import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('File', { description: 'A binary asset uploaded to a project.' })
export class FileObject {
  @Field(() => ID, { description: 'Unique file identifier.' })
  id!: string;

  @Field(() => ID, { description: 'Identifier of the owning project.' })
  projectId!: string;

  @Field({ description: 'Human-readable display name of the file.' })
  name!: string;

  @Field({ description: 'IANA media type of the file.' })
  mimeType!: string;

  @Field(() => Int, { description: 'Size of the file in bytes.' })
  size!: number;

  @Field({ description: 'Server-generated storage key locating the binary.' })
  storageKey!: string;

  @Field(() => GraphQLISODateTime, { description: 'When the file metadata was recorded.' })
  createdAt!: Date;
}
