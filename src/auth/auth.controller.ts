import { Controller, Get, Post, Body, UseGuards, Req, Res, ValidationPipe, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { SupabaseUser } from './supabase-user.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { ErrorHandlerService, ErrorResponse, SuccessResponse } from '../common/error-handler.service';
import { ValidationService } from '../common/validation.service';
import { SecureConfigService } from '../config/secure-config.service';

type AuthResponse = ErrorResponse | SuccessResponse;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(
    private supabaseService: SupabaseService,
    private errorHandler: ErrorHandlerService,
    private validationService: ValidationService,
    private secureConfig: SecureConfigService,
  ) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@CurrentUser() user: SupabaseUser, @Req() request: any) {
    // Obtener el rol del usuario desde la base de datos
    const userRole = await this.getUserRole(user.id, request);
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name,
        role: userRole,
        status: userRole ? 'active' : 'pending_role_assignment',
        message: userRole ? 'Usuario activo' : 'Pendiente de asignación de rol',
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
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
      // 🔑 Usar token desde cookies HttpOnly
      const accessToken = request.cookies?.access_token;
      
      if (!accessToken) {
        return {
          error: 'Token no encontrado',
          message: 'No se encontró token de acceso en las cookies'
        };
      }
      
      const supabase = this.supabaseService.getClientWithAuth(accessToken);
      
      // 🔄 Usar UPSERT para actualizar o insertar rol
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: body.userId,
          role: body.role,
          updated_at: new Date()
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        return {
          error: 'Error al asignar rol',
          message: error.message
        };
      }
      
      return {
        message: 'Rol actualizado exitosamente',
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
      // 🔑 Usar token desde cookies HttpOnly
      const accessToken = request.cookies?.access_token;
      
      if (!accessToken) {
        return {
          error: 'Token no encontrado',
          message: 'No se encontró token de acceso en las cookies'
        };
      }
      
      const supabase = this.supabaseService.getClientWithAuth(accessToken);
      
      // � 1. Obtener roles de usuarios
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at, updated_at');
      
      if (error) {
        return {
          error: 'Error al obtener usuarios',
          message: error.message
        };
      }
      
      // 🔍 2. Obtener perfiles de usuarios
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, phone, company');
      
      if (profilesError) {
        return {
          error: 'Error al obtener perfiles',
          message: profilesError.message
        };
      }
      
      // 🔗 3. Hacer match entre roles y perfiles
      const users = userRoles?.map(ur => {
        // Buscar el perfil correspondiente
        const profile = profiles?.find(p => p.user_id === ur.user_id);
        
        return {
          id: ur.user_id,
          name: profile?.full_name || 'Sin nombre',
          avatar: profile?.avatar_url,
          phone: profile?.phone,
          company: profile?.company,
          role: ur.role,
          roleAssignedAt: ur.created_at,
          roleUpdatedAt: ur.updated_at,
          isCurrentUser: ur.user_id === user.id
        };
      }) || [];
      
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

  // 🔐 Login con cookies HttpOnly y validación mejorada
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponse> {
    try {
      // Validar entrada de datos
      const validatedDto = await this.validationService.validateDto(LoginDto, loginDto);
      
      // Sanitizar email
      const sanitizedEmail = this.validationService.sanitizeText(validatedDto.email);
      if (!this.validationService.isValidEmail(sanitizedEmail)) {
        this.errorHandler.logSecurityEvent('Invalid email format in login attempt', { email: sanitizedEmail }, 'medium');
        return this.errorHandler.handleError(new Error('Invalid email format'), 'login');
      }

      const supabase = this.supabaseService.getClient();
      
      // Autenticación con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: validatedDto.password,
      });

      if (error) {
        this.errorHandler.logSecurityEvent('Login attempt failed', { 
          email: sanitizedEmail, 
          error: error.message 
        }, 'medium');
        
        // Mapear errores comunes a mensajes seguros
        let errorMessage = 'Credenciales inválidas';
        if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
        }
        
        return this.errorHandler.handleError(new Error(errorMessage), 'login');
      }

      if (!data.user || !data.session) {
        return this.errorHandler.handleError(new Error('Authentication failed'), 'login');
      }

      // 🍪 Configurar cookies HttpOnly SEGURAS
      this.setSecureCookies(response, data.session);

      // Obtener rol del usuario desde la base de datos
      const userRole = await this.getUserRole(data.user.id);

      // Crear o actualizar el perfil del usuario si no existe
      await this.ensureUserProfile(data.user);

      // Log evento de seguridad exitoso
      this.errorHandler.logSecurityEvent('Successful login', { 
        userId: data.user.id, 
        email: sanitizedEmail 
      }, 'low');

      // ✅ Solo devolver datos del usuario (SIN tokens)
      return this.errorHandler.createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
          role: userRole || 'owner',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at,
          email_confirmed: data.user.email_confirmed_at ? true : false,
        }
      });
    } catch (error) {
      this.errorHandler.logSecurityEvent('Login internal error', { error: error.message }, 'high');
      return this.errorHandler.handleError(error, 'login');
    }
  }

  // 🔐 Register con cookies HttpOnly y validación mejorada
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponse> {
    try {
      // Validar entrada de datos
      const validatedDto = await this.validationService.validateDto(RegisterDto, registerDto);
      
      // Sanitizar datos de entrada
      const sanitizedEmail = this.validationService.sanitizeText(validatedDto.email);
      const sanitizedUsername = this.validationService.sanitizeText(validatedDto.username);
      const sanitizedName = this.validationService.sanitizeText(validatedDto.name);
      
      // Validaciones adicionales
      if (!this.validationService.isValidEmail(sanitizedEmail)) {
        return this.errorHandler.handleError(new Error('Invalid email format'), 'register');
      }
      
      if (!this.validationService.isAlphanumericSafe(sanitizedUsername)) {
        return this.errorHandler.handleError(new Error('Username contains invalid characters'), 'register');
      }

      const supabase = this.supabaseService.getClient();
      
      // Registro con Supabase
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: validatedDto.password,
        options: {
          data: {
            username: sanitizedUsername,
            name: sanitizedName,
            full_name: sanitizedName,
          }
        }
      });

      if (error) {
        this.errorHandler.logSecurityEvent('Registration attempt failed', { 
          email: sanitizedEmail, 
          error: error.message 
        }, 'medium');
        
        let errorMessage = 'Error en el registro';
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email ya está registrado';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'La contraseña es muy débil';
        }
        
        return this.errorHandler.handleError(new Error(errorMessage), 'register');
      }

      if (!data.user) {
        return this.errorHandler.handleError(new Error('Registration failed'), 'register');
      }

      // Crear perfil inicial del usuario
      await this.createUserProfile(data.user, {
        email: sanitizedEmail,
        username: sanitizedUsername,
        name: sanitizedName,
        password: '' // No almacenar password
      });
      
      // Asignar rol por defecto
      await this.assignDefaultRole(data.user.id);

      // Log evento de seguridad exitoso
      this.errorHandler.logSecurityEvent('Successful registration', { 
        userId: data.user.id, 
        email: sanitizedEmail 
      }, 'low');

      return this.errorHandler.createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
          username: sanitizedUsername,
          name: sanitizedName,
          role: 'owner',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at,
          email_confirmed: false,
        }
      }, 'Registro exitoso. Por favor verifica tu email.');
    } catch (error) {
      this.errorHandler.logSecurityEvent('Registration internal error', { error: error.message }, 'high');
      return this.errorHandler.handleError(error, 'register');
    }
  }

  // 🔐 Refresh token usando cookies con validación mejorada
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponse> {
    try {
      // 🍪 Obtener refresh token de cookies
      const refreshToken = request.cookies?.refresh_token;
      
      if (!refreshToken || typeof refreshToken !== 'string') {
        this.errorHandler.logSecurityEvent('Refresh token missing', {}, 'medium');
        return this.errorHandler.handleError(new Error('No refresh token'), 'refresh');
      }

      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        this.errorHandler.logSecurityEvent('Refresh token failed', { error: error.message }, 'medium');
        // 🧹 Limpiar cookies si el refresh falló
        this.clearSecureCookies(response);
        return this.errorHandler.handleError(new Error('Invalid refresh token'), 'refresh');
      }

      if (!data.user || !data.session) {
        this.clearSecureCookies(response);
        return this.errorHandler.handleError(new Error('Session refresh failed'), 'refresh');
      }

      // 🍪 Actualizar cookies con nuevos tokens
      this.setSecureCookies(response, data.session);

      const userRole = await this.getUserRole(data.user.id);

      // Log evento exitoso
      this.errorHandler.logSecurityEvent('Token refreshed successfully', { 
        userId: data.user.id 
      }, 'low');

      return this.errorHandler.createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
          role: userRole || 'owner',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at,
          email_confirmed: true,
        }
      });
    } catch (error) {
      this.errorHandler.logSecurityEvent('Refresh token internal error', { error: error.message }, 'high');
      this.clearSecureCookies(response);
      return this.errorHandler.handleError(error, 'refresh');
    }
  }

  // 🔐 Logout limpiando cookies de forma segura
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response): Promise<AuthResponse> {
    try {
      // 🧹 Limpiar cookies HttpOnly
      this.clearSecureCookies(response);
      
      this.errorHandler.logSecurityEvent('User logged out', {}, 'low');
      
      return this.errorHandler.createSuccessResponse({ 
        message: 'Sesión cerrada exitosamente' 
      });
    } catch (error) {
      this.errorHandler.logSecurityEvent('Logout error', { error: error.message }, 'medium');
      return this.errorHandler.handleError(error, 'logout');
    }
  }

  // ===========================================
  // MÉTODOS HELPER ADICIONALES
  // ===========================================

  // 🛡️ Configurar cookies seguras con configuración mejorada
  private setSecureCookies(response: Response, session: any): void {
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error('Invalid session data for cookie setting');
    }

    const isProduction = this.secureConfig.isProduction();
    const cookieDomain = this.secureConfig.getCookieDomain();
    
    // 🎯 Configuración específica para producción vs desarrollo
    const baseCookieOptions = {
      httpOnly: true,           // 🔒 No accesible desde JavaScript
      path: '/',
      domain: isProduction && cookieDomain ? cookieDomain : undefined,
    };

    // 🛡️ Configuración condicional según el entorno
    const cookieOptions = isProduction ? {
      ...baseCookieOptions,
      secure: true,             // 🔒 SIEMPRE HTTPS en producción
      sameSite: 'none' as const, // 🔒 Para dominios cruzados
    } : {
      ...baseCookieOptions,
      secure: false,            // 🔓 HTTP permitido en desarrollo
      sameSite: 'lax' as const, // 🔒 Más permisivo en desarrollo
    };

    this.logger.log('Setting secure cookies', {
      isProduction,
      cookieDomain,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
    });

    try {
      // Access token (15 minutos)
      response.cookie('access_token', session.access_token, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      // Refresh token (7 días)
      response.cookie('refresh_token', session.refresh_token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      this.logger.log('Secure cookies set successfully');
    } catch (error) {
      this.logger.error('Error setting cookies', error);
      throw new Error('Failed to set secure cookies');
    }
  }

  // 🧹 Limpiar cookies de forma segura
  private clearSecureCookies(response: Response): void {
    const isProduction = this.secureConfig.isProduction();
    const cookieDomain = this.secureConfig.getCookieDomain();
    
    // 🎯 Misma configuración que setSecureCookies para limpiar correctamente
    const baseCookieOptions = {
      httpOnly: true,
      path: '/',
      domain: isProduction && cookieDomain ? cookieDomain : undefined,
    };

    const cookieOptions = isProduction ? {
      ...baseCookieOptions,
      secure: true,
      sameSite: 'none' as const,
    } : {
      ...baseCookieOptions,
      secure: false,
      sameSite: 'lax' as const,
    };

    try {
      response.clearCookie('access_token', cookieOptions);
      response.clearCookie('refresh_token', cookieOptions);
      
      this.logger.log('Cookies cleared successfully');
    } catch (error) {
      this.logger.error('Error clearing cookies', error);
    }
  }

  private async ensureUserProfile(user: any): Promise<void> {
    if (!user?.id) {
      this.logger.warn('Invalid user data provided to ensureUserProfile');
      return;
    }

    try {
      const supabase = this.supabaseService.getClient();
      
      // Verificar si el perfil ya existe
      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = not found
        this.logger.error('Error checking existing profile', selectError);
        return;
      }

      if (!existingProfile) {
        // Crear perfil si no existe con datos sanitizados
        const profileData = {
          user_id: user.id,
          full_name: this.validationService.sanitizeText(
            user.user_metadata?.name || user.user_metadata?.full_name || ''
          ),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (insertError) {
          this.logger.error('Error creating user profile', insertError);
        } else {
          this.logger.log(`Profile created for user ${user.id}`);
        }
      }
    } catch (error) {
      this.logger.error('Exception in ensureUserProfile', error);
    }
  }

  private async createUserProfile(user: any, registerData: { email: string; username: string; name: string; password: string }): Promise<void> {
    if (!user?.id || !registerData?.name) {
      this.logger.warn('Invalid data provided to createUserProfile');
      return;
    }

    try {
      const supabase = this.supabaseService.getClient();
      
      const profileData = {
        user_id: user.id,
        full_name: this.validationService.sanitizeText(registerData.name),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .insert([profileData]);

      if (error) {
        this.logger.error('Error creating user profile during registration', error);
        throw new Error('Failed to create user profile');
      }

      this.logger.log(`Profile created for new user ${user.id}`);
    } catch (error) {
      this.logger.error('Exception in createUserProfile', error);
      throw error;
    }
  }

  private async assignDefaultRole(userId: string): Promise<void> {
    if (!userId || !this.validationService.isValidUUID(userId)) {
      this.logger.warn('Invalid userId provided to assignDefaultRole');
      return;
    }

    try {
      const supabase = this.supabaseService.getClient();
      
      const roleData = {
        user_id: userId,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_roles')
        .insert([roleData]);

      if (error) {
        this.logger.error('Error assigning default role', error);
        throw new Error('Failed to assign default role');
      }

      this.logger.log(`Default role assigned to user ${userId}`);
    } catch (error) {
      this.logger.error('Exception in assignDefaultRole', error);
      throw error;
    }
  }

  private async getUserRole(userId: string, request?: any): Promise<string | null> {
    if (!userId || !this.validationService.isValidUUID(userId)) {
      this.logger.warn('Invalid userId provided to getUserRole');
      return null;
    }

    try {
      this.logger.log(`Getting role for user: ${userId}`);
      
      // 🔑 Extraer token desde cookies HttpOnly si está disponible
      let supabase = this.supabaseService.getClient();
      
      if (request?.cookies?.access_token) {
        const accessToken = request.cookies.access_token;
        try {
          supabase = this.supabaseService.getClientWithAuth(accessToken);
          this.logger.log('Using authenticated client with token from cookies');
        } catch (error) {
          this.logger.warn('Failed to create authenticated client, using default');
        }
      }
      
      // 🔍 Consulta con manejo de errores mejorado
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Not found
          this.logger.log(`No role found for user: ${userId}`);
          return null;
        }
        this.logger.error('Database error getting user role', error);
        return null;
      }
      
      if (!data?.role) {
        this.logger.log(`No role data for user: ${userId}`);
        return null;
      }
      
      const role = data.role;
      this.logger.log(`Role found for user ${userId}: ${role}`);
      return role;
    } catch (error) {
      this.logger.error('Exception getting user role', error);
      return null;
    }
  }
}