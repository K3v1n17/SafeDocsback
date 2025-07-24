import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class SecureConfigService {
  constructor(private configService: NestConfigService) {}

  /**
   * Obtiene variables de entorno de forma segura con validación
   */
  getSupabaseUrl(): string {
    const url = this.configService.get<string>('SUPABASE_URL');
    if (!url) {
      throw new Error('SUPABASE_URL is not configured');
    }
    if (!this.isValidUrl(url)) {
      throw new Error('SUPABASE_URL is not a valid URL');
    }
    return url;
  }

  getSupabaseAnonKey(): string {
    const key = this.configService.get<string>('SUPABASE_ANON_KEY');
    if (!key) {
      throw new Error('SUPABASE_ANON_KEY is not configured');
    }
    if (!this.isValidJWT(key)) {
      throw new Error('SUPABASE_ANON_KEY is not a valid JWT token');
    }
    return key;
  }

  getFrontendUrl(): string {
    const url = this.configService.get<string>('FRONTEND_URL');
    if (!url) {
      throw new Error('FRONTEND_URL is not configured');
    }
    if (!this.isValidUrl(url)) {
      throw new Error('FRONTEND_URL is not a valid URL');
    }
    return url;
  }

  getCookieDomain(): string | undefined {
    const domain = this.configService.get<string>('COOKIE_DOMAIN');
    if (domain && !this.isValidDomain(domain)) {
      throw new Error('COOKIE_DOMAIN is not valid');
    }
    return domain;
  }

  getPort(): number {
    const port = this.configService.get<number>('PORT') || 3001;
    if (port < 1 || port > 65535) {
      throw new Error('PORT must be between 1 and 65535');
    }
    return port;
  }

  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Validaciones auxiliares
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidJWT(token: string): boolean {
    // Validación básica de formato JWT
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  private isValidDomain(domain: string): boolean {
    // Validación básica de dominio
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$|^localhost$/i;
    return domainRegex.test(domain);
  }
}
