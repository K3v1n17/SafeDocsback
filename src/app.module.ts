import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentosModule } from './documentos/documentos.module';
import { AuthModule } from './auth/auth.module';
import { SharedSecurityModule } from './shared/shared-security.module';
import { RateLimitMiddleware } from './common/rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),
    SharedSecurityModule,
    AuthModule,
    DocumentosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas las rutas
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('*');
  }
}
