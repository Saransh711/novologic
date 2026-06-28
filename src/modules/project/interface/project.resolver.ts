import { Args, Query, Resolver } from '@nestjs/graphql';
import { Project } from '@prisma/client';
import { ProjectService } from '../application/project.service';
import { ListProjectsArgs } from './dto/list-projects.args';
import { ProjectObject } from './dto/project.object';

@Resolver(() => ProjectObject)
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => [ProjectObject], {
    name: 'projects',
    description: 'Lists projects, oldest first, with pagination.',
  })
  async projects(@Args() args: ListProjectsArgs): Promise<ProjectObject[]> {
    const projects = await this.projectService.list(args.take, args.skip);
    return projects.map((project) => ProjectResolver.toDto(project));
  }

  private static toDto(project: Project): ProjectObject {
    return {
      id: project.id,
      userId: project.userId,
      name: project.name,
      createdAt: project.createdAt,
    };
  }
}
