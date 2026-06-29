import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/domain/auth.constants';
import { AuthService } from '../../modules/auth/application/auth.service';

/**
 * Guards GraphQL resolvers behind a valid access-token cookie. On success the
 * resolved user is attached to the request so `@CurrentUser()` can read it.
 * Throws `UnauthenticatedError` (→ GraphQL `UNAUTHENTICATED`) otherwise.
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context).getContext<{ req: Request }>();
    const req = ctx.req;
    const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

    const user = await this.authService.getViewerFromAccessToken(accessToken);
    (req as Request & { user?: unknown }).user = user;
    return true;
  }
}
