# GUÍA ACTUALIZADA PARA FRONTEND CON COOKIES HTTPONLY

## 🍪 SISTEMA DE AUTENTICACIÓN BASADO EN COOKIES

Tu backend usa **cookies HttpOnly** para la autenticación, lo que significa que:

- ✅ **Mayor seguridad**: Las cookies no son accesibles desde JavaScript
- ✅ **Automáticas**: Se envían automáticamente con cada request
- ✅ **No necesitas manejar tokens**: El navegador se encarga de enviar las cookies

## 🔗 ENDPOINTS PARA COMPARTIR DOCUMENTOS

### 1. **VER DOCUMENTOS COMPARTIDOS CONMIGO**
```http
GET /api/documentos/shared-with-me
```

**Headers automáticos:**
```
Cookie: access_token=<tu-token-httponly>
```

**Código JavaScript:**
```javascript
async function getSharedWithMe() {
  const response = await fetch('/api/documentos/shared-with-me', {
    method: 'GET',
    credentials: 'include' // ✅ IMPORTANTE: Incluir cookies
  });
  
  const data = await response.json();
  return data;
}
```

**Respuesta:**
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
      "shared_by": "uuid-del-usuario",
      "expires_at": "2025-07-19T10:30:00Z",
      "is_expired": false,
      "created_at": "2025-07-18T10:30:00Z",
      "share_token": "token-seguro",
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

### 2. **COMPARTIR UN DOCUMENTO**
```http
POST /api/documentos/simple-share
```

**Código JavaScript:**
```javascript
async function shareDocument(documentId, sharedWithUserId, options = {}) {
  const response = await fetch('/api/documentos/simple-share', {
    method: 'POST',
    credentials: 'include', // ✅ IMPORTANTE: Incluir cookies
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documentId: documentId,
      sharedWithUserId: sharedWithUserId,
      permissionLevel: options.permissionLevel || 'read',
      expiresInHours: options.expiresInHours || 24,
      shareTitle: options.shareTitle,
      shareMessage: options.shareMessage
    })
  });
  
  const data = await response.json();
  return data;
}
```

**Ejemplo de uso:**
```javascript
shareDocument(
  'doc-uuid-123', 
  'user-uuid-456',
  {
    permissionLevel: 'read',
    expiresInHours: 48,
    shareTitle: 'Documento importante',
    shareMessage: 'Por favor revisa este documento'
  }
).then(result => {
  console.log('Documento compartido:', result);
});
```

### 3. **VER MIS DOCUMENTOS COMPARTIDOS**
```http
GET /api/documentos/my-shared
```

**Código JavaScript:**
```javascript
async function getMySharedDocuments() {
  const response = await fetch('/api/documentos/my-shared', {
    method: 'GET',
    credentials: 'include' // ✅ IMPORTANTE: Incluir cookies
  });
  
  const data = await response.json();
  return data;
}
```

### 4. **REVOCAR UN SHARE**
```http
DELETE /api/documentos/shares/{shareId}/revoke
```

**Código JavaScript:**
```javascript
async function revokeShare(shareId) {
  const response = await fetch(`/api/documentos/shares/${shareId}/revoke`, {
    method: 'DELETE',
    credentials: 'include' // ✅ IMPORTANTE: Incluir cookies
  });
  
  if (response.ok) {
    console.log('Share revocado exitosamente');
    return true;
  }
  
  return false;
}
```

## 🎨 COMPONENTES REACT ACTUALIZADOS

