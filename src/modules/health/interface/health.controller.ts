import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from '../application/health.service';
import { HealthReport } from '../domain/health.types';
import { HealthStatusResponse } from './dto/health-status.response';

// Health probes are polled frequently by load balancers and orchestrators;
// exempt them so monitoring never trips (and never depletes) the rate limit.
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness/readiness check',
    description:
      'Returns the current health of the API and its dependencies, including a live database probe.',
  })
  @ApiOkResponse({ type: HealthStatusResponse })
  async check(): Promise<HealthStatusResponse> {
    const report = await this.healthService.check();
    return HealthController.toResponse(report);
  }

  private static toResponse(report: HealthReport): HealthStatusResponse {
    return {
      status: report.status,
      service: report.service,
      timestamp: report.timestamp.toISOString(),
      uptimeSeconds: report.uptimeSeconds,
      database: report.database,
    };
  }
}
