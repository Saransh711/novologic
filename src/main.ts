import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Response } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  applyUploadConstraintsToDocument,
  UploadConstraints,
} from './common/swagger/upload-docs.transform';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';
import { UPLOAD_FILE_OPERATION_ID } from './modules/file/interface/file-upload.controller';

const SWAGGER_PATH = 'docs';

function setupSwagger(app: NestExpressApplication, uploadConstraints: UploadConstraints): void {
  const config = new DocumentBuilder()
    .setTitle('Workbook API')
    .setDescription(
      'REST surface for the Online Workbook product. The primary API is GraphQL at /graphql; these REST endpoints cover health checks and binary uploads.',
    )
    .setVersion('0.1.0')
    .addTag('health', 'Service health and readiness checks')
    .addTag('files', 'Binary file uploads (images and PDF)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  applyUploadConstraintsToDocument(document, UPLOAD_FILE_OPERATION_ID, uploadConstraints);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

function parseAllowedMimeTypes(raw: string): string[] {
  return raw
    .split(',')
    .map((type) => type.trim())
    .filter((type) => type.length > 0);
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const playgroundEnabled = config.get('GRAPHQL_PLAYGROUND', { infer: true });
  const corsOrigins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));
  const uploadsDir = resolve(config.get('UPLOADS_DIR', { infer: true }));
  const uploadsPublicPath = config.get('UPLOADS_PUBLIC_PATH', { infer: true });
  const uploadConstraints: UploadConstraints = {
    allowedMimeTypes: parseAllowedMimeTypes(config.get('ALLOWED_MIME_TYPES', { infer: true })),
    maxUploadSizeBytes: config.get('MAX_UPLOAD_SIZE_BYTES', { infer: true }),
  };
  const isProduction = nodeEnv === NodeEnv.Production;

  app.use(
    helmet({
      contentSecurityPolicy: playgroundEnabled ? false : undefined,
      crossOriginEmbedderPolicy: !playgroundEnabled,
    }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );


  const frameAncestors = ['\'self\'', ...corsOrigins].join(' ');

  await mkdir(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, {
    prefix: uploadsPublicPath,
    index: false,
    dotfiles: 'deny',
    redirect: false,
    setHeaders: (res: Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    },
  });

  setupSwagger(app, uploadConstraints);

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`workbook-api running on port ${port} (${nodeEnv})`);
  logger.log(`Swagger UI available at http://localhost:${port}/${SWAGGER_PATH}`);
  if (!isProduction && playgroundEnabled) {
    logger.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
  }
}

bootstrap().catch((error: unknown) => {
  // The pino logger may not be wired yet if bootstrap failed early, so fall back
  // to the framework logger to guarantee the failure is surfaced before exit.
  new Logger('Bootstrap').error(
    'Fatal error during bootstrap',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
