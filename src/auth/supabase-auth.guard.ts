// SupabaseAuthGuard  para cookies HttpOnly
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // 🔍 DEBUG - LOGGING DETALLADO
    console.log('🔍 ===== AUTH GUARD DEBUG =====');
    console.log('📡 URL:', request.url);
    console.log('🍪 Raw Cookie:', request.headers.cookie);
    console.log('🍪 Parsed Cookies:', request.cookies);
    console.log('🔑 Authorization:', request.headers.authorization);
    console.log('===============================');
    
    try {
      // 🍪 Prioridad: 1. Cookies HttpOnly, 2. Header Authorization
      let token = request.cookies?.access_token;
      
      console.log('🔍 Token from cookies:', token ? 'EXISTS' : 'NOT_FOUND');
      
      // Fallback para APIs que usen headers
      if (!token) {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
          console.log('🔍 Token from header:', token ? 'EXISTS' : 'NOT_FOUND');
        }
      }

      if (!token) {
        console.log('❌ NO TOKEN PROVIDED');
        throw new UnauthorizedException('No token provided');
      }
      
      console.log('✅ Token found, verifying with Supabase...');

      // Verificar token con Supabase
      const supabase = this.supabaseService.getClientWithAuth(token);
      const { data: { user }, error } = await supabase.auth.getUser();

      console.log('🔍 Supabase verification result:', {
        hasUser: !!user,
        hasError: !!error,
        userId: user?.id,
        errorMessage: error?.message
      });

      if (error || !user) {
        console.log('❌ Token verification failed, attempting refresh...');
        // Si el token expiró, intentar refresh automático
        const refreshToken = request.cookies?.refresh_token;
        
        if (refreshToken) {
          console.log('🔄 Access token expirado, intentando refresh automático');
          
          const refreshResult = await this.attemptTokenRefresh(refreshToken, response);
          if (refreshResult.success) {
            // Actualizar request con nuevo token y usuario
            request.user = refreshResult.user;
            return true;
          }
        }
        
        // Limpiar cookies inválidas
        this.clearCookies(response);
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Agregar usuario al request
      request.user = {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
        user_metadata: user.user_metadata
      };
      
      return true;
      
    } catch (error) {
      console.error('Auth guard error:', error);
      this.clearCookies(response);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  // 🔄 Intento automático de refresh token
  private async attemptTokenRefresh(refreshToken: string, response: any) {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session) {
        return { success: false };
      }

      // 🍪 Actualizar cookies con nuevos tokens
      this.setSecureCookies(response, data.session);
      
      console.log('✅ Tokens refrescados automáticamente');
      
      return {
        success: true,
        user: {
          id: data.user!.id,
          email: data.user!.email,
          created_at: data.user!.created_at,
          updated_at: data.user!.updated_at,
          user_metadata: data.user!.user_metadata
        },
        session: data.session
      };
      
    } catch (error) {
      console.error('Auto refresh failed:', error);
      return { success: false };
    }
  }

  // 🛡️ Configurar cookies (mismo método que en AuthController)
  private setSecureCookies(response: any, session: any): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const, // Cambiado a 'lax' para desarrollo local
      path: '/',
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    };

    response.cookie('access_token', session.access_token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    response.cookie('refresh_token', session.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
  }

  // 🧹 Limpiar cookies
  private clearCookies(response: any): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const, // 'lax' para desarrollo local
      path: '/',
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    };

    response.clearCookie('access_token', cookieOptions);
    response.clearCookie('refresh_token', cookieOptions);
  }
}
