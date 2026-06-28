import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * Rate-limits both GraphQL operations and REST endpoints. The default
 * ThrottlerGuard reads the request from the HTTP context, which is undefined for
 * GraphQL resolvers; this variant resolves the underlying Express
 * request/response from whichever context is active so a single global guard
 * protects the entire surface (GraphQL mutations and the binary upload route).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext): { req: Request; res: Response } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req: Request;
        res: Response;
      }>();
      return { req: gqlContext.req, res: gqlContext.res };
    }

    const httpContext = context.switchToHttp();
    return {
      req: httpContext.getRequest<Request>(),
      res: httpContext.getResponse<Response>(),
    };
  }
}
