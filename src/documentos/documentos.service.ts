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

  async verifyChecksum(id: string, checksum: string, userToken: string): Promise<boolean> {
    const documento = await this.findOne(id, userToken);
    return documento.checksum_sha256 === checksum;
  }

  // 🔍 Realizar verificación completa del documento
  async performFullVerification(id: string, userId: string, userToken: string) {
    console.log('🔍 Starting full verification for document:', id);
    
    try {
      // 1. Obtener el documento
      const documento = await this.findOne(id, userToken);
      if (!documento) {
        throw new Error('Document not found');
      }

      // 2. Obtener información actual del archivo (si todavía existe)
      const supabase = this.supabaseService.getClientWithAuth(userToken);
      
      let currentChecksum: string | null = null;
      let fileExists = false;
      
      try {
        // Intentar descargar el archivo para verificar si existe y calcular su checksum
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(documento.file_path);
        
        if (!downloadError && fileData) {
          fileExists = true;
          // Calcular checksum actual del archivo
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          currentChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
        }
      } catch (error) {
        console.log('File not accessible for verification:', error.message);
      }

      // 3. Crear registro de verificación
      const verificationDetails: string[] = [];
      let status = 'failed';
      let integrityPct = 0;

      if (!fileExists) {
        verificationDetails.push('❌ Archivo no accesible o no existe');
        status = 'file_missing';
      } else if (currentChecksum === documento.checksum_sha256) {
        verificationDetails.push('✅ Archivo íntegro');
        verificationDetails.push('✅ Checksum coincide con el original');
        verificationDetails.push(`📋 Hash: ${currentChecksum}`);
        status = 'verified';
        integrityPct = 100;
      } else {
        verificationDetails.push('❌ Integridad comprometida');
        verificationDetails.push(`📋 Hash original: ${documento.checksum_sha256}`);
        verificationDetails.push(`📋 Hash actual: ${currentChecksum}`);
        status = 'integrity_failed';
        integrityPct = 0;
      }

      // 4. Guardar verificación en base de datos
      const { error: insertError } = await supabase
        .from('document_verifications')
        .insert({
          document_id: id,
          run_by: userId,
          status: status,
          integrity_pct: integrityPct,
          hash_checked: currentChecksum || 'N/A',
          details: verificationDetails
        });

      if (insertError) {
        console.error('Error saving verification:', insertError);
      }

      return {
        documentId: id,
        fileName: documento.title || 'Unknown',
        fileExists,
        originalChecksum: documento.checksum_sha256,
        currentChecksum,
        isValid: status === 'verified',
        status,
        integrityPercentage: integrityPct,
        details: verificationDetails,
        verifiedAt: new Date(),
        verifiedBy: userId
      };

    } catch (error) {
      console.error('Error in performFullVerification:', error);
      throw error;
    }
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
        checksum_sha256: checksum,
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
}
