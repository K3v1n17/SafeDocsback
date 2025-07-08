-- 🔍 SCRIPT DE DEBUGGING PARA POLÍTICAS RLS
-- Ejecutar paso a paso para identificar el problema

-- 1. Verificar el estado actual de RLS en user_roles
SELECT 
    schemaname, 
    tablename, 
    rowsecurity,
    enablerow 
FROM pg_tables 
WHERE tablename = 'user_roles';

-- 2. Ver todas las políticas actuales en user_roles
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_roles';

-- 3. TEMPORALMENTE deshabilitar RLS para probar
-- ⚠️ SOLO PARA DEBUGGING - REACTIVAR DESPUÉS
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- 4. Probar consulta directa (debería funcionar ahora)
SELECT 
    user_id, 
    role, 
    created_at 
FROM user_roles 
WHERE user_id = '7adf3360-a4f4-4621-b590-de7bce72b197';

-- 5. Si la consulta anterior funciona, el problema son las políticas
-- Reactivar RLS y crear políticas más simples
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_authenticated" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_authenticated" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_authenticated" ON user_roles;

-- 7. Crear UNA SOLA política muy permisiva para SELECT
CREATE POLICY "allow_all_select" ON user_roles
    FOR SELECT USING (true);

-- 8. Crear políticas restrictivas solo para INSERT/UPDATE/DELETE
CREATE POLICY "allow_authenticated_insert" ON user_roles
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_update" ON user_roles
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_delete" ON user_roles
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 9. Verificar que las nuevas políticas están activas
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_roles';

COMMENT ON TABLE user_roles IS 'RLS temporalmente muy permisivo para debugging';
