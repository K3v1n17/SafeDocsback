-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear tabla de roles de usuario
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Crear tabla de tokens de compartición
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  document_id UUID NOT NULL, -- Asegúrate de que coincida con tu tabla de documentos
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID REFERENCES auth.users(id), -- Opcional
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  allowed_ips TEXT[], -- Array de IPs permitidas
  permissions TEXT[] DEFAULT ARRAY['document:read:shared'],
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_document_id ON public.share_tokens(document_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_shared_by ON public.share_tokens(shared_by);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON public.share_tokens(expires_at);

-- 4. Crear políticas RLS (Row Level Security)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- Política para user_roles: solo el usuario puede ver su propio rol
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Política para share_tokens: solo el creador puede gestionar sus tokens
CREATE POLICY "Users can manage their own share tokens" ON public.share_tokens
  FOR ALL USING (auth.uid() = shared_by);

-- Política para share_tokens: usuarios pueden ver tokens compartidos con ellos
CREATE POLICY "Users can view tokens shared with them" ON public.share_tokens
  FOR SELECT USING (auth.uid() = shared_with OR shared_with IS NULL);

-- 5. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Crear trigger para user_roles
CREATE TRIGGER handle_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Insertar tu usuario como administrador (cambia el email)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'kevin.lema3@hotmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 8. Crear función para asignar rol por defecto a nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Crear trigger para asignar rol automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
