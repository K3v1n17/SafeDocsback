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
import { ShareDocumentDto, UnshareDocumentDto } from './dto/share-document.dto';
import { SimpleShareDto } from './dto/share-document-adapted.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseUser } from '../auth/supabase-user.interface';

@Controller('documentos')
@UseGuards(SupabaseAuthGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  private extractTokenFromRequest(req: Request): string {
    // 🍪 PRIMERO: Intentar obtener token de cookies HttpOnly (sistema principal)
    const cookieToken = req.cookies?.access_token;
    if (cookieToken) {
      console.log('🍪 Token obtenido de cookies HttpOnly en DocumentosController');
      return cookieToken;
    }

    // 🔑 FALLBACK: Intentar obtener token del header Authorization (para compatibilidad con frontend)
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      console.log('🔑 Token obtenido de Authorization header en DocumentosController (fallback)');
      return token;
    }

    console.log('❌ No se encontró token en cookies ni headers en DocumentosController');
    return '';
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

  @Get('shared-with-me')
  async getSharedWithMe(
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    try {
      console.log('🔍 User info in getSharedWithMe:', {
        userId: user.id,
        email: user.email,
        userIdType: typeof user.id
      });

      // Validar que el user.id sea un UUID válido
      if (!user.id || typeof user.id !== 'string') {
        console.error('❌ Invalid user ID:', user.id);
        return {
          success: false,
          error: 'Usuario no válido',
          message: 'ID de usuario no encontrado o inválido'
        };
      }

      const token = this.extractTokenFromRequest(req);
      const sharedDocuments = await this.documentosService.getSharedWithMe(user.id, token);
      
      // Formato esperado por el frontend
      return {
        success: true,
        data: sharedDocuments
      };
    } catch (error) {
      console.error('Error in getSharedWithMe controller:', error);
      return {
        success: false,
        error: 'Error al obtener documentos compartidos',
        message: error.message
      };
    }
  }

  @Get('my-shared')
  @HttpCode(HttpStatus.OK)
  async getMySharedDocuments(@CurrentUser() user: SupabaseUser, @Req() req: Request) {
    const token = this.extractTokenFromRequest(req);
    
    try {
      const myShares = await this.documentosService.getMySharedDocuments(user.id, token);
      return {
        success: true,
        data: myShares
      };
    } catch (error) {
      console.error('Error in getMySharedDocuments:', error);
      throw error;
    }
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
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    
    const token = this.extractTokenFromRequest(req);
    const isValid = await this.documentosService.verifyChecksum(id, token);
    
    return {
      documentId: id,
      isValid,
      message: isValid ? 'Document integrity verified' : 'Document integrity check failed'
    };
  }

  // 🔐 NUEVOS ENDPOINTS PARA COMPARTIR DOCUMENTOS

  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  async shareDocument(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Body(ValidationPipe) shareDto: { sharedWithUserId: string; expiresAt?: string },
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.shareDocument(
      documentId,
      shareDto.sharedWithUserId,
      user.id,
      token,
      shareDto.expiresAt
    );
  }

  @Delete(':id/share/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unshareDocument(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Param('userId', ParseUUIDPipe) sharedWithUserId: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.unshareDocument(documentId, sharedWithUserId, user.id, token);
  }

  @Get(':id/shares')
  async getDocumentShares(
    @Param('id', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.getDocumentShares(documentId, user.id, token);
  }

  // 🚀 NUEVOS ENDPOINTS PARA SISTEMA SEGURO DE COMPARTIR

  @Post(':id/secure-share')
  @HttpCode(HttpStatus.CREATED)
  async createSecureShare(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Body(ValidationPipe) shareDto: {
      sharedWithUserId: string;
      title?: string;
      message?: string;
      expiresAt?: string;
    },
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.createSecureShare(
      documentId,
      shareDto.sharedWithUserId,
      user.id,
      token,
      shareDto.title,
      shareDto.message,
      shareDto.expiresAt
    );
  }

  @Get('shared/:shareToken')
  async getSecureSharedDocument(
    @Param('shareToken') shareToken: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    try {
      const token = this.extractTokenFromRequest(req);
      const sharedDocument = await this.documentosService.getSecureSharedDocument(shareToken, user.id, token);
      
      // El service ya devuelve el formato correcto con success: true
      return sharedDocument;
    } catch (error) {
      console.error('Error in getSecureSharedDocument controller:', error);
      return {
        success: false,
        error: 'Documento compartido no encontrado o acceso denegado',
        message: error.message
      };
    }
  }

  @Delete('shares/:shareId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.revokeShare(shareId, user.id, token);
  }

  // ============================================================================
  // ENDPOINTS PARA ACCESO TEMPORAL USANDO document_shares
  // ============================================================================

  @Post('simple-share')
  @HttpCode(HttpStatus.CREATED)
  async simpleShareDocument(
    @Body(ValidationPipe) shareDto: SimpleShareDto,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    try {
      const token = this.extractTokenFromRequest(req);
      
      console.log('📤 Simple share request:', {
        documentId: shareDto.documentId,
        sharedWithUserId: shareDto.sharedWithUserId,
        sharedByUserId: user.id,
        permissionLevel: shareDto.permissionLevel || 'read'
      });

      return await this.documentosService.simpleShareDocument(
        shareDto.documentId,
        shareDto.sharedWithUserId,
        user.id,
        shareDto.permissionLevel || 'read',
        shareDto.expiresInHours || 24,
        shareDto.shareTitle,
        shareDto.shareMessage,
        token
      );
    } catch (error) {
      console.error('❌ Error in simpleShareDocument controller:', error);
      return {
        success: false,
        error: 'Error al compartir documento',
        message: error.message
      };
    }
  }

  @Get(':id/verify-share-access')
  async verifyShareAccess(
    @Param('id', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    return this.documentosService.verifyDocumentShareAccess(
      documentId,
      user.id,
      token
    );
  }

  // ============================================================================
  // ENDPOINTS ADICIONALES PARA COMPARTIR DOCUMENTOS
  // ============================================================================

  @Get(':id/permission-check')
  @HttpCode(HttpStatus.OK)
  async checkDocumentPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permission') permission: string = 'read',
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    
    try {
      const hasPermission = await this.documentosService.checkDocumentPermission(
        id,
        user.id,
        permission,
        token
      );
      
      return {
        success: true,
        hasPermission,
        documentId: id,
        userId: user.id,
        permission
      };
    } catch (error) {
      console.error('Error in checkDocumentPermission:', error);
      throw error;
    }
  }

  @Get(':id/with-permission-check')
  @HttpCode(HttpStatus.OK)
  async getDocumentWithPermissionCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    
    try {
      const document = await this.documentosService.getDocumentWithPermissionCheck(
        id,
        user.id,
        token
      );
      
      return {
        success: true,
        document
      };
    } catch (error) {
      console.error('Error in getDocumentWithPermissionCheck:', error);
      throw error;
    }
  }

  @Post('cleanup-expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredShares(@CurrentUser() user: SupabaseUser, @Req() req: Request) {
    const token = this.extractTokenFromRequest(req);
    
    try {
      const cleanedCount = await this.documentosService.cleanupExpiredShares(token);
      
      return {
        success: true,
        message: `Se limpiaron ${cleanedCount} shares expirados`,
        cleanedCount
      };
    } catch (error) {
      console.error('Error in cleanupExpiredShares:', error);
      throw error;
    }
  }
}
