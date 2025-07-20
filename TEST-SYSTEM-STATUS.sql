-- ============================================================================
-- SCRIPT DE PRUEBAS PARA EL SISTEMA DE COMPARTIR DOCUMENTOS
-- ============================================================================

-- 1. VERIFICAR ESTADO ACTUAL DE LAS POLÍTICAS
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('document_shares', 'documents')
ORDER BY tablename, policyname;

-- 2. VERIFICAR ESTADO DE RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity = true THEN '🟢 RLS HABILITADO'
        ELSE '🔴 RLS DESHABILITADO'
    END as estado_rls
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('document_shares', 'documents')
ORDER BY tablename;

-- 3. VERIFICAR FUNCIONES DISPONIBLES
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

-- 4. VERIFICAR ESTRUCTURA DE TABLAS
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('document_shares', 'documents')
ORDER BY table_name, ordinal_position;

-- 5. CONTAR REGISTROS EXISTENTES
SELECT 
    'documents' as tabla,
    COUNT(*) as total_registros
FROM public.documents
UNION ALL
SELECT 
    'document_shares' as tabla,
    COUNT(*) as total_registros
FROM public.document_shares;

-- MENSAJE DE ESTADO
DO $$
BEGIN
    RAISE NOTICE '🔧 VERIFICACIÓN DEL SISTEMA DE COMPARTIR DOCUMENTOS';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PASOS COMPLETADOS:';
    RAISE NOTICE '✅ Errores de TypeScript corregidos en documentos.service.ts';
    RAISE NOTICE '✅ Consultas SQL optimizadas';
    RAISE NOTICE '✅ Mapeo de datos corregido';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 LISTO PARA EJECUTAR:';
    RAISE NOTICE '1. Ejecutar CREATE-SECURE-RLS-POLICIES.sql';
    RAISE NOTICE '2. Probar endpoints /shared-with-me y /simple-share';
    RAISE NOTICE '3. Verificar permisos y expiración';
END $$;
