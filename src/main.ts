import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const playgroundEnabled = config.get('GRAPHQL_PLAYGROUND', { infer: true });
  const corsOrigins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));
  const isProduction = nodeEnv === NodeEnv.Production;

  app.use(
    helmet({
      // The GraphQL sandbox (Apollo) loads assets from a CDN; relax CSP only
      // when the playground is enabled, keep strict defaults otherwise.
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

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`workbook-api running on port ${port} (${nodeEnv})`);
  if (!isProduction && playgroundEnabled) {
    logger.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
  }
}

void bootstrap();
