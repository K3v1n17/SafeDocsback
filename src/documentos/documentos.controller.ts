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
  ForbiddenException
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
    // Asegurar que el owner_id sea del usuario autenticado
    createDocumentoDto.owner_id = user.id;
    return this.documentosService.create(createDocumentoDto);
  }

  @Get()
  findAll(@CurrentUser() user: SupabaseUser) {
    // Solo retornar documentos del usuario autenticado
    return this.documentosService.findByOwner(user.id);
  }

  @Get('owner/:ownerId')
  findByOwner(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @CurrentUser() user: SupabaseUser
  ) {
    // Solo permitir ver documentos propios
    if (ownerId !== user.id) {
      throw new ForbiddenException('You can only access your own documents');
    }
    return this.documentosService.findByOwner(ownerId);
  }

  @Get('tags')
  findByTags(
    @Query('tags') tags: string,
    @CurrentUser() user: SupabaseUser
  ) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    return this.documentosService.findByTagsAndOwner(tagArray, user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser
  ) {
    const documento = await this.documentosService.findOne(id);
    // Verificar que el documento pertenece al usuario
    if (documento.owner_id !== user.id) {
      throw new ForbiddenException('You can only access your own documents');
    }
    return documento;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(ValidationPipe) updateDocumentoDto: UpdateDocumentoDto,
    @CurrentUser() user: SupabaseUser
  ) {
    const documento = await this.documentosService.findOne(id);
    // Verificar que el documento pertenece al usuario
    if (documento.owner_id !== user.id) {
      throw new ForbiddenException('You can only modify your own documents');
    }
    return this.documentosService.update(id, updateDocumentoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser
  ) {
    const documento = await this.documentosService.findOne(id);
    // Verificar que el documento pertenece al usuario
    if (documento.owner_id !== user.id) {
      throw new ForbiddenException('You can only delete your own documents');
    }
    return this.documentosService.remove(id);
  }

  @Post(':id/verify')
  async verifyChecksum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('checksum') checksum: string,
    @CurrentUser() user: SupabaseUser
  ) {
    const documento = await this.documentosService.findOne(id);
    // Verificar que el documento pertenece al usuario
    if (documento.owner_id !== user.id) {
      throw new ForbiddenException('You can only verify your own documents');
    }
    return this.documentosService.verifyChecksum(id, checksum);
  }
}
