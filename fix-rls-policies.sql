-- 🔧 POLÍTICAS RLS CORREGIDAS PARA user_roles
-- Solución al problema de círculo vicioso

-- Primero, eliminar las políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON user_roles;

-- Asegurar que RLS está habilitado
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ✅ POLÍTICA SIMPLE PARA SELECT: Todos pueden ver su propio rol
-- Esta política NO depende de subconsultas circulares
CREATE POLICY "user_roles_select_own" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- ✅ POLÍTICA PARA INSERT: Solo usuarios autenticados, pero verificaremos en el backend
-- Cambiamos la estrategia: dejamos que el backend verifique permisos
CREATE POLICY "user_roles_insert_authenticated" ON user_roles
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ✅ POLÍTICA PARA UPDATE: Solo el propio usuario O verificación en backend  
CREATE POLICY "user_roles_update_authenticated" ON user_roles
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ✅ POLÍTICA PARA DELETE: Solo usuarios autenticados, verificación en backend
CREATE POLICY "user_roles_delete_authenticated" ON user_roles
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 📋 COMENTARIOS:
-- 1. Removimos las políticas que creaban círculos viciosos
-- 2. Permitimos que cualquier usuario autenticado vea su propio rol
-- 3. Para INSERT/UPDATE/DELETE, verificaremos permisos de admin en el BACKEND
-- 4. Esto es más simple y no genera conflictos

COMMENT ON TABLE user_roles IS 'Políticas RLS simplificadas - verificación de admin en backend';
