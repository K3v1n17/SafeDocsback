# 🔐 GUÍA DE AUTENTICACIÓN A TRAVÉS DEL BACKEND

## 🎯 NUEVOS ENDPOINTS AGREGADOS

Tu backend ahora tiene endpoints de autenticación centralizados que actúan como proxy a Supabase:

### **1. Login**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123"
}
```

### **2. Register**
```http
POST /auth/register
Content-Type: application/json

{
  "email": "nuevo@example.com",
  "password": "password123",
  "username": "nuevo_usuario",
  "name": "Nombre Completo"
}
```

### **3. Refresh Token**
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### **4. Logout**
```http
POST /auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### **5. Get Current User (existente)**
```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## 🚀 CÓDIGO PARA EL FRONTEND

### **1. Servicio de autenticación:**

```typescript
// services/auth.service.ts
const API_BASE_URL = 'http://localhost:3001';

export const authService = {
  // Login
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();
    
    if (result.success) {
      // Guardar tokens en localStorage
      localStorage.setItem('access_token', result.data.session.access_token);
      localStorage.setItem('refresh_token', result.data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }

    return result;
  },

  // Register
  async register(email: string, password: string, username: string, name: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, username, name }),
    });

    const result = await response.json();
    
    if (result.success && result.data.session) {
      // Guardar tokens solo si viene sesión (email confirmado)
      localStorage.setItem('access_token', result.data.session.access_token);
      localStorage.setItem('refresh_token', result.data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }

    return result;
  },

  // Get current user
  async getCurrentUser() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('No hay token');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.json();
  },

  // Refresh token
  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
      throw new Error('No hay refresh token');
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const result = await response.json();
    
    if (result.success) {
      // Actualizar tokens
      localStorage.setItem('access_token', result.data.session.access_token);
      localStorage.setItem('refresh_token', result.data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }

    return result;
  },

  // Logout
  async logout() {
    const token = localStorage.getItem('access_token');
    
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }

    // Limpiar localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  // Helper para verificar si está logueado
  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  // Helper para obtener el usuario del localStorage
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
};
```

### **2. Componente de Login (React):**

```tsx
// components/LoginForm.tsx
import { useState } from 'react';
import { authService } from '../services/auth.service';

export const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authService.login(formData.email, formData.password);
      
      if (result.success) {
        console.log('Login exitoso:', result.data.user);
        // Redirigir al dashboard
        window.location.href = '/dashboard';
      } else {
        setError(result.error || 'Error de login');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Iniciar Sesión</h2>
      
      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="form-group">
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            email: e.target.value
          }))}
          required
        />
      </div>

      <div className="form-group">
        <input
          type="password"
          placeholder="Contraseña"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            password: e.target.value
          }))}
          required
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>
    </form>
  );
};
```

### **3. Interceptor para requests automáticos:**

```typescript
// utils/apiClient.ts
const API_BASE_URL = 'http://localhost:3001';

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('access_token');
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      // Si es 401, intentar refresh
      if (response.status === 401 && token) {
        const refreshResult = await authService.refreshToken();
        
        if (refreshResult.success) {
          // Reintentar la request original
          return fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
              ...defaultHeaders,
              'Authorization': `Bearer ${refreshResult.data.session.access_token}`,
              ...options.headers
            }
          });
        } else {
          // Refresh falló, logout
          authService.logout();
          window.location.href = '/login';
        }
      }

      return response;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
};
```

## 🔑 VENTAJAS DE ESTA IMPLEMENTACIÓN:

### **1. Seguridad mejorada:**
- ✅ Claves de Supabase solo en el servidor
- ✅ Validaciones centralizadas
- ✅ Logs de autenticación en el backend

### **2. Control centralizado:**
- ✅ Todos los logins pasan por tu backend
- ✅ Puedes agregar lógica adicional (rate limiting, etc.)
- ✅ Fácil de auditar y monitorear

### **3. Flexibilidad:**
- ✅ Puedes cambiar de Supabase a otro proveedor fácilmente
- ✅ Puedes agregar más validaciones
- ✅ Puedes personalizar las respuestas

## 🧪 TESTING:

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"password123","username":"newuser","name":"New User"}'

# Get current user
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

¡Ahora tu frontend puede usar estos endpoints en lugar de conectarse directamente a Supabase!
