import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, Max, Min } from 'class-validator';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@ArgsType()
export class ListProjectsArgs {
  @Field(() => Int, {
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `Maximum number of projects to return (1-${MAX_PAGE_SIZE}).`,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  take: number = DEFAULT_PAGE_SIZE;

  @Field(() => Int, {
    defaultValue: 0,
    description: 'Number of projects to skip before collecting the page.',
  })
  @IsInt()
  @Min(0)
  skip: number = 0;
}
