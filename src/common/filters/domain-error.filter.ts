import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { DomainError, DomainErrorCode } from '../errors/domain.error';

const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  [DomainErrorCode.NotFound]: HttpStatus.NOT_FOUND,
  [DomainErrorCode.Conflict]: HttpStatus.CONFLICT,
  [DomainErrorCode.InvalidInput]: HttpStatus.BAD_REQUEST,
};

/**
 * Translates application-layer {@link DomainError}s into the right boundary
 * representation: a GraphQL error with a stable `extensions.code` for GraphQL
 * operations, or a JSON HTTP error with the mapped status for REST endpoints
 * (e.g. the binary upload controller). Keeps resolvers and controllers free of
 * error-mapping concerns.
 */
@Catch(DomainError)
export class DomainErrorFilter implements GqlExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    if (host.getType<'graphql' | 'http'>() === 'graphql') {
      throw new GraphQLError(exception.message, {
        extensions: { code: exception.code },
      });
    }

    const status = HTTP_STATUS_BY_CODE[exception.code];
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
