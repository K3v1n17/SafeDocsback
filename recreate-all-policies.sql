-- 🔧 SCRIPT DE REPARACIÓN COMPLETA - Solo recrear políticas existentes
-- Ejecutar en Supabase SQL Editor línea por línea si es necesario

-- ============================================================================
-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Allow profile search for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Users can view basic profile info for sharing" ON public.profiles;

-- Document Shares
DROP POLICY IF EXISTS "View my received shares" ON public.document_shares;
DROP POLICY IF EXISTS "Manage my created shares" ON public.document_shares;
DROP POLICY IF EXISTS "Create shares for my documents" ON public.document_shares;
DROP POLICY IF EXISTS "Users can view shares directed to them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.document_shares;

-- Documents
DROP POLICY IF EXISTS "Access owned and shared documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents they own or shared with them" ON public.documents;

-- User Roles
DROP POLICY IF EXISTS "Restrict to own role only" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles for permission checks" ON public.user_roles;
DROP POLICY IF EXISTS "Users can only view their own role" ON public.user_roles;

-- ============================================================================
-- 2. RECREAR POLÍTICAS SEGURAS
-- ============================================================================

-- ✅ PROFILES: Solo información básica para compartir
CREATE POLICY "profiles_secure_sharing"
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- ✅ DOCUMENT_SHARES: Ver shares dirigidos a mí
CREATE POLICY "shares_view_received"
ON public.document_shares FOR SELECT 
TO authenticated 
USING (
  shared_with_user_id = auth.uid() 
  AND is_active = true 
  AND (expires_at IS NULL OR expires_at > NOW())
);

-- ✅ DOCUMENT_SHARES: Gestionar shares que yo creé
CREATE POLICY "shares_manage_created"
ON public.document_shares FOR ALL 
TO authenticated 
USING (created_by = auth.uid());

-- ✅ DOCUMENT_SHARES: Crear shares solo para mis documentos
CREATE POLICY "shares_create_own_docs"
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

-- ✅ DOCUMENTS: Acceso a mis documentos y compartidos
CREATE POLICY "documents_access_owned_shared"
ON public.documents FOR SELECT 
TO authenticated 
USING (
  owner_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.document_shares ds
    WHERE ds.document_id = id
    AND ds.shared_with_user_id = auth.uid()
    AND ds.is_active = true
    AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  )
);

-- ✅ USER_ROLES: MÁXIMA SEGURIDAD - Solo mi propio rol
CREATE POLICY "roles_own_only"
ON public.user_roles FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- ============================================================================
-- 3. HABILITAR RLS (por si acaso)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. VERIFICACIÓN FINAL
-- ============================================================================

-- Ver todas las políticas creadas
SELECT 
  tablename, 
  policyname
FROM pg_policies 
WHERE tablename IN ('profiles', 'document_shares', 'documents', 'user_roles')
ORDER BY tablename, policyname;

-- Test de seguridad
SELECT COUNT(*) as "Profiles disponibles" FROM public.profiles;
SELECT COUNT(*) as "Solo mi rol visible" FROM public.user_roles;
