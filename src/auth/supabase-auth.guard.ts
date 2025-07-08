import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token no encontrado');
    }

    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedException('Token inválido');
      }

      // Simplificar el objeto user para evitar conflictos de tipos
      request.user = {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at,
        user_metadata: data.user.user_metadata
      };
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Error de autenticación');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
