import { ApiProperty } from '@nestjs/swagger';


export class UploadFileResponse {
  @ApiProperty({
    description:
      'Server-generated storage key (format: YYYY/MM/<uuid>.<ext>); submit this to the uploadFileMetadata mutation.',
    example: '2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png',
  })
  readonly storageKey: string;

  @ApiProperty({
    description: 'Publicly served URL for the stored binary.',
    example: 'http://localhost:3000/uploads/2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png',
  })
  readonly url: string;

  @ApiProperty({ description: 'Original client-provided file name.', example: 'diagram.png' })
  readonly name: string;

  @ApiProperty({ description: 'Detected MIME type of the stored file.', example: 'image/png' })
  readonly mimeType: string;

  @ApiProperty({ description: 'Size of the stored file in bytes.', example: 20480 })
  readonly size: number;

  constructor(value: {
    storageKey: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
  }) {
    this.storageKey = value.storageKey;
    this.url = value.url;
    this.name = value.name;
    this.mimeType = value.mimeType;
    this.size = value.size;
  }
}
