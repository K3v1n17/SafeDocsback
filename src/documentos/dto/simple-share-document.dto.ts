import { IsString, IsOptional, IsUUID, IsNumber, IsIn, Min, Max } from 'class-validator';

export class SimpleShareDocumentDto {
  @IsUUID()
  documentId: string;

  @IsUUID()
  sharedWithUserId: string;

  @IsOptional()
  @IsString()
  @IsIn(['read', 'write', 'admin'])
  permissionLevel?: string = 'read';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8760) // Máximo 1 año
  expiresInHours?: number = 24;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareMessage?: string;
}
