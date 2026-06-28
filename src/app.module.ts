import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { EnvironmentVariables, NodeEnv, validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

type TypedConfigService = ConfigService<EnvironmentVariables, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: TypedConfigService) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
            limit: config.get('RATE_LIMIT_MAX', { infer: true }),
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
          context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        };
      },
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
