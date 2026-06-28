import { SetMetadata } from '@nestjs/common';

export const DEFAULT_THROTTLER = 'default';
export const UPLOAD_THROTTLER = 'upload';

export const UPLOAD_THROTTLE_MARKER = 'throttle:upload-target';

export const UploadRateLimited = (): MethodDecorator & ClassDecorator =>
  SetMetadata(UPLOAD_THROTTLE_MARKER, true);
