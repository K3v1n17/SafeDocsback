# 🧪 Script de Pruebas para Endpoints de Compartir

## 📋 **Pruebas con curl - Reemplaza TOKEN con tu token real**

### 1. **Buscar usuarios para compartir**
```bash
# Buscar por nombre
curl -X GET "http://localhost:3001/share/search-users?q=juan" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Buscar por empresa
curl -X GET "http://localhost:3001/share/search-users?q=empresa" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Búsqueda muy corta (debería dar error)
curl -X GET "http://localhost:3001/share/search-users?q=ju" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### 2. **Ver documentos compartidos conmigo**
```bash
curl -X GET "http://localhost:3001/documentos/shared-with-me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### 3. **Ver usuarios que tienen acceso a un documento**
```bash
# Reemplaza DOCUMENT_ID con un ID real de tu documento
curl -X GET "http://localhost:3001/share/document-users/DOCUMENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### 4. **Crear un compartir seguro**
```bash
# Reemplaza DOCUMENT_ID y TARGET_USER_ID con IDs reales
curl -X POST "http://localhost:3001/documentos/DOCUMENT_ID/secure-share" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "sharedWithUserId": "TARGET_USER_ID",
    "title": "Documento compartido de prueba",
    "message": "Esto es una prueba",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

---

## 🔧 **Problemas Comunes y Soluciones**

### ❌ **Error: "Bad Request"**
**Causa**: Problema en el query de Supabase
**Solución**: ✅ Ya corregido en el servicio

### ❌ **Error: "No users found"**
**Causa**: No hay usuarios en la tabla `profiles`
**Solución**: Insertar datos de prueba

### ❌ **Error: "No tienes permisos"**
**Causa**: Políticas RLS bloqueando acceso
**Solución**: Verificar políticas (ver abajo)

---

## 🗄️ **Insertar Datos de Prueba**

### **1. Insertar perfiles de prueba en Supabase SQL Editor:**
```sql
-- Insertar perfiles de prueba (reemplaza UUIDs con IDs reales de auth.users)
INSERT INTO public.profiles (user_id, full_name, company, avatar_url) VALUES
('11111111-1111-1111-1111-111111111111', 'Juan Pérez', 'Empresa ABC', null),
('22222222-2222-2222-2222-222222222222', 'María García', 'Tech Solutions', null),
('33333333-3333-3333-3333-333333333333', 'Carlos López', 'Innovación SA', null);
```

### **2. Verificar usuarios existentes:**
```sql
-- Ver todos los usuarios registrados
SELECT 
  au.id,
  au.email,
  p.full_name,
  p.company
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
ORDER BY au.created_at DESC;
```

---

## 🔒 **Verificar Políticas RLS**

### **1. Verificar políticas de `profiles`:**
```sql
-- Ver políticas actuales
SELECT 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'profiles';
```

### **2. Crear política si no existe:**
```sql
-- Permitir que usuarios autenticados vean profiles (para búsqueda)
CREATE POLICY "Authenticated users can view profiles for sharing" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);
```

### **3. Verificar políticas de `document_shares`:**
```sql
-- Ver políticas de document_shares
SELECT 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'document_shares';
```

### **4. Crear políticas de document_shares si no existen:**
```sql
-- Usuarios pueden ver shares donde son destinatarios
CREATE POLICY "Users can view shares directed to them" 
ON public.document_shares FOR SELECT 
TO authenticated 
USING (shared_with_user_id = auth.uid() AND is_active = true);

-- Usuarios pueden gestionar shares que crearon
CREATE POLICY "Users can manage their own shares" 
ON public.document_shares FOR ALL 
TO authenticated 
USING (created_by = auth.uid());
```

---

## 🧪 **Pasos para Probar Completo**

### **Paso 1: Preparar datos**
1. Ejecutar scripts SQL de inserción
2. Verificar que tienes al menos 2 usuarios con profiles
3. Verificar políticas RLS

### **Paso 2: Obtener token**
1. Login en tu frontend
2. Copiar el token del localStorage o cookies
3. Usar en los curl commands

### **Paso 3: Probar búsqueda**
```bash
# Reemplaza YOUR_TOKEN_HERE con tu token real
curl -X GET "http://localhost:3001/share/search-users?q=juan" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### **Paso 4: Verificar respuesta esperada**
```json
{
  "users": [
    {
      "id": "user-uuid",
      "name": "Juan Pérez",
      "company": "Empresa ABC",
      "avatar": null
    }
  ]
}
```

---

## 🔍 **Debug en caso de errores**

### **1. Verificar logs del backend:**
```bash
# En la consola donde corre NestJS
# Buscar logs como:
# "🍪 Token obtenido de cookies en ShareController"
# "Error searching users:"
```

### **2. Verificar en Supabase Dashboard:**
1. Ir a Logs → API
2. Filtrar por errores
3. Ver qué queries están fallando

### **3. Verificar datos:**
```sql
-- Contar profiles
SELECT COUNT(*) FROM public.profiles;

-- Ver si tu usuario tiene profile
SELECT * FROM public.profiles WHERE user_id = 'tu-user-id';
```
