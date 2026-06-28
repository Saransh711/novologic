import { Module } from '@nestjs/common';
import { HealthService } from './application/health.service';
import { HealthResolver } from './interface/health.resolver';

@Module({
  providers: [HealthService, HealthResolver],
})
export class HealthModule {}
