import { Injectable } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a stable, paginated page of projects, oldest first. The secondary
   * sort on `id` keeps ordering deterministic when timestamps collide.
   */
  async list(take: number, skip: number): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });
  }
}
