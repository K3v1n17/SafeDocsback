import { Module } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SharedSecurityModule } from '../shared/shared-security.module';

@Module({
  imports: [SharedSecurityModule],
  controllers: [DocumentosController],
  providers: [
    DocumentosService, 
    SupabaseAuthGuard,
  ],
  exports: [DocumentosService],
})
export class DocumentosModule {}
