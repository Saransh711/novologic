import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { InvalidInputError } from '../../common/errors/domain.error';
import { FileStorage, StoredBinary } from './file-storage';


@Injectable()
export class LocalFileStorage extends FileStorage {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly rootDir: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.rootDir = resolve(config.get('UPLOADS_DIR', { infer: true }));
  }

  async save({ content, extension }: StoredBinary): Promise<string> {
    const storageKey = LocalFileStorage.generateStorageKey(extension);
    const absolutePath = this.resolveWithinRoot(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });

    await writeFile(absolutePath, content, { flag: 'wx' });

    return storageKey;
  }

  async exists(storageKey: string): Promise<boolean> {
    const absolutePath = this.resolveWithinRoot(storageKey);
    try {
      await access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageKey: string): Promise<void> {
    const absolutePath = this.resolveWithinRoot(storageKey);
    try {
      await unlink(absolutePath);
    } catch (error) {
      if (isFileNotFound(error)) {
        return;
      }
      this.logger.error(
        `Failed to remove stored binary for key "${storageKey}"`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }


  private static generateStorageKey(extension: string): string {
    const now = new Date();
    const year = now.getUTCFullYear().toString();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    return `${year}/${month}/${randomUUID()}.${safeExtension}`;
  }

  private resolveWithinRoot(storageKey: string): string {
    const normalizedKey = normalize(storageKey);
    const absolutePath = resolve(this.rootDir, normalizedKey);
    const relativePath = relative(this.rootDir, absolutePath);

    const escapesRoot =
      relativePath === '' ||
      relativePath.startsWith('..') ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath);

    if (escapesRoot) {
      throw new InvalidInputError('Resolved file path escapes the uploads directory.');
    }

    return absolutePath;
  }
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
