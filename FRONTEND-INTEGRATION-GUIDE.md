# GUÍA COMPLETA PARA INTEGRAR EL FRONTEND CON EL SISTEMA DE COMPARTIR DOCUMENTOS

## 🔗 ENDPOINTS DISPONIBLES

### 1. **VER DOCUMENTOS COMPARTIDOS CONMIGO**
```
GET /documentos/shared-with-me
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
```

**Respuesta exitosa:**
```json
[
  {
    "id": "uuid",
    "document_id": "uuid",
    "title": "Documento Compartido",
    "description": "Descripción del documento",
    "doc_type": "pdf",
    "permission_level": "read",
    "shared_by": "uuid-del-usuario-que-compartio",
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
```

### 2. **COMPARTIR UN DOCUMENTO**
```
POST /documentos/simple-share
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
Content-Type: application/json
```

**Body:**
```json
{
  "documentId": "uuid-del-documento",
  "sharedWithUserId": "uuid-del-usuario-destinatario",
  "permissionLevel": "read",
  "expiresInHours": 24,
  "shareTitle": "Título personalizado (opcional)",
  "shareMessage": "Mensaje personalizado (opcional)"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Documento compartido exitosamente",
  "share": {
    "id": "uuid",
    "document_id": "uuid",
    "shared_with_user_id": "uuid",
    "created_by": "uuid",
    "share_token": "token-seguro",
    "title": "Título del share",
    "message": "Mensaje del share",
    "permission_level": "read",
    "expires_at": "2025-07-19T10:30:00Z",
    "is_active": true,
    "created_at": "2025-07-18T10:30:00Z"
  },
  "share_token": "token-seguro"
}
```

### 3. **VER DOCUMENTOS QUE YO HE COMPARTIDO**
```
GET /documentos/my-shared
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
```

### 4. **REVOCAR UN SHARE**
```
DELETE /documentos/shares/:shareId
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
```

### 5. **VERIFICAR PERMISOS DE UN DOCUMENTO**
```
GET /documentos/:documentId/permission-check
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
```

### 6. **OBTENER DOCUMENTO CON VERIFICACIÓN DE PERMISOS**
```
GET /documentos/:documentId/with-permission-check
```
**Headers:**
```
Authorization: Bearer <token>
Cookie: supabase-auth-token=<token>
```

## 🎨 COMPONENTES SUGERIDOS PARA EL FRONTEND

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/documentos/simple-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify({
          documentId: document.id,
          ...formData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        onShare(result);
        onClose();
      }
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h3>Compartir: {document.title}</h3>
        
        <div className="form-group">
          <label>Usuario destinatario (ID):</label>
          <input
            type="text"
            value={formData.sharedWithUserId}
            onChange={(e) => setFormData({...formData, sharedWithUserId: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Nivel de permisos:</label>
          <select
            value={formData.permissionLevel}
            onChange={(e) => setFormData({...formData, permissionLevel: e.target.value})}
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
          />
        </div>
        
        <div className="form-group">
          <label>Título personalizado (opcional):</label>
          <input
            type="text"
            value={formData.shareTitle}
            onChange={(e) => setFormData({...formData, shareTitle: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label>Mensaje (opcional):</label>
          <textarea
            value={formData.shareMessage}
            onChange={(e) => setFormData({...formData, shareMessage: e.target.value})}
          />
        </div>
        
        <div className="form-actions">
          <button type="submit">Compartir</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
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

  useEffect(() => {
    fetchSharedDocuments();
  }, []);

  const fetchSharedDocuments = async () => {
    try {
      const response = await fetch('/api/documentos/shared-with-me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include'
      });

      const data = await response.json();
      setSharedDocuments(data);
    } catch (error) {
      console.error('Error fetching shared documents:', error);
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

  if (loading) return <div>Cargando documentos compartidos...</div>;

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

### **MySharedDocuments.jsx**
```jsx
import React, { useState, useEffect } from 'react';

const MySharedDocuments = () => {
  const [myShares, setMyShares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyShares();
  }, []);

  const fetchMyShares = async () => {
    try {
      const response = await fetch('/api/documentos/my-shared', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include'
      });

      const data = await response.json();
      setMyShares(data);
    } catch (error) {
      console.error('Error fetching my shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async (shareId) => {
    try {
      const response = await fetch(`/api/documentos/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        fetchMyShares(); // Refrescar la lista
      }
    } catch (error) {
      console.error('Error revoking share:', error);
    }
  };

  if (loading) return <div>Cargando mis documentos compartidos...</div>;

  return (
    <div className="my-shared-documents">
      <h2>Documentos que he compartido</h2>
      
      {myShares.length === 0 ? (
        <p>No has compartido ningún documento.</p>
      ) : (
        <div className="shares-list">
          {myShares.map((share) => (
            <div key={share.id} className="share-card">
              <div className="share-header">
                <h3>{share.title}</h3>
                <button 
                  onClick={() => revokeShare(share.id)}
                  className="revoke-button"
                >
                  Revocar
                </button>
              </div>
              
              <p>{share.message}</p>
              
              <div className="share-meta">
                <span>Compartido con: {share.shared_with_user_id}</span>
                <span>Expira: {share.expires_at ? formatDate(share.expires_at) : 'Sin expiración'}</span>
                <span>Token: {share.share_token.substring(0, 10)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySharedDocuments;
```

## 🔧 FUNCIONES AUXILIARES

### **api.js**
```javascript
const API_BASE_URL = 'http://localhost:3000/api';

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return await response.json();
};

// Funciones específicas para compartir documentos
export const shareDocument = async (shareData) => {
  return await apiRequest('/documentos/simple-share', {
    method: 'POST',
    body: JSON.stringify(shareData)
  });
};

export const getSharedWithMe = async () => {
  return await apiRequest('/documentos/shared-with-me');
};

export const getMySharedDocuments = async () => {
  return await apiRequest('/documentos/my-shared');
};

export const revokeShare = async (shareId) => {
  return await apiRequest(`/documentos/shares/${shareId}`, {
    method: 'DELETE'
  });
};
```

## 📱 INTEGRACIÓN EN TU APP PRINCIPAL

### **App.jsx**
```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SharedWithMeList from './components/SharedWithMeList';
import MySharedDocuments from './components/MySharedDocuments';
import DocumentsList from './components/DocumentsList';

function App() {
  return (
    <Router>
      <div className="App">
        <nav>
          <Link to="/documents">Mis Documentos</Link>
          <Link to="/shared-with-me">Compartidos conmigo</Link>
          <Link to="/my-shared">Mis compartidos</Link>
        </nav>
        
        <Routes>
          <Route path="/documents" element={<DocumentsList />} />
          <Route path="/shared-with-me" element={<SharedWithMeList />} />
          <Route path="/my-shared" element={<MySharedDocuments />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

## 🎯 PUNTOS CLAVE PARA EL FRONTEND

1. **Autenticación**: Usar siempre `credentials: 'include'` para las cookies
2. **Tokens**: Incluir el token en el header Authorization
3. **Manejo de errores**: Verificar response.ok antes de parsear JSON
4. **Expiración**: Mostrar claramente si un share está expirado
5. **Permisos**: Mostrar badges para los niveles de permiso
6. **Actualización**: Refrescar listas después de acciones (compartir, revocar)

¿Necesitas ayuda con algún componente específico o tienes dudas sobre la implementación?
