import { IsNotEmpty, IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';

export class GrantTemporaryAccessDto {
  @IsNotEmpty()
  @IsString()
  sharedWithUserId: string;

  @IsOptional()
  @IsIn(['view', 'download', 'edit'])
  permissionLevel?: string = 'view';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760) // Máximo 1 año (365 días * 24 horas)
  expiresInHours?: number = 24;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareMessage?: string;
}

export class VerifyAccessDto {
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}
