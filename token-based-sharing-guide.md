# 🔧 Endpoints Adaptados a tu Esquema Existente

## 📋 **Estructura de tu Base de Datos Actual:**

Tu `document_shares` usa **TOKEN-BASED sharing**, que es muy potente:

```sql
document_shares:
- id (uuid)
- document_id (uuid) 
- created_by (uuid)
- share_token (text) -- 🔑 Token único para acceso
- title (text)
- message (text) 
- expires_at (timestamp)
- is_active (boolean)
```

## 🎯 **Endpoints Recomendados:**

### 1. **Crear un share con token**
```http
POST /documentos/{documentId}/share
```
**Body:**
```json
{
  "title": "Mi documento compartido",
  "message": "Aquí tienes acceso al documento",
  "expiresAt": "2024-12-31T23:59:59Z" // Opcional
}
```

**Respuesta:**
```json
{
  "id": "uuid-del-share",
  "document_id": "uuid-del-documento",
  "share_token": "abc123...token-único",
  "share_url": "https://tuapp.com/shared/abc123...token-único",
  "title": "Mi documento compartido",
  "message": "Aquí tienes acceso al documento",
  "expires_at": "2024-12-31T23:59:59Z",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2. **Ver shares de un documento (propietario)**
```http
GET /documentos/{documentId}/shares
```

### 3. **Revocar un share**
```http
DELETE /documentos/shares/{shareId}
```

### 4. **Acceso público via token** 🌐
```http
GET /shared/{shareToken}
```
**Sin autenticación** - Cualquiera con el token puede acceder

### 5. **Estadísticas de un share**
```http
GET /documentos/shares/{shareId}/stats
```

## 🔒 **Ventajas de tu Enfoque Actual:**

1. **Más flexible** - No necesitas que el usuario esté registrado
2. **Fácil de compartir** - Solo envías un link
3. **Trackeable** - Ya tienes `document_share_views` para estadísticas
4. **Seguro** - Token único, difícil de adivinar
5. **Temporal** - Puedes poner expiración

## 🎨 **Implementación en Frontend:**

### **Botón de Compartir:**
```jsx
const ShareDocument = ({ document }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const createShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch(`/documentos/${document.id}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Documento: ${document.title}`,
          message: 'Te comparto este documento',
          expiresAt: null // Sin expiración
        })
      });
      
      const shareData = await response.json();
      const url = `${window.location.origin}/shared/${shareData.share_token}`;
      setShareUrl(url);
      
      // Copiar al clipboard
      navigator.clipboard.writeText(url);
      alert('¡Link copiado al clipboard!');
      
    } catch (error) {
      console.error('Error creating share:', error);
    }
    setIsSharing(false);
  };

  return (
    <div>
      <button onClick={createShare} disabled={isSharing}>
        {isSharing ? 'Generando...' : '🔗 Compartir'}
      </button>
      
      {shareUrl && (
        <div className="share-result">
          <p>¡Documento compartido!</p>
          <input 
            value={shareUrl} 
            readOnly 
            onClick={(e) => e.target.select()}
          />
          <button onClick={() => navigator.clipboard.writeText(shareUrl)}>
            📋 Copiar
          </button>
        </div>
      )}
    </div>
  );
};
```

### **Página de Acceso Público:**
```jsx
// Ruta: /shared/[token]
const SharedDocumentView = ({ shareToken }) => {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSharedDocument();
  }, [shareToken]);

  const loadSharedDocument = async () => {
    try {
      const response = await fetch(`/shared/${shareToken}`);
      
      if (!response.ok) {
        throw new Error('Share not found or expired');
      }
      
      const data = await response.json();
      setShareData(data);
    } catch (error) {
      console.error('Error loading shared document:', error);
      // Mostrar página de error
    }
    setLoading(false);
  };

  if (loading) return <div>Cargando documento...</div>;
  
  if (!shareData) return <div>Documento no encontrado o expirado</div>;

  return (
    <div className="shared-document-view">
      <h1>{shareData.share.title}</h1>
      {shareData.share.message && (
        <p className="share-message">{shareData.share.message}</p>
      )}
      
      <div className="document-info">
        <h2>{shareData.document.title}</h2>
        <p>{shareData.document.description}</p>
        <span>Tipo: {shareData.document.doc_type}</span>
        <span>Tamaño: {formatFileSize(shareData.document.file_size)}</span>
      </div>
      
      {/* Aquí mostrarías el documento o un botón de descarga */}
      <button onClick={() => downloadDocument(shareData.document)}>
        📥 Descargar Documento
      </button>
      
      <div className="read-only-notice">
        🔒 Este documento es de solo lectura
      </div>
    </div>
  );
};
```

## 🚀 **Siguiente Paso:**

¿Quieres que implemente los endpoints adaptados a tu esquema actual? Sería mucho más sencillo porque tu base de datos ya está lista y es muy potente.

**Ventajas:**
- ✅ No necesitas cambiar la base de datos
- ✅ Ya tienes tracking de views
- ✅ Ya tienes mensajes y participantes
- ✅ Sistema más flexible que el mío
- ✅ Puedes compartir con usuarios no registrados

¿Procedemos con esta implementación?
