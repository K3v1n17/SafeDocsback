-- 🔧 Script para adaptar el código a tu esquema existente
-- NO ejecutar, solo para referencia

-- Tu tabla document_shares ya existe y está bien diseñada
-- Solo necesitamos agregar RLS policies si no las tienes

-- 1. Habilitar RLS en document_shares (si no está habilitado)
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- 2. Policies para document_shares (adaptadas a tu estructura)
CREATE POLICY "Users can create shares for their documents" ON public.document_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d 
      WHERE d.id = document_id 
      AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their shares" ON public.document_shares
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can update their shares" ON public.document_shares
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their shares" ON public.document_shares
  FOR DELETE USING (created_by = auth.uid());

-- 3. Policy para acceso público via token (opcional)
CREATE POLICY "Public access via valid token" ON public.document_shares
  FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- 4. Agregar campo user_id para compartir directo con usuarios (OPCIONAL)
-- Solo si quieres también el enfoque user-based
ALTER TABLE public.document_shares 
ADD COLUMN shared_with_user_id UUID REFERENCES auth.users(id);

-- 5. Policy para usuarios compartidos específicos
CREATE POLICY "Users can view documents shared with them" ON public.document_shares
  FOR SELECT USING (
    shared_with_user_id = auth.uid() 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  );
