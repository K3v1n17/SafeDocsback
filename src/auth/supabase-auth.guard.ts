// 🔒 SupabaseAuthGuard refactorizado con mejores prácticas de seguridad
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ErrorHandlerService } from '../common/error-handler.service';
import { ValidationService } from '../common/validation.service';
import { SecureConfigService } from '../config/secure-config.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private supabaseService: SupabaseService,
    private errorHandler: ErrorHandlerService,
    private validationService: ValidationService,
    private secureConfig: SecureConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // 🔍 Logging más seguro (sin exponer tokens)
    this.logger.debug(`Authentication check for ${request.method} ${request.url}`);
    
    try {
      // 🍪 Prioridad: 1. Cookies HttpOnly, 2. Header Authorization
      let token = this.extractTokenFromCookies(request);
      
      // Fallback para APIs que usen headers
      if (!token) {
        token = this.extractTokenFromHeader(request);
      }

      if (!token) {
        this.errorHandler.logSecurityEvent('No authentication token provided', {
          ip: request.ip,
          userAgent: request.get('User-Agent'),
          url: request.url
        }, 'medium');
        throw new UnauthorizedException('Authentication required');
      }
      
      // Validar formato del token
      if (!this.validationService.isValidEmail(token) && !this.isValidJWTFormat(token)) {
        this.errorHandler.logSecurityEvent('Invalid token format', {
          ip: request.ip,
          url: request.url
        }, 'high');
        throw new UnauthorizedException('Invalid token format');
      }

      this.logger.debug('Token found, verifying with Supabase...');

      // Verificar token con Supabase
      const user = await this.verifyTokenWithSupabase(token);

      if (!user) {
        // Si el token expiró, intentar refresh automático
        const refreshToken = this.extractRefreshTokenFromCookies(request);
        
        if (refreshToken) {
          this.logger.debug('Access token expired, attempting automatic refresh');
          
          const refreshResult = await this.attemptTokenRefresh(refreshToken, response);
          if (refreshResult.success && refreshResult.user) {
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
      
      // Log evento de autenticación exitosa
      this.errorHandler.logSecurityEvent('Successful authentication', {
        userId: user.id,
        ip: request.ip,
        url: request.url
      }, 'low');
      
      return true;
      
    } catch (error) {
      this.logger.error('Authentication failed', error);
      this.clearCookies(response);
      
      this.errorHandler.logSecurityEvent('Authentication failed', {
        error: error.message,
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url
      }, 'medium');
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extrae token de acceso desde cookies HttpOnly
   */
  private extractTokenFromCookies(request: any): string | null {
    const token = request.cookies?.access_token;
    return (token && typeof token === 'string') ? token : null;
  }

  /**
   * Extrae token desde header Authorization
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return (token && typeof token === 'string') ? token : null;
    }
    return null;
  }

  /**
   * Extrae refresh token desde cookies
   */
  private extractRefreshTokenFromCookies(request: any): string | null {
    const token = request.cookies?.refresh_token;
    return (token && typeof token === 'string') ? token : null;
  }

  /**
   * Verifica token con Supabase
   */
  private async verifyTokenWithSupabase(token: string): Promise<any> {
    try {
      const supabase = this.supabaseService.getClientWithAuth(token);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        this.logger.debug('Token verification failed', { error: error?.message });
        return null;
      }

      return user;
    } catch (error) {
      this.logger.warn('Exception during token verification', error);
      return null;
    }
  }

  /**
   * Valida formato básico de JWT
   */
  private isValidJWTFormat(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Intento automático de refresh token
   */
  private async attemptTokenRefresh(refreshToken: string, response: any): Promise<{ success: boolean; user?: any }> {
    try {
      if (!this.isValidJWTFormat(refreshToken)) {
        return { success: false };
      }

      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session || !data.user) {
        this.logger.debug('Token refresh failed', { error: error?.message });
        return { success: false };
      }

      //  Actualizar cookies con nuevos tokens
      this.setSecureCookies(response, data.session);
      
      this.logger.debug('Tokens refreshed automatically');
      
      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at,
          updated_at: data.user.updated_at,
          user_metadata: data.user.user_metadata
        }
      };
      
    } catch (error) {
      this.logger.error('Auto refresh failed', error);
      return { success: false };
    }
  }

  /**
   * Configurar cookies seguras (reutilizar lógica del AuthController)
   */
  private setSecureCookies(response: any, session: any): void {
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error('Invalid session data for cookie setting');
    }

    const isProduction = this.secureConfig.isProduction();
    const cookieDomain = this.secureConfig.getCookieDomain();
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
      domain: isProduction && cookieDomain ? cookieDomain : undefined,
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

  /**
   * Limpiar cookies de forma segura
   */
  private clearCookies(response: any): void {
    const isProduction = this.secureConfig.isProduction();
    const cookieDomain = this.secureConfig.getCookieDomain();
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
      domain: isProduction && cookieDomain ? cookieDomain : undefined,
    };

    response.clearCookie('access_token', cookieOptions);
    response.clearCookie('refresh_token', cookieOptions);
  }
}
