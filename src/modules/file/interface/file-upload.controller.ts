import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ErrorResponse } from '../../../common/dto/error-response';
import { InvalidInputError } from '../../../common/errors/domain.error';
import { FileService } from '../application/file.service';
import { UploadFileResponse } from './dto/upload-file-response';

/**
 * Stable OpenAPI operation id for the upload endpoint. Used by the Swagger
 * transform in `main.ts` to inject the live MIME allowlist and size limit
 * without coupling to the route path.
 */
export const UPLOAD_FILE_OPERATION_ID = 'filesUpload';

/**
 * Thin HTTP boundary for binary uploads. Multipart parsing, the size limit, and
 * the MIME allowlist are enforced by the `file` Multer interceptor configured in
 * {@link FileModule}; this controller only delegates to the service and maps the
 * result. The two-step flow is: upload here, then submit the returned
 * `storageKey` to the `uploadFileMetadata` GraphQL mutation.
 */
@ApiTags('files')
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    operationId: UPLOAD_FILE_OPERATION_ID,
    summary: 'Upload a binary file (image or PDF)',
    description: [
      'Step one of the two-step file flow. Accepts a single multipart file, validates it against the server-side allowlist and size limit, stores it under a server-generated key, and returns that key plus its served URL.',
      '',
      'Pass the returned `storageKey` to the `uploadFileMetadata` GraphQL mutation to persist the file metadata.',
      '',
      // The active allowlist and size limit (sourced from ALLOWED_MIME_TYPES and
      // MAX_UPLOAD_SIZE_BYTES) are injected here at boot by the Swagger transform.
    ].join('\n'),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    description: 'Multipart form data carrying exactly one file in the `file` field.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The binary file to upload.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: UploadFileResponse,
    description: 'File stored. Returns the server-generated storage key and served URL.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description:
      'The `file` field is missing, or the file has an unsupported MIME type (not in the images/PDF allowlist).',
  })
  @ApiPayloadTooLargeResponse({
    type: ErrorResponse,
    description: 'The uploaded file exceeds the configured maximum size.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded for the upload endpoint.',
  })
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<UploadFileResponse> {
    if (!file) {
      throw new InvalidInputError('A multipart file field named "file" is required.');
    }

    const result = await this.fileService.upload({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      content: file.buffer,
    });

    return new UploadFileResponse(result);
  }
}
