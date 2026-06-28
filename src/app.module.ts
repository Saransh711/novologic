import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DomainErrorFilter } from './common/filters/domain-error.filter';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { createLoggerOptions } from './common/logging/logger-options.factory';
import {
  DEFAULT_THROTTLER,
  UPLOAD_THROTTLE_MARKER,
  UPLOAD_THROTTLER,
} from './common/throttling/throttler.constants';
import { EnvironmentVariables, NodeEnv, validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { FileModule } from './modules/file/file.module';
import { HealthModule } from './modules/health/health.module';
import { WorkbookModule } from './modules/workbook/workbook.module';

type TypedConfigService = ConfigService<EnvironmentVariables, true>;

/**
 * Strips internal detail (stack traces, original error objects) from GraphQL
 * errors before they leave the server, exposing only the safe message, stable
 * extensions code, path, and locations.
 */
function maskGraphqlError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = error instanceof GraphQLError ? error : undefined;
  const code =
    (original?.extensions?.code as string | undefined) ??
    (formatted.extensions?.code as string | undefined) ??
    'INTERNAL_SERVER_ERROR';

  return {
    message: formatted.message,
    locations: formatted.locations,
    path: formatted.path,
    extensions: { code },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: TypedConfigService) =>
        createLoggerOptions({ NODE_ENV: config.get('NODE_ENV', { infer: true }) }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, Reflector],
      useFactory: (config: TypedConfigService, reflector: Reflector) => ({
        throttlers: [
          {
            name: DEFAULT_THROTTLER,
            ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
            limit: config.get('RATE_LIMIT_MAX', { infer: true }),
          },
          {
            // Scoped to handlers marked with `@UploadRateLimited()`; skipped
            // everywhere else so ordinary routes keep the broader default limit.
            name: UPLOAD_THROTTLER,
            ttl: config.get('UPLOAD_RATE_LIMIT_TTL_MS', { infer: true }),
            limit: config.get('UPLOAD_RATE_LIMIT_MAX', { infer: true }),
            skipIf: (context: ExecutionContext) =>
              !reflector.getAllAndOverride<boolean>(UPLOAD_THROTTLE_MARKER, [
                context.getHandler(),
                context.getClass(),
              ]),
          },
        ],
      }),
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: TypedConfigService) => {
        const playgroundEnabled = config.get('GRAPHQL_PLAYGROUND', { infer: true });
        const isProduction = config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
        return {
          // Persist the generated SDL during local development for review;
          // generate it in memory in production where `src` is not shipped.
          autoSchemaFile: isProduction ? true : join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: false,
          graphiql: playgroundEnabled,
          introspection: playgroundEnabled,
          csrfPrevention: true,
          includeStacktraceInErrorResponses: false,
          formatError: maskGraphqlError,
          context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        };
      },
    }),
    PrismaModule,
    HealthModule,
    WorkbookModule,
    FileModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    // Catch-all safety net registered first; NestJS still routes to the more
    // specific `@Catch(...)` filters below when their type matches.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
  ],
})
export class AppModule {}
