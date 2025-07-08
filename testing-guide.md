# 🔧 CONFIGURACIÓN PARA PROBAR PERMISOS DE DOCUMENTOS

## Endpoints disponibles:

### 1. Obtener todos los documentos (filtrados por propietario)
```
GET http://localhost:3001/documentos
Authorization: Bearer YOUR_JWT_TOKEN
```

### 2. Obtener MIS documentos específicamente
```
GET http://localhost:3001/documentos/my-documents
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Obtener un documento específico
```
GET http://localhost:3001/documentos/{document_id}
Authorization: Bearer YOUR_JWT_TOKEN
```

### 4. Crear un nuevo documento
```
POST http://localhost:3001/documentos
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Mi documento de prueba",
  "description": "Documento para probar permisos",
  "doc_type": "pdf",
  "tags": ["prueba", "personal"],
  "mime_type": "application/pdf",
  "file_size": 1024,
  "file_path": "/uploads/test.pdf",
  "checksum_sha256": "abc123def456"
}
```

## Cómo probar:

### Opción 1: Con curl
```bash
# Reemplaza YOUR_JWT_TOKEN con tu token real
curl -X GET http://localhost:3001/documentos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Opción 2: Con el script de Node.js
```bash
# Edita el archivo test-documents-api.js y pon tu token
node test-documents-api.js
```

### Opción 3: Con Postman
1. Importa la colección existente: `postman-collection.json`
2. Agrega el header `Authorization: Bearer YOUR_JWT_TOKEN`
3. Prueba los endpoints

## Comportamiento esperado:

### ✅ CORRECTO:
- Solo deberías ver documentos donde `owner_id` = tu user ID
- Los endpoints deberían devolver arrays vacíos si no tienes documentos
- No deberías ver documentos de otros usuarios

### ❌ INCORRECTO:
- Ver documentos de todos los usuarios
- Error 403 o 401 con token válido
- Error 500 en el servidor

## Troubleshooting:

### Si ves documentos de otros usuarios:
- Las políticas RLS no están aplicadas
- Ejecuta el script `setup-documents-rls.sql` en Supabase

### Si ves array vacío pero deberías tener documentos:
- Verifica que el `owner_id` en la base de datos coincida con tu user ID
- Chequea que el token sea válido

### Si obtienes error 401:
- El token ha expirado
- El token es inválido
- El guard de autenticación no está funcionando

## Obtener tu token JWT:

### Desde el navegador:
```javascript
// En la consola del navegador
localStorage.getItem('supabase.auth.token')
```

### Desde Supabase:
```javascript
// En tu código frontend
const { data: { session } } = await supabase.auth.getSession();
console.log(session?.access_token);
```
