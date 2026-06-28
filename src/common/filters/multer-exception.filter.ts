import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Maps low-level Multer multipart parsing failures (size limit exceeded,
 * unexpected fields, too many files) to clean HTTP responses, so upload clients
 * receive a meaningful 4xx instead of an opaque 500.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const status =
      exception.code === 'LIMIT_FILE_SIZE' ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;

    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds the maximum allowed size.'
        : `Invalid file upload: ${exception.message}.`;

    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message,
    });
  }
}
