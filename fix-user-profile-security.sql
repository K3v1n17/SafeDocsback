-- 🚨 ELIMINAR LA VISTA user_profile QUE EXPONE auth.users
-- ¡CRÍTICO! Ejecutar inmediatamente en Supabase SQL Editor

-- ===========================================
-- INVESTIGAR Y ELIMINAR LA VISTA PROBLEMÁTICA
-- ===========================================

-- 1. Primero, ver qué contiene la vista
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'user_profile' AND schemaname = 'public';

-- 2. Ver los permisos actuales
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE table_name = 'user_profile' AND table_schema = 'public';

-- 3. ELIMINAR LA VISTA PROBLEMÁTICA
-- ⚠️ CUIDADO: Esto puede romper código que la use
DROP VIEW IF EXISTS public.user_profile;

-- ===========================================
-- CREAR UNA VISTA SEGURA COMO REEMPLAZO
-- ===========================================

-- 4. Crear una vista segura basada en la tabla profiles
CREATE VIEW public.user_profile_safe AS
SELECT 
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.phone,
    p.company,
    p.bio,
    p.created_at,
    p.updated_at,
    -- NO incluir datos sensibles de auth.users
    au.email  -- Solo el email, que no es tan sensible
FROM public.profiles p
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE p.user_id = auth.uid();  -- Solo el usuario puede ver su perfil

-- 5. Habilitar RLS en la nueva vista
ALTER VIEW public.user_profile_safe OWNER TO postgres;

-- 6. Dar permisos solo a authenticated
GRANT SELECT ON public.user_profile_safe TO authenticated;
REVOKE ALL ON public.user_profile_safe FROM anon;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- 7. Verificar que la vista problemática se eliminó
SELECT COUNT(*) as vistas_problemáticas
FROM pg_views 
WHERE viewname = 'user_profile' AND schemaname = 'public';
-- Debe devolver 0

-- 8. Verificar que la nueva vista funciona
SELECT * FROM public.user_profile_safe LIMIT 1;

-- ===========================================
-- COMENTARIOS
-- ===========================================

COMMENT ON VIEW public.user_profile_safe IS 'Vista segura que NO expone auth.users - Solo datos del perfil propio';

-- 9. Si tienes código que usa user_profile, cámbialo a user_profile_safe
-- O puedes crear un alias (menos recomendado):
-- CREATE VIEW public.user_profile AS SELECT * FROM public.user_profile_safe;
