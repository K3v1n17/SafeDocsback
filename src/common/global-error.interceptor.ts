import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';

@Injectable()
export class GlobalErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GlobalErrorInterceptor.name);

  constructor(private errorHandler: ErrorHandlerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data) => {
        // Si la respuesta ya tiene el formato correcto, no modificarla
        if (data && typeof data === 'object' && 'success' in data && 'timestamp' in data) {
          return data;
        }

        // Envolver respuestas exitosas que no tengan el formato estándar
        return this.errorHandler.createSuccessResponse(data);
      }),
      catchError((error) => {
        this.logger.error(`Error in ${path}`, error);

        // Si ya es una HttpException con respuesta estructurada, mantenerla
        if (error instanceof HttpException) {
          const response = error.getResponse();
          
          // Si la respuesta ya está formateada, usarla
          if (typeof response === 'object' && 'success' in response) {
            return throwError(() => error);
          }

          // Formatear la respuesta de error HTTP
          const formattedError = this.errorHandler.handleError(
            new Error(typeof response === 'string' ? response : error.message),
            `HTTP ${error.getStatus()}`,
            path
          );

          throw new HttpException(formattedError, error.getStatus());
        }

        // Para errores no HTTP, crear una respuesta estructurada
        const formattedError = this.errorHandler.handleError(error, 'Unhandled Error', path);
        
        throw new HttpException(formattedError, HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }
}
