import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * The default ThrottlerGuard reads the request from the HTTP context, which is
 * undefined for GraphQL resolvers. This variant resolves the underlying
 * Express request/response from the GraphQL execution context instead.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext): { req: Request; res: Response } {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Request;
      res: Response;
    }>();
    return { req: gqlContext.req, res: gqlContext.res };
  }
}
