import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 🍪 Habilitar manejo de cookies
  app.use(cookieParser());
  
  // 🔍 Middleware de diagnóstico
  app.use((req, res, next) => {
    if (req.url.includes('/documentos') || req.url.includes('/auth/me')) {
      console.log('🔍 ===== REQUEST DIAGNOSTIC =====');
      console.log(`📡 ${req.method} ${req.url}`);
      console.log('🌐 Origin:', req.headers.origin);
      console.log('🍪 Raw Cookie Header:', req.headers.cookie);
      console.log('🍪 Parsed Cookies:', req.cookies);
      console.log('🔑 Authorization:', req.headers.authorization);
      console.log('===============================');
    }
    next();
  });
  
  // Habilitar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 🔒 Habilitar CORS con configuración para cookies
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // 🍪 Permitir cookies en requests CORS
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization' , 'Cookie'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
