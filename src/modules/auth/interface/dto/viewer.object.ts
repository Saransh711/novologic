import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Viewer', { description: 'The currently authenticated user.' })
export class ViewerObject {
  @Field(() => ID, { description: 'Unique user identifier.' })
  id!: string;

  @Field({ description: 'Display name of the user.' })
  name!: string;

  @Field({ description: 'Email address used to sign in.' })
  email!: string;

  @Field(() => String, { nullable: true, description: 'Optional contact phone number.' })
  phone?: string | null;

  @Field(() => String, { nullable: true, description: 'Optional mailing address.' })
  address?: string | null;

  @Field(() => GraphQLISODateTime, { description: 'When the account was created.' })
  createdAt!: Date;
}
