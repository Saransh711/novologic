import { Module } from '@nestjs/common';
import { HealthService } from './application/health.service';
import { HealthController } from './interface/health.controller';
import { HealthResolver } from './interface/health.resolver';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthResolver],
})
export class HealthModule {}
