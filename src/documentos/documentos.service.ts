import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { Documento } from './entities/documento.entity';
import { SupabaseUser } from '../auth/supabase-user.interface';

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
}
