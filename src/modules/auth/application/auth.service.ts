import { Injectable, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { UnauthenticatedError } from '../../../common/errors/domain.error';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PasswordService } from './password.service';
import { SignedRefreshToken, TokenService } from './token.service';

/** Generic message returned for every authentication failure (no enumeration). */
const INVALID_CREDENTIALS = 'Invalid email or password.';
const INVALID_SESSION = 'Your session is invalid or has expired. Please sign in again.';

export interface RequestMetadata {
  userAgent?: string;
  ip?: string;
}

export interface IssuedSession {
  user: User;
  accessToken: string;
  refresh: SignedRefreshToken;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Verifies credentials and, on success, issues a fresh access + refresh token
   * pair. The same generic error (and a comparable amount of work) is produced
   * whether the email is unknown or the password is wrong, to defeat user
   * enumeration and timing attacks.
   */
  async login(
    email: string,
    plainPassword: string,
    metadata: RequestMetadata,
  ): Promise<IssuedSession> {
    const normalisedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalisedEmail } });

    if (!user) {
      // Spend comparable time so a missing account is indistinguishable from a
      // wrong password.
      await this.password.hash(plainPassword);
      throw new UnauthenticatedError(INVALID_CREDENTIALS);
    }

    const passwordValid = await this.password.verify(user.passwordHash, plainPassword);
    if (!passwordValid) {
      throw new UnauthenticatedError(INVALID_CREDENTIALS);
    }

    return this.issueSession(user, metadata);
  }

  /**
   * Validates a refresh token, rotates it, and issues a new session. Implements
   * reuse detection: presenting an already-rotated (revoked) token is treated
   * as theft and revokes every active token for that user.
   */
  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<IssuedSession> {
    let claims: { sub: string; jti: string };
    try {
      claims = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthenticatedError(INVALID_SESSION);
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: claims.jti } });
    if (!stored || stored.tokenHash !== this.tokens.hashToken(refreshToken)) {
      throw new UnauthenticatedError(INVALID_SESSION);
    }

    if (stored.revokedAt) {
      // The token was already rotated away — a replay. Revoke the whole family.
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; revoking session family.`,
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthenticatedError(INVALID_SESSION);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthenticatedError(INVALID_SESSION);
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthenticatedError(INVALID_SESSION);
    }

    const refresh = await this.tokens.signRefreshToken(user.id);

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          id: refresh.jti,
          userId: user.id,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
          userAgent: metadata.userAgent,
          ip: metadata.ip,
        },
      }),
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedById: refresh.jti },
      }),
    ]);

    const accessToken = await this.tokens.signAccessToken({ sub: user.id, email: user.email });
    return { user, accessToken, refresh };
  }

  /** Revokes the refresh token (best-effort); never throws so logout always succeeds. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const claims = await this.tokens.verifyRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { id: claims.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Token already invalid/expired — nothing to revoke.
    }
  }

  /** Resolves the authenticated user from an access token, or throws. */
  async getViewerFromAccessToken(accessToken: string | undefined): Promise<User> {
    if (!accessToken) {
      throw new UnauthenticatedError('Authentication required.');
    }
    let claims: { sub: string };
    try {
      claims = await this.tokens.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthenticatedError(INVALID_SESSION);
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new UnauthenticatedError(INVALID_SESSION);
    }
    return user;
  }

  private async issueSession(user: User, metadata: RequestMetadata): Promise<IssuedSession> {
    const refresh = await this.tokens.signRefreshToken(user.id);
    await this.prisma.refreshToken.create({
      data: {
        id: refresh.jti,
        userId: user.id,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
        userAgent: metadata.userAgent,
        ip: metadata.ip,
      },
    });
    const accessToken = await this.tokens.signAccessToken({ sub: user.id, email: user.email });
    return { user, accessToken, refresh };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
