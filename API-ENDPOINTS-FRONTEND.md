# 📚 API Endpoints - Sistema de Documentos Seguros

## 🔐 Autenticación
Todos los endpoints requieren autenticación. El sistema usa **HttpOnly cookies** automáticamente.

**Base URL**: `http://localhost:3000/documentos`

---

## 📄 Gestión de Documentos

### 1. Subir Documento
```http
POST /documentos/upload
Content-Type: multipart/form-data
```

**Body (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'Mi Documento');
formData.append('description', 'Descripción del documento');
formData.append('doc_type', 'report'); // report, contract, invoice, other
formData.append('tags', 'tag1,tag2,tag3');
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Mi Documento",
  "file_path": "path/to/file",
  "checksum": "sha256_hash",
  "verification": {
    "id": "uuid",
    "status": "verified"
  }
}
```

### 2. Obtener Mis Documentos
```http
GET /documentos/my-documents
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Documento 1",
    "description": "...",
    "doc_type": "report",
    "file_size": 1024,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### 3. Obtener Documento por ID
```http
GET /documentos/:id
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Documento",
  "description": "...",
  "file_path": "path/to/file",
  "owner_id": "user_uuid",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 4. Actualizar Documento
```http
PATCH /documentos/:id
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "tags": ["tag1", "tag2"]
}
```

### 5. Eliminar Documento
```http
DELETE /documentos/:id
```

---

## 🔗 Sistema de Compartir Seguro

### 6. Crear Compartir Seguro (Requiere Usuario Registrado)
```http
POST /documentos/:documentId/secure-share
Content-Type: application/json
```

**Body:**
```json
{
  "sharedWithUserId": "uuid_del_usuario_destino",
  "title": "Documento compartido contigo",
  "message": "Mensaje personalizado",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "share_uuid",
  "document_id": "doc_uuid",
  "shared_with_user_id": "user_uuid",
  "share_token": "secure_token_hash",
  "title": "Documento compartido contigo",
  "message": "Mensaje personalizado",
  "expires_at": "2025-12-31T23:59:59Z",
  "permission_level": "read",
  "share_url": "https://frontend.com/shared/secure_token_hash"
}
```

### 7. Acceder a Documento Compartido (Solo Usuario Autorizado)
```http
GET /documentos/shared/:shareToken
```

**Response:**
```json
{
  "share": {
    "id": "share_uuid",
    "title": "Documento compartido contigo",
    "message": "Mensaje personalizado",
    "permission_level": "read",
    "created_at": "2025-01-01T00:00:00Z",
    "expires_at": "2025-12-31T23:59:59Z"
  },
  "document": {
    "id": "doc_uuid",
    "title": "Documento Original",
    "description": "...",
    "doc_type": "report",
    "file_size": 1024,
    "signed_file_url": "https://supabase.co/storage/signed_url_temporal"
  }
}
```

### 8. Obtener Documentos Compartidos Conmigo
```http
GET /documentos/shared-with-me
```

**Response:**
```json
[
  {
    "id": "share_uuid",
    "share_token": "token_hash",
    "title": "Documento compartido contigo",
    "message": "Mensaje del propietario",
    "expires_at": "2025-12-31T23:59:59Z",
    "created_at": "2025-01-01T00:00:00Z",
    "documents": {
      "title": "Documento Original",
      "description": "...",
      "doc_type": "report"
    }
  }
]
```

### 9. Revocar Compartir
```http
DELETE /documentos/shares/:shareId/revoke
```

**Response:** `204 No Content`

---

## 📋 Búsqueda y Filtros

### 10. Buscar por Tags
```http
GET /documentos/tags?tags=tag1,tag2,tag3
```

### 11. Obtener Compartidos de un Documento
```http
GET /documentos/:id/shares
```

**Response:**
```json
[
  {
    "id": "share_uuid",
    "shared_with_user_id": "user_uuid",
    "title": "Compartido con Usuario",
    "created_at": "2025-01-01T00:00:00Z",
    "expires_at": "2025-12-31T23:59:59Z",
    "is_active": true
  }
]
```

---

## 🚀 Ejemplos de Uso Frontend

### Upload de Documento
```javascript
const uploadDocument = async (file, metadata) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', metadata.title);
  formData.append('description', metadata.description);
  formData.append('doc_type', metadata.doc_type);
  formData.append('tags', metadata.tags.join(','));

  const response = await fetch('/documentos/upload', {
    method: 'POST',
    credentials: 'include', // ✅ Importante para cookies
    body: formData
  });

  return response.json();
};
```

### Compartir Documento Seguro
```javascript
const shareDocument = async (documentId, targetUserId) => {
  const response = await fetch(`/documentos/${documentId}/secure-share`, {
    method: 'POST',
    credentials: 'include', // ✅ Importante para cookies
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sharedWithUserId: targetUserId,
      title: 'Documento importante',
      message: 'Te comparto este documento para revisión',
      expiresAt: '2025-12-31T23:59:59Z'
    })
  });

  return response.json();
};
```

### Acceder a Documento Compartido
```javascript
const accessSharedDocument = async (shareToken) => {
  const response = await fetch(`/documentos/shared/${shareToken}`, {
    credentials: 'include' // ✅ Importante para cookies
  });

  if (response.ok) {
    const data = await response.json();
    // data.document.signed_file_url contiene la URL temporal del archivo
    return data;
  }
  
  throw new Error('No autorizado o documento no encontrado');
};
```

### Obtener Documentos Compartidos Conmigo
```javascript
const getSharedWithMe = async () => {
  const response = await fetch('/documentos/shared-with-me', {
    credentials: 'include' // ✅ Importante para cookies
  });

  return response.json();
};
```

---

## 🔒 Seguridad Implementada

1. **HttpOnly Cookies**: Los tokens se manejan automáticamente
2. **Usuario Registrado Requerido**: Solo usuarios del sistema pueden ver documentos compartidos
3. **Token + Usuario**: Doble validación para máxima seguridad
4. **URLs Firmadas Temporales**: Los archivos se acceden con URLs que expiran
5. **RLS Policies**: Supabase controla el acceso a nivel de base de datos
6. **Verificación de Checksums**: Integridad de archivos garantizada

## ⚠️ Importante

- **Sempre usar `credentials: 'include'`** en fetch para cookies
- Los tokens de compartir son únicos y seguros (SHA256)
- Los usuarios deben estar registrados en el sistema para ver documentos
- Las URLs firmadas expiran en 1 hora
- Solo el dueño puede compartir y revocar compartidos
