-- ============================================================================
-- ADAPTACIÓN DE DOCUMENT_SHARES EXISTENTE
-- ============================================================================

-- 1. Expandir permission_level para incluir más opciones
ALTER TABLE public.document_shares 
DROP CONSTRAINT IF EXISTS document_shares_permission_level_check;

-- Agregar nuevos tipos de permisos
ALTER TABLE public.document_shares 
ADD CONSTRAINT document_shares_permission_level_check 
CHECK (permission_level::text = ANY (ARRAY[
    'read'::character varying,
    'comment'::character varying, 
    'view'::character varying,
    'download'::character varying,
    'edit'::character varying
]::text[]));

-- 2. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_with_user_id 
ON public.document_shares(shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_document_shares_active_expires 
ON public.document_shares(is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_document_shares_document_user 
ON public.document_shares(document_id, shared_with_user_id);

-- 3. Función para limpiar accesos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_document_shares()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Desactivar shares expirados
    UPDATE document_shares 
    SET is_active = false
    WHERE expires_at < NOW() AND is_active = true;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para otorgar acceso temporal usando document_shares
CREATE OR REPLACE FUNCTION grant_document_share_access(
    p_document_id UUID,
    p_shared_with_user_id UUID,
    p_shared_by_user_id UUID,
    p_permission_level TEXT DEFAULT 'read',
    p_expires_in_hours INTEGER DEFAULT 24,
    p_share_title TEXT DEFAULT NULL,
    p_share_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_share_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_share_id UUID;
    v_result JSON;
BEGIN
    -- Generar token único
    v_share_token := encode(gen_random_bytes(32), 'hex');
    
    -- Calcular fecha de expiración
    v_expires_at := NOW() + (p_expires_in_hours || ' hours')::INTERVAL;
    
    -- Insertar o actualizar share (UPSERT)
    INSERT INTO document_shares (
        document_id,
        shared_with_user_id,
        created_by,
        share_token,
        title,
        message,
        permission_level,
        expires_at,
        is_active
    ) VALUES (
        p_document_id,
        p_shared_with_user_id,
        p_shared_by_user_id,
        v_share_token,
        p_share_title,
        p_share_message,
        p_permission_level,
        v_expires_at,
        true
    )
    ON CONFLICT (document_id, shared_with_user_id) -- Asumiendo que agregas esta constraint
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        expires_at = EXCLUDED.expires_at,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        is_active = true,
        share_token = EXCLUDED.share_token
    RETURNING id, share_token INTO v_share_id, v_share_token;
    
    -- Si no hay constraint, hacer UPDATE manual
    IF v_share_id IS NULL THEN
        -- Buscar share existente
        SELECT id INTO v_share_id 
        FROM document_shares 
        WHERE document_id = p_document_id 
        AND shared_with_user_id = p_shared_with_user_id;
        
        IF v_share_id IS NOT NULL THEN
            -- Actualizar existente
            UPDATE document_shares SET
                permission_level = p_permission_level,
                expires_at = v_expires_at,
                title = p_share_title,
                message = p_share_message,
                is_active = true,
                share_token = v_share_token
            WHERE id = v_share_id;
        END IF;
    END IF;
    
    -- Crear respuesta JSON
    v_result := json_build_object(
        'success', true,
        'share_id', v_share_id,
        'share_token', v_share_token,
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

-- 5. Función para verificar acceso usando document_shares
CREATE OR REPLACE FUNCTION verify_document_share_access(
    p_document_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_share RECORD;
    v_result JSON;
BEGIN
    -- Buscar share activo
    SELECT * INTO v_share
    FROM document_shares
    WHERE document_id = p_document_id
    AND shared_with_user_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
    
    IF FOUND THEN
        -- Registrar vista
        INSERT INTO document_share_views (share_id, viewer_id, viewed_at)
        VALUES (v_share.id, p_user_id, NOW());
        
        v_result := json_build_object(
            'has_access', true,
            'permission_level', v_share.permission_level,
            'expires_at', v_share.expires_at,
            'share_token', v_share.share_token
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

-- 6. Agregar constraint único para evitar duplicados (opcional)
-- ALTER TABLE document_shares 
-- ADD CONSTRAINT unique_document_user_share 
-- UNIQUE(document_id, shared_with_user_id);

-- 7. Políticas RLS mejoradas para document_shares
DROP POLICY IF EXISTS "Users can view shares directed to them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.document_shares;

-- Ver shares dirigidos a mí (activos y no expirados)
CREATE POLICY "View my received shares" 
ON public.document_shares FOR SELECT 
TO authenticated 
USING (
    shared_with_user_id = auth.uid() 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
);

-- Gestionar shares que yo creé
CREATE POLICY "Manage my created shares" 
ON public.document_shares FOR ALL 
TO authenticated 
USING (created_by = auth.uid());

-- Los dueños de documentos pueden gestionar todos los shares
CREATE POLICY "Document owners manage shares" 
ON public.document_shares FOR ALL 
TO authenticated 
USING (
    document_id IN (
        SELECT id FROM documents WHERE owner_id = auth.uid()
    )
);

COMMENT ON FUNCTION grant_document_share_access IS 'Otorga acceso temporal usando la tabla document_shares existente';
COMMENT ON FUNCTION verify_document_share_access IS 'Verifica acceso usando document_shares y registra la vista';
COMMENT ON FUNCTION cleanup_expired_document_shares IS 'Limpia shares expirados';
