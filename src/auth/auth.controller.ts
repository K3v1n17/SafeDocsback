import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(private supabaseService: SupabaseService) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@CurrentUser() user: SupabaseUser, @Req() request: any) {
    // Obtener el rol del usuario desde la base de datos
    const userRole = await this.getUserRole(user.id, request);
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      role: userRole,
      status: userRole ? 'active' : 'pending_role_assignment',
      message: userRole ? 'Usuario activo' : 'Pendiente de asignación de rol',
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  // 🔐 Solo endpoints admin para gestionar roles
  @Post('admin/assign-role')
  @UseGuards(SupabaseAuthGuard)
  async assignRole(
    @Body() body: { userId: string; role: string },
    @CurrentUser() user: SupabaseUser,
    @Req() request: any
  ) {
    const userRole = await this.getUserRole(user.id, request);
    
    if (userRole !== 'admin') {
      return {
        error: 'Acceso denegado',
        message: 'Solo administradores pueden asignar roles'
      };
    }
    
    const validRoles = ['owner', 'admin', 'auditor', 'recipient'];
    if (!validRoles.includes(body.role)) {
      return {
        error: 'Rol inválido',
        message: 'Los roles válidos son: ' + validRoles.join(', ')
      };
    }
    
    try {
      // 🔑 Usar cliente autenticado en lugar del cliente anónimo
      const [type, token] = request.headers.authorization.split(' ');
      const supabase = this.supabaseService.getClientWithAuth(token);
      
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: body.userId,
          role: body.role
        });
      
      if (error) {
        return {
          error: 'Error al asignar rol',
          message: error.message
        };
      }
      
      return {
        message: 'Rol asignado exitosamente',
        userId: body.userId,
        role: body.role
      };
    } catch (error) {
      return {
        error: 'Error al asignar rol',
        message: error.message
      };
    }
  }

  @Get('admin/users')
  @UseGuards(SupabaseAuthGuard)
  async getAllUsers(@CurrentUser() user: SupabaseUser, @Req() request: any) {
    const userRole = await this.getUserRole(user.id, request);
    
    if (userRole !== 'admin') {
      return {
        error: 'Acceso denegado',
        message: 'Solo administradores pueden ver todos los usuarios'
      };
    }
    
    try {
      // 🔑 Usar cliente autenticado
      const [type, token] = request.headers.authorization.split(' ');
      const supabase = this.supabaseService.getClientWithAuth(token);
      
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at, updated_at');
      
      if (error) {
        return {
          error: 'Error al obtener usuarios',
          message: error.message
        };
      }
      
      const users = userRoles?.map(ur => ({
        id: ur.user_id,
        role: ur.role,
        roleAssignedAt: ur.created_at,
        roleUpdatedAt: ur.updated_at,
        isCurrentUser: ur.user_id === user.id
      })) || [];
      
      return {
        message: 'Usuarios con roles asignados',
        count: users.length,
        users: users
      };
    } catch (error) {
      return {
        error: 'Error al obtener usuarios',
        message: error.message
      };
    }
  }

  private async getUserRole(userId: string, request?: any): Promise<string | null> {
    try {
      console.log(`🔍 Getting role for user: ${userId}`);
      
      // 🔑 Extraer token del request si está disponible
      let supabase = this.supabaseService.getClient();
      
      if (request?.headers?.authorization) {
        const [type, token] = request.headers.authorization.split(' ');
        if (type === 'Bearer' && token) {
          console.log('🔑 Using authenticated client with token');
          supabase = this.supabaseService.getClientWithAuth(token);
        }
      }
      
      console.log('📡 Supabase client initialized');
      
      // 🔍 Verificar el usuario autenticado actual
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('👤 Current authenticated user:', {
        id: user?.id,
        email: user?.email,
        searching_for: userId,
        is_same_user: user?.id === userId
      });
      
      if (authError) {
        console.error('❌ Auth error:', authError);
      }
      
      // 🔍 Consulta directa con más logging
      console.log('📊 Executing query on user_roles...');
      const { data, error } = await supabase
        .from('user_roles')
        .select('*') // Seleccionar todo para ver qué devuelve
        .eq('user_id', userId);
      
      console.log('📋 Query result:', { data, error });
      
      if (error) {
        console.error('❌ Error getting user role:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log(`⚠️ No role found for user: ${userId}`);
        console.log('🔍 Available roles in DB (first 5):');
        
        // Consultar todos los roles para ver si hay alguno
        const { data: allRoles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .limit(5);
        
        console.log('Available roles:', allRoles);
        return null;
      }
      
      const role = data[0].role;
      console.log(`✅ Role found for user ${userId}: ${role}`);
      return role;
    } catch (error) {
      console.error('💥 Exception getting user role:', error);
      return null;
    }
  }
}
