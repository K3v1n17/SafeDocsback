-- ============================================================================
-- SCRIPT SIMPLE PARA ARREGLAR POLÍTICAS RLS
-- ============================================================================

-- 1. ELIMINAR TODAS LAS POLÍTICAS PROBLEMÁTICAS (INCLUYENDO LAS QUE DETECTÓ SUPABASE)
DROP POLICY IF EXISTS "View my received shares" ON public.document_shares;
DROP POLICY IF EXISTS "Manage my created shares" ON public.document_shares;
DROP POLICY IF EXISTS "Document owners manage shares" ON public.document_shares;
DROP POLICY IF EXISTS "Users can view documents they own or shared with them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.document_shares;
DROP POLICY IF EXISTS "create_shares_for_my_docs" ON public.document_shares;
DROP POLICY IF EXISTS "manage_my_created_shares" ON public.document_shares;
DROP POLICY IF EXISTS "view_my_received_shares" ON public.document_shares;

-- 2. DESHABILITAR RLS TEMPORALMENTE EN DOCUMENT_SHARES
ALTER TABLE public.document_shares DISABLE ROW LEVEL SECURITY;

-- 2.1 VERIFICAR QUE RLS ESTÁ DESHABILITADO
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'document_shares';

-- 3. VERIFICAR QUE NO HAY POLÍTICAS ACTIVAS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'document_shares';

-- 4. ELIMINAR SOLO LAS FUNCIONES QUE CAUSAN PROBLEMAS DE RECURSIÓN
-- (MANTENEMOS document_shares_set_token y generate_share_token que funcionan bien)
DROP FUNCTION IF EXISTS grant_document_share_access(UUID, UUID, UUID, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_document_share_access(UUID, UUID);
DROP FUNCTION IF EXISTS cleanup_expired_document_shares();

-- 4.1 VERIFICAR QUE LAS FUNCIONES ÚTILES SIGUEN DISPONIBLES
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('document_shares_set_token', 'generate_share_token')
ORDER BY schema_name, function_name;

-- 5. VERIFICAR EL ESTADO DE LA TABLA
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'document_shares';

-- MENSAJE FINAL
DO $$
BEGIN
    RAISE NOTICE '✅ SCRIPT COMPLETADO';
    RAISE NOTICE 'Políticas eliminadas: create_shares_for_my_docs, manage_my_created_shares, view_my_received_shares';
    RAISE NOTICE 'RLS deshabilitado en document_shares';
    RAISE NOTICE 'Los endpoints deberían funcionar correctamente';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ADVERTENCIA DE SEGURIDAD:';
    RAISE NOTICE 'Sin RLS, todos los usuarios autenticados pueden ver todos los shares';
    RAISE NOTICE 'Esto es TEMPORAL mientras solucionamos el problema';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Probar los endpoints /shared-with-me y /simple-share';
    RAISE NOTICE '2. Verificar que funcionan correctamente';
    RAISE NOTICE '3. Más tarde implementaremos RLS seguro';
END $$;
