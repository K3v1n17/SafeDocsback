import { IsUUID, IsOptional, IsString, IsBoolean } from 'class-validator';

// DTO adaptado a tu estructura existente de document_shares
export class CreateShareDto {
  @IsUUID()
  documentId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string; // ISO date string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateShareDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ShareAccessDto {
  @IsString()
  shareToken: string;
}

// Response interfaces adaptadas a tu esquema
export interface DocumentShareResponse {
  id: string;
  document_id: string;
  created_by: string;
  share_token: string;
  title?: string;
  message?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  
  // Datos del documento (cuando se incluyen)
  document?: {
    id: string;
    title: string;
    description?: string;
    doc_type?: string;
    owner_id: string;
  };
}

export interface ShareViewResponse {
  share: DocumentShareResponse;
  document: {
    id: string;
    title: string;
    description?: string;
    doc_type?: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    created_at: string;
  };
  // NO incluir datos sensibles como checksum o file_url completa
}
