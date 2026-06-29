import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { EnvironmentVariables } from '../../../config/env.validation';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from '../domain/auth.constants';
import type { SignedRefreshToken } from '../application/token.service';

const DURATION_UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses ms-style durations like `15m`, `1h`, `7d` into milliseconds. */
function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  return Number(match[1]) * DURATION_UNITS_MS[match[2]];
}

/**
 * Centralises httpOnly cookie creation/clearing so every auth cookie shares the
 * same hardened, environment-driven security attributes.
 */
@Injectable()
export class CookieService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  setAuthCookies(res: Response, accessToken: string, refresh: SignedRefreshToken): void {
    const accessMaxAge = parseDurationMs(this.config.get('ACCESS_TOKEN_TTL', { infer: true }));
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.baseOptions('/', accessMaxAge));

    const refreshMaxAge = Math.max(0, refresh.expiresAt.getTime() - Date.now());
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refresh.token,
      this.baseOptions(REFRESH_COOKIE_PATH, refreshMaxAge),
    );
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.baseOptions('/'));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.baseOptions(REFRESH_COOKIE_PATH));
  }

  private baseOptions(path: string, maxAge?: number): CookieOptions {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.config.get('COOKIE_SAMESITE', { infer: true }),
      path,
      ...(domain ? { domain } : {}),
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }
}
