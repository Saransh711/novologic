import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

@ObjectType('Workbook', { description: 'The current editable document for a project.' })
export class WorkbookObject {
  @Field(() => ID, { description: 'Unique workbook identifier.' })
  id!: string;

  @Field(() => ID, { description: 'Identifier of the owning project.' })
  projectId!: string;

  @Field(() => GraphQLJSON, { description: 'ProseMirror/Tiptap document content.' })
  content!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime, { description: 'When the workbook was first created.' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the workbook content last changed.' })
  updatedAt!: Date;
}
