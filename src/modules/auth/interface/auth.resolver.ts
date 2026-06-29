import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { GqlAuthGuard } from '../../../common/auth/gql-auth.guard';
import { UnauthenticatedError } from '../../../common/errors/domain.error';
import { AuthRateLimited } from '../../../common/throttling/throttler.constants';
import { AuthService, RequestMetadata } from '../application/auth.service';
import { REFRESH_TOKEN_COOKIE } from '../domain/auth.constants';
import { CookieService } from './cookies';
import { LoginInput } from './dto/login.input';
import { ViewerObject } from './dto/viewer.object';

interface GqlContext {
  req: Request;
  res: Response;
}

@Resolver(() => ViewerObject)
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: CookieService,
  ) {}

  @Mutation(() => ViewerObject, {
    name: 'login',
    description: 'Authenticates with email + password, setting httpOnly auth cookies.',
  })
  @AuthRateLimited()
  async login(@Args('input') input: LoginInput, @Context() ctx: GqlContext): Promise<ViewerObject> {
    const session = await this.authService.login(
      input.email,
      input.password,
      AuthResolver.metadata(ctx.req),
    );
    this.cookies.setAuthCookies(ctx.res, session.accessToken, session.refresh);
    return AuthResolver.toViewer(session.user);
  }

  @Mutation(() => ViewerObject, {
    name: 'refreshToken',
    description: 'Rotates the refresh token and issues a new access token via httpOnly cookies.',
  })
  async refreshToken(@Context() ctx: GqlContext): Promise<ViewerObject> {
    const token = ctx.req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!token) {
      this.cookies.clearAuthCookies(ctx.res);
      throw new UnauthenticatedError(
        'Your session is invalid or has expired. Please sign in again.',
      );
    }
    const session = await this.authService.refresh(token, AuthResolver.metadata(ctx.req));
    this.cookies.setAuthCookies(ctx.res, session.accessToken, session.refresh);
    return AuthResolver.toViewer(session.user);
  }

  @Mutation(() => Boolean, {
    name: 'logout',
    description: 'Revokes the current refresh token and clears the auth cookies.',
  })
  async logout(@Context() ctx: GqlContext): Promise<boolean> {
    const token = ctx.req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(token);
    this.cookies.clearAuthCookies(ctx.res);
    return true;
  }

  @Query(() => ViewerObject, {
    name: 'me',
    description: 'Returns the currently authenticated user.',
  })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: User): ViewerObject {
    return AuthResolver.toViewer(user);
  }

  private static metadata(req: Request): RequestMetadata {
    return {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
  }

  private static toViewer(user: User): ViewerObject {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      createdAt: user.createdAt,
    };
  }
}
