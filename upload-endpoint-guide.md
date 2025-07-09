# Guía de Upload de Documentos - Backend

## Endpoint de Upload

**POST** `/documentos/upload`

### Headers requeridos:
```
Authorization: Bearer <token_jwt>
Content-Type: multipart/form-data
```

### Parámetros:

#### Archivo (requerido):
- **field name**: `file`
- **tipos permitidos**: PDF, DOC, DOCX, TXT, JPG, PNG, GIF
- **tamaño máximo**: 10MB

#### Metadata (opcional):
- **title** o **titulo**: Título del documento
- **description** o **contenido**: Descripción del documento
- **doc_type** o **tipo**: Tipo de documento
- **tags**: Array de etiquetas (JSON)
- **etiquetas**: String JSON con etiquetas (para compatibilidad con frontend)

### Ejemplo de uso con FormData:

```javascript
const formData = new FormData();
formData.append('file', fileObject);
formData.append('title', 'Mi Documento');
formData.append('description', 'Descripción del documento');
formData.append('doc_type', 'pdf');
formData.append('tags', JSON.stringify(['tag1', 'tag2']));

fetch('/documentos/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Ejemplo de uso con compatibilidad frontend anterior:

```javascript
const formData = new FormData();
formData.append('file', fileObject);
formData.append('titulo', 'Mi Documento');
formData.append('contenido', 'Descripción del documento');
formData.append('tipo', 'pdf');
formData.append('etiquetas', '["tag1", "tag2"]');

fetch('/documentos/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Funcionalidades implementadas:

1. **Subida de archivos**: Se suben al bucket `archivos` de Supabase
2. **Generación de checksum**: Se calcula SHA256 del archivo
3. **Verificación inicial**: Se crea un registro de verificación automáticamente
4. **Validaciones**: Tipo de archivo y tamaño máximo
5. **Nombres únicos**: Se usa timestamp + nombre original
6. **Estructura de carpetas**: `public/{user_id}/{timestamp}_{filename}`
7. **Metadatos**: Se guardan título, descripción, tipo y etiquetas
8. **Seguridad**: RLS de Supabase controla los permisos

## Respuesta exitosa:

```json
{
  "id": "uuid-del-documento",
  "owner_id": "uuid-del-usuario",
  "title": "Título del documento",
  "description": "Descripción",
  "doc_type": "pdf",
  "tags": ["tag1", "tag2"],
  "mime_type": "application/pdf",
  "file_size": 12345,
  "file_path": "public/user-id/timestamp_filename.pdf",
  "file_url": "https://supabase-url/storage/v1/object/public/archivos/...",
  "checksum_sha256": "hash-sha256",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

## Errores comunes:

- **400**: No se envió archivo
- **400**: Tipo de archivo no permitido
- **400**: Archivo muy grande (>10MB)
- **401**: Token inválido
- **500**: Error interno del servidor

## Migración desde frontend directo:

El endpoint es compatible con el formato anterior del frontend, manteniendo tanto los nombres nuevos (`title`, `description`, `doc_type`, `tags`) como los anteriores (`titulo`, `contenido`, `tipo`, `etiquetas`) para una transición suave.
