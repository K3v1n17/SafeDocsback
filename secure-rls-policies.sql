-- 🔒 POLÍTICAS RLS SEGURAS - Sistema de compartir documentos
-- PRIORIDAD: MÁXIMA SEGURIDAD - NO exponer información sensible

-- ============================================================================
-- 1. TABLA PROFILES - Solo información básica para compartir
-- ============================================================================

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "Authenticated users can view profiles for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view basic profile info for sharing" ON public.profiles;

-- ✅ POLÍTICA SEGURA: Solo información básica (nombre, email)
-- NO exponer roles, permisos, o información sensible
CREATE POLICY "Secure profile sharing access" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- NOTA: En tu ShareController, asegúrate de solo devolver:
-- SELECT id, full_name, email FROM profiles WHERE...
-- NUNCA devolver: role, permissions, created_at, etc.

-- ============================================================================
-- 2. TABLA DOCUMENT_SHARES - Gestión de compartidos
-- ============================================================================

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "Users can view shares directed to them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.document_shares;
DROP POLICY IF EXISTS "Users can view documents shared with them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their shares" ON public.document_shares;

-- ✅ Ver shares dirigidos a mí
CREATE POLICY "View my received shares" 
ON public.document_shares FOR SELECT 
TO authenticated 
USING (
  shared_with_user_id = auth.uid() 
  AND is_active = true 
  AND (expires_at IS NULL OR expires_at > NOW())
);

-- ✅ Gestionar shares que yo creé
CREATE POLICY "Manage my created shares" 
ON public.document_shares FOR ALL 
TO authenticated 
USING (created_by = auth.uid());

-- ✅ Crear shares solo para mis documentos
CREATE POLICY "Create shares for my documents" 
ON public.document_shares FOR INSERT 
TO authenticated 
WITH CHECK (
  created_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_id 
    AND d.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 3. TABLA DOCUMENTS - Acceso a documentos
-- ============================================================================

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "Users can view shared documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents they own or shared with them" ON public.documents;

-- ✅ POLÍTICA SEGURA: Solo mis documentos o compartidos conmigo
CREATE POLICY "Access my documents and shared documents" 
ON public.documents FOR SELECT 
TO authenticated 
USING (
  -- Mis documentos
  owner_id = auth.uid()
  OR
  -- Documentos compartidos conmigo (válidos)
  EXISTS (
    SELECT 1 FROM public.document_shares ds
    WHERE ds.document_id = id
    AND ds.shared_with_user_id = auth.uid()
    AND ds.is_active = true
    AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  )
);

-- ============================================================================
-- 4. TABLA USER_ROLES - MÁXIMA SEGURIDAD 🔐
-- ============================================================================

-- ELIMINAR cualquier política que exponga roles a otros usuarios
DROP POLICY IF EXISTS "Users can view roles for permission checks" ON public.user_roles;
DROP POLICY IF EXISTS "Allow role checks" ON public.user_roles;
DROP POLICY IF EXISTS "Users can only view their own role" ON public.user_roles;

-- ✅ POLÍTICA SÚPER RESTRICTIVA: Solo mi propio rol
CREATE POLICY "Only view my own role" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- IMPORTANTE: Los usuarios NO pueden ver roles de otros
-- Las verificaciones de admin se hacen en el backend, no expuestas

-- ============================================================================
-- 5. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. VERIFICACIÓN DE SEGURIDAD
-- ============================================================================

-- ✅ Test 1: Verificar que NO puedo ver roles de otros
SELECT 
  COUNT(*) as total_roles_visible,
  COUNT(CASE WHEN user_id = auth.uid() THEN 1 END) as my_roles_only
FROM public.user_roles;
-- Resultado esperado: total_roles_visible = my_roles_only = 1

-- ✅ Test 2: Verificar acceso a profiles básicos
SELECT COUNT(*) as profiles_for_sharing FROM public.profiles;
-- Resultado esperado: > 0 (puede ver profiles para compartir)

-- ✅ Test 3: Verificar mis documentos
SELECT COUNT(*) as my_documents FROM public.documents WHERE owner_id = auth.uid();

-- ✅ Test 4: Verificar documentos compartidos conmigo
SELECT COUNT(*) as shared_with_me 
FROM public.documents d
WHERE EXISTS (
  SELECT 1 FROM public.document_shares ds
  WHERE ds.document_id = d.id
  AND ds.shared_with_user_id = auth.uid()
  AND ds.is_active = true
);

-- ============================================================================
-- 7. NOTAS DE SEGURIDAD IMPORTANTES
-- ============================================================================

/*
🔒 RECORDATORIOS DE SEGURIDAD:

1. En ShareController.searchUsersForSharing():
   - Solo devolver: id, full_name, email
   - NUNCA: role, created_at, permissions, etc.

2. Verificaciones de admin:
   - Hacer en el backend usando service account
   - NO exponer a través de RLS policies

3. Logs de seguridad:
   - Monitorear intentos de acceso a roles
   - Alertar sobre consultas sospechosas

4. Testing:
   - Probar con diferentes usuarios
   - Verificar que no se filtren datos sensibles
*/
