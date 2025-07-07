import { Module } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Module({
  controllers: [DocumentosController],
  providers: [DocumentosService, SupabaseService, SupabaseAuthGuard],
  exports: [DocumentosService],
})
export class DocumentosModule {}
