import { IsString, IsOptional, IsArray } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  titulo?: string; // Para compatibilidad con frontend

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  contenido?: string; // Para compatibilidad con frontend

  @IsString()
  @IsOptional()
  doc_type?: string;

  @IsString()
  @IsOptional()
  tipo?: string; // Para compatibilidad con frontend

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  etiquetas?: string; // Para compatibilidad con frontend (JSON string)
}
