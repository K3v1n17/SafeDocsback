import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { Documento } from './entities/documento.entity';
import { SupabaseUser } from '../auth/supabase-user.interface';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentosService {
  constructor(private supabaseService: SupabaseService) {}

  // 🔐 Verificar si el usuario es admin
  private async isAdmin(userId: string, userToken: string): Promise<boolean> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('Error checking user role:', error);
      return false;
    }

    return data?.role === 'admin';
  }

  // 🔐 Verificar si el usuario puede editar el documento (es propietario o admin)
  private async canEditDocument(documentId: string, userId: string, userToken: string): Promise<boolean> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Verificar si es admin
    const isUserAdmin = await this.isAdmin(userId, userToken);
    if (isUserAdmin) {
      return true;
    }

    // Verificar si es propietario del documento
    const { data, error } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (error) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    return data.owner_id === userId;
  }

  async create(createDocumentoDto: CreateDocumentoDto, userToken: string): Promise<Documento> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Solo los usuarios autenticados pueden crear documentos
    // El owner_id debe ser establecido por el controlador
    const { data, error } = await supabase
      .from('documents')
      .insert([createDocumentoDto])
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error creating document: ${error.message}`);
    }

    return data;
  }

  async findAll(userToken: string): Promise<Documento[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Obtener el usuario actual desde el token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new BadRequestException('Invalid token or user not found');
    }

    // Verificar si el usuario es admin
    const isUserAdmin = await this.isAdmin(user.id, userToken);
    
    let query = supabase.from('documents').select('*');
    
    // Si NO es admin, filtrar solo por sus documentos
    if (!isUserAdmin) {
      query = query.eq('owner_id', user.id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching documents: ${error.message}`);
    }

    return data || [];
  }

  async findOne(id: string, userToken: string): Promise<Documento> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Obtener el usuario actual desde el token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new BadRequestException('Invalid token or user not found');
    }

    // Obtener el documento
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    // Verificar permisos: debe ser el propietario o admin
    const isUserAdmin = await this.isAdmin(user.id, userToken);
    
    if (!isUserAdmin && data.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to view this document');
    }

    return data;
  }

  async update(id: string, updateDocumentoDto: UpdateDocumentoDto, userId: string, userToken: string): Promise<Documento> {
    // 🔐 Verificar permisos: solo propietario o admin pueden actualizar
    const canEdit = await this.canEditDocument(id, userId, userToken);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to update this document');
    }

    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    const { data, error } = await supabase
      .from('documents')
      .update({ ...updateDocumentoDto, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error updating document: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return data;
  }

  async remove(id: string, userId: string, userToken: string): Promise<void> {
    // 🔐 Verificar permisos: solo propietario o admin pueden eliminar
    const canEdit = await this.canEditDocument(id, userId, userToken);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to delete this document');
    }

    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Error deleting document: ${error.message}`);
    }
  }

  async findByOwner(ownerId: string, userToken: string): Promise<Documento[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Obtener el usuario actual desde el token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new BadRequestException('Invalid token or user not found');
    }

    // Verificar si el usuario es admin o el propietario
    const isUserAdmin = await this.isAdmin(user.id, userToken);
    
    if (!isUserAdmin && user.id !== ownerId) {
      throw new ForbiddenException('You can only view your own documents');
    }
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching documents: ${error.message}`);
    }

    return data || [];
  }

  async findByTags(tags: string[], userToken: string): Promise<Documento[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    // Obtener el usuario actual desde el token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new BadRequestException('Invalid token or user not found');
    }

    // Verificar si el usuario es admin
    const isUserAdmin = await this.isAdmin(user.id, userToken);
    
    let query = supabase.from('documents').select('*').overlaps('tags', tags);
    
    // Si NO es admin, filtrar solo por sus documentos
    if (!isUserAdmin) {
      query = query.eq('owner_id', user.id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching documents by tags: ${error.message}`);
    }

    return data || [];
  }

  async verifyChecksum(id: string, userToken: string): Promise<boolean> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // 1. Obtener el documento para acceder al file_path
    const { data: documento, error: docError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .single();
    
    if (docError || !documento) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    const { data: verification, error: verificationError } = await supabase
      .from('document_verifications')
      .select('hash_checked')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1);


    if (verificationError || !verification) {
      throw new NotFoundException(`Checksum verification not found for document ID ${id}`);
    }

    // 2. Descargar el archivo desde Supabase Storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('archivos')
      .download(documento.file_path);
    
    if (fileError || !fileData) {
      throw new BadRequestException(`Error downloading file: ${fileError?.message || 'File not found'}`);
    }

    // 3. Calcular el checksum SHA256 del archivo descargado
    const buffer = await fileData.arrayBuffer();
    const documentoChecksum = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

    // 4. Comparar con el checksum recibido
    return documentoChecksum === verification[0].hash_checked;
  }

  // Función para crear verificación inicial del documento
  private async createInitialVerification(documentId: string, checksum: string, userId: string, userToken: string): Promise<boolean> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    try {
      const initialStatus = 'verified';
      const initialIntegrity = 100;
      const initialDetails = [
        'Documento subido correctamente',
        'Hash inicial calculado',
        'Archivo íntegro al momento de subida',
        'Verificación inicial completada'
      ];

      const { error } = await supabase
        .from('document_verifications')
        .insert({
          document_id: documentId,
          run_by: userId,
          status: initialStatus,
          integrity_pct: initialIntegrity,
          hash_checked: checksum,
          details: initialDetails
        });

      if (error) {
        console.error('Error creando verificación inicial:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error en createInitialVerification:', error);
      return false;
    }
  }

  async createWithFile(
    createDocumentoDto: CreateDocumentoDto, 
    file: any, 
    userToken: string
  ): Promise<Documento> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);
    
    try {
      // 1. Generar un nombre único para el archivo (similar al frontend)
      const safeName = file.originalname.trim().replace(/\s+/g, "_");
      const filePath = `public/${createDocumentoDto.owner_id}/${Date.now()}_${safeName}`;
      
      // 2. Calcular el checksum SHA256 del archivo
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
      
      // 3. Subir el archivo al storage de Supabase (bucket 'archivos' como en el frontend)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw new BadRequestException(`Error uploading file: ${uploadError.message}`);
      }

      // 4. Obtener la URL pública del archivo
      const { data: publicUrlData } = supabase.storage
        .from('archivos')
        .getPublicUrl(filePath);

      // 5. Crear el documento en la base de datos con la información del archivo
      const documentData = {
        owner_id: createDocumentoDto.owner_id!,
        title: createDocumentoDto.title,
        description: createDocumentoDto.description || null,
        doc_type: createDocumentoDto.doc_type,
        tags: createDocumentoDto.tags || [],
        mime_type: file.mimetype,
        file_size: file.size,
        file_path: filePath,
        ///file_url: publicUrlData.publicUrl,
        //checksum_sha256: checksum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single();

      if (error) {
        // Si hay error al crear el documento, eliminar el archivo subido
        await supabase.storage
          .from('archivos')
          .remove([filePath]);
        
        throw new BadRequestException(`Error creating document: ${error.message}`);
      }

      // 6. Crear verificación inicial para el documento
      if (data?.id) {
        const verificationCreated = await this.createInitialVerification(
          data.id, 
          checksum, 
          createDocumentoDto.owner_id!, 
          userToken
        );
        if (!verificationCreated) {
          console.warn(`No se pudo crear la verificación inicial para el documento ${data.id}`);
        }
      }

      return data;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error processing file upload: ${error.message}`);
    }
  }

  // 🔐 NUEVO: Métodos para compartir documentos

  async shareDocument(
    documentId: string, 
    sharedWithUserId: string, 
    userId: string, 
    userToken: string,
    expiresAt?: string
  ): Promise<any> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // Verificar que el usuario es el dueño del documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('owner_id, title')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.owner_id !== userId) {
      throw new ForbiddenException('You can only share your own documents');
    }

    // Verificar que el usuario objetivo existe
    const { data: targetUser, error: userError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', sharedWithUserId)
      .single();

    if (userError || !targetUser) {
      throw new BadRequestException('Target user not found');
    }

    // Evitar auto-compartir
    if (userId === sharedWithUserId) {
      throw new BadRequestException('You cannot share a document with yourself');
    }

    // Crear el share
    const shareData = {
      document_id: documentId,
      owner_id: userId,
      shared_with_user_id: sharedWithUserId,
      permission_level: 'read',
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: true
    };

    const { data, error } = await supabase
      .from('document_shares')
      .insert([shareData])
      .select(`
        id,
        document_id,
        owner_id,
        shared_with_user_id,
        permission_level,
        shared_at,
        expires_at,
        is_active
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new BadRequestException('Document is already shared with this user');
      }
      throw new BadRequestException(`Error sharing document: ${error.message}`);
    }

    return data;
  }

  async unshareDocument(
    documentId: string, 
    sharedWithUserId: string, 
    userId: string, 
    userToken: string
  ): Promise<void> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // Verificar que el usuario es el dueño
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.owner_id !== userId) {
      throw new ForbiddenException('You can only unshare your own documents');
    }

    // Eliminar el share
    const { error } = await supabase
      .from('document_shares')
      .delete()
      .eq('document_id', documentId)
      .eq('shared_with_user_id', sharedWithUserId)
      .eq('owner_id', userId);

    if (error) {
      throw new BadRequestException(`Error unsharing document: ${error.message}`);
    }
  }

  async getDocumentShares(documentId: string, userId: string, userToken: string): Promise<any[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // Verificar que el usuario es el dueño del documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('owner_id, title')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.owner_id !== userId) {
      throw new ForbiddenException('You can only view shares of your own documents');
    }

    // Obtener todos los shares del documento con información del usuario
    const { data, error } = await supabase
      .from('document_shares')
      .select(`
        id,
        document_id,
        shared_with_user_id,
        permission_level,
        shared_at,
        expires_at,
        is_active
      `)
      .eq('document_id', documentId)
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new BadRequestException(`Error fetching document shares: ${error.message}`);
    }

    return data || [];
  }

  // 🔐 MÉTODOS PARA COMPARTIR DOCUMENTOS SEGUROS (Token + Usuario Registrado)

  private generateShareToken(): string {
    return crypto.createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-${uuidv4()}`)
      .digest('hex');
  }

  async createSecureShare(
    documentId: string,
    sharedWithUserId: string,
    userId: string,
    userToken: string,
    title?: string,
    message?: string,
    expiresAt?: string
  ): Promise<any> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // 1. Verificar que el usuario es dueño del documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('owner_id, title')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.owner_id !== userId) {
      throw new ForbiddenException('You can only share your own documents');
    }

    // 2. Verificar que el usuario objetivo existe y está activo
    const { data: targetUser, error: userError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('user_id', sharedWithUserId)
      .single();

    if (userError || !targetUser) {
      throw new BadRequestException('Target user not found or not active in the system');
    }

    // 3. Evitar auto-compartir
    if (userId === sharedWithUserId) {
      throw new BadRequestException('You cannot share a document with yourself');
    }

    // 4. Crear share con token seguro
    const shareToken = this.generateShareToken();
    
    const shareData = {
      document_id: documentId,
      created_by: userId,
      shared_with_user_id: sharedWithUserId, // ✅ Usuario específico
      share_token: shareToken,
      title: title || `Shared: ${document.title}`,
      message: message || 'Document shared with you',
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: true,
      permission_level: 'read' // Solo lectura
    };

    const { data, error } = await supabase
      .from('document_shares')
      .insert([shareData])
      .select(`
        id,
        document_id,
        created_by,
        shared_with_user_id,
        share_token,
        title,
        message,
        expires_at,
        is_active,
        permission_level,
        created_at
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Document already shared with this user');
      }
      throw new BadRequestException(`Error creating share: ${error.message}`);
    }

    return {
      ...data,
      share_url: `${process.env.FRONTEND_URL}/shared/${shareToken}`
    };
  }

  async getSecureSharedDocument(shareToken: string, viewerUserId: string, userToken: string): Promise<any> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // 1. Buscar el share y validar
    const { data: share, error: shareError } = await supabase
      .from('document_shares')
      .select(`
        id,
        document_id,
        created_by,
        shared_with_user_id,
        title,
        message,
        expires_at,
        is_active,
        permission_level,
        created_at,
        documents:document_id (
          id,
          title,
          description,
          doc_type,
          mime_type,
          file_size,
          file_path,
          owner_id,
          created_at
        )
      `)
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .single();

    if (shareError || !share) {
      throw new NotFoundException('Share not found or has been revoked');
    }

    // 2. Verificar expiración
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new BadRequestException('Share has expired');
    }

    // 3. ✅ Verificar que el usuario que accede es el destinatario autorizado
    if (share.shared_with_user_id !== viewerUserId) {
      throw new ForbiddenException('You are not authorized to view this shared document');
    }

    // 4. Registrar la vista
    await this.recordSecureShareView(share.id, viewerUserId, userToken);

    // 5. Generar URL firmada temporal para el archivo (si es CDN)
    const signedFileUrl = await this.generateSignedFileUrl(share.documents[0].file_path);

    return {
      success: true,
      data: {
        share: {
          id: share.id,
          title: share.title,
          message: share.message,
          permission_level: share.permission_level,
          created_at: share.created_at,
          expires_at: share.expires_at
        },
        document: {
          id: share.documents[0].id,
          titulo: share.documents[0].title, // Campo esperado por frontend
          contenido: share.documents[0].description,
          tipo: share.documents[0].doc_type,
          file_size: share.documents[0].file_size,
          mime_type: share.documents[0].mime_type,
          created_at: share.documents[0].created_at,
          signed_file_url: signedFileUrl // ✅ URL temporal para descarga/vista
        }
      }
    };
  }

  private async generateSignedFileUrl(filePath: string): Promise<string> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Generar URL firmada de Supabase (válida por 1 hora)
      const { data, error } = await supabase.storage
        .from('archivos')
        .createSignedUrl(filePath, 3600); // 1 hora

      if (error) {
        console.error('Error generating signed URL:', error);
        throw new BadRequestException('Error generating file access URL');
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in generateSignedFileUrl:', error);
      throw new BadRequestException('Error generating file access URL');
    }
  }

  private async recordSecureShareView(shareId: string, viewerId: string, userToken: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClientWithAuth(userToken);
      
      await supabase
        .from('document_share_views')
        .insert([{
          share_id: shareId,
          viewer_id: viewerId,
          viewed_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error recording share view:', error);
      // No fallar por esto
    }
  }

  async getMySharedDocuments(userId: string, userToken: string): Promise<any[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // Documentos que YO he compartido
    const { data, error } = await supabase
      .from('document_shares')
      .select(`
        id,
        document_id,
        shared_with_user_id,
        share_token,
        title,
        message,
        expires_at,
        is_active,
        created_at,
        documents:document_id (
          title,
          doc_type
        )
      `)
      .eq('created_by', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching shared documents: ${error.message}`);
    }

    return data || [];
  }

  // ============================================================================
  // SISTEMA DE ACCESO TEMPORAL USANDO document_shares EXISTENTE
  // ============================================================================

  async getSharedWithMe(userId: string, userToken: string): Promise<any[]> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    try {
      console.log('🔍 Getting shared documents for user:', userId);
      
      // Consulta que aprovecha las nuevas políticas RLS
      const { data: sharesData, error } = await supabase
        .from('document_shares')
        .select(`
          id,
          document_id,
          created_by,
          share_token,
          title,
          message,
          permission_level,
          expires_at,
          is_active,
          created_at,
          shared_with_user_id
        `)
        .eq('shared_with_user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('📋 document_shares query result:', { 
        count: sharesData?.length || 0, 
        error: error?.message 
      });

      if (error) {
        console.error('❌ Error fetching shared documents:', error);
        throw new BadRequestException(`Error fetching shared documents: ${error.message}`);
      }

      if (!sharesData || sharesData.length === 0) {
        console.log('ℹ️ No shared documents found for user:', userId);
        return [];
      }

      console.log('✅ Found shared documents:', sharesData.length);

      // Obtener información de los documentos por separado
      const documentIds = sharesData.map(share => share.document_id);
      
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, title, description, doc_type, created_at, owner_id')
        .in('id', documentIds);

      if (docsError) {
        console.error('❌ Error fetching documents:', docsError);
        throw new BadRequestException(`Error fetching documents: ${docsError.message}`);
      }

      // Mapear datos para compatibilidad con frontend
      const mappedData = sharesData.map(share => {
        const document = documents?.find(doc => doc.id === share.document_id);
        const now = new Date();
        const expiresAt = share.expires_at ? new Date(share.expires_at) : null;
        const isExpired = expiresAt && expiresAt <= now;

        return {
          id: share.id,
          document_id: share.document_id,
          title: share.title || document?.title || 'Documento sin título',
          description: share.message || document?.description || 'Sin descripción',
          doc_type: document?.doc_type || 'unknown',
          permission_level: share.permission_level,
          shared_by: share.created_by,
          expires_at: share.expires_at,
          is_expired: isExpired,
          created_at: share.created_at,
          share_token: share.share_token,
          document: document
        };
      });

      console.log('📤 Returning mapped data:', mappedData.length);
      return mappedData;

    } catch (error) {
      console.error('💥 Error in getSharedWithMe:', error);
      throw new BadRequestException(`Error fetching shared documents: ${error.message || 'Unknown error'}`);
    }
  }

  // ============================================================================
  // MÉTODO SIMPLE PARA COMPARTIR DOCUMENTOS
  // ============================================================================
  async simpleShareDocument(
    documentId: string,
    sharedWithUserId: string,
    sharedByUserId: string,
    permissionLevel: string = 'read',
    expiresInHours: number = 24,
    shareTitle?: string,
    shareMessage?: string,
    userToken?: string
  ): Promise<any> {
    const supabase = userToken 
      ? this.supabaseService.getClientWithAuth(userToken)
      : this.supabaseService.getClient();

    try {
      console.log('🔗 Simple share document:', {
        documentId,
        sharedWithUserId,
        sharedByUserId,
        permissionLevel,
        expiresInHours
      });

      // Verificar que el documento existe y el usuario tiene permisos
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, title, owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        throw new BadRequestException('Documento no encontrado');
      }

      if (document.owner_id !== sharedByUserId) {
        throw new BadRequestException('No tienes permisos para compartir este documento');
      }

      // Generar token único usando la función de la base de datos
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_share_token');

      if (tokenError) {
        console.error('❌ Error generating token:', tokenError);
        throw new BadRequestException('Error generando token de compartir');
      }

      const shareToken = tokenData;

      // Calcular fecha de expiración
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      // Crear share directamente en la tabla (sin RLS problemas)
      const { data: shareData, error: shareError } = await supabase
        .from('document_shares')
        .insert({
          document_id: documentId,
          shared_with_user_id: sharedWithUserId,
          created_by: sharedByUserId,
          share_token: shareToken,
          title: shareTitle || document.title,
          message: shareMessage || 'Documento compartido contigo',
          permission_level: permissionLevel,
          expires_at: expiresAt.toISOString(),
          is_active: true
        })
        .select('*')
        .single();

      if (shareError) {
        console.error('❌ Error creating share:', shareError);
        
        // Si es error de duplicado, intentar actualizar
        if (shareError.code === '23505') {
          console.log('🔄 Duplicate share found, updating...');
          const { data: updateData, error: updateError } = await supabase
            .from('document_shares')
            .update({
              share_token: shareToken,
              title: shareTitle || document.title,
              message: shareMessage || 'Documento compartido contigo',
              permission_level: permissionLevel,
              expires_at: expiresAt.toISOString(),
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('document_id', documentId)
            .eq('shared_with_user_id', sharedWithUserId)
            .select('*')
            .single();

          if (updateError) {
            throw new BadRequestException(`Error al actualizar share: ${updateError.message}`);
          }

          return {
            success: true,
            message: 'Documento compartido exitosamente (actualizado)',
            share: updateData,
            share_token: shareToken
          };
        }

        throw new BadRequestException(`Error al compartir documento: ${shareError.message}`);
      }

      console.log('✅ Share created successfully:', shareData);

      return {
        success: true,
        message: 'Documento compartido exitosamente',
        share: shareData,
        share_token: shareToken
      };

    } catch (error) {
      console.error('💥 Error in simpleShareDocument:', error);
      throw new BadRequestException(`Error al compartir documento: ${error.message || 'Unknown error'}`);
    }
  }

  // Verificar acceso usando document_shares
  async verifyDocumentShareAccess(
    documentId: string,
    userId: string,
    userToken?: string
  ): Promise<any> {
    const supabase = userToken 
      ? this.supabaseService.getClientWithAuth(userToken)
      : this.supabaseService.getClient();

    try {
      console.log('🔍 Verifying document share access:', { documentId, userId });

      const { data, error } = await supabase
        .rpc('verify_document_share_access', {
          p_document_id: documentId,
          p_user_id: userId
        });

      if (error) {
        console.error('❌ Error verifying share access:', error);
        throw new BadRequestException(`Error al verificar acceso: ${error.message}`);
      }

      console.log('✅ Access verification result:', data);
      return data;

    } catch (error) {
      console.error('💥 Error in verifyDocumentShareAccess:', error);
      throw new BadRequestException(`Error al verificar acceso: ${error.message || 'Unknown error'}`);
    }
  }

  async revokeShare(shareId: string, userId: string, userToken: string): Promise<void> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    // Solo el creador puede revocar
    const { data: share, error: shareError } = await supabase
      .from('document_shares')
      .select('created_by')
      .eq('id', shareId)
      .single();

    if (shareError || !share) {
      throw new NotFoundException(`Share with ID ${shareId} not found`);
    }

    if (share.created_by !== userId) {
      throw new ForbiddenException('You can only revoke shares you created');
    }

    const { error } = await supabase
      .from('document_shares')
      .update({ is_active: false })
      .eq('id', shareId);

    if (error) {
      throw new BadRequestException(`Error revoking share: ${error.message}`);
    }
  }

  // ============================================================================
  // VERIFICACIÓN DE PERMISOS CON NUEVAS POLÍTICAS RLS
  // ============================================================================
  async checkDocumentPermission(
    documentId: string,
    userId: string,
    requiredPermission: string = 'read',
    userToken?: string
  ): Promise<boolean> {
    const supabase = userToken 
      ? this.supabaseService.getClientWithAuth(userToken)
      : this.supabaseService.getClient();

    try {
      console.log('🔐 Checking document permission:', {
        documentId,
        userId,
        requiredPermission
      });

      const { data, error } = await supabase
        .rpc('check_document_share_permission', {
          doc_id: documentId,
          user_id: userId,
          required_permission: requiredPermission
        });

      if (error) {
        console.error('❌ Error checking permission:', error);
        return false;
      }

      console.log('✅ Permission check result:', data);
      return data === true;

    } catch (error) {
      console.error('💥 Error in checkDocumentPermission:', error);
      return false;
    }
  }

  // Limpiar shares expirados
  async cleanupExpiredShares(userToken?: string): Promise<number> {
    const supabase = userToken 
      ? this.supabaseService.getClientWithAuth(userToken)
      : this.supabaseService.getClient();

    try {
      console.log('🧹 Cleaning up expired shares...');

      const { data, error } = await supabase
        .rpc('cleanup_expired_shares');

      if (error) {
        console.error('❌ Error cleaning up expired shares:', error);
        return 0;
      }

      console.log('✅ Cleaned up expired shares:', data);
      return data || 0;

    } catch (error) {
      console.error('💥 Error in cleanupExpiredShares:', error);
      return 0;
    }
  }

  // ============================================================================
  // OBTENER DOCUMENTOS COMPARTIDOS CON PERMISOS
  // ============================================================================
  async getDocumentWithPermissionCheck(
    documentId: string,
    userId: string,
    userToken: string
  ): Promise<any> {
    const supabase = this.supabaseService.getClientWithAuth(userToken);

    try {
      // Verificar permiso antes de obtener el documento
      const hasPermission = await this.checkDocumentPermission(
        documentId,
        userId,
        'read',
        userToken
      );

      if (!hasPermission) {
        throw new ForbiddenException('No tienes permisos para ver este documento');
      }

      // Obtener el documento
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        throw new BadRequestException(`Error fetching document: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('💥 Error in getDocumentWithPermissionCheck:', error);
      throw error;
    }
  }
}
