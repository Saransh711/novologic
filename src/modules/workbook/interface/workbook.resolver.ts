import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Prisma, Workbook, WorkbookVersion } from '@prisma/client';
import { WorkbookService } from '../application/workbook.service';
import { SaveWorkbookInput } from './dto/save-workbook.input';
import { WorkbookObject } from './dto/workbook.object';
import { WorkbookVersionObject } from './dto/workbook-version.object';

@Resolver(() => WorkbookObject)
export class WorkbookResolver {
  constructor(private readonly workbookService: WorkbookService) {}

  @Query(() => WorkbookObject, {
    name: 'workbook',
    nullable: true,
    description: 'Returns the workbook for a project, or null if none exists yet.',
  })
  async workbook(
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<WorkbookObject | null> {
    const workbook = await this.workbookService.findByProjectId(projectId);
    return workbook ? WorkbookResolver.toDto(workbook) : null;
  }

  @Query(() => [WorkbookVersionObject], {
    name: 'workbookVersions',
    description: 'Lists the most recent archived versions of a workbook, newest first.',
  })
  async workbookVersions(
    @Args('workbookId', { type: () => ID }) workbookId: string,
  ): Promise<WorkbookVersionObject[]> {
    const versions = await this.workbookService.listVersions(workbookId);
    return versions.map((version) => WorkbookResolver.toVersionDto(version));
  }

  @Mutation(() => WorkbookObject, {
    name: 'saveWorkbook',
    description:
      'Creates or overwrites a project workbook, archiving the previous content as a version.',
  })
  async saveWorkbook(@Args('input') input: SaveWorkbookInput): Promise<WorkbookObject> {
    const workbook = await this.workbookService.save(
      input.projectId,
      input.content as Prisma.InputJsonValue,
    );
    return WorkbookResolver.toDto(workbook);
  }

  @Mutation(() => WorkbookObject, {
    name: 'restoreWorkbookVersion',
    description:
      'Restores a workbook to a previous version, archiving the current content as a new version first.',
  })
  async restoreWorkbookVersion(
    @Args('versionId', { type: () => ID }) versionId: string,
  ): Promise<WorkbookObject> {
    const workbook = await this.workbookService.restoreVersion(versionId);
    return WorkbookResolver.toDto(workbook);
  }

  private static toDto(workbook: Workbook): WorkbookObject {
    return {
      id: workbook.id,
      projectId: workbook.projectId,
      content: workbook.content as Record<string, unknown>,
      createdAt: workbook.createdAt,
      updatedAt: workbook.updatedAt,
    };
  }

  private static toVersionDto(version: WorkbookVersion): WorkbookVersionObject {
    return {
      id: version.id,
      workbookId: version.workbookId,
      content: version.content as Record<string, unknown>,
      createdAt: version.createdAt,
    };
  }
}
