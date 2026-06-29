import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { GraphQLJSON } from 'graphql-scalars';
import { IsProseMirrorDocument } from '../../../../common/validation/is-prosemirror-document.validator';

@InputType({ description: 'Input to create or overwrite a project workbook.' })
export class SaveWorkbookInput {
  @Field({ description: 'Identifier of the project that owns the workbook.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  projectId!: string;

  @Field(() => GraphQLJSON, {
    description: 'ProseMirror/Tiptap document to persist as the workbook content.',
  })
  @IsProseMirrorDocument()
  content!: Record<string, unknown>;
}
