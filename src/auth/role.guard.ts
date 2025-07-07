import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRole, RolePermissions } from './roles.interface';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const supabase = this.supabaseService.getClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Obtener el rol del usuario desde la base de datos
      const userRole = await this.getUserRole(user.id);
      
      // Verificar permisos requeridos
      const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
      
      if (requiredPermissions && !this.hasPermissions(userRole, requiredPermissions)) {
        throw new ForbiddenException('Insufficient permissions');
      }

      // Adjuntar usuario y rol al request
      request.user = user;
      request.userRole = userRole;
      request.permissions = RolePermissions[userRole];
      
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }

  private async getUserRole(userId: string): Promise<UserRole> {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // Si no existe un rol, creamos uno por defecto
      await this.createDefaultRole(userId);
      return UserRole.OWNER;
    }
    
    return data.role as UserRole;
  }

  private async createDefaultRole(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    
    await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: UserRole.OWNER
      });
  }

  private hasPermissions(userRole: UserRole, requiredPermissions: string[]): boolean {
    const userPermissions = RolePermissions[userRole];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }
}
