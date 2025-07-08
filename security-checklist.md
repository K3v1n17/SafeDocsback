# 🔐 CHECKLIST DE SEGURIDAD PARA PRODUCCIÓN

## ✅ IMPLEMENTADO:
- [x] Autenticación JWT con Supabase
- [x] Guard de autenticación en todos los endpoints
- [x] Filtrado de documentos por propietario
- [x] Verificación de permisos a nivel de aplicación
- [x] Validación de roles (admin/owner)

## ⚠️ PENDIENTE - CRÍTICO:
- [ ] **Ejecutar políticas RLS en Supabase** (archivo: setup-documents-rls.sql)
- [ ] **Configurar variables de entorno para producción**
- [ ] **Implementar rate limiting**
- [ ] **Configurar CORS apropiadamente**

## 📋 TAREAS ADICIONALES RECOMENDADAS:

### 1. Configurar RLS en Supabase
```sql
-- Ejecutar en Supabase SQL Editor
-- Ver archivo: setup-documents-rls.sql
```

### 2. Mejorar validaciones
```typescript
// En los DTOs, agregar más validaciones
@IsNotEmpty()
@IsString()
@MaxLength(255)
title: string;

@IsOptional()
@IsArray()
@ArrayMaxSize(10)
tags: string[];
```

### 3. Agregar logging
```typescript
// En los servicios
console.log(`User ${user.id} accessed document ${documentId}`);
```

### 4. Configurar CORS
```typescript
// En main.ts
app.enableCors({
  origin: ['https://tu-frontend.com'],
  credentials: true,
});
```

### 5. Variables de entorno para producción
```env
# Producción
NODE_ENV=production
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-key-de-produccion
```

## 🚨 ANTES DE CONECTAR EL FRONTEND:

1. **Ejecuta el script RLS en Supabase**
2. **Prueba que solo veas tus documentos**
3. **Verifica que los errores se manejen correctamente**
4. **Configura las variables de entorno**

## 💡 CÓDIGO PARA EL FRONTEND:

```typescript
// Servicio de autenticación
const token = localStorage.getItem('supabase.auth.token');

// Headers para requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Ejemplo de request
const response = await fetch('http://localhost:3001/documentos', {
  method: 'GET',
  headers
});
```
