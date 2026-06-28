import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { File } from '@prisma/client';
import { FileService } from '../application/file.service';
import { FileObject } from './dto/file.object';
import { UploadFileMetadataInput } from './dto/upload-file-metadata.input';

@Resolver(() => FileObject)
export class FileResolver {
  constructor(private readonly fileService: FileService) {}

  @Mutation(() => FileObject, {
    name: 'uploadFileMetadata',
    description: 'Records metadata for a file binary already stored under its storage key.',
  })
  async uploadFileMetadata(@Args('input') input: UploadFileMetadataInput): Promise<FileObject> {
    const file = await this.fileService.create(input);
    return FileResolver.toDto(file);
  }

  @Mutation(() => FileObject, {
    name: 'deleteFile',
    description: 'Deletes a file record and its stored binary, returning the removed file.',
  })
  async deleteFile(@Args('id', { type: () => ID }) id: string): Promise<FileObject> {
    const file = await this.fileService.delete(id);
    return FileResolver.toDto(file);
  }

  private static toDto(file: File): FileObject {
    return {
      id: file.id,
      projectId: file.projectId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      storageKey: file.storageKey,
      createdAt: file.createdAt,
    };
  }
}
