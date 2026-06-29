import { SetMetadata } from '@nestjs/common';

export const DEFAULT_THROTTLER = 'default';
export const UPLOAD_THROTTLER = 'upload';
export const AUTH_THROTTLER = 'auth';

export const UPLOAD_THROTTLE_MARKER = 'throttle:upload-target';
export const AUTH_THROTTLE_MARKER = 'throttle:auth-target';

export const UploadRateLimited = (): MethodDecorator & ClassDecorator =>
  SetMetadata(UPLOAD_THROTTLE_MARKER, true);

/**
 * Marks a resolver/handler as guarded by the stricter `auth` throttler bucket,
 * used to slow brute-force attempts against the login mutation.
 */
export const AuthRateLimited = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_THROTTLE_MARKER, true);
