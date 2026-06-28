import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return value === 'true' || value === '1';
};

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(({ value }) => (value === undefined ? 3000 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(({ value }) => (value === undefined || value === '' ? '' : String(value)))
  @IsString()
  CORS_ORIGINS = '';

  @Transform(toBoolean)
  @IsBoolean()
  GRAPHQL_PLAYGROUND = false;

  @Transform(({ value }) => (value === undefined ? 60000 : Number(value)))
  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_MS = 60000;

  @Transform(({ value }) => (value === undefined ? 120 : Number(value)))
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX = 120;

  @Transform(({ value }) => (value === undefined || value === '' ? './uploads' : String(value)))
  @IsString()
  @IsNotEmpty()
  UPLOADS_DIR = './uploads';

  @Transform(({ value }) => (value === undefined ? 10_485_760 : Number(value)))
  @IsInt()
  @Min(1)
  MAX_UPLOAD_SIZE_BYTES = 10_485_760;

  @Transform(({ value }) =>
    value === undefined || value === ''
      ? 'image/png,image/jpeg,image/gif,image/webp,application/pdf'
      : String(value),
  )
  @IsString()
  @IsNotEmpty()
  ALLOWED_MIME_TYPES = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validatedConfig;
}
