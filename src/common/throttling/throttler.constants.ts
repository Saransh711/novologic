import { SetMetadata } from '@nestjs/common';

/**
 * Named throttler buckets. `default` covers the whole surface (GraphQL queries,
 * mutations, REST). `upload` is a stricter, dedicated bucket applied only to
 * routes marked with {@link UploadRateLimited}, since binary uploads (multipart
 * parsing + disk writes) are far more expensive than ordinary requests.
 */
export const DEFAULT_THROTTLER = 'default';
export const UPLOAD_THROTTLER = 'upload';

/** Metadata flag read by the `upload` throttler's `skipIf` to scope it to uploads. */
export const UPLOAD_THROTTLE_MARKER = 'throttle:upload-target';

/** Opts a handler into the stricter {@link UPLOAD_THROTTLER} bucket. */
export const UploadRateLimited = (): MethodDecorator & ClassDecorator =>
  SetMetadata(UPLOAD_THROTTLE_MARKER, true);
