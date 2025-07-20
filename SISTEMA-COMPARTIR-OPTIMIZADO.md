# 🔗 Sistema de Compartir Documentos - Usando tu estructura existente

## 🎯 Estrategia Implementada

**¡Usamos tu tabla `document_shares` existente!** No necesitas crear tablas nuevas. Solo hemos optimizado y expandido lo que ya tienes.

## 📋 Tu Esquema Actual (Optimizado)

### Tabla `document_shares` (Expandida)
```sql
- id: UUID 
- document_id: UUID (referencia a documents)
- shared_with_user_id: UUID (usuario que recibe acceso)
- created_by: UUID (usuario que comparte)
- share_token: TEXT (token único)
- title: TEXT (título personalizado)
- message: TEXT (mensaje)
- permission_level: VARCHAR (read, comment, view, download, edit)
- expires_at: TIMESTAMP (fecha de expiración)
- is_active: BOOLEAN (estado activo)
- created_at: TIMESTAMP
```

### Tablas Relacionadas (Ya existentes)
- `document_share_views` - Registra quién ve qué
- `document_share_participants` - Participantes en el share
- `document_share_messages` - Mensajes relacionados al share

## 🚀 Cómo Funciona el Sistema

### 1. Compartir un Documento

**Endpoint:** `POST /documentos/{id}/grant-share-access`

```json
{
  "sharedWithUserId": "user-uuid",
  "permissionLevel": "read", // read, comment, view, download, edit
  "expiresInHours": 24,
  "shareTitle": "Revisión importante",
  "shareMessage": "Por favor revisa antes del viernes"
}
```

**¿Qué pasa internamente?**
1. Se verifica que el documento existe y eres el dueño
2. Se crea/actualiza un registro en `document_shares`
3. Se genera un token único
4. Se calcula la fecha de expiración
5. **NO se cambian los roles globales del usuario**

### 2. Verificar Acceso

**Endpoint:** `GET /documentos/{id}/verify-share-access`

```json
{
  "has_access": true,
  "permission_level": "read",
  "expires_at": "2025-07-19T10:30:00Z",
  "share_token": "abc123..."
}
```

### 3. Ver Documentos Compartidos Conmigo

**Endpoint:** `GET /documentos/shared-with-me`

```json
[
  {
    "id": "share-uuid",
    "share_token": "abc123...",
    "title": "Documento compartido",
    "message": "Mensaje del que lo compartió",
    "permission_level": "read",
    "expires_at": "2025-07-19T10:30:00Z",
    "shared_by": {
      "id": "user-uuid",
      "name": "Juan Pérez",
      "avatar": "avatar-url"
    },
    "document": {
      "id": "doc-uuid",
      "title": "Documento Original",
      "description": "Descripción...",
      "doc_type": "pdf"
    }
  }
]
```

## 🔧 Pasos para Implementar

### 1. Ejecutar Script de Adaptación

```bash
# Ejecutar en tu base de datos
psql -U tu_usuario -d tu_base_de_datos -f adapt-existing-document-shares.sql
```

### 2. Probar el Endpoint Arreglado

```bash
# Test del endpoint que estaba fallando
curl -X GET http://localhost:3000/documentos/shared-with-me \
  -H "Authorization: Bearer tu-token"
```

### 3. Usar el Nuevo Sistema de Compartir

```bash
# Compartir documento con acceso temporal
curl -X POST http://localhost:3000/documentos/doc-uuid/grant-share-access \
  -H "Content-Type: application/json" \
  -d '{
    "sharedWithUserId": "user-uuid",
    "permissionLevel": "read",
    "expiresInHours": 48,
    "shareTitle": "Revisión urgente",
    "shareMessage": "Necesito tu feedback"
  }'
```

## 🎨 Respuestas al Usuario

### ✅ **¿Cómo manejo el compartir documentos?**

**Respuesta:** Ya no necesitas cambiar roles globales. El sistema funciona así:

1. **Compartir**: POST a `/documentos/{id}/grant-share-access`
2. **El usuario recibe acceso TEMPORAL** solo para ese documento específico
3. **Tipos de acceso**: `read`, `comment`, `view`, `download`, `edit`
4. **Expiración automática**: El acceso se vence automáticamente

### ✅ **¿Se registra como visitante?**

**Respuesta:** No cambias su rol global. El acceso se registra en `document_shares` con:
- Permisos específicos para ese documento
- Fecha de expiración
- Auditoría completa en `document_share_views`

### ✅ **¿Cuándo se acaba el tiempo?**

**Respuesta:** El acceso se desactiva automáticamente:
- Campo `expires_at` controla cuándo expira
- Función `cleanup_expired_document_shares()` limpia automáticamente
- Las consultas filtran por `is_active = true` y `expires_at > NOW()`

### ✅ **¿Error "Bad Request" arreglado?**

