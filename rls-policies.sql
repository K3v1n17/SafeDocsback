-- Políticas RLS para user_roles
-- Solo los admins pueden insertar/actualizar/eliminar roles

-- Primero, habilitamos RLS en la tabla user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: todos pueden ver su propio rol
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Política para SELECT: admins pueden ver todos los roles
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Política para INSERT: solo admins pueden insertar roles
CREATE POLICY "Only admins can insert roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Política para UPDATE: solo admins pueden actualizar roles
CREATE POLICY "Only admins can update roles" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Política para DELETE: solo admins pueden eliminar roles
CREATE POLICY "Only admins can delete roles" ON user_roles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- IMPORTANTE: Para que el primer admin pueda ser asignado, necesitamos hacer esto manualmente:
-- INSERT INTO user_roles (user_id, role) VALUES ('tu-user-id-aqui', 'admin');
