import { Injectable } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async list(take: number, skip: number): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });
  }
}
