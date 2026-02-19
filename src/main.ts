import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalErrorInterceptor } from './common/global-error.interceptor';
import { ErrorHandlerService } from './common/error-handler.service';
import { SecureConfigService } from './config/secure-config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Obtener servicios de configuración
    const secureConfig = app.get(SecureConfigService);
    const errorHandler = app.get(ErrorHandlerService);
    
    // 🛡️ Headers de seguridad básicos (sin helmet)
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      if (secureConfig.isProduction()) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      next();
    });
    
    // 🍪 Habilitar manejo de cookies
    app.use(cookieParser());
    
    // 🔍 Middleware de logging seguro (solo en desarrollo)
    if (secureConfig.isDevelopment()) {
      app.use((req, res, next) => {
        if (req.url.includes('/documentos') || req.url.includes('/auth')) {
          logger.debug(`${req.method} ${req.url}`);
          logger.debug(`Origin: ${req.headers.origin}`);
          logger.debug(`Has Cookies: ${!!req.cookies && Object.keys(req.cookies).length > 0}`);
        }
        next();
      });
    }
    
    // � Configurar interceptor global de errores
    app.useGlobalInterceptors(new GlobalErrorInterceptor(errorHandler));
    
    // 🔍 Habilitar validación global con configuración segura
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        disableErrorMessages: secureConfig.isProduction(), // No exponer detalles en producción
        validationError: {
          target: false,  // No incluir el objeto original
          value: false,   // No incluir el valor que falló
        },
      }),
    );

    // 🔒 Configurar CORS con mejores prácticas de seguridad
    const corsOrigins = secureConfig.isDevelopment() 
      ? [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // IPs locales en desarrollo
        ]
      : [
          secureConfig.getFrontendUrl(),
          /^https:\/\/.*\.vercel\.app$/, // Dominios Vercel
        ].filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        // Permitir requests sin origin solo en desarrollo (Postman, etc.)
        if (!origin && secureConfig.isDevelopment()) {
          return callback(null, true);
        }
        
        if (!origin) {
          return callback(new Error('Origin required'), false);
        }
        
        // Verificar origins permitidos
        const isAllowed = corsOrigins.some(allowedOrigin => {
          if (typeof allowedOrigin === 'string') {
            return allowedOrigin === origin;
          }
          if (allowedOrigin instanceof RegExp) {
            return allowedOrigin.test(origin);
          }
          return false;
        });
        
        if (isAllowed) {
          return callback(null, true);
        }
        
        logger.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true, // 🍪 Permitir cookies en requests CORS
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Cookie',
        'X-Requested-With',
        'X-Client-Info'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining', 
        'X-RateLimit-Reset'
      ],
      maxAge: 86400, // Cache preflight por 24 horas
    });

    // 🚀 Iniciar servidor
    const port = secureConfig.getPort();
    await app.listen(port);
    
    logger.log(`🚀 SafeDocs Backend started on port ${port}`);
    logger.log(`🌍 Environment: ${secureConfig.isProduction() ? 'Production' : 'Development'}`);
    logger.log(`🔒 Security features enabled`);
    
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  Logger.error('Bootstrap failed', error);
  process.exit(1);
});
