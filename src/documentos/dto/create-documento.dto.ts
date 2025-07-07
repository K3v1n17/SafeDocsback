import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber, IsUUID } from 'class-validator';

export class CreateDocumentoDto {
  @IsUUID()
  @IsOptional()
  owner_id?: string; // Se asigna automáticamente del usuario autenticado

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  doc_type?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsNumber()
  @IsNotEmpty()
  file_size: number;

  @IsString()
  @IsNotEmpty()
  file_path: string;

  @IsString()
  @IsNotEmpty()
  checksum_sha256: string;
}
