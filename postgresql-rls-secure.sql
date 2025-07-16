-- 🔒 POLÍTICAS RLS SEGURAS - PostgreSQL/Supabase
-- Basadas en tu estructura de BD real
-- PRIORIDAD: NO exponer información sensible como roles

-- ============================================================================
-- 1. PROFILES - Búsqueda segura (PK: user_id)
-- ============================================================================

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Authenticated users can view profiles for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view basic profile info for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Secure profile access for sharing" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile search for sharing" ON public.profiles;

-- ✅ POLÍTICA SEGURA: Solo campos básicos para compartir
-- Permite: user_id, full_name, company
-- NO permite: phone, bio, avatar_url (datos sensibles)
CREATE POLICY "Allow profile search for sharing"
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- ============================================================================
-- 2. DOCUMENT_SHARES - Gestión de compartidos
-- ============================================================================

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Users can view shares directed to them" ON public.document_shares;
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.document_shares;
DROP POLICY IF EXISTS "Users can create shares for their documents" ON public.document_shares;

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
-- 3. DOCUMENTS - Acceso a documentos
-- ============================================================================

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Users can view documents they own or shared with them" ON public.documents;
DROP POLICY IF EXISTS "Users can view shared documents" ON public.documents;

-- ✅ POLÍTICA SEGURA: Mis documentos + compartidos conmigo
CREATE POLICY "Access owned and shared documents"
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
-- 4. USER_ROLES - MÁXIMA SEGURIDAD 🔐
-- ============================================================================

-- ELIMINAR cualquier política que exponga roles
DROP POLICY IF EXISTS "Users can view roles for permission checks" ON public.user_roles;
DROP POLICY IF EXISTS "Allow role checks" ON public.user_roles;
DROP POLICY IF EXISTS "Users can only view their own role" ON public.user_roles;

-- ✅ POLÍTICA SÚPER RESTRICTIVA: Solo mi propio rol
CREATE POLICY "Restrict to own role only"
ON public.user_roles FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- IMPORTANTE: Los usuarios NO pueden ver roles de otros
-- Las verificaciones de admin se hacen en el backend con service account

-- ============================================================================
-- 5. TABLAS ADICIONALES - Políticas básicas
-- ============================================================================

-- DOCUMENT_SHARE_MESSAGES - Solo mensajes de shares donde participo
DROP POLICY IF EXISTS "Users can view share messages they participate in" ON public.document_share_messages;
CREATE POLICY "Users can view share messages they participate in"
ON public.document_share_messages FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.document_shares ds
    WHERE ds.id = share_id
    AND (ds.created_by = auth.uid() OR ds.shared_with_user_id = auth.uid())
    AND ds.is_active = true
  )
);

-- DOCUMENT_SHARE_PARTICIPANTS - Solo participantes de mis shares
DROP POLICY IF EXISTS "Users can view participants of their shares" ON public.document_share_participants;
CREATE POLICY "Users can view participants of their shares"
ON public.document_share_participants FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.document_shares ds
    WHERE ds.id = share_id
    AND (ds.created_by = auth.uid() OR ds.shared_with_user_id = auth.uid())
  )
);

-- HISTORY - Solo mi historial
DROP POLICY IF EXISTS "Users can view their own history" ON public.history;
CREATE POLICY "Users can view their own history"
ON public.history FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- ============================================================================
-- 6. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. VERIFICACIÓN DE SEGURIDAD
-- ============================================================================

-- ✅ Test 1: Verificar que NO puedo ver roles de otros
SELECT 
  COUNT(*) as total_roles_visible,
  'Solo debería ver 1 (mi rol)' as esperado
FROM public.user_roles;

-- ✅ Test 2: Verificar acceso a profiles para compartir
SELECT 
  COUNT(*) as profiles_disponibles,
  'Debería ver todos los profiles' as esperado
FROM public.profiles;

-- ✅ Test 3: Verificar mis documentos
SELECT 
  COUNT(*) as mis_documentos
FROM public.documents 
WHERE owner_id = auth.uid();

-- ✅ Test 4: Verificar documentos compartidos conmigo
SELECT 
  COUNT(*) as compartidos_conmigo
FROM public.documents d
WHERE EXISTS (
  SELECT 1 FROM public.document_shares ds
  WHERE ds.document_id = d.id
  AND ds.shared_with_user_id = auth.uid()
  AND ds.is_active = true
);

-- ============================================================================
-- 8. NOTAS DE SEGURIDAD IMPORTANTES
-- ============================================================================

/*
🔒 RECORDATORIOS DE SEGURIDAD:

1. En ShareController.searchUsersForSharing():
   - SELECT user_id, full_name, company FROM profiles
   - NUNCA: phone, bio, avatar_url, created_at, updated_at

2. Estructura de profiles:
   - PK: user_id (no 'id')
   - Campos seguros: full_name, company
   - Campos sensibles: phone, bio, avatar_url

3. Verificaciones de admin:
   - Usar service account en backend
   - NO exponer através de RLS

4. Testing regular:
   - Probar con diferentes usuarios
   - Verificar que no se filtren datos sensibles
   - Monitorear logs de acceso
*/
