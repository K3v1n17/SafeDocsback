# 🔐 SafeDocs Backend - Configuración de Seguridad

## ⚡ Inicio Rápido

### 1. Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus credenciales reales
nano .env
```

### 2. Configuración Mínima Requerida
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima_jwt
NODE_ENV=development
JWT_SECRET=tu_secreto_minimo_32_caracteres
FRONTEND_URL=http://localhost:3000
```

### 3. Instalar Dependencias (Opcionales)
```bash
npm install helmet express-rate-limit
```

### 4. Verificar Configuración
```bash
chmod +x scripts/security-check.sh
./scripts/security-check.sh
```

## 🛡️ Características de Seguridad Implementadas

- ✅ **Cookies HttpOnly** para tokens
- ✅ **Rate Limiting** configurable
- ✅ **Validación y Sanitización** de datos
- ✅ **Manejo Seguro de Errores**
- ✅ **Headers de Seguridad**
- ✅ **Logging de Eventos de Seguridad**
- ✅ **Validación de Variables de Entorno**
- ✅ **Protección CORS** configurada

## 🚨 Importante para Producción

1. **Usar HTTPS** siempre
2. **Configurar NODE_ENV=production**
3. **Usar secretos seguros** (mínimo 32 caracteres)
4. **Configurar CORS** con dominios específicos
5. **Rotar credenciales** regularmente

## 📊 Monitoreo

Los eventos de seguridad se registran automáticamente:
- Intentos de login fallidos
- Rate limiting excedido
- Errores de autenticación
- Accesos denegados

## 🔍 Testing

```bash
# Test de rate limiting
for i in {1..105}; do curl http://localhost:3001/auth/me; done

# Test de validación
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test<script>","password":"test"}'
```

## 📖 Documentación Completa

Ver `SECURITY-REFACTOR.md` para detalles completos de implementación.
