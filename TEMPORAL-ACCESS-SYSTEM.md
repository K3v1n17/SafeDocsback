# 🔐 Sistema de Acceso Temporal a Documentos

## Resumen del Sistema

Este sistema permite compartir documentos con **acceso temporal** y **permisos específicos** sin necesidad de cambiar los roles globales del usuario.

## ✅ Características Principales

- **Acceso Temporal**: Los permisos tienen fecha de expiración
- **Permisos Específicos**: Solo para documentos concretos
- **Roles por Documento**: `view`, `download`, `edit`
- **Auditoría**: Seguimiento de accesos y uso
- **Limpieza Automática**: Los accesos expirados se desactivan automáticamente

## 🗂️ Estructura de Datos

### Tabla `document_temporary_access`
```sql
- id: UUID (identificador único)
- document_id: UUID (referencia al documento)
- shared_with_user_id: UUID (usuario que recibe acceso)
- shared_by_user_id: UUID (usuario que comparte)
- access_token: TEXT (token único para acceso)
- permission_level: TEXT (view, download, edit)
- share_title: TEXT (título personalizado)
- share_message: TEXT (mensaje personalizado)
- expires_at: TIMESTAMP (fecha de expiración)
- is_active: BOOLEAN (estado del acceso)
- created_at: TIMESTAMP (fecha de creación)
- updated_at: TIMESTAMP (fecha de actualización)
- accessed_at: TIMESTAMP (último acceso)
- access_count: INTEGER (número de accesos)
```

## 🚀 Endpoints API

### 1. Otorgar Acceso Temporal

**POST** `/documentos/{id}/grant-temporary-access`

```json
{
  "sharedWithUserId": "user-uuid",
  "permissionLevel": "view", // view, download, edit
  "expiresInHours": 24,
  "shareTitle": "Documento importante",
  "shareMessage": "Revisa este documento antes de la reunión"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Acceso otorgado exitosamente",
  "access_token": "abc123...",
  "expires_at": "2025-07-19T10:30:00Z",
  "permission_level": "view"
}
```

### 2. Verificar Acceso

**GET** `/documentos/{id}/verify-access`

**Respuesta:**
```json
{
  "has_access": true,
  "permission_level": "view",
  "expires_at": "2025-07-19T10:30:00Z",
  "access_count": 5
}
```

### 3. Obtener Documentos Compartidos Conmigo

**GET** `/documentos/shared-with-me`

**Respuesta:**
```json
[
  {
    "id": "access-uuid",
    "share_token": "abc123...",
    "title": "Documento compartido",
    "message": "Mensaje del remitente",
    "expires_at": "2025-07-19T10:30:00Z",
    "permission_level": "view",
    "access_count": 3,
    "created_at": "2025-07-18T10:30:00Z",
    "documents": {
      "title": "Documento Original",
      "description": "Descripción del documento",
      "doc_type": "pdf",
      "created_at": "2025-07-15T09:00:00Z"
    }
  }
]
```

## 🎯 Flujo de Trabajo

### Compartir un Documento

1. **Usuario A** quiere compartir un documento con **Usuario B**
2. **Usuario A** hace POST a `/documentos/{id}/grant-temporary-access`
3. Se crea un registro en `document_temporary_access` con:
   - Fecha de expiración
   - Permisos específicos
   - Token único
4. **Usuario B** recibe acceso temporal al documento

### Acceder a un Documento Compartido

1. **Usuario B** hace GET a `/documentos/shared-with-me`
2. Ve todos los documentos compartidos con él
3. Puede acceder al documento usando el token
4. El sistema verifica automáticamente:
   - Si el acceso está activo
   - Si no ha expirado
   - Qué permisos tiene

### Expiración Automática

- Los accesos expirados se marcan como inactivos
- El sistema limpia automáticamente los accesos vencidos
- Los usuarios no pueden acceder a documentos con acceso expirado

## 🔧 Configuración

### 1. Ejecutar el Script SQL

```bash
# Ejecutar en tu base de datos PostgreSQL
psql -U tu_usuario -d tu_base_de_datos -f document-temporary-access.sql
```

### 2. Verificar Tablas

```sql
-- Verificar que la tabla se creó correctamente
SELECT * FROM document_temporary_access LIMIT 5;

-- Verificar funciones
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('grant_document_access', 'verify_document_access');
```

## 📋 Casos de Uso

### Caso 1: Revisión de Documento (24 horas)
```json
{
  "sharedWithUserId": "reviewer-uuid",
  "permissionLevel": "view",
  "expiresInHours": 24,
  "shareTitle": "Revisión de Propuesta",
  "shareMessage": "Por favor revisa y dame feedback"
}
```