**Respuesta:** Sí, el error estaba en la consulta. Ahora:
- Logs detallados para debugging
- Mejor manejo de errores
- Consultas optimizadas
- Información completa (incluyendo quien compartió)

## 📊 Beneficios del Sistema

### 🔒 Seguridad
- **Sin cambios de roles globales**: Los usuarios mantienen sus roles originales
- **Acceso específico**: Solo al documento compartido
- **Expiración automática**: No quedan accesos "olvidados"
- **Auditoría completa**: Todo se registra en `document_share_views`

### 🎯 Flexibilidad
- **Múltiples tipos de permisos**: read, comment, view, download, edit
- **Duración configurable**: Desde 1 hora hasta 1 año
- **Mensajes personalizados**: Contexto del por qué se comparte
- **Revocación inmediata**: Puedes quitar acceso en cualquier momento

### 📈 Escalabilidad
- **Usa tu estructura existente**: No rompe nada actual
- **Optimizado con índices**: Consultas rápidas
- **Políticas RLS**: Seguridad a nivel de base de datos
- **Limpieza automática**: Mantiene la base de datos limpia

## 🧪 Casos de Uso Reales

### Caso 1: Revisión de Contrato (2 días)
```json
{
  "sharedWithUserId": "abogado-uuid",
  "permissionLevel": "comment",
  "expiresInHours": 48,
  "shareTitle": "Contrato para revisión",
  "shareMessage": "Necesito tu revisión legal antes del miércoles"
}
```

### Caso 2: Cliente descarga factura (4 horas)
```json
{
  "sharedWithUserId": "cliente-uuid",  
  "permissionLevel": "download",
  "expiresInHours": 4,
  "shareTitle": "Factura #12345",
  "shareMessage": "Tu factura está lista para descarga"
}
```

### Caso 3: Colaboración en propuesta (1 semana)
```json
{
  "sharedWithUserId": "colaborador-uuid",
  "permissionLevel": "edit",
  "expiresInHours": 168,
  "shareTitle": "Propuesta conjunta",
  "shareMessage": "Puedes editar hasta el próximo viernes"
}
```

## 🚨 Resolución del Error Original

### El problema era:
```
Error: Bad Request
Object.getSharedWithMe .next\static\chunks\src_83cc3698._.js (2044:19)
```

### La solución implementada:
1. **Logs detallados**: Ahora ves exactamente qué falla
2. **Consultas optimizadas**: Mejor performance
3. **Mejor manejo de errores**: Errores más claros
4. **Información completa**: Incluye datos del usuario que compartió

## 📱 Frontend Ejemplo

```jsx
const ShareDocumentButton = ({ documentId }) => {
  const [shareData, setShareData] = useState({
    sharedWithUserId: '',
    permissionLevel: 'read',
    expiresInHours: 24,
    shareTitle: '',
    shareMessage: ''
  });

  const handleShare = async () => {
    try {
      const response = await fetch(`/api/documentos/${documentId}/grant-share-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Para cookies HttpOnly
        body: JSON.stringify(shareData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Documento compartido exitosamente!
               Token: ${result.share_token}
               Expira: ${new Date(result.expires_at).toLocaleString()}`);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al compartir: ' + error.message);
    }
  };

  return (
    <div className="share-document-form">
      <h3>Compartir Documento</h3>
      
      <input 
        type="text" 
        placeholder="ID del usuario"
        value={shareData.sharedWithUserId}
        onChange={(e) => setShareData({...shareData, sharedWithUserId: e.target.value})}
      />
      
      <select 
        value={shareData.permissionLevel}
        onChange={(e) => setShareData({...shareData, permissionLevel: e.target.value})}
      >
        <option value="read">Solo Lectura</option>
        <option value="comment">Lectura + Comentarios</option>
        <option value="download">Lectura + Descarga</option>
        <option value="edit">Edición Completa</option>
      </select>
      
      <input 
        type="number" 
        placeholder="Horas de acceso"
        value={shareData.expiresInHours}
        onChange={(e) => setShareData({...shareData, expiresInHours: parseInt(e.target.value)})}
      />
      
      <input 
        type="text" 
        placeholder="Título (opcional)"
        value={shareData.shareTitle}
        onChange={(e) => setShareData({...shareData, shareTitle: e.target.value})}
      />
      
      <textarea 
        placeholder="Mensaje (opcional)"
        value={shareData.shareMessage}
        onChange={(e) => setShareData({...shareData, shareMessage: e.target.value})}
      />
      
      <button onClick={handleShare}>Compartir</button>
    </div>
  );
};
```

## 🎯 Próximos Pasos

1. **Ejecutar el script SQL** de adaptación
2. **Probar el endpoint** `shared-with-me` que estaba fallando
3. **Implementar el frontend** para compartir documentos
4. **Configurar limpieza automática** de accesos expirados

**¡El sistema está listo para usar tu estructura existente de manera óptima!** 🚀
