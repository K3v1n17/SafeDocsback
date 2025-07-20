import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateSecureShareDto {
  @IsUUID()
  sharedWithUserId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
