import { Controller, Get, Query, UseGuards, Req, Param, ParseUUIDPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('share')
@UseGuards(SupabaseAuthGuard)
export class ShareController {
  constructor(private supabaseService: SupabaseService) {}

  private extractTokenFromRequest(req: Request): string {
    // 🍪 PRIMERO: Intentar obtener token de cookies HttpOnly
    const cookieToken = req.cookies?.access_token;
    if (cookieToken) {
      console.log('🍪 Token obtenido de cookies en ShareController');
      return cookieToken;
    }

    // 🔑 FALLBACK: Intentar obtener token del header Authorization (para compatibilidad)
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      console.log('🔑 Token obtenido de Authorization header en ShareController');
      return token;
    }

    console.log('❌ No token encontrado en ShareController');
    return '';
  }

  // 🔍 Buscar usuarios para compartir (por nombre o empresa)
  @Get('search-users')
  async searchUsersForSharing(
    @Query('q') searchQuery: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    if (!searchQuery || searchQuery.length < 3) {
      return {
        users: [],
        message: 'Escribe al menos 3 caracteres para buscar'
      };
    }

    const token = this.extractTokenFromRequest(req);
    const supabase = this.supabaseService.getClientWithAuth(token);

    console.log('🔍 Buscando usuarios con query:', searchQuery);
    console.log('🔑 Usuario actual ID:', user.id);

    try {
      // 🔒 CONSULTA SEGURA: Solo información básica para compartir
      // Estructura real: profiles.user_id (PK), full_name, company
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, company') // ✅ Campos reales de tu BD
        .or(`full_name.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`)
        .neq('user_id', user.id) // Excluir usuario actual
        .limit(10);

      console.log('🔍 Resultado búsqueda segura:', data);
      console.log('❌ Error búsqueda:', error);

      if (error) {
        console.error('Error searching users:', error);
        return { users: [], error: `Error al buscar usuarios: ${error.message}` };
      }

      // Debug: contar cuántos resultados
      console.log(`📈 Encontrados ${data?.length || 0} usuarios que coinciden con "${searchQuery}"`);

      // 🛡️ RESPUESTA SEGURA: Solo información básica según estructura real
      const result = {
        users: data?.map(profile => ({
          id: profile.user_id, // ✅ Campo real de tu BD: user_id
          name: profile.full_name || 'Usuario',
          company: profile.company || null // ✅ Campo real: company
        })) || []
      };

      console.log('📤 Respuesta final:', result);
      return result;

    } catch (err) {
      console.error('💥 Error inesperado:', err);
      return { users: [], error: 'Error inesperado al buscar usuarios' };
    }
  }

  // 📋 Obtener usuarios que ya tienen acceso a un documento específico
  @Get('document-users/:documentId')
  async getDocumentSharedUsers(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: SupabaseUser,
    @Req() req: Request
  ) {
    const token = this.extractTokenFromRequest(req);
    const supabase = this.supabaseService.getClientWithAuth(token);

    // Verificar que el usuario es dueño del documento
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || doc?.owner_id !== user.id) {
      return { users: [], error: 'No tienes permisos para ver este documento' };
    }

    // Obtener usuarios con acceso al documento
    const { data: shares, error: sharesError } = await supabase
      .from('document_shares')
      .select('id, shared_with_user_id, permission_level, expires_at, created_at')
      .eq('document_id', documentId)
      .eq('is_active', true)
      .not('shared_with_user_id', 'is', null); // Solo shares con usuario específico

    if (sharesError) {
      return { users: [], error: 'Error al obtener usuarios compartidos' };
    }

    if (!shares || shares.length === 0) {
      return { users: [] };
    }

    // Extraer IDs de usuarios compartidos
    const userIds = shares.map(share => share.shared_with_user_id);

    // 🔒 CONSULTA SEGURA: Solo información básica según estructura real
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, company') // ✅ Campos reales de tu BD
      .in('user_id', userIds); // ✅ Campo real: user_id

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return { users: [], error: 'Error al obtener información de usuarios' };
    }

    // 🛡️ COMBINAR DATOS SEGUROS: Solo info necesaria según estructura real
    const result = shares.map(share => {
      const profile = profiles?.find(p => p.user_id === share.shared_with_user_id);
      
      return {
        shareId: share.id,
        userId: share.shared_with_user_id,
        name: profile?.full_name || 'Usuario',
        company: profile?.company || null, // ✅ Campo real: company
        permission: share.permission_level,
        expiresAt: share.expires_at,
        sharedAt: share.created_at
      };
    });

    return { users: result };
  }
}
