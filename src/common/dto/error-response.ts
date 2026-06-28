import { ApiProperty } from '@nestjs/swagger';

/**
 * Canonical JSON error body returned by the REST boundary. Mirrors the shape
 * produced by {@link DomainErrorFilter} and {@link MulterExceptionFilter} so the
 * OpenAPI contract matches what clients actually receive.
 */
export class ErrorResponse {
  @ApiProperty({ description: 'HTTP status code of the error.', example: 400 })
  readonly statusCode: number;

  @ApiProperty({
    description: 'Stable machine-readable error code.',
    example: 'BAD_USER_INPUT',
  })
  readonly code: string;

  @ApiProperty({
    description: 'Human-readable explanation of the failure.',
    example: 'Unsupported file type "image/svg+xml".',
  })
  readonly message: string;
}
