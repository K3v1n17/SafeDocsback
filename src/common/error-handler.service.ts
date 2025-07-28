import { Injectable, Logger } from '@nestjs/common';
import { SecureConfigService } from '../config/secure-config.service';

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
  path?: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  constructor(private secureConfigService: SecureConfigService) {}

  /**
   * Maneja errores de forma segura, ocultando información sensible en producción
   * @param error Error original
   * @param context Contexto del error
   * @param path Ruta donde ocurrió el error
   * @returns Respuesta de error segura
   */
  handleError(error: any, context: string, path?: string): ErrorResponse {
    const isDevelopment = this.secureConfigService.isDevelopment();
    const timestamp = new Date().toISOString();

    // Log completo del error para debugging interno
    this.logger.error(
      `Error in ${context}`,
      {
        error: error?.message || error,
        stack: error?.stack,
        path,
        timestamp,
      }
    );

    // Mapeo de errores conocidos a mensajes seguros
    const safeError = this.mapToSafeError(error, isDevelopment);

    return {
      success: false,
      error: safeError.message,
      code: safeError.code,
      timestamp,
      path,
    };
  }

  /**
   * Crea una respuesta de éxito estandarizada
   * @param data Datos de respuesta
   * @param message Mensaje opcional
   * @returns Respuesta de éxito
   */
  createSuccessResponse<T>(data: T, message?: string): SuccessResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Valida y sanitiza mensajes de error para exposición pública
   * @param error Error original
   * @param isDevelopment Si está en modo desarrollo
   * @returns Error seguro para mostrar
   */
  private mapToSafeError(error: any, isDevelopment: boolean): { message: string; code?: string } {
    const errorMessage = error?.message || 'Unknown error';
    const errorCode = error?.code;

    // En producción, mapear errores específicos a mensajes genéricos
    if (!isDevelopment) {
      // Errores de autenticación
      if (this.isAuthError(errorMessage)) {
        return { message: 'Error de autenticación', code: 'AUTH_ERROR' };
      }

      // Errores de base de datos
      if (this.isDatabaseError(errorMessage)) {
        return { message: 'Error interno del servidor', code: 'DB_ERROR' };
      }

      // Errores de validación
      if (this.isValidationError(errorMessage)) {
        return { message: 'Datos de entrada inválidos', code: 'VALIDATION_ERROR' };
      }

      // Errores de permisos
      if (this.isPermissionError(errorMessage)) {
        return { message: 'Acceso denegado', code: 'PERMISSION_ERROR' };
      }

      // Errores de recursos no encontrados
      if (this.isNotFoundError(errorMessage)) {
        return { message: 'Recurso no encontrado', code: 'NOT_FOUND' };
      }

      // Error genérico para cualquier otro caso
      return { message: 'Error interno del servidor', code: 'INTERNAL_ERROR' };
    }

    // En desarrollo, mostrar más detalles pero aún sanitizados
    return {
      message: this.sanitizeErrorMessage(errorMessage),
      code: errorCode,
    };
  }

  /**
   * Determina si es un error de autenticación
   */
  private isAuthError(message: string): boolean {
    const authKeywords = [
      'invalid token',
      'token expired',
      'unauthorized',
      'authentication failed',
      'invalid credentials',
      'login failed',
      'session expired',
    ];
    
    return authKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Determina si es un error de base de datos
   */
  private isDatabaseError(message: string): boolean {
    const dbKeywords = [
      'database',
      'connection',
      'query',
      'constraint',
      'foreign key',
      'unique',
      'syntax error',
      'table',
      'column',
    ];
    
    return dbKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Determina si es un error de validación
   */
  private isValidationError(message: string): boolean {
    const validationKeywords = [
      'validation failed',
      'invalid input',
      'required field',
      'must be',
      'should be',
      'expected',
      'format',
    ];
    
    return validationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Determina si es un error de permisos
   */
  private isPermissionError(message: string): boolean {
    const permissionKeywords = [
      'forbidden',
      'access denied',
      'permission',
      'not allowed',
      'insufficient privileges',
      'role',
    ];
    
    return permissionKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Determina si es un error de recurso no encontrado
   */
  private isNotFoundError(message: string): boolean {
    const notFoundKeywords = [
      'not found',
      'does not exist',
      'missing',
      '404',
    ];
    
    return notFoundKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Sanitiza mensajes de error para remover información sensible
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'Error desconocido';
    }

    // Remover información sensible común
    let sanitized = message
      .replace(/password/gi, '[REDACTED]')
      .replace(/token/gi, '[REDACTED]')
      .replace(/key/gi, '[REDACTED]')
      .replace(/secret/gi, '[REDACTED]')
      .replace(/credential/gi, '[REDACTED]')
      // Remover rutas de archivos del sistema
      .replace(/[C-Z]:\\[^\\s]*/g, '[PATH]')
      .replace(/\/[^\s]*\/[^\s]*/g, '[PATH]')
      // Remover IPs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
      // Remover UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]');

    // Limitar longitud del mensaje
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 197) + '...';
    }

    return sanitized;
  }

  /**
   * Log de eventos de seguridad importantes
   */
  logSecurityEvent(event: string, details: Record<string, any>, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const logData = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      details: this.sanitizeLogDetails(details),
    };

    switch (severity) {
      case 'high':
        this.logger.error(`SECURITY ALERT: ${event}`, logData);
        break;
      case 'medium':
        this.logger.warn(`SECURITY WARNING: ${event}`, logData);
        break;
      default:
        this.logger.log(`SECURITY INFO: ${event}`, logData);
    }
  }

  /**
   * Sanitiza detalles de logs para remover información sensible
   */
  private sanitizeLogDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Campos que deben ser redactados
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential', 'session'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
