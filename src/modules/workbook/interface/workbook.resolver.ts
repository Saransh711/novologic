import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Prisma, Workbook } from '@prisma/client';
import { WorkbookService } from '../application/workbook.service';
import { SaveWorkbookInput } from './dto/save-workbook.input';
import { WorkbookObject } from './dto/workbook.object';

@Resolver(() => WorkbookObject)
export class WorkbookResolver {
  constructor(private readonly workbookService: WorkbookService) {}

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

  private static toDto(workbook: Workbook): WorkbookObject {
    return {
      id: workbook.id,
      projectId: workbook.projectId,
      content: workbook.content as Record<string, unknown>,
      createdAt: workbook.createdAt,
      updatedAt: workbook.updatedAt,
    };
  }
}
