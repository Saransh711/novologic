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
import { extensionForMimeType } from '../domain/file.constants';

const PRISMA_UNIQUE_CONSTRAINT = 'P2002';

export interface UploadFileMetadata {
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

/** A binary received at the upload boundary, ready to be persisted. */
export interface IncomingBinary {
  originalName: string;
  mimeType: string;
  size: number;
  content: Buffer;
}

/** Result of storing a binary: the key + URL the client uses thereafter. */
export interface StoredBinaryResult {
  storageKey: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class FileService {
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly maxUploadSizeBytes: number;
  private readonly publicBaseUrl: string;
  private readonly uploadsPublicPath: string;

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
    this.publicBaseUrl = config.get('PUBLIC_BASE_URL', { infer: true });
    this.uploadsPublicPath = config.get('UPLOADS_PUBLIC_PATH', { infer: true });
  }

  /**
   * Validates and persists an uploaded binary, returning the server-generated
   * storage key and served URL the client passes to `uploadFileMetadata`.
   */
  async upload(binary: IncomingBinary): Promise<StoredBinaryResult> {
    this.assertAllowedMimeType(binary.mimeType);
    this.assertWithinSizeLimit(binary.size);

    const extension = extensionForMimeType(binary.mimeType);
    const storageKey = await this.storage.save({ content: binary.content, extension });

    return {
      storageKey,
      url: this.buildPublicUrl(storageKey),
      name: sanitizeDisplayName(binary.originalName),
      mimeType: binary.mimeType,
      size: binary.size,
    };
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

    const binaryExists = await this.storage.exists(metadata.storageKey);
    if (!binaryExists) {
      throw new InvalidInputError(
        `No uploaded binary was found for storage key "${metadata.storageKey}".`,
      );
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

  private buildPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}${this.uploadsPublicPath}/${storageKey}`;
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

const MAX_DISPLAY_NAME_LENGTH = 255;

/**
 * Derives a safe display name from a client-supplied filename: strips any path
 * components and control characters and bounds the length. Used for display
 * only — never as a storage path.
 */
function sanitizeDisplayName(originalName: string): string {
  const baseName = originalName.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const safeName = withoutControlChars.slice(0, MAX_DISPLAY_NAME_LENGTH);
  return safeName.length > 0 ? safeName : 'upload';
}
