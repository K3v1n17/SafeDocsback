import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  ValidationPipe, 
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Req,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { UploadDocumentDto } from './dto/upload-documento.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseUser } from '../auth/supabase-user.interface';

@Controller('documentos')
@UseGuards(SupabaseAuthGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  private extractTokenFromRequest(req: Request): string {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : '';
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createDocumentoDto: CreateDocumentoDto,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    // Solo asegurar que el owner_id sea del usuario autenticado
    // Supabase RLS se encarga del resto de permisos
    createDocumentoDto.owner_id = user.id;
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.create(createDocumentoDto, token);
  }

  @Get()
  findAll(@CurrentUser() user: SupabaseUser, @Req() req: Request) {
    // El token JWT automáticamente determina qué documentos puede ver:
    // - Si es admin: ve todos los documentos
    // - Si es owner: ve solo sus documentos
    // - Si es auditor: ve metadatos de todos
    // - Si es recipient: ve solo documentos compartidos con él
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.findAll(token);
  }



  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @UploadedFile() file: any,
    @Body(ValidationPipe) uploadData: UploadDocumentDto,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validar tipo de archivo
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Validar tamaño del archivo (10MB máximo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum 10MB allowed');
    }

    const token = this.extractTokenFromRequest(req);
    
    // Crear el DTO para el servicio usando las propiedades correctas
    const createDocumentoDto: CreateDocumentoDto = {
      title: uploadData.title || uploadData.titulo || file.originalname,
      description: uploadData.description || uploadData.contenido || `Archivo subido: ${file.originalname}`,
      doc_type: uploadData.doc_type || uploadData.tipo || this.getDocumentTypeFromMime(file.mimetype),
      tags: uploadData.tags || (uploadData.etiquetas ? JSON.parse(uploadData.etiquetas) : []),
      owner_id: user.id,
      mime_type: file.mimetype,
      file_size: file.size,
      file_path: '', // Se asignará en el servicio
      checksum_sha256: '' // Se calculará en el servicio
    };
    
    return this.documentosService.createWithFile(createDocumentoDto, file, token);
  }

  private getDocumentTypeFromMime(mimeType: string): string {
    const typeMap = {
      'application/pdf': 'pdf',
      'application/msword': 'documento',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
      'text/plain': 'texto',
      'image/jpeg': 'imagen',
      'image/png': 'imagen',
      'image/gif': 'imagen'
    };
    
    return typeMap[mimeType] || 'archivo';
  }



  @Get('my-documents')
  findMyDocuments(@CurrentUser() user: SupabaseUser, @Req() req: Request) {
    // Endpoint específico para obtener MIS documentos (como propietario)
    // Usa el user.id del token, no necesita parámetros
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.findByOwner(user.id, token);
  }

  @Get('tags')
  findByTags(
    @Query('tags') tags: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    if (!tags) {
      throw new BadRequestException('Tags parameter is required');
    }
    const tagArray = tags.split(',').map(tag => tag.trim());
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.findByTags(tagArray, token);
  }

  @Get('search')
  searchDocuments(
    @Query('q') query: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    // Endpoint para búsqueda futura - por ahora solo devuelve todos
    // TODO: Implementar búsqueda por título, descripción, etc.
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.findAll(token);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    // Supabase RLS se encarga de verificar permisos
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(ValidationPipe) updateDocumentoDto: UpdateDocumentoDto,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    // Supabase RLS permitirá la actualización solo si el usuario tiene permisos
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.update(id, updateDocumentoDto, user.id, token);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    // Supabase RLS permitirá la eliminación solo si el usuario tiene permisos
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.remove(id, user.id, token);
  }

  @Post(':id/verify')
  async verifyChecksum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('checksum') checksum: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    if (!checksum) {
      throw new BadRequestException('Checksum is required');
    }
    
    const token = this.extractTokenFromRequest(req);
    const isValid = await this.documentosService.verifyChecksum(id, checksum, token);
    
    return {
      documentId: id,
      providedChecksum: checksum,
      isValid,
      message: isValid ? 'Document integrity verified' : 'Document integrity check failed'
    };
  }
}