### **ShareDocumentModal.jsx**
```jsx
import React, { useState } from 'react';

const ShareDocumentModal = ({ document, onClose, onShare }) => {
  const [formData, setFormData] = useState({
    sharedWithUserId: '',
    permissionLevel: 'read',
    expiresInHours: 24,
    shareTitle: '',
    shareMessage: ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/documentos/simple-share', {
        method: 'POST',
        credentials: 'include', // ✅ COOKIES HTTPONLY
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: document.id,
          ...formData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        onShare(result);
        onClose();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      alert('Error al compartir el documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Compartir: {document.title}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario destinatario (ID):</label>
            <input
              type="text"
              value={formData.sharedWithUserId}
              onChange={(e) => setFormData({...formData, sharedWithUserId: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Nivel de permisos:</label>
            <select
              value={formData.permissionLevel}
              onChange={(e) => setFormData({...formData, permissionLevel: e.target.value})}
              disabled={loading}
            >
              <option value="read">Solo lectura</option>
              <option value="write">Lectura y edición</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Expira en (horas):</label>
            <input
              type="number"
              value={formData.expiresInHours}
              onChange={(e) => setFormData({...formData, expiresInHours: parseInt(e.target.value)})}
              min="1"
              max="8760"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Título personalizado:</label>
            <input
              type="text"
              value={formData.shareTitle}
              onChange={(e) => setFormData({...formData, shareTitle: e.target.value})}
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Mensaje:</label>
            <textarea
              value={formData.shareMessage}
              onChange={(e) => setFormData({...formData, shareMessage: e.target.value})}
              disabled={loading}
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Compartiendo...' : 'Compartir'}
            </button>
            <button type="button" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareDocumentModal;
```

### **SharedWithMeList.jsx**
```jsx
import React, { useState, useEffect } from 'react';

const SharedWithMeList = () => {
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSharedDocuments();
  }, []);

  const fetchSharedDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/documentos/shared-with-me', {
        method: 'GET',
        credentials: 'include' // ✅ COOKIES HTTPONLY
      });

      const data = await response.json();
      
      if (data.success) {
        setSharedDocuments(data.data);
      } else {
        setError(data.message || 'Error al cargar documentos');
      }
    } catch (error) {
      console.error('Error fetching shared documents:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openDocument = (documentId) => {
    // Implementar lógica para abrir documento
    console.log('Opening document:', documentId);
  };

  if (loading) {
    return <div className="loading">Cargando documentos compartidos...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="shared-documents">
      <h2>Documentos compartidos conmigo</h2>
      
      {sharedDocuments.length === 0 ? (
        <p>No tienes documentos compartidos.</p>
      ) : (
        <div className="documents-grid">
          {sharedDocuments.map((share) => (
            <div key={share.id} className="document-card">
              <div className="document-header">
                <h3>{share.title}</h3>
                <span className={`permission-badge ${share.permission_level}`}>
                  {share.permission_level}
                </span>
              </div>
              
              <p className="document-description">{share.description}</p>
              
              <div className="document-meta">
                <span className="doc-type">{share.doc_type}</span>
                <span className="shared-date">
                  Compartido: {formatDate(share.created_at)}
                </span>
              </div>
              
              {share.expires_at && (
                <div className={`expiration ${share.is_expired ? 'expired' : ''}`}>
                  {share.is_expired ? 'Expirado' : `Expira: ${formatDate(share.expires_at)}`}
                </div>
              )}
              
              <div className="document-actions">
                <button 
                  onClick={() => openDocument(share.document_id)}
                  disabled={share.is_expired}
                  className="btn-primary"
                >
                  Abrir documento
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SharedWithMeList;
```

## 🔧 CONFIGURACIÓN IMPORTANTE

### **Axios Configuration** (si usas Axios)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // ✅ IMPORTANTE: Incluir cookies
});

// Uso
api.get('/documentos/shared-with-me')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
```

### **Fetch Configuration** (recomendado)
```javascript
const apiRequest = async (endpoint, options = {}) => {
  const defaultOptions = {
    credentials: 'include', // ✅ IMPORTANTE: Incluir cookies
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const response = await fetch(`/api${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Uso
apiRequest('/documentos/shared-with-me')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

## 🚨 PUNTOS IMPORTANTES

1. **SIEMPRE usar `credentials: 'include'`** en todas las requests
2. **NO necesitas manejar tokens** manualmente
3. **El navegador se encarga** de enviar las cookies automáticamente
4. **Más seguro** que tokens en localStorage
5. **Funciona automáticamente** con tu sistema de autenticación existente

## 🎯 VENTAJAS DE TU SISTEMA

- ✅ **Seguridad**: Cookies HttpOnly no son accesibles desde JavaScript
- ✅ **Simplicidad**: No necesitas manejar tokens manualmente
- ✅ **Automático**: Las cookies se envían automáticamente
- ✅ **Consistente**: Mismo sistema para todo el backend

¿Necesitas ayuda con algún componente específico o tienes dudas sobre la implementación?
