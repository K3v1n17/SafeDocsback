import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RoleGuard } from './role.guard';
import { ShareTokenService } from './share-token.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseAuthGuard,
    RoleGuard,
    ShareTokenService,
    SupabaseService,
    Reflector
  ],
  exports: [
    SupabaseAuthGuard,
    RoleGuard,
    ShareTokenService,
    SupabaseService
  ]
})
export class AuthModule {}