import { Field, Float, ObjectType, registerEnumType } from '@nestjs/graphql';
import { DependencyStatus, ServiceStatus } from '../../domain/health.types';

registerEnumType(ServiceStatus, {
  name: 'ServiceStatus',
  description: 'Overall health of the service.',
});

registerEnumType(DependencyStatus, {
  name: 'DependencyStatus',
  description: 'Health of an individual downstream dependency.',
});

@ObjectType({ description: 'Liveness and readiness snapshot for the API.' })
export class HealthStatus {
  @Field(() => ServiceStatus, { description: 'Aggregated service status.' })
  status!: ServiceStatus;

  @Field({ description: 'Name of the service reporting health.' })
  service!: string;

  @Field({ description: 'ISO-8601 timestamp when the report was generated.' })
  timestamp!: string;

  @Field(() => Float, { description: 'Process uptime in seconds.' })
  uptimeSeconds!: number;

  @Field(() => DependencyStatus, { description: 'PostgreSQL connectivity status.' })
  database!: DependencyStatus;
}
