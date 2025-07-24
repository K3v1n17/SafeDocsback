import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecureConfigService } from '../config/secure-config.service';
import { ErrorHandlerService } from '../common/error-handler.service';
import { ValidationService } from '../common/validation.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Módulo compartido que exporta servicios comunes de seguridad
 * Evita duplicación de dependencias entre módulos
 */
@Module({
  imports: [ConfigModule],
  providers: [
    SecureConfigService,
    ErrorHandlerService,
    ValidationService,
    SupabaseService,
  ],
  exports: [
    SecureConfigService,
    ErrorHandlerService,
    ValidationService,
    SupabaseService,
  ],
})
export class SharedSecurityModule {}
