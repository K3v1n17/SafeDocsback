-- ============================================================================
-- VERIFICAR TODAS LAS POLÍTICAS RLS EN TABLAS RELACIONADAS
-- ============================================================================

-- 1. VERIFICAR POLÍTICAS SOLO EN TABLAS DE SHARING (NO DOCUMENTS)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN (
    'document_shares', 
    'document_share_views',
    'document_share_participants',
    'document_share_messages'
)
ORDER BY tablename, policyname;

-- 2. VERIFICAR ESTADO RLS SOLO EN TABLAS DE SHARING (NO DOCUMENTS)
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
  AND tablename IN (
    'document_shares', 
    'document_share_views',
    'document_share_participants',
    'document_share_messages'
)
ORDER BY tablename;

-- 3. VERIFICAR FUNCIONES RELACIONADAS CON DOCUMENT SHARING
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE '%document%'
   OR p.proname LIKE '%share%'
ORDER BY schema_name, function_name;

-- MENSAJE INFORMATIVO
DO $$
BEGIN
    RAISE NOTICE '📊 REPORTE DE POLÍTICAS RLS - SOLO TABLAS DE SHARING';
    RAISE NOTICE 'Verificando solo tablas de document sharing...';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tablas verificadas (SIN TOCAR documents):';
    RAISE NOTICE '- document_shares';
    RAISE NOTICE '- document_share_views';
    RAISE NOTICE '- document_share_participants';
    RAISE NOTICE '- document_share_messages';
    RAISE NOTICE '';
    RAISE NOTICE '🚫 NO SE TOCAN las políticas de la tabla documents';
END $$;
