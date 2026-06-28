import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { DomainErrorCode } from '../errors/domain.error';

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred.';
const SERVER_ERROR_STATUS_THRESHOLD = 500;

/**
 * Last-resort filter for anything not handled by a more specific filter
 * (e.g. {@link DomainErrorFilter}). It logs the real error with full context for
 * operators, then returns a masked, consistently shaped error to clients so
 * internal details and stack traces are never leaked across the boundary.
 *
 * Registered last in the provider list; NestJS applies the most specific
 * matching filter first, so domain and multipart errors are still handled by
 * their dedicated filters.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void | GraphQLError {
    const isGraphql = host.getType<GqlContextType>() === 'graphql';
    const { status, message, code } = this.normalize(exception);

    this.log(exception, host, isGraphql, status);

    if (isGraphql) {
      return new GraphQLError(message, { extensions: { code } });
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({ statusCode: status, code, message });
  }

  private normalize(exception: unknown): { status: number; message: string; code: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        message: exception.message,
        code: HttpStatus[status] ?? DomainErrorCode.InvalidInput,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  private log(exception: unknown, host: ArgumentsHost, isGraphql: boolean, status: number): void {
    const context = isGraphql ? this.graphqlContext(host) : this.httpContext(host);
    const stack = exception instanceof Error ? exception.stack : String(exception);

    if (status >= SERVER_ERROR_STATUS_THRESHOLD) {
      this.logger.error(`Unhandled exception (${context})`, stack);
    } else {
      this.logger.warn(`Handled exception (${context}): ${stack}`);
    }
  }

  private httpContext(host: ArgumentsHost): string {
    const request = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
    return `${request.method ?? 'UNKNOWN'} ${request.url ?? 'unknown'}`;
  }

  private graphqlContext(host: ArgumentsHost): string {
    const info = GqlArgumentsHost.create(host).getInfo<{
      parentType?: { name?: string };
      fieldName?: string;
    }>();
    return `${info?.parentType?.name ?? 'GraphQL'}.${info?.fieldName ?? 'unknown'}`;
  }
}
