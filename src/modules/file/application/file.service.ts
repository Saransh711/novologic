import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File, Prisma } from '@prisma/client';
import {
  InvalidInputError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '../../../common/errors/domain.error';
import { EnvironmentVariables } from '../../../config/env.validation';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../../infrastructure/storage/file-storage';

const PRISMA_UNIQUE_CONSTRAINT = 'P2002';

export interface UploadFileMetadata {
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

@Injectable()
export class FileService {
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly maxUploadSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.allowedMimeTypes = new Set(
      config
        .get('ALLOWED_MIME_TYPES', { infer: true })
        .split(',')
        .map((type) => type.trim().toLowerCase())
        .filter((type) => type.length > 0),
    );
    this.maxUploadSizeBytes = config.get('MAX_UPLOAD_SIZE_BYTES', { infer: true });
  }

  /** Persists metadata for a binary already stored under `storageKey`. */
  async create(metadata: UploadFileMetadata): Promise<File> {
    this.assertAllowedMimeType(metadata.mimeType);
    this.assertWithinSizeLimit(metadata.size);

    const project = await this.prisma.project.findUnique({
      where: { id: metadata.projectId },
      select: { id: true },
    });
    if (!project) {
      throw new ResourceNotFoundError(`Project "${metadata.projectId}" was not found.`);
    }

    try {
      return await this.prisma.file.create({ data: metadata });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ResourceConflictError(
          `A file with storage key "${metadata.storageKey}" already exists.`,
        );
      }
      throw error;
    }
  }

  /** Removes the file's stored binary (if present) and its metadata record. */
  async delete(id: string): Promise<File> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new ResourceNotFoundError(`File "${id}" was not found.`);
    }

    await this.storage.remove(file.storageKey);
    return this.prisma.file.delete({ where: { id } });
  }

  private assertAllowedMimeType(mimeType: string): void {
    if (!this.allowedMimeTypes.has(mimeType.toLowerCase())) {
      throw new InvalidInputError(`Unsupported file type "${mimeType}".`);
    }
  }

  private assertWithinSizeLimit(size: number): void {
    if (size > this.maxUploadSizeBytes) {
      throw new InvalidInputError(
        `File size ${size} bytes exceeds the limit of ${this.maxUploadSizeBytes} bytes.`,
      );
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT
  );
}
