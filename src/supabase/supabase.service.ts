import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SecureConfigService } from '../config/secure-config.service';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabase: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(private secureConfigService: SecureConfigService) {
    try {
      this.supabaseUrl = this.secureConfigService.getSupabaseUrl();
      this.supabaseAnonKey = this.secureConfigService.getSupabaseAnonKey();
      
      this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: false, // Desactivar persistencia automática de sesión
          autoRefreshToken: false, // Desactivar refresh automático
          detectSessionInUrl: false, // Desactivar detección de sesión en URL
        },
        global: {
          headers: {
            'X-Client-Info': 'safedocs-backend',
          },
        },
      });
      
      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client', error);
      throw error;
    }
  }

  /**
   * Obtiene el cliente Supabase sin autenticación (solo para operaciones públicas)
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Crea un cliente Supabase autenticado con token de usuario específico
   * @param accessToken Token de acceso JWT válido
   * @returns Cliente Supabase autenticado
   */
  getClientWithAuth(accessToken: string): SupabaseClient {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Access token is required and must be a string');
    }

    // Validación básica del formato JWT
    if (!this.isValidJWTFormat(accessToken)) {
      throw new Error('Invalid JWT token format');
    }

    try {
      const authenticatedClient = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Client-Info': 'safedocs-backend-auth',
          },
        },
      });

      return authenticatedClient;
    } catch (error) {
      this.logger.error('Failed to create authenticated Supabase client', error);
      throw new Error('Failed to create authenticated client');
    }
  }

  /**
   * Establece sesión en el cliente existente de forma segura
   * @param accessToken Token de acceso
   * @param refreshToken Token de refresh
   * @returns Resultado de la operación
   */
  async setSession(accessToken: string, refreshToken: string): Promise<{ success: boolean; error?: string }> {
    if (!accessToken || !refreshToken) {
      return { success: false, error: 'Both access and refresh tokens are required' };
    }

    if (!this.isValidJWTFormat(accessToken) || !this.isValidJWTFormat(refreshToken)) {
      return { success: false, error: 'Invalid token format' };
    }

    try {
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        this.logger.warn('Session setting failed', { error: error.message });
        return { success: false, error: 'Failed to set session' };
      }

      if (!data.session || !data.user) {
        return { success: false, error: 'Invalid session data' };
      }

      this.logger.log('Session set successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Unexpected error setting session', error);
      return { success: false, error: 'Internal error' };
    }
  }

  /**
   * Valida el formato básico de un JWT
   * @param token Token a validar
   * @returns true si el formato es válido
   */
  private isValidJWTFormat(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Verifica si un usuario tiene acceso a un recurso específico
   * @param userId ID del usuario
   * @param resourceId ID del recurso
   * @param accessType Tipo de acceso requerido
   * @param userToken Token del usuario
   * @returns true si tiene acceso
   */
  async hasAccess(userId: string, resourceId: string, accessType: 'read' | 'write' | 'delete', userToken: string): Promise<boolean> {
    if (!userId || !resourceId || !userToken) {
      return false;
    }

    try {
      const client = this.getClientWithAuth(userToken);
      
      // Verificar acceso basado en el tipo de recurso y permisos
      const { data, error } = await client
        .from('user_permissions')
        .select('permission_type')
        .eq('user_id', userId)
        .eq('resource_id', resourceId)
        .eq('permission_type', accessType)
        .single();

      if (error) {
        this.logger.warn('Access check failed', { error: error.message, userId, resourceId, accessType });
        return false;
      }

      return !!data;
    } catch (error) {
      this.logger.error('Access check error', error);
      return false;
    }
  }
}
