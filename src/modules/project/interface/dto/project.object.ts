import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Project', { description: 'A workspace owned by a single user.' })
export class ProjectObject {
  @Field(() => ID, { description: 'Unique project identifier.' })
  id!: string;

  @Field(() => ID, { description: 'Identifier of the user that owns the project.' })
  userId!: string;

  @Field({ description: 'Human-readable project name.' })
  name!: string;

  @Field(() => GraphQLISODateTime, { description: 'When the project was created.' })
  createdAt!: Date;
}
