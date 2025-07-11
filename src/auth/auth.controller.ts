import { Controller, Get, Post, Body, UseGuards, Req, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

interface AuthResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

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

  // 🔐 NUEVO: Endpoint de Login
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
            role: userRole || 'owner',
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

  // 🔐 NUEVO: Endpoint de Register
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
            role: 'owner',
            created_at: data.user.created_at,
            updated_at: data.user.updated_at || data.user.created_at,
            email_confirmed: false,
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

  // 🔐 NUEVO: Endpoint de Refresh Token
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

  // 🔐 NUEVO: Endpoint de Logout
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

  // ===========================================
  // MÉTODOS HELPER ADICIONALES
  // ===========================================

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
