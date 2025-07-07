-- Verificar políticas actuales en user_roles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'user_roles';

-- Verificar si RLS está habilitado
SELECT schemaname, tablename, rowsecurity, forcerowsecurity FROM pg_tables WHERE tablename = 'user_roles';
