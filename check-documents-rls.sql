-- 🔍 VERIFICAR ESTADO DE RLS EN LA TABLA DOCUMENTS
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si RLS está habilitado en documents
SELECT 
    schemaname, 
    tablename, 
    rowsecurity
FROM pg_tables 
WHERE tablename = 'documents';

-- 2. Ver políticas actuales en documents (si las hay)
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'documents';

-- 3. Si NO hay políticas, significa que TODOS pueden ver TODOS los documentos
-- Si SÍ hay RLS habilitado sin políticas, NADIE puede ver documentos

-- 4. Para permitir que admin vea todos los documentos, necesitamos:
-- OPCIÓN A: Deshabilitar RLS (menos seguro)
-- ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- OPCIÓN B: Crear políticas específicas (más seguro)
-- Ver próximo archivo para políticas completas
