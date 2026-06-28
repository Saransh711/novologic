import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { FileService } from './application/file.service';
import { FileResolver } from './interface/file.resolver';

@Module({
  imports: [StorageModule],
  providers: [FileService, FileResolver],
})
export class FileModule {}
