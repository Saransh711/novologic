import { ApiProperty } from '@nestjs/swagger';


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
