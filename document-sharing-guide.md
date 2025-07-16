# 🔐 API de Compartir Documentos - Guía Completa

## 🎯 **Endpoints Disponibles**

### 1. **Compartir un documento**
```http
POST /documentos/{documentId}/share
```

**Body:**
```json
{
  "sharedWithUserId": "uuid-del-usuario",
  "expiresAt": "2024-12-31T23:59:59Z" // Opcional
}
```

**Respuesta:**
```json
{
  "id": "uuid-del-share",
  "document_id": "uuid-del-documento",
  "owner_id": "uuid-del-propietario",
  "shared_with_user_id": "uuid-del-usuario",
  "permission_level": "read",
  "shared_at": "2024-01-01T00:00:00Z",
  "expires_at": "2024-12-31T23:59:59Z",
  "is_active": true
}
```

### 2. **Dejar de compartir un documento**
```http
DELETE /documentos/{documentId}/share/{userId}
```

### 3. **Ver con quién está compartido un documento**
```http
GET /documentos/{documentId}/shares
```

**Respuesta:**
```json
[
  {
    "id": "uuid-del-share",
    "shared_with_user_id": "uuid-del-usuario",
    "permission_level": "read",
    "shared_at": "2024-01-01T00:00:00Z",
    "expires_at": null,
    "is_active": true
  }
]
```

### 4. **Ver documentos compartidos conmigo**
```http
GET /documentos/shared-with-me
```

**Respuesta:**
```json
[
  {
    "id": "uuid-del-share",
    "document_id": "uuid-del-documento",
    "owner_id": "uuid-del-propietario",
    "permission_level": "read",
    "shared_at": "2024-01-01T00:00:00Z",
    "documents": {
      "id": "uuid-del-documento",
      "title": "Título del documento",
      "description": "Descripción",
      "doc_type": "pdf",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
]
```

## 🔒 **Características de Seguridad**

### ✅ **Permisos y Validaciones:**
1. **Solo el propietario** puede compartir sus documentos
2. **No se puede auto-compartir** (usuario consigo mismo)
3. **Solo lectura** - El usuario compartido NO puede editar
4. **RLS en base de datos** - Doble validación de seguridad
5. **Expiración opcional** - Para compartir temporal
6. **Usuario objetivo debe existir** en el sistema

### ✅ **Controles de Acceso:**
- **Propietario**: Puede ver, editar, eliminar, compartir
- **Usuario compartido**: Solo puede VER (read-only)
- **Admin**: Puede ver todo pero respeta las reglas de compartir

## 🎨 **Implementación en Frontend**

### **Botón de Compartir (Ejemplo React)**
```jsx
// En tu componente de documentos
const ShareButton = ({ document, currentUser }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState([]);

  const handleShare = async (userEmail, expiresAt) => {
    try {
      // 1. Buscar usuario por email (necesitarás un endpoint para esto)
      const user = await findUserByEmail(userEmail);
      
      // 2. Compartir documento
      await fetch(`/documentos/${document.id}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedWithUserId: user.id,
          expiresAt: expiresAt
        })
      });
      
      // 3. Actualizar lista
      loadSharedUsers();
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  const loadSharedUsers = async () => {
    const response = await fetch(`/documentos/${document.id}/shares`, {
      credentials: 'include'
    });
    const shares = await response.json();
    setSharedUsers(shares);
  };

  return (
    <div>
      {/* Solo mostrar si es el propietario */}
      {document.owner_id === currentUser.id && (
        <button 
          onClick={() => setShowShareModal(true)}
          className="share-btn"
        >
          🔗 Compartir
        </button>
      )}
      
      {showShareModal && (
        <ShareModal 
          onShare={handleShare}
          onClose={() => setShowShareModal(false)}
          sharedUsers={sharedUsers}
          onUnshare={(userId) => unshareDocument(document.id, userId)}
        />
      )}
    </div>
  );
};
```

### **Pestaña de Documentos Compartidos Conmigo**
```jsx
const SharedWithMeTab = () => {
  const [sharedDocs, setSharedDocs] = useState([]);

  useEffect(() => {
    loadSharedDocuments();
  }, []);

  const loadSharedDocuments = async () => {
    const response = await fetch('/documentos/shared-with-me', {
      credentials: 'include'
    });
    const docs = await response.json();
    setSharedDocs(docs);
  };

  return (
    <div>
      <h3>📁 Documentos Compartidos Conmigo</h3>
      {sharedDocs.map(share => (
        <div key={share.id} className="shared-document">
          <h4>{share.documents.title}</h4>
          <p>Compartido por: Usuario {share.owner_id}</p>
          <p>Desde: {new Date(share.shared_at).toLocaleDateString()}</p>
          <span className="read-only-badge">🔒 Solo lectura</span>
          <button onClick={() => openDocument(share.documents.id)}>
            Ver Documento
          </button>
        </div>
      ))}
    </div>
  );
};
```

## 🚀 **Próximos Pasos**

1. **Ejecutar el SQL** para crear las tablas
2. **Probar los endpoints** con Postman
3. **Implementar el frontend** con los botones de compartir
4. **Agregar notificaciones** cuando te compartan un documento
5. **Implementar búsqueda de usuarios** por email

## 🔧 **Endpoints Adicionales Recomendados**

### Buscar usuarios para compartir:
```http
GET /auth/users/search?email=usuario@example.com
```

### Obtener detalles de usuario:
```http
GET /auth/users/{userId}/profile
```

¿Te gustaría que implemente alguno de estos endpoints adicionales o necesitas ayuda con alguna parte específica?
