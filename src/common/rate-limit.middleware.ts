import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecureConfigService } from '../config/secure-config.service';
import { ErrorHandlerService } from './error-handler.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

interface RateLimitData {
  requests: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly store = new Map<string, RateLimitData>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    private secureConfig: SecureConfigService,
    private errorHandler: ErrorHandlerService,
  ) {
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100');
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '1') * 60 * 1000; // minutos a ms
    
    // Limpiar store cada hora
    setInterval(() => this.cleanupStore(), 60 * 60 * 1000);
  }

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const identifier = this.getClientIdentifier(req);
    const now = Date.now();
    
    // Obtener datos de rate limit para este cliente
    let rateLimitData = this.store.get(identifier);
    
    // Si no existe o el tiempo se ha reiniciado, crear nuevo registro
    if (!rateLimitData || now > rateLimitData.resetTime) {
      rateLimitData = {
        requests: 0,
        resetTime: now + this.windowMs,
      };
    }

    // Incrementar contador de requests
    rateLimitData.requests++;
    this.store.set(identifier, rateLimitData);

    // Agregar headers de rate limit
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - rateLimitData.requests));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

    // Verificar si se excedió el límite
    if (rateLimitData.requests > this.maxRequests) {
      this.errorHandler.logSecurityEvent('Rate limit exceeded', {
        identifier,
        requests: rateLimitData.requests,
        limit: this.maxRequests,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      }, 'medium');

      // Agregar header Retry-After
      const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      const errorResponse = this.errorHandler.handleError(
        new Error('Rate limit exceeded'),
        'RateLimit',
        req.url
      );

      throw new HttpException(errorResponse, HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }

  /**
   * Obtiene un identificador único para el cliente
   * Prioriza user ID si está autenticado, luego IP
   */
  private getClientIdentifier(req: AuthenticatedRequest): string {
    // Si el usuario está autenticado, usar su ID
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }

    // Fallback a IP (considerando proxies)
    const forwarded = req.get('X-Forwarded-For');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
    
    return `ip:${ip}`;
  }

  /**
   * Limpia registros expirados del store
   */
  private cleanupStore(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.store.entries()) {
      if (now > data.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Obtiene estadísticas actuales del rate limiter
   */
  getStats(): { totalClients: number; activeRequests: number } {
    const now = Date.now();
    let activeRequests = 0;

    for (const data of this.store.values()) {
      if (now <= data.resetTime) {
        activeRequests += data.requests;
      }
    }

    return {
      totalClients: this.store.size,
      activeRequests,
    };
  }
}