### Caso 2: Edición Colaborativa (1 semana)
```json
{
  "sharedWithUserId": "editor-uuid",
  "permissionLevel": "edit",
  "expiresInHours": 168,
  "shareTitle": "Documento Colaborativo",
  "shareMessage": "Puedes editar hasta el viernes"
}
```

### Caso 3: Descarga Temporal (2 horas)
```json
{
  "sharedWithUserId": "client-uuid",
  "permissionLevel": "download",
  "expiresInHours": 2,
  "shareTitle": "Archivo solicitado",
  "shareMessage": "Descarga disponible por 2 horas"
}
```

## 🔒 Seguridad

### Políticas RLS Implementadas

1. **Solo ver accesos recibidos**: Los usuarios solo ven documentos compartidos con ellos
2. **Gestionar accesos creados**: Los usuarios pueden administrar accesos que ellos otorgaron
3. **Dueños gestionan todo**: Los propietarios de documentos pueden gestionar todos los accesos

### Validaciones

- Los tokens son únicos y seguros
- Solo el propietario puede compartir documentos
- Los accesos expirados se desactivan automáticamente
- Auditoría completa de todos los accesos

## 🧪 Testing

### Probar el Sistema

```bash
# 1. Otorgar acceso
curl -X POST http://localhost:3000/documentos/doc-uuid/grant-temporary-access \
  -H "Content-Type: application/json" \
  -d '{
    "sharedWithUserId": "user-uuid",
    "permissionLevel": "view",
    "expiresInHours": 24
  }'

# 2. Verificar acceso
curl -X GET http://localhost:3000/documentos/doc-uuid/verify-access

# 3. Ver documentos compartidos
curl -X GET http://localhost:3000/documentos/shared-with-me
```

## 🎨 Frontend (React)

### Componente para Compartir

```jsx
const ShareDocumentForm = ({ documentId }) => {
  const [shareData, setShareData] = useState({
    sharedWithUserId: '',
    permissionLevel: 'view',
    expiresInHours: 24,
    shareTitle: '',
    shareMessage: ''
  });

  const handleShare = async () => {
    const response = await fetch(`/api/documentos/${documentId}/grant-temporary-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shareData)
    });
    
    const result = await response.json();
    if (result.success) {
      alert('Documento compartido exitosamente');
    }
  };

  return (
    <form onSubmit={handleShare}>
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
        <option value="view">Solo Ver</option>
        <option value="download">Descargar</option>
        <option value="edit">Editar</option>
      </select>
      
      <input 
        type="number" 
        placeholder="Horas de acceso"
        value={shareData.expiresInHours}
        onChange={(e) => setShareData({...shareData, expiresInHours: parseInt(e.target.value)})}
      />
      
      <button type="submit">Compartir</button>
    </form>
  );
};
```

## 🚨 Resolución de Errores

### Error "Bad Request" en getSharedWithMe

**Problema**: La consulta falla porque la tabla no existe o faltan campos.

**Solución**:
1. Ejecutar el script SQL `document-temporary-access.sql`
2. Verificar que el endpoint funcione con logs mejorados
3. Usar el sistema de fallback que implementamos

### Error de Permisos

**Problema**: RLS bloquea el acceso.

**Solución**:
1. Verificar que las políticas RLS estén activas
2. Asegurar que el usuario esté autenticado
3. Revisar que el token sea válido

## 📈 Monitoreo

### Métricas Importantes

```sql
-- Accesos más utilizados
SELECT document_id, COUNT(*) as shares_count
FROM document_temporary_access
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY document_id
ORDER BY shares_count DESC;

-- Accesos expirados recientes
SELECT COUNT(*) as expired_access
FROM document_temporary_access
WHERE expires_at < NOW() AND is_active = false;

-- Usuarios más activos compartiendo
SELECT shared_by_user_id, COUNT(*) as shares_created
FROM document_temporary_access
GROUP BY shared_by_user_id
ORDER BY shares_created DESC;
```

## 🔄 Migración desde document_shares

Si ya tienes datos en `document_shares`, puedes migrarlos:

```sql
-- Migrar datos existentes
INSERT INTO document_temporary_access (
    document_id,
    shared_with_user_id,
    shared_by_user_id,
    access_token,
    permission_level,
    share_title,
    share_message,
    expires_at,
    is_active,
    created_at
)
SELECT 
    document_id,
    shared_with_user_id,
    created_by,
    share_token,
    'view', -- permission por defecto
    title,
    message,
    expires_at,
    is_active,
    created_at
FROM document_shares
WHERE is_active = true;
```

¡Con este sistema tienes un control completo sobre los accesos temporales a documentos! 🚀
