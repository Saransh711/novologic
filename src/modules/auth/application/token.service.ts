import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../../../config/env.validation';

/** Claims carried by the short-lived access token. */
export interface AccessTokenClaims {
  sub: string;
  email: string;
}

/** Claims carried by the rotating refresh token. `jti` is the DB row id. */
export interface RefreshTokenClaims {
  sub: string;
  jti: string;
}

export interface SignedRefreshToken {
  /** The JWT to place in the cookie. */
  token: string;
  /** Stable id (jti) used as the RefreshToken row primary key. */
  jti: string;
  /** SHA-256 hash of the token, the only form persisted server-side. */
  tokenHash: string;
  /** Absolute expiry, mirrored into the DB row for cheap checks. */
  expiresAt: Date;
}

/**
 * Signs and verifies the access/refresh JWTs and hashes refresh tokens for
 * storage. Access and refresh tokens are signed with separate secrets so a leak
 * of one never compromises the other. The plaintext refresh token is only ever
 * returned to the caller (to set as a cookie); the database stores its hash.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('ACCESS_TOKEN_TTL', { infer: true }),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwt.verifyAsync<AccessTokenClaims>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async signRefreshToken(userId: string): Promise<SignedRefreshToken> {
    const jti = randomUUID();
    const claims: RefreshTokenClaims = { sub: userId, jti };
    const token = await this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('REFRESH_TOKEN_TTL', { infer: true }),
    });

    const decoded = this.jwt.decode<{ exp?: number }>(token);
    const expiresAt = new Date((decoded?.exp ?? 0) * 1000);

    return { token, jti, tokenHash: this.hashToken(token), expiresAt };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    return this.jwt.verifyAsync<RefreshTokenClaims>(token, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
  }

  /** SHA-256 hex digest used as the stored, revocable handle for a token. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
