# PRUEBAS DE ENDPOINTS - SISTEMA DE COMPARTIR DOCUMENTOS

## 🧪 COLLECTION PARA POSTMAN/INSOMNIA

### 1. **Obtener documentos compartidos conmigo**
```
GET {{baseUrl}}/documentos/shared-with-me
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

### 2. **Compartir un documento (Simple Share)**
```
POST {{baseUrl}}/documentos/simple-share
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "documentId": "{{documentId}}",
  "sharedWithUserId": "{{targetUserId}}",
  "permissionLevel": "read",
  "expiresInHours": 24,
  "shareTitle": "Documento compartido desde API",
  "shareMessage": "Te comparto este documento para que lo revises"
}
```

### 3. **Ver mis documentos compartidos**
```
GET {{baseUrl}}/documentos/my-shared
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

### 4. **Verificar permisos de un documento**
```
GET {{baseUrl}}/documentos/{{documentId}}/permission-check?permission=read
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

### 5. **Obtener documento con verificación de permisos**
```
GET {{baseUrl}}/documentos/{{documentId}}/with-permission-check
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

### 6. **Revocar un share**
```
DELETE {{baseUrl}}/documentos/shares/{{shareId}}/revoke
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

### 7. **Limpiar shares expirados**
```
POST {{baseUrl}}/documentos/cleanup-expired
```
**Headers:**
```
Cookie: access_token={{httpOnlyToken}}
```

## 📋 VARIABLES DE ENTORNO

```
baseUrl = http://localhost:3000/api
httpOnlyToken = tu_token_desde_cookies_httponly
documentId = uuid_del_documento
targetUserId = uuid_del_usuario_objetivo
shareId = uuid_del_share
```

## 🔍 RESPUESTAS ESPERADAS

### GET /shared-with-me
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "document_id": "uuid",
      "title": "Documento compartido",
      "description": "Descripción del documento",
      "doc_type": "pdf",
      "permission_level": "read",
      "shared_by": "uuid",
      "expires_at": "2025-07-19T10:30:00Z",
      "is_expired": false,
      "created_at": "2025-07-18T10:30:00Z",
      "share_token": "token",
      "document": {
        "id": "uuid",
        "title": "Título original",
        "description": "Descripción original",
        "doc_type": "pdf",
        "created_at": "2025-07-18T09:00:00Z",
        "owner_id": "uuid"
      }
    }
  ]
}
```

### POST /simple-share
```json
{
  "success": true,
  "message": "Documento compartido exitosamente",
  "share": {
    "id": "uuid",
    "document_id": "uuid",
    "shared_with_user_id": "uuid",
    "created_by": "uuid",
    "share_token": "token",
    "title": "Título del share",
    "message": "Mensaje del share",
    "permission_level": "read",
    "expires_at": "2025-07-19T10:30:00Z",
    "is_active": true,
    "created_at": "2025-07-18T10:30:00Z"
  },
  "share_token": "token"
}
```

### GET /my-shared
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "document_id": "uuid",
      "shared_with_user_id": "uuid",
      "share_token": "token",
      "title": "Documento compartido",
      "message": "Mensaje del share",
      "expires_at": "2025-07-19T10:30:00Z",
      "is_active": true,
      "created_at": "2025-07-18T10:30:00Z",
      "documents": {
        "title": "Título original",
        "doc_type": "pdf"
      }
    }
  ]
}
```

### GET /permission-check
```json
{
  "success": true,
  "hasPermission": true,
  "documentId": "uuid",
  "userId": "uuid",
  "permission": "read"
}
```

## 🚨 ERRORES COMUNES

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solución**: Verificar que el token esté correcto y no haya expirado.

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "No tienes permisos para ver este documento"
}
```
**Solución**: Verificar que el usuario tenga permisos para el documento.

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Document with ID xxx not found"
}
```
**Solución**: Verificar que el ID del documento sea correcto.

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)"
}
```
**Solución**: Verificar que todos los UUIDs estén en el formato correcto.

## 📱 EJEMPLO DE INTEGRACIÓN JAVASCRIPT

```javascript
// Configuración base
const API_BASE = 'http://localhost:3000/api';
const token = localStorage.getItem('supabase-token');

// Función para hacer requests
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return await response.json();
}

// Obtener documentos compartidos conmigo
async function getSharedWithMe() {
  return await apiRequest('/documentos/shared-with-me');
}

// Compartir un documento
async function shareDocument(documentId, targetUserId, options = {}) {
  return await apiRequest('/documentos/simple-share', {
    method: 'POST',
    body: JSON.stringify({
      documentId,
      sharedWithUserId: targetUserId,
      permissionLevel: options.permission || 'read',
      expiresInHours: options.expiresInHours || 24,
      shareTitle: options.title,
      shareMessage: options.message
    })
  });
}

// Usar las funciones
getSharedWithMe().then(result => {
  console.log('Documentos compartidos:', result.data);
});

shareDocument('doc-uuid', 'user-uuid', {
  permission: 'read',
  expiresInHours: 48,
  title: 'Documento importante',
  message: 'Revisa este documento urgente'
}).then(result => {
  console.log('Documento compartido:', result);
});
```
