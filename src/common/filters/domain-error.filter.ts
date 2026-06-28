import { Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainError } from '../errors/domain.error';

/**
 * Translates application-layer {@link DomainError}s into GraphQL errors with a
 * stable `extensions.code`, keeping resolvers thin and free of error mapping.
 */
@Catch(DomainError)
export class DomainErrorFilter implements GqlExceptionFilter {
  catch(exception: DomainError): never {
    throw new GraphQLError(exception.message, {
      extensions: { code: exception.code },
    });
  }
}
