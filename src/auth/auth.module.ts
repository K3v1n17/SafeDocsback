import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ShareController } from './share.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [AuthController, ShareController],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class AuthModule {}