export enum ServiceStatus {
  Ok = 'ok',
  Degraded = 'degraded',
}

export enum DependencyStatus {
  Up = 'up',
  Down = 'down',
}

export interface HealthReport {
  status: ServiceStatus;
  service: string;
  timestamp: Date;
  uptimeSeconds: number;
  database: DependencyStatus;
}
