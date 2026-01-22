<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS Logo" />
  </a>
</p>

<p align="center">
  Backend desarrollado con <b>NestJS</b> para el proyecto <b>SafeDocs</b>, orientado a la gestión segura de documentos mediante una arquitectura modular y escalable.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-TypeScript-red" alt="NestJS" />
  <img src="https://img.shields.io/badge/Node.js-v18+-green" alt="Node.js" />
  <img src="https://img.shields.io/badge/Estado-En%20desarrollo-yellow" alt="Estado del proyecto" />
</p>

---

## 📄 Descripción

**SafeDocs Backend** es el componente servidor de la aplicación SafeDocs.  
Su función principal es exponer una **API REST** para la gestión segura de documentos y usuarios, aplicando buenas prácticas de desarrollo backend y principios de arquitectura modular.

El proyecto fue desarrollado con fines **académicos**, utilizando el framework NestJS y servicios de backend proporcionados por Supabase.

---

## 🚀 Funcionalidades Principales

- Autenticación y autorización de usuarios  
- Gestión de usuarios  
- Carga, almacenamiento y recuperación de documentos  
- Control de acceso a recursos  
- Validación de datos y manejo centralizado de errores  
- API REST para integración con el frontend  

---

## 🛠️ Tecnologías Utilizadas

- **Framework:** NestJS  
- **Lenguaje:** TypeScript  
- **Runtime:** Node.js  
- **Base de datos / Backend as a Service:** Supabase  
- **Arquitectura:** API REST  
- **Gestor de paquetes:** pnpm  
- **Control de versiones:** Git  

---

## 📁 Estructura del Proyecto

```text
src/
├── auth/                # Módulo de autenticación y autorización
├── documentos/          # Módulo de gestión de documentos
├── supabase/            # Configuración e integración con Supabase
├── app.controller.ts    # Controlador principal de la aplicación
├── app.service.ts       # Servicio principal con lógica base
├── app.module.ts        # Módulo raíz de la aplicación
└── main.ts              # Punto de entrada de la aplicación


📌 Estado del Proyecto

📍 Proyecto académico / en desarrollo
Algunas funcionalidades pueden encontrarse en evolución o sujetas a mejoras.
