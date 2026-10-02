import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

const DB_UNAVAILABLE_CODES = [
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR',
];

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Erreurs HTTP levées par Nest ou par nos services (400, 404, 409...)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // Erreur de validation : déjà au format { error, details }
      if (typeof body === 'object' && 'details' in body) {
        return res.status(status).json(body);
      }

      const { error, message } =
        typeof body === 'string'
          ? { error: undefined, message: body }
          : (body as { error?: string; message?: string | string[] });

      return res.status(status).json({
        error: error ?? HttpStatus[status],
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    // Tout le reste : erreur serveur
    const err = exception as { code?: string; driverError?: { code?: string } };
    const code = err?.code ?? err?.driverError?.code;
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message:
        code && DB_UNAVAILABLE_CODES.includes(code)
          ? 'Database connection failed'
          : 'An unexpected error occurred',
    });
  }
}