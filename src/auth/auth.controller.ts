import { Controller, Post, Get, Body, UseGuards, Request, Param } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(private supabaseService: SupabaseService) {}
  
  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    return {
      message: 'Login debe hacerse desde el frontend con Supabase client',
      instructions: 'Usa supabase.auth.signInWithPassword() en el frontend'
    };
  }

  @Post('register')
  async register(@Body() registerDto: { email: string; password: string; fullName?: string }) {
    return {
      message: 'Registro debe hacerse desde el frontend con Supabase client',
      instructions: 'Usa supabase.auth.signUp() en el frontend'
    };
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@CurrentUser() user: SupabaseUser) {
    // Obtener el rol del usuario desde la base de datos
    const userRole = await this.getUserRole(user.id);
    
    // Si no tiene rol, necesita que un admin se lo asigne
    if (!userRole) {
      return {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name,
        role: null,
        permissions: [],
        status: 'pending_role_assignment',
        message: 'Tu cuenta está pendiente de asignación de rol por parte de un administrador',
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        metadata: user.user_metadata
      };
    }
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      role: userRole,
      permissions: this.getPermissions(userRole),
      status: 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      metadata: user.user_metadata
    };
  }

  private async getUserRole(userId: string): Promise<string | null> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error || !data) {
        // No crear rol automáticamente, devolver null
        return null;
      }
      
      return data.role;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  private async createDefaultRole(userId: string): Promise<void> {
    // Ya no se usa automáticamente, solo para admin
    try {
      const supabase = this.supabaseService.getClient();
      await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'owner'
        });
    } catch (error) {
      console.error('Error creating default role:', error);
    }
  }

  private getPermissions(role: string): string[] {
    const permissions = {
      'owner': ['document:create', 'document:read:own', 'document:update:own', 'document:delete:own'],
      'admin': ['document:read:all', 'user:read:all', 'user:create', 'user:update:all'],
      'auditor': ['document:read:metadata', 'audit:read'],
      'recipient': ['document:read:shared']
    };
    
    return permissions[role] || permissions['owner'];
  }

  // 🔐 Endpoint para listar usuarios pendientes (solo admin)
  @Get('admin/pending-users')
  @UseGuards(SupabaseAuthGuard)
  async getPendingUsers(@CurrentUser() user: SupabaseUser) {
    const userRole = await this.getUserRole(user.id);
    
    if (userRole !== 'admin') {
      return {
        error: 'Acceso denegado',
        message: 'Solo administradores pueden ver usuarios pendientes'
      };
    }
    
    try {
      const supabase = this.supabaseService.getClient();
      
      // Por ahora, mostrar mensaje informativo sobre usuarios pendientes
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id');
      
      const userIdsWithRoles = userRoles?.map(ur => ur.user_id) || [];
      
      return {
        message: 'Funcionalidad de usuarios pendientes',
        explanation: 'Los usuarios pendientes son aquellos que se registraron pero no tienen rol asignado',
        totalUsersWithRoles: userIdsWithRoles.length,
        note: 'Para ver usuarios pendientes específicos, necesitas configurar vistas que accedan a auth.users',
        currentApproach: 'Por seguridad, solo mostramos usuarios que ya tienen roles asignados'
      };
    } catch (error) {
      return {
        error: 'Error al obtener información de usuarios',
        message: error.message
      };
    }
  }

  // 🔐 Endpoint para asignar rol a usuario (solo admin)
  @Post('admin/assign-role')
  @UseGuards(SupabaseAuthGuard)
  async assignRole(
    @Body() body: { userId: string; role: string },
    @CurrentUser() user: SupabaseUser
  ) {
    const userRole = await this.getUserRole(user.id);
    
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
      const supabase = this.supabaseService.getClient();
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

  // 🔐 Endpoint para cambiar rol de usuario (solo admin)
  @Post('admin/change-role')
  @UseGuards(SupabaseAuthGuard)
  async changeUserRole(
    @Body() body: { userId: string; newRole: string },
    @CurrentUser() user: SupabaseUser
  ) {
    const userRole = await this.getUserRole(user.id);
    
    if (userRole !== 'admin') {
      return {
        error: 'Acceso denegado',
        message: 'Solo administradores pueden cambiar roles'
      };
    }
    
    const validRoles = ['owner', 'admin', 'auditor', 'recipient'];
    if (!validRoles.includes(body.newRole)) {
      return {
        error: 'Rol inválido',
        message: 'Los roles válidos son: ' + validRoles.join(', ')
      };
    }
    
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_roles')
        .update({ role: body.newRole })
        .eq('user_id', body.userId);
      
      if (error) {
        return {
          error: 'Error al cambiar rol',
          message: error.message
        };
      }
      
      return {
        message: 'Rol cambiado exitosamente',
        userId: body.userId,
        newRole: body.newRole
      };
    } catch (error) {
      return {
        error: 'Error al cambiar rol',
        message: error.message
      };
    }
  }

  // 🔐 Endpoint para listar todos los usuarios con roles (solo admin)
  @Get('admin/users')
  @UseGuards(SupabaseAuthGuard)
  async getAllUsers(@CurrentUser() user: SupabaseUser) {
    const userRole = await this.getUserRole(user.id);
    
    if (userRole !== 'admin') {
      return {
        error: 'Acceso denegado',
        message: 'Solo administradores pueden ver todos los usuarios'
      };
    }
    
    try {
      const supabase = this.supabaseService.getClient();
      
      // Obtener TODOS los usuarios con roles asignados (no solo admins)
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
        permissions: this.getPermissions(ur.role),
        roleAssignedAt: ur.created_at,
        roleUpdatedAt: ur.updated_at,
        isCurrentUser: ur.user_id === user.id
      })) || [];
      
      // Estadísticas por rol
      const roleStats = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {});
      
      return {
        message: 'Todos los usuarios con roles asignados',
        explanation: 'Este endpoint muestra TODOS los usuarios que tienen algún rol (admin, owner, auditor, recipient)',
        count: users.length,
        roleDistribution: roleStats,
        users: users
      };
    } catch (error) {
      return {
        error: 'Error al obtener usuarios',
        message: error.message
      };
    }
  }

  // 🔍 Endpoint de diagnóstico
  @Get('debug/check-permissions')
  @UseGuards(SupabaseAuthGuard)
  async checkPermissions(@CurrentUser() user: SupabaseUser) {
    const userRole = await this.getUserRole(user.id);
    
    try {
      const supabase = this.supabaseService.getClient();
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      return {
        currentUser: {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name
        },
        roleInDatabase: roleData,
        detectedRole: userRole,
        permissions: userRole ? this.getPermissions(userRole) : [],
        allUsersWithRoles: allRoles?.length || 0,
        isAdmin: userRole === 'admin',
        canAccessAdminEndpoints: userRole === 'admin',
        troubleshooting: {
          hasRoleInDB: !!roleData,
          shouldCreateRole: !roleData,
          recommendedAction: !roleData ? 'Execute SQL to assign admin role' : 'Role exists, permissions working!'
        }
      };
    } catch (error) {
      return {
        error: 'Error checking permissions',
        message: error.message,
        currentUser: {
          id: user.id,
          email: user.email
        },
        detectedRole: userRole
      };
    }
  }

  @Post('logout')
  async logout() {
    return {
      message: 'Logout debe hacerse desde el frontend con Supabase client',
      instructions: 'Usa supabase.auth.signOut() en el frontend'
    };
  }
}