-- ============================================================================
-- POLÍTICAS RLS SEGURAS PARA COMPARTIR DOCUMENTOS
-- ============================================================================

-- 1. HABILITAR RLS EN DOCUMENT_SHARES
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- 2. CREAR POLÍTICAS PARA DOCUMENT_SHARES

-- 2.1 POLÍTICA: Los usuarios pueden ver sus propios shares (que han creado)
CREATE POLICY "users_can_view_own_created_shares" ON public.document_shares
    FOR SELECT
    USING (created_by = auth.uid());

-- 2.2 POLÍTICA: Los usuarios pueden ver shares que han sido compartidos con ellos
CREATE POLICY "users_can_view_received_shares" ON public.document_shares
    FOR SELECT
    USING (
        shared_with_user_id = auth.uid() 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- 2.3 POLÍTICA: Los usuarios pueden crear shares para sus propios documentos
CREATE POLICY "users_can_create_shares_for_own_docs" ON public.document_shares
    FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.documents 
            WHERE id = document_id 
            AND owner_id = auth.uid()
        )
    );

-- 2.4 POLÍTICA: Los usuarios pueden actualizar sus propios shares
CREATE POLICY "users_can_update_own_shares" ON public.document_shares
    FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- 2.5 POLÍTICA: Los usuarios pueden eliminar sus propios shares
CREATE POLICY "users_can_delete_own_shares" ON public.document_shares
    FOR DELETE
    USING (created_by = auth.uid());

-- 3. CREAR POLÍTICAS PARA DOCUMENTS (ACCESO COMPARTIDO)

-- 3.1 POLÍTICA: Los usuarios pueden ver documentos que les han compartido
CREATE POLICY "users_can_view_shared_documents" ON public.documents
    FOR SELECT
    USING (
        owner_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.document_shares ds
            WHERE ds.document_id = id
            AND ds.shared_with_user_id = auth.uid()
            AND ds.is_active = true
            AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
        )
    );

-- 4. CREAR FUNCIÓN PARA VERIFICAR PERMISOS DE COMPARTIR
CREATE OR REPLACE FUNCTION public.check_document_share_permission(
    doc_id UUID,
    user_id UUID,
    required_permission TEXT DEFAULT 'read'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    share_permission TEXT;
    share_active BOOLEAN;
    share_expired BOOLEAN;
BEGIN
    -- Verificar si el usuario es el propietario del documento
    IF EXISTS (
        SELECT 1 FROM public.documents 
        WHERE id = doc_id AND owner_id = user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar si tiene un share activo
    SELECT 
        ds.permission_level,
        ds.is_active,
        (ds.expires_at IS NOT NULL AND ds.expires_at <= NOW())
    INTO share_permission, share_active, share_expired
    FROM public.document_shares ds
    WHERE ds.document_id = doc_id 
    AND ds.shared_with_user_id = user_id;
    
    -- Si no hay share, no tiene permisos
    IF share_permission IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Si el share no está activo o expiró, no tiene permisos
    IF NOT share_active OR share_expired THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar nivel de permisos
    CASE required_permission
        WHEN 'read' THEN
            RETURN share_permission IN ('read', 'write', 'admin');
        WHEN 'write' THEN
            RETURN share_permission IN ('write', 'admin');
        WHEN 'admin' THEN
            RETURN share_permission = 'admin';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

-- 5. CREAR FUNCIÓN PARA LIMPIAR SHARES EXPIRADOS
CREATE OR REPLACE FUNCTION public.cleanup_expired_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Desactivar shares expirados
    UPDATE public.document_shares 
    SET is_active = false
    WHERE expires_at IS NOT NULL 
    AND expires_at <= NOW() 
    AND is_active = true;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$;

-- 6. CREAR TRIGGER PARA LIMPIAR SHARES EXPIRADOS AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_shares()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ejecutar limpieza cada vez que se consulta la tabla
    PERFORM public.cleanup_expired_shares();
    RETURN NEW;
END;
$$;

-- No crear el trigger por ahora para evitar problemas de rendimiento
-- CREATE TRIGGER cleanup_expired_shares_trigger
--     BEFORE SELECT ON public.document_shares
--     FOR EACH STATEMENT
--     EXECUTE FUNCTION public.trigger_cleanup_expired_shares();

-- 7. VERIFICAR POLÍTICAS CREADAS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('document_shares', 'documents')
ORDER BY tablename, policyname;

-- 8. VERIFICAR FUNCIONES CREADAS
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN (
    'check_document_share_permission',
    'cleanup_expired_shares',
    'generate_share_token',
    'document_shares_set_token'
)
ORDER BY schema_name, function_name;

-- MENSAJE FINAL
DO $$
BEGIN
    RAISE NOTICE '✅ POLÍTICAS RLS SEGURAS CREADAS';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 POLÍTICAS DOCUMENT_SHARES:';
    RAISE NOTICE '- users_can_view_own_created_shares: Ver shares que he creado';
    RAISE NOTICE '- users_can_view_received_shares: Ver shares que me han compartido';
    RAISE NOTICE '- users_can_create_shares_for_own_docs: Crear shares de mis documentos';
    RAISE NOTICE '- users_can_update_own_shares: Actualizar mis shares';
    RAISE NOTICE '- users_can_delete_own_shares: Eliminar mis shares';
    RAISE NOTICE '';
    RAISE NOTICE '📄 POLÍTICAS DOCUMENTS:';
    RAISE NOTICE '- users_can_view_shared_documents: Ver documentos compartidos conmigo';
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  FUNCIONES CREADAS:';
    RAISE NOTICE '- check_document_share_permission(): Verificar permisos de share';
    RAISE NOTICE '- cleanup_expired_shares(): Limpiar shares expirados';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Probar los endpoints con RLS habilitado';
    RAISE NOTICE '2. Verificar que los permisos funcionan correctamente';
    RAISE NOTICE '3. Probar expiración de shares';
END $$;
