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
  BadRequestException
} from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseUser } from '../auth/supabase-user.interface';

@Controller('documentos')
@UseGuards(SupabaseAuthGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createDocumentoDto: CreateDocumentoDto,
    @CurrentUser() user: SupabaseUser
  ) {
    // Solo asegurar que el owner_id sea del usuario autenticado
    // Supabase RLS se encarga del resto de permisos
    createDocumentoDto.owner_id = user.id;
    return this.documentosService.create(createDocumentoDto);
  }

  @Get()
  findAll(@CurrentUser() user: SupabaseUser) {
    // El token JWT automáticamente determina qué documentos puede ver:
    // - Si es admin: ve todos los documentos
    // - Si es owner: ve solo sus documentos
    // - Si es auditor: ve metadatos de todos
    // - Si es recipient: ve solo documentos compartidos con él
    return this.documentosService.findAll();
  }

  @Get('my-documents')
  findMyDocuments(@CurrentUser() user: SupabaseUser) {
    // Endpoint específico para obtener MIS documentos (como propietario)
    // Usa el user.id del token, no necesita parámetros
    return this.documentosService.findByOwner(user.id);
  }

  @Get('tags')
  findByTags(
    @Query('tags') tags: string,
    @CurrentUser() user: SupabaseUser
  ) {
    if (!tags) {
      throw new BadRequestException('Tags parameter is required');
    }
    const tagArray = tags.split(',').map(tag => tag.trim());
    return this.documentosService.findByTags(tagArray);
  }

  @Get('search')
  searchDocuments(
    @Query('q') query: string,
    @CurrentUser() user: SupabaseUser
  ) {
    // Endpoint para búsqueda futura - por ahora solo devuelve todos
    // TODO: Implementar búsqueda por título, descripción, etc.
    return this.documentosService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser
  ) {
    // Supabase RLS se encarga de verificar permisos
    return this.documentosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(ValidationPipe) updateDocumentoDto: UpdateDocumentoDto,
    @CurrentUser() user: SupabaseUser
  ) {
    // Supabase RLS permitirá la actualización solo si el usuario tiene permisos
    return this.documentosService.update(id, updateDocumentoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser
  ) {
    // Supabase RLS permitirá la eliminación solo si el usuario tiene permisos
    return this.documentosService.remove(id);
  }

  @Post(':id/verify')
  async verifyChecksum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('checksum') checksum: string,
    @CurrentUser() user: SupabaseUser
  ) {
    if (!checksum) {
      throw new BadRequestException('Checksum is required');
    }
    
    const isValid = await this.documentosService.verifyChecksum(id, checksum);
    
    return {
      documentId: id,
      providedChecksum: checksum,
      isValid,
      message: isValid ? 'Document integrity verified' : 'Document integrity check failed'
    };
  }
}
