import { Injectable } from '@nestjs/common';
import { Prisma, Workbook } from '@prisma/client';
import { ResourceNotFoundError } from '../../../common/errors/domain.error';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MAX_WORKBOOK_VERSIONS } from '../domain/workbook.constants';

@Injectable()
export class WorkbookService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the project's workbook or overwrites its content. When overwriting,
   * the previous content is archived as a {@link Prisma.WorkbookVersion} and the
   * history is pruned to the {@link MAX_WORKBOOK_VERSIONS} newest snapshots. All
   * steps run in one transaction so history can never diverge from content.
   */
  async save(projectId: string, content: Prisma.InputJsonValue): Promise<Workbook> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.workbook.findUnique({ where: { projectId } });

      if (!existing) {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true },
        });
        if (!project) {
          throw new ResourceNotFoundError(`Project "${projectId}" was not found.`);
        }
        return tx.workbook.create({ data: { projectId, content } });
      }

      await tx.workbookVersion.create({
        data: {
          workbookId: existing.id,
          content: existing.content as Prisma.InputJsonValue,
        },
      });

      await this.prunePreviousVersions(tx, existing.id);

      return tx.workbook.update({ where: { id: existing.id }, data: { content } });
    });
  }

  private async prunePreviousVersions(
    tx: Prisma.TransactionClient,
    workbookId: string,
  ): Promise<void> {
    const staleVersions = await tx.workbookVersion.findMany({
      where: { workbookId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_WORKBOOK_VERSIONS,
      select: { id: true },
    });

    if (staleVersions.length === 0) {
      return;
    }

    await tx.workbookVersion.deleteMany({
      where: { id: { in: staleVersions.map((version) => version.id) } },
    });
  }
}
