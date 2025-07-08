import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { Documento } from './entities/documento.entity';

@Injectable()
export class DocumentosService {
  constructor(private supabaseService: SupabaseService) {}

  async create(createDocumentoDto: CreateDocumentoDto): Promise<Documento> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS verificará automáticamente que el usuario tenga permisos de creación
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

  async findAll(): Promise<Documento[]> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS se encarga automáticamente de filtrar según el rol del usuario
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching documents: ${error.message}`);
    }

    return data || [];
  }

  async findOne(id: string): Promise<Documento> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS verificará automáticamente que el usuario tenga permisos de lectura
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return data;
  }

  async update(id: string, updateDocumentoDto: UpdateDocumentoDto): Promise<Documento> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS verificará automáticamente que el usuario tenga permisos de actualización
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

  async remove(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS verificará automáticamente que el usuario tenga permisos de eliminación
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Error deleting document: ${error.message}`);
    }
  }

  async findByOwner(ownerId: string): Promise<Documento[]> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS se encarga de verificar si el usuario actual puede ver documentos de este owner
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

  async findByTags(tags: string[]): Promise<Documento[]> {
    const supabase = this.supabaseService.getClient();
    
    // Supabase RLS filtrará automáticamente según los permisos del usuario
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .overlaps('tags', tags)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching documents by tags: ${error.message}`);
    }

    return data || [];
  }

  async verifyChecksum(id: string, checksum: string): Promise<boolean> {
    const documento = await this.findOne(id);
    return documento.checksum_sha256 === checksum;
  }
}
