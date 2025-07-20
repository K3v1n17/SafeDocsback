-- ============================================================================
-- SISTEMA DE ACCESO TEMPORAL A DOCUMENTOS
-- ============================================================================

-- 1. Tabla para gestionar accesos temporales por documento
CREATE TABLE IF NOT EXISTS document_temporary_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información del acceso
    access_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    permission_level TEXT NOT NULL DEFAULT 'view', -- 'view', 'download', 'edit'
    
    -- Metadata
    share_title TEXT,
    share_message TEXT,
    
    -- Control de tiempo
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE, -- Última vez que accedió
    access_count INTEGER DEFAULT 0,
    
    -- Restricciones
    UNIQUE(document_id, shared_with_user_id) -- Un usuario solo puede tener un acceso activo por documento
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_document_temporary_access_document_id ON document_temporary_access(document_id);
CREATE INDEX IF NOT EXISTS idx_document_temporary_access_shared_with ON document_temporary_access(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_document_temporary_access_token ON document_temporary_access(access_token);
CREATE INDEX IF NOT EXISTS idx_document_temporary_access_expires ON document_temporary_access(expires_at);
CREATE INDEX IF NOT EXISTS idx_document_temporary_access_active ON document_temporary_access(is_active);

-- 3. Función para limpiar accesos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_document_access()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Desactivar accesos expirados
    UPDATE document_temporary_access 
    SET is_active = false, updated_at = NOW()
    WHERE expires_at < NOW() AND is_active = true;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Políticas RLS para document_temporary_access
ALTER TABLE document_temporary_access ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "Users can view their received access" ON document_temporary_access;
DROP POLICY IF EXISTS "Users can manage access they created" ON document_temporary_access;
DROP POLICY IF EXISTS "Document owners can manage access" ON document_temporary_access;

-- Ver accesos que me fueron otorgados
CREATE POLICY "View my received document access"
ON document_temporary_access FOR SELECT
TO authenticated
USING (
    shared_with_user_id = auth.uid() 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
);

-- Gestionar accesos que yo creé
CREATE POLICY "Manage document access I created"
ON document_temporary_access FOR ALL
TO authenticated
USING (shared_by_user_id = auth.uid());

-- Los dueños de documentos pueden gestionar todos los accesos a sus documentos
CREATE POLICY "Document owners manage all access"
ON document_temporary_access FOR ALL
TO authenticated
USING (
    document_id IN (
        SELECT id FROM documents WHERE user_id = auth.uid()
    )
);

-- 5. Función para otorgar acceso temporal
CREATE OR REPLACE FUNCTION grant_document_access(
    p_document_id UUID,
    p_shared_with_user_id UUID,
    p_shared_by_user_id UUID,
    p_permission_level TEXT DEFAULT 'view',
    p_expires_in_hours INTEGER DEFAULT 24,
    p_share_title TEXT DEFAULT NULL,
    p_share_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_access_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_result JSON;
BEGIN
    -- Calcular fecha de expiración
    v_expires_at := NOW() + (p_expires_in_hours || ' hours')::INTERVAL;
    
    -- Insertar o actualizar acceso (UPSERT)
    INSERT INTO document_temporary_access (
        document_id,
        shared_with_user_id,
        shared_by_user_id,
        permission_level,
        expires_at,
        share_title,
        share_message
    ) VALUES (
        p_document_id,
        p_shared_with_user_id,
        p_shared_by_user_id,
        p_permission_level,
        v_expires_at,
        p_share_title,
        p_share_message
    )
    ON CONFLICT (document_id, shared_with_user_id)
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        expires_at = EXCLUDED.expires_at,
        share_title = EXCLUDED.share_title,
        share_message = EXCLUDED.share_message,
        is_active = true,
        updated_at = NOW(),
        access_token = encode(gen_random_bytes(32), 'hex')
    RETURNING access_token INTO v_access_token;
    
    -- Crear respuesta JSON
    v_result := json_build_object(
        'success', true,
        'access_token', v_access_token,
        'expires_at', v_expires_at,
        'permission_level', p_permission_level,
        'message', 'Acceso otorgado exitosamente'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Error al otorgar acceso'
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Función para verificar acceso
CREATE OR REPLACE FUNCTION verify_document_access(
    p_document_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_access RECORD;
    v_result JSON;
BEGIN
    -- Buscar acceso activo
    SELECT * INTO v_access
    FROM document_temporary_access
    WHERE document_id = p_document_id
    AND shared_with_user_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
    
    IF FOUND THEN
        -- Actualizar contador de accesos
        UPDATE document_temporary_access
        SET access_count = access_count + 1,
            accessed_at = NOW()
        WHERE id = v_access.id;
        
        v_result := json_build_object(
            'has_access', true,
            'permission_level', v_access.permission_level,
            'expires_at', v_access.expires_at,
            'access_count', v_access.access_count + 1
        );
    ELSE
        v_result := json_build_object(
            'has_access', false,
            'message', 'No tienes acceso a este documento'
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_document_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_access_updated_at
    BEFORE UPDATE ON document_temporary_access
    FOR EACH ROW
    EXECUTE FUNCTION update_document_access_updated_at();

-- 8. Crear un job para limpiar accesos expirados (requiere pg_cron)
-- SELECT cron.schedule('cleanup-expired-document-access', '0 */6 * * *', 'SELECT cleanup_expired_document_access();');

COMMENT ON TABLE document_temporary_access IS 'Gestiona accesos temporales a documentos con roles específicos y fecha de expiración';
COMMENT ON FUNCTION grant_document_access IS 'Otorga acceso temporal a un documento con permisos específicos';
COMMENT ON FUNCTION verify_document_access IS 'Verifica si un usuario tiene acceso activo a un documento';
COMMENT ON FUNCTION cleanup_expired_document_access IS 'Desactiva accesos expirados automáticamente';
