-- 🔍 INVESTIGAR LA VISTA user_profile
-- Ejecutar en Supabase SQL Editor para ver qué está expuesto

-- 1. Ver la definición de la vista
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'user_profile';

-- 2. Ver los permisos de la vista
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE table_name = 'user_profile';

-- 3. Ver si realmente existe
SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'user_profile' 
    AND table_schema = 'public'
);

-- 4. Si existe, ver qué columnas expone
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profile' 
AND table_schema = 'public';
