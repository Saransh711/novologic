import { Injectable } from '@nestjs/common';
import { Prisma, Workbook, WorkbookVersion } from '@prisma/client';
import { ResourceNotFoundError } from '../../../common/errors/domain.error';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MAX_WORKBOOK_VERSIONS } from '../domain/workbook.constants';

@Injectable()
export class WorkbookService {
  constructor(private readonly prisma: PrismaService) {}

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

      await this.snapshotCurrent(tx, existing);
      await this.prunePreviousVersions(tx, existing.id);

      return tx.workbook.update({ where: { id: existing.id }, data: { content } });
    });
  }

  async findByProjectId(projectId: string): Promise<Workbook | null> {
    return this.prisma.workbook.findUnique({ where: { projectId } });
  }

  async listVersions(workbookId: string): Promise<WorkbookVersion[]> {
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: workbookId },
      select: { id: true },
    });
    if (!workbook) {
      throw new ResourceNotFoundError(`Workbook "${workbookId}" was not found.`);
    }

    return this.prisma.workbookVersion.findMany({
      where: { workbookId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_WORKBOOK_VERSIONS,
    });
  }

  async restoreVersion(versionId: string): Promise<Workbook> {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.workbookVersion.findUnique({ where: { id: versionId } });
      if (!version) {
        throw new ResourceNotFoundError(`Workbook version "${versionId}" was not found.`);
      }

      const workbook = await tx.workbook.findUnique({ where: { id: version.workbookId } });
      if (!workbook) {
        throw new ResourceNotFoundError(`Workbook "${version.workbookId}" was not found.`);
      }

      await this.snapshotCurrent(tx, workbook);
      await this.prunePreviousVersions(tx, workbook.id);

      return tx.workbook.update({
        where: { id: workbook.id },
        data: { content: version.content as Prisma.InputJsonValue },
      });
    });
  }

  private async snapshotCurrent(tx: Prisma.TransactionClient, workbook: Workbook): Promise<void> {
    await tx.workbookVersion.create({
      data: {
        workbookId: workbook.id,
        content: workbook.content as Prisma.InputJsonValue,
      },
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
