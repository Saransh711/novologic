import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '@prisma/client';
import type { Request } from 'express';

/**
 * Injects the authenticated user resolved by `GqlAuthGuard`. Only valid on
 * resolvers protected by that guard, which populates `req.user`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const ctx = GqlExecutionContext.create(context).getContext<{
      req: Request & { user?: User };
    }>();
    return ctx.req.user as User;
  },
);
