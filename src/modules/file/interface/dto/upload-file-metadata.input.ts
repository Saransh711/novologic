import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, Min } from 'class-validator';
import {
  STORAGE_KEY_PATTERN,
  STORAGE_KEY_PATTERN_MESSAGE,
} from '../../../../common/validation/storage-key.constants';

@InputType({ description: 'Metadata describing an already-uploaded file binary.' })
export class UploadFileMetadataInput {
  @Field({ description: 'Identifier of the project the file belongs to.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  projectId!: string;

  @Field({ description: 'Human-readable display name of the file.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @Field({ description: 'IANA media type of the file (allowlist enforced server-side).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType!: string;

  @Field(() => Int, { description: 'Size of the file in bytes.' })
  @IsInt()
  @Min(1)
  size!: number;

  @Field({ description: 'Server-generated storage key locating the binary.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(STORAGE_KEY_PATTERN, { message: STORAGE_KEY_PATTERN_MESSAGE })
  storageKey!: string;
}
