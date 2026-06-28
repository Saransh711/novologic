import { Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from '../application/health.service';
import { HealthReport } from '../domain/health.types';
import { HealthStatus } from './dto/health-status.object';

@SkipThrottle()
@Resolver(() => HealthStatus)
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => HealthStatus, {
    name: 'health',
    description: 'Returns the current health of the API and its dependencies.',
  })
  async health(): Promise<HealthStatus> {
    const report = await this.healthService.check();
    return HealthResolver.toDto(report);
  }

  private static toDto(report: HealthReport): HealthStatus {
    return {
      status: report.status,
      service: report.service,
      timestamp: report.timestamp.toISOString(),
      uptimeSeconds: report.uptimeSeconds,
      database: report.database,
    };
  }
}
