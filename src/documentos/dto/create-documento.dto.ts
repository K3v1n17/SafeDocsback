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

  // Los siguientes campos se generan automáticamente en el servicio
  @IsString()
  @IsOptional()
  mime_type?: string;

  @IsNumber()
  @IsOptional()
  file_size?: number;

  @IsString()
  @IsOptional()
  file_path?: string;

  @IsString()
  @IsOptional()
  checksum_sha256?: string;
}
