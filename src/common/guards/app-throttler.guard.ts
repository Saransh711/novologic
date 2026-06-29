import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

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
