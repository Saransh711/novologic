import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum CookieSameSite {
  Lax = 'lax',
  Strict = 'strict',
  None = 'none',
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

  @Transform(({ value }) => (value === undefined ? 60000 : Number(value)))
  @IsInt()
  @Min(1)
  UPLOAD_RATE_LIMIT_TTL_MS = 60000;

  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  UPLOAD_RATE_LIMIT_MAX = 20;

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

  @Transform(({ value }) =>
    value === undefined || value === ''
      ? 'http://localhost:3000'
      : String(value).replace(/\/+$/, ''),
  )
  @IsString()
  @IsNotEmpty()
  PUBLIC_BASE_URL = 'http://localhost:3000';

  @Transform(({ value }) => {
    const raw = value === undefined || value === '' ? '/uploads' : String(value);
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/uploads';
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\/[A-Za-z0-9._/-]*$/, {
    message: 'UPLOADS_PUBLIC_PATH must be an absolute URL path of safe characters.',
  })
  UPLOADS_PUBLIC_PATH = '/uploads';

  // --- Authentication -------------------------------------------------------

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET must be at least 32 characters of high-entropy secret.',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET must be at least 32 characters of high-entropy secret.',
  })
  JWT_REFRESH_SECRET!: string;

  @Transform(({ value }) => (value === undefined || value === '' ? '15m' : String(value)))
  @IsString()
  @IsNotEmpty()
  ACCESS_TOKEN_TTL = '15m';

  @Transform(({ value }) => (value === undefined || value === '' ? '7d' : String(value)))
  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_TTL = '7d';

  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = false;

  @Transform(({ value }) =>
    value === undefined || value === '' ? CookieSameSite.Lax : String(value),
  )
  @IsEnum(CookieSameSite)
  COOKIE_SAMESITE: CookieSameSite = CookieSameSite.Lax;

  @Transform(({ value }) => (value === undefined ? '' : String(value)))
  @IsString()
  COOKIE_DOMAIN = '';

  @Transform(({ value }) => (value === undefined ? 60000 : Number(value)))
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_TTL_MS = 60000;

  @Transform(({ value }) => (value === undefined ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_MAX = 10;

  @Transform(({ value }) => (value === undefined || value === '' ? 'Demo123!' : String(value)))
  @IsString()
  @IsNotEmpty()
  SEED_USER_PASSWORD = 'Demo123!';
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
