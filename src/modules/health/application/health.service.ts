import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DependencyStatus, HealthReport, ServiceStatus } from '../domain/health.types';

const SERVICE_NAME = 'workbook-api';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const databaseUp = await this.prisma.isHealthy();
    const database = databaseUp ? DependencyStatus.Up : DependencyStatus.Down;

    return {
      status: databaseUp ? ServiceStatus.Ok : ServiceStatus.Degraded,
      service: SERVICE_NAME,
      timestamp: new Date(),
      uptimeSeconds: Math.floor(process.uptime()),
      database,
    };
  }
}
