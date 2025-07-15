# 🔒 Guía de Migración a HttpOnly Cookies

## ¿Por qué migrar?

**Problema actual**: Tokens JWT almacenados en `localStorage` son vulnerables a ataques XSS.

**Solución**: HttpOnly Cookies que no son accesibles desde JavaScript del cliente.

## Cambios en el Backend ✅

### 1. **AuthController actualizado**
- ✅ Login ahora usa cookies HttpOnly
- ✅ Register usa cookies HttpOnly 
- ✅ Refresh usa cookies automáticamente
- ✅ Logout limpia cookies
- ✅ Tokens NO se envían en response body

### 2. **SupabaseAuthGuard actualizado**  
- ✅ Prioridad: cookies → headers
- ✅ Refresh automático de tokens
- ✅ Limpieza automática de cookies inválidas

### 3. **Configuración CORS**
- ✅ `credentials: true` para permitir cookies
- ✅ Origen específico configurado

## Cambios necesarios en el Frontend

### 1. **Eliminar manejo manual de tokens**

```javascript
// ❌ ANTES: Guardar tokens manualmente
localStorage.setItem('access_token', data.session.access_token);
localStorage.setItem('refresh_token', data.session.refresh_token);

// ✅ AHORA: Los tokens se manejan automáticamente en cookies
// No necesitas hacer nada, el navegador los guarda automáticamente
```

### 2. **Actualizar llamadas API**

```javascript
// ✅ Configurar cliente API para usar cookies
const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
  withCredentials: true, // 🍪 IMPORTANTE: Enviar cookies automáticamente
});

// ❌ ANTES: Agregar headers manualmente
// headers: { Authorization: `Bearer ${token}` }

// ✅ AHORA: Las cookies se envían automáticamente
// No necesitas headers de autorización
```

### 3. **Actualizar AuthContext**

```javascript
// ✅ Nuevo AuthContext simplificado
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Login simplificado
  const login = async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    
    if (response.data.success) {
      setUser(response.data.data.user);
      // 🍪 Cookies se configuran automáticamente
      return { success: true };
    }
    return { success: false, error: response.data.error };
  };

  // ✅ Logout simplificado  
  const logout = async () => {
    await apiClient.post('/auth/logout');
    setUser(null);
    // 🍪 Cookies se limpian automáticamente
  };

  // ✅ Verificar sesión actual
  const checkAuth = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data.user);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Auto-refresh se maneja en el backend
  // No necesitas lógica de refresh en el frontend

  useEffect(() => {
    checkAuth();
  }, []);

  return { user, login, logout, loading };
}
```

### 4. **Actualizar interceptores de Axios**

```javascript
// ✅ Interceptor simplificado
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado, redirigir a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ❌ ANTES: Lógica compleja de refresh manual
// ✅ AHORA: El refresh es automático en el backend
```

### 5. **Variables de entorno**

```bash
# Frontend .env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_API_CREDENTIALS=true

# Backend .env  
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
COOKIE_DOMAIN=localhost # Solo en producción usar dominio real
```

## Beneficios de seguridad

### ✅ **Protecciones implementadas**
- **HttpOnly**: Cookies no accesibles desde JavaScript
- **Secure**: Solo HTTPS en producción  
- **SameSite=Strict**: Protección contra CSRF
- **Path=/**: Scope limitado
- **MaxAge**: Expiración automática
- **Refresh automático**: Sin interrupción de UX

### 🛡️ **Vulnerabilidades eliminadas**
- ❌ XSS no puede robar tokens
- ❌ No hay tokens en localStorage
- ❌ No hay tokens en el código JavaScript
- ❌ CSRF prevention con SameSite

## Checklist de migración

### Backend ✅
- [x] AuthController actualizado
- [x] SupabaseAuthGuard actualizado  
- [x] CORS configurado con credentials
- [x] Cookie parser instalado

### Frontend (pendiente)
- [ ] Remover localStorage de tokens
- [ ] Configurar `withCredentials: true`
- [ ] Actualizar AuthContext
- [ ] Remover headers Authorization manuales
- [ ] Simplificar lógica de refresh
- [ ] Testear flujo completo

## Comandos para testing

```bash
# Verificar cookies en browser DevTools
# Application → Cookies → localhost:3001
# Debe mostrar: access_token y refresh_token con HttpOnly=true

# Test endpoints
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}' \
  -c cookies.txt

curl -X GET http://localhost:3001/auth/me \
  -b cookies.txt
```

## Rollback plan

Si hay problemas, puedes activar modo híbrido:

1. Mantener cookies HttpOnly (recomendado)
2. Temporalmente devolver tokens en response
3. Hacer migración gradual por endpoints

```javascript
// Modo híbrido temporal
const token = getCookieToken() || getLocalStorageToken();
```
