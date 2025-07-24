import { Injectable } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationService {
  
  /**
   * Valida y transforma un DTO usando class-validator
   * @param dtoClass Clase del DTO
   * @param data Datos a validar
   * @returns Datos validados y transformados
   */
  async validateDto<T>(dtoClass: new () => T, data: any): Promise<T> {
    const dto = plainToClass(dtoClass, data);
    const errors = await validate(dto as object);
    
    if (errors.length > 0) {
      const errorMessages = errors.map(error => 
        Object.values(error.constraints || {}).join(', ')
      ).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    
    return dto;
  }

  /**
   * Sanitiza texto HTML para prevenir XSS
   * @param input Texto a sanitizar
   * @returns Texto sanitizado
   */
  sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Implementación básica de sanitización sin librerías externas
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitiza entrada de texto general
   * @param input Texto a sanitizar
   * @returns Texto sanitizado
   */
  sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remover caracteres de control y no imprimibles
    return input
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remover caracteres de control
      .replace(/[\u2000-\u206F]/g, '') // Remover espacios especiales Unicode
      .trim();
  }

  /**
   * Valida que un email tenga formato correcto
   * @param email Email a validar
   * @returns true si es válido
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Valida que un UUID tenga formato correcto
   * @param uuid UUID a validar
   * @returns true si es válido
   */
  isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Valida que un nombre de archivo sea seguro
   * @param filename Nombre del archivo
   * @returns true si es seguro
   */
  isValidFilename(filename: string): boolean {
    if (!filename || typeof filename !== 'string') {
      return false;
    }
    
    // No permitir caracteres peligrosos en nombres de archivo
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return false;
    }
    
    // No permitir nombres reservados en Windows
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      return false;
    }
    
    // Límite de longitud razonable
    return filename.length > 0 && filename.length <= 255;
  }

  /**
   * Valida parámetros de paginación
   * @param page Número de página
   * @param limit Límite por página
   * @returns Parámetros validados
   */
  validatePagination(page?: number, limit?: number): { page: number; limit: number } {
    const validPage = Math.max(1, Math.floor(Number(page) || 1));
    const validLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));
    
    return { page: validPage, limit: validLimit };
  }

  /**
   * Valida que un string contenga solo caracteres alfanuméricos y algunos especiales seguros
   * @param input String a validar
   * @returns true si es seguro
   */
  isAlphanumericSafe(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    
    // Solo permitir letras, números, espacios, guiones y guiones bajos
    const safePattern = /^[a-zA-Z0-9\s\-_]+$/;
    return safePattern.test(input);
  }

  /**
   * Escapa caracteres especiales para consultas SQL (aunque usemos ORM)
   * @param input String a escapar
   * @returns String escapado
   */
  escapeSqlString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/'/g, "''")  // Escapar comillas simples
      .replace(/\\/g, '\\\\') // Escapar backslashes
      .replace(/\x00/g, '\\0') // Escapar null bytes
      .replace(/\n/g, '\\n') // Escapar saltos de línea
      .replace(/\r/g, '\\r') // Escapar retornos de carro
      .replace(/\x1a/g, '\\Z'); // Escapar caracteres de sustitución
  }
}
