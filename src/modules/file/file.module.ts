import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InvalidInputError } from '../../common/errors/domain.error';
import { EnvironmentVariables } from '../../config/env.validation';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { FileService } from './application/file.service';
import { FileUploadController } from './interface/file-upload.controller';
import { FileResolver } from './interface/file.resolver';

@Module({
  imports: [
    StorageModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const maxUploadSizeBytes = config.get('MAX_UPLOAD_SIZE_BYTES', { infer: true });
        const allowedMimeTypes = new Set(
          config
            .get('ALLOWED_MIME_TYPES', { infer: true })
            .split(',')
            .map((type) => type.trim().toLowerCase())
            .filter((type) => type.length > 0),
        );

        return {
          // Buffer uploads in memory so binaries never touch a client-controlled
          // path; the storage layer alone decides where bytes are written.
          storage: memoryStorage(),
          limits: { fileSize: maxUploadSizeBytes, files: 1 },
          fileFilter: (_request, file, callback) => {
            if (allowedMimeTypes.has(file.mimetype.toLowerCase())) {
              callback(null, true);
              return;
            }
            callback(new InvalidInputError(`Unsupported file type "${file.mimetype}".`), false);
          },
        };
      },
    }),
  ],
  controllers: [FileUploadController],
  providers: [FileService, FileResolver],
})
export class FileModule {}
