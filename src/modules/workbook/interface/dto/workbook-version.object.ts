import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

@ObjectType('WorkbookVersion', {
  description: 'An immutable snapshot of a workbook captured for version history.',
})
export class WorkbookVersionObject {
  @Field(() => ID, { description: 'Unique version identifier.' })
  id!: string;

  @Field(() => ID, { description: 'Identifier of the workbook this version belongs to.' })
  workbookId!: string;

  @Field(() => GraphQLJSON, { description: 'Archived ProseMirror/Tiptap document content.' })
  content!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime, { description: 'When this version was archived.' })
  createdAt!: Date;
}
