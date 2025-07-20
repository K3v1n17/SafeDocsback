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

  // 🔒 Habilitar CORS con configuración para cookies y múltiples orígenes
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.22:3000',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PROD,
  ].filter(Boolean); // Filtrar valores undefined/null

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
      if (!origin) return callback(null, true);
      
      // Verificar si el origin está en la lista de permitidos
      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS: Origin '${origin}' allowed`);
        return callback(null, true);
      }
      
      // En desarrollo, permitir cualquier IP local
      if (process.env.NODE_ENV === 'development') {
        const isLocalNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/;
        if (isLocalNetwork.test(origin)) {
          console.log(`✅ CORS (dev): Local origin '${origin}' allowed`);
          return callback(null, true);
        }
      }
      
      console.warn(`🚫 CORS: Origin '${origin}' not allowed. Allowed origins:`, allowedOrigins);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // 🍪 Permitir cookies en requests CORS
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
