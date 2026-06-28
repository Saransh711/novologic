import { ApiProperty } from '@nestjs/swagger';
import { DependencyStatus, ServiceStatus } from '../../domain/health.types';

export class HealthStatusResponse {
  @ApiProperty({
    enum: ServiceStatus,
    enumName: 'ServiceStatus',
    description: 'Aggregated service status.',
    example: ServiceStatus.Ok,
  })
  status!: ServiceStatus;

  @ApiProperty({ description: 'Name of the service reporting health.', example: 'workbook-api' })
  service!: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp when the report was generated.',
    example: '2026-06-28T09:22:20.341Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Process uptime in seconds.', example: 42 })
  uptimeSeconds!: number;

  @ApiProperty({
    enum: DependencyStatus,
    enumName: 'DependencyStatus',
    description: 'PostgreSQL connectivity status.',
    example: DependencyStatus.Up,
  })
  database!: DependencyStatus;
}
