-- 🔐 HABILITAR RLS EN TODAS LAS TABLAS FALTANTES
-- ¡CRÍTICO! Ejecutar inmediatamente en Supabase SQL Editor

-- ===========================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ===========================================

-- 1. Tabla document_shares
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- 2. Tabla document_share_participants  
ALTER TABLE document_share_participants ENABLE ROW LEVEL SECURITY;

-- 3. Tabla document_share_messages
ALTER TABLE document_share_messages ENABLE ROW LEVEL SECURITY;

-- 4. Tabla document_share_views
ALTER TABLE document_share_views ENABLE ROW LEVEL SECURITY;

-- 5. Tabla document_verifications
ALTER TABLE document_verifications ENABLE ROW LEVEL SECURITY;

-- 6. Tabla history
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- POLÍTICAS BÁSICAS DE SEGURIDAD
-- ===========================================

-- DOCUMENT_SHARES: Solo el creador puede ver sus compartidos
CREATE POLICY "document_shares_owner" ON document_shares
    FOR ALL USING (auth.uid() = created_by);

-- DOCUMENT_SHARE_PARTICIPANTS: Solo participantes y creador
CREATE POLICY "document_share_participants_access" ON document_share_participants
    FOR ALL USING (
        auth.uid() = user_id OR 
        auth.email() = email OR
        EXISTS (
            SELECT 1 FROM document_shares ds 
            WHERE ds.id = share_id 
            AND ds.created_by = auth.uid()
        )
    );

-- DOCUMENT_SHARE_MESSAGES: Solo participantes del share
CREATE POLICY "document_share_messages_participants" ON document_share_messages
    FOR ALL USING (
        auth.uid() = sender_id OR
        EXISTS (
            SELECT 1 FROM document_share_participants dsp 
            WHERE dsp.share_id = document_share_messages.share_id 
            AND (dsp.user_id = auth.uid() OR dsp.email = auth.email())
        )
    );

-- DOCUMENT_SHARE_VIEWS: Solo el dueño del share puede ver las vistas
CREATE POLICY "document_share_views_owner" ON document_share_views
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM document_shares ds 
            WHERE ds.id = share_id 
            AND ds.created_by = auth.uid()
        )
    );

-- DOCUMENT_VERIFICATIONS: Solo el dueño del documento y quien ejecutó
CREATE POLICY "document_verifications_access" ON document_verifications
    FOR ALL USING (
        auth.uid() = run_by OR
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = document_id 
            AND d.owner_id = auth.uid()
        )
    );

-- HISTORY: Solo el usuario puede ver su propio historial
CREATE POLICY "history_own_user" ON history
    FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Ver el estado de RLS en todas las tablas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'documents',
    'document_shares',
    'document_share_participants',
    'document_share_messages', 
    'document_share_views',
    'document_verifications',
    'history'
)
ORDER BY tablename;

-- Comentario
COMMENT ON SCHEMA public IS 'RLS habilitado en todas las tablas críticas - ' || NOW();
