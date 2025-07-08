-- 🔐 CONFIGURAR POLÍTICAS RLS PARA LA TABLA DOCUMENTS
-- Este script configurará las políticas de seguridad a nivel de fila para documents

-- 1. Habilitar RLS en la tabla documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "documents_owner_select" ON documents;
DROP POLICY IF EXISTS "documents_owner_insert" ON documents;
DROP POLICY IF EXISTS "documents_owner_update" ON documents;
DROP POLICY IF EXISTS "documents_owner_delete" ON documents;
DROP POLICY IF EXISTS "documents_admin_all" ON documents;
DROP POLICY IF EXISTS "documents_shared_read" ON documents;

-- 3. POLÍTICA PRINCIPAL: Solo el propietario puede ver sus documentos
CREATE POLICY "documents_owner_select" ON documents
    FOR SELECT USING (
        auth.uid() = owner_id
    );

-- 4. POLÍTICA PARA INSERT: Solo usuarios autenticados pueden crear documentos
-- y solo pueden crear documentos donde ellos son el owner
CREATE POLICY "documents_owner_insert" ON documents
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id
    );

-- 5. POLÍTICA PARA UPDATE: Solo el propietario puede actualizar sus documentos
CREATE POLICY "documents_owner_update" ON documents
    FOR UPDATE USING (
        auth.uid() = owner_id
    );

-- 6. POLÍTICA PARA DELETE: Solo el propietario puede eliminar sus documentos
CREATE POLICY "documents_owner_delete" ON documents
    FOR DELETE USING (
        auth.uid() = owner_id
    );

-- 7. POLÍTICA ADICIONAL: Permitir que admins vean todos los documentos
-- (Solo si existe un sistema de roles)
CREATE POLICY "documents_admin_all" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 8. POLÍTICA FUTURA: Documentos compartidos (para implementar después)
-- CREATE POLICY "documents_shared_read" ON documents
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM document_shares ds
--             JOIN document_share_participants dsp ON ds.id = dsp.share_id
--             WHERE ds.document_id = documents.id
--             AND (dsp.user_id = auth.uid() OR dsp.email = auth.email())
--             AND ds.is_active = true
--             AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
--         )
--     );

-- 9. Comentarios para verificación
COMMENT ON TABLE documents IS 'RLS habilitado: Solo propietarios y admins pueden acceder';

-- 10. Script de verificación
-- SELECT * FROM documents; -- Debería mostrar solo documentos del usuario actual
-- SELECT auth.uid(); -- Para verificar el ID del usuario actual
