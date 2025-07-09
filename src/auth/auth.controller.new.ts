import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  ValidationPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { 
  LoginDto, 
  RegisterDto, 
  RefreshTokenDto, 
  ForgotPasswordDto 
} from './dto/auth.dto';

interface AuthResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private supabaseService: SupabaseService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(ValidationPipe) loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Autenticación con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password,
      });

      if (error) {
        // Log del error para debugging (sin exponer detalles al frontend)
        console.error('Login error:', error.message);
        
        // Mapear errores comunes a mensajes amigables
        let errorMessage = 'Credenciales inválidas';
        if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email o contraseña incorrectos';
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: 'Error de autenticación'
        };
      }

      // Obtener rol del usuario desde tu base de datos
      const userRole = await this.getUserRole(data.user.id);

      // Crear o actualizar el perfil del usuario si no existe
      await this.ensureUserProfile(data.user);

      // Respuesta formateada y segura
      return {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username,
            name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
            role: userRole || 'owner', // Rol por defecto
            created_at: data.user.created_at,
            updated_at: data.user.updated_at || data.user.created_at,
            email_confirmed: data.user.email_confirmed_at ? true : false,
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
            expires_in: data.session.expires_in || 3600,
          }
        }
      };
    } catch (error) {
      console.error('Login internal error:', error);
      return {
        success: false,
        error: 'Error interno del servidor'
      };
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(ValidationPipe) registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Registro con Supabase
      const { data, error } = await supabase.auth.signUp({
        email: registerDto.email,
        password: registerDto.password,
        options: {
          data: {
            username: registerDto.username,
            name: registerDto.name,
            full_name: registerDto.name,
          }
        }
      });

      if (error) {
        console.error('Register error:', error.message);
        
        let errorMessage = 'Error en el registro';
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email ya está registrado';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'La contraseña es muy débil';
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Error en el registro'
        };
      }

      // Crear perfil inicial del usuario
      await this.createUserProfile(data.user, registerDto);
      
      // Asignar rol por defecto
      await this.assignDefaultRole(data.user.id);

      return {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            username: registerDto.username,
            name: registerDto.name,
            role: 'owner', // Rol por defecto
            created_at: data.user.created_at,
            updated_at: data.user.updated_at || data.user.created_at,
            email_confirmed: false, // Siempre false en registro inicial
          },
          session: data.session ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
            expires_in: data.session.expires_in || 3600,
          } : null,
        },
        message: 'Registro exitoso. Por favor verifica tu email.'
      };
    } catch (error) {
      console.error('Register internal error:', error);
      return {
        success: false,
        error: 'Error interno del servidor'
      };
    }
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getCurrentUser(@CurrentUser() user: SupabaseUser): Promise<AuthResponse> {
    try {
      // Obtener información adicional del usuario
      const userRole = await this.getUserRole(user.id);
      
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username,
          name: user.user_metadata?.name || user.user_metadata?.full_name,
          role: userRole || 'owner',
          created_at: user.created_at,
          updated_at: user.updated_at,
          email_confirmed: true, // Si llegó aquí, el token es válido
        }
      };
    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        error: 'Error obteniendo información del usuario'
      };
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body(ValidationPipe) refreshDto: RefreshTokenDto): Promise<AuthResponse> {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshDto.refresh_token
      });

      if (error) {
        return {
          success: false,
          error: 'Token de refresco inválido'
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: 'Error refrescando sesión'
        };
      }

      const userRole = await this.getUserRole(data.user.id);

      return {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username,
            name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
            role: userRole || 'owner',
            created_at: data.user.created_at,
            updated_at: data.user.updated_at || data.user.created_at,
            email_confirmed: true,
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
            expires_in: data.session.expires_in || 3600,
          }
        }
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: 'Error interno del servidor'
      };
    }
  }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: SupabaseUser): Promise<AuthResponse> {
    try {
      // Aquí puedes agregar lógica adicional como:
      // - Invalidar tokens en base de datos
      // - Registrar logout en logs
      // - Limpiar sesiones activas
      
      return {
        success: true,
        data: { message: 'Sesión cerrada exitosamente' }
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Error cerrando sesión'
      };
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(ValidationPipe) forgotDto: ForgotPasswordDto): Promise<AuthResponse> {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { error } = await supabase.auth.resetPasswordForEmail(forgotDto.email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      });

      if (error) {
        console.error('Forgot password error:', error.message);
        // No revelamos si el email existe o no por seguridad
      }

      return {
        success: true,
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
      };
    } catch (error) {
      console.error('Forgot password internal error:', error);
      return {
        success: false,
        error: 'Error interno del servidor'
      };
    }
  }

  // ===========================================
  // MÉTODOS HELPER PRIVADOS
  // ===========================================

  private async getUserRole(userId: string): Promise<string | null> {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log('No role found for user:', userId);
        return null;
      }

      return data?.role || null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  private async ensureUserProfile(user: any): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Verificar si el perfil ya existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (!existingProfile) {
        // Crear perfil si no existe
        await supabase
          .from('profiles')
          .insert([{
            user_id: user.id,
            full_name: user.user_metadata?.name || user.user_metadata?.full_name || '',
            created_at: new Date(),
            updated_at: new Date()
          }]);
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  }

  private async createUserProfile(user: any, registerDto: RegisterDto): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      
      await supabase
        .from('profiles')
        .insert([{
          user_id: user.id,
          full_name: registerDto.name,
          created_at: new Date(),
          updated_at: new Date()
        }]);
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }

  private async assignDefaultRole(userId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      
      await supabase
        .from('user_roles')
        .insert([{
          user_id: userId,
          role: 'owner',
          created_at: new Date(),
          updated_at: new Date()
        }]);
    } catch (error) {
      console.error('Error assigning default role:', error);
    }
  }
}
