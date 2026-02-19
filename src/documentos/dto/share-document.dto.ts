import { IsUUID, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum PermissionLevel {
  READ = 'read'
}

export class ShareDocumentDto {
  @IsUUID()
  documentId: string;

  @IsUUID()
  sharedWithUserId: string;

  @IsEnum(PermissionLevel)
  @IsOptional()
  permissionLevel?: PermissionLevel = PermissionLevel.READ;

  @IsDateString()
  @IsOptional()
  expiresAt?: string; // Para compartir temporal
}

export class UnshareDocumentDto {
  @IsUUID()
  documentId: string;

  @IsUUID()
  sharedWithUserId: string;
}

export class DocumentShareResponse {
  id: string;
  documentId: string;
  documentTitle: string;
  ownerId: string;
  ownerName: string;
  sharedWithUserId: string;
  sharedWithUserName: string;
  permissionLevel: string;
  sharedAt: string;
  expiresAt?: string;
  isActive: boolean;
}
