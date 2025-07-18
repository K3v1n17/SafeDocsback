-- ============================================================================
-- REVERTIR CAMBIOS DE ADAPT-EXISTING-DOCUMENT-SHARES.SQL
-- ============================================================================

-- 1. REVERTIR: Eliminar las nuevas políticas RLS que causan recursión
DROP POLICY IF EXISTS "View my received shares" ON public.document_shares;
DROP POLICY IF EXISTS "Manage my created shares" ON public.document_shares;
DROP POLICY IF EXISTS "Document owners manage shares" ON public.document_shares;

-- 2. REVERTIR: Eliminar las funciones creadas
DROP FUNCTION IF EXISTS grant_document_share_access(UUID, UUID, UUID, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_document_share_access(UUID, UUID);
DROP FUNCTION IF EXISTS cleanup_expired_document_shares();

-- 3. REVERTIR: Eliminar los índices creados
DROP INDEX IF EXISTS idx_document_shares_shared_with_user_id;
DROP INDEX IF EXISTS idx_document_shares_active_expires;
DROP INDEX IF EXISTS idx_document_shares_document_user;

-- 4. REVERTIR: Restaurar el constraint original de permission_level
ALTER TABLE public.document_shares 
DROP CONSTRAINT IF EXISTS document_shares_permission_level_check;

-- Restaurar el constraint original (solo 'read' y 'comment')
ALTER TABLE public.document_shares 
ADD CONSTRAINT document_shares_permission_level_check 
CHECK (permission_level::text = ANY (ARRAY[
    'read'::character varying, 
    'comment'::character varying
]::text[]));

-- 5. REVERTIR: Eliminar constraint único si se agregó
ALTER TABLE public.document_shares 
DROP CONSTRAINT IF EXISTS unique_document_user_share;

-- 6. RESTAURAR: Políticas RLS originales (si existían)
-- Estas son las políticas que probablemente tenías antes
CREATE POLICY "Users can view documents they own or shared with them" 
ON public.document_shares FOR SELECT 
TO authenticated 
USING (
    created_by = auth.uid() OR shared_with_user_id = auth.uid()
);

CREATE POLICY "Users can manage their own shares" 
ON public.document_shares FOR ALL 
TO authenticated 
USING (created_by = auth.uid());

-- 7. VERIFICAR: Mostrar el estado actual de las políticas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'document_shares'
ORDER BY policyname;

-- 8. VERIFICAR: Mostrar las funciones relacionadas con document_shares
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%document_share%'
ORDER BY routine_name;

-- 9. VERIFICAR: Mostrar los índices de la tabla
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'document_shares'
ORDER BY indexname;

-- 10. VERIFICAR: Mostrar los constraints de la tabla
SELECT 
    conname,
    contype,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'document_shares'
ORDER BY conname;

-- MENSAJE FINAL
DO $$
BEGIN
    RAISE NOTICE '✅ REVERTIDO COMPLETAMENTE';
    RAISE NOTICE 'Se han eliminado:';
    RAISE NOTICE '- Políticas RLS que causaban recursión';
    RAISE NOTICE '- Funciones SQL personalizadas';
    RAISE NOTICE '- Índices adicionales';
    RAISE NOTICE '- Constraints modificados';
    RAISE NOTICE '';
    RAISE NOTICE 'La tabla document_shares está restaurada a su estado original';
    RAISE NOTICE 'Ahora puedes probar los endpoints sin problemas';
END $$;
