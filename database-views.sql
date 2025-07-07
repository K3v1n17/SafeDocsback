-- Vista para obtener información completa de usuarios
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear vista que combina auth.users con user_roles
CREATE OR REPLACE VIEW public.users_with_roles AS
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.created_at as account_created_at,
  au.updated_at as account_updated_at,
  au.email_confirmed_at,
  au.last_sign_in_at,
  ur.role,
  ur.created_at as role_assigned_at,
  ur.updated_at as role_updated_at,
  CASE 
    WHEN ur.role IS NULL THEN 'pending_role_assignment'
    ELSE 'active'
  END as status
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC;

-- 2. Crear vista solo para usuarios pendientes
CREATE OR REPLACE VIEW public.pending_users AS
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.created_at as account_created_at,
  'pending_role_assignment' as status
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.role IS NULL
ORDER BY au.created_at DESC;

-- 3. Crear políticas RLS para las vistas
ALTER VIEW public.users_with_roles SET (security_invoker = true);
ALTER VIEW public.pending_users SET (security_invoker = true);

-- 4. Crear función para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_id AND role = 'admin'
  );
END;
$$;

-- 5. Crear políticas para las vistas (solo admins pueden ver)
CREATE POLICY "Admins can view all users with roles" ON public.users_with_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view pending users" ON public.pending_users
  FOR SELECT USING (public.is_admin(auth.uid()));

-- 6. Habilitar RLS en las vistas
ALTER VIEW public.users_with_roles ENABLE ROW LEVEL SECURITY;
ALTER VIEW public.pending_users ENABLE ROW LEVEL SECURITY;
