import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ShareController } from './share.controller';
import { SharedSecurityModule } from '../shared/shared-security.module';

@Module({
  imports: [SharedSecurityModule],
  controllers: [AuthController, ShareController],
  providers: [],
  exports: [],
})
export class AuthModule {}