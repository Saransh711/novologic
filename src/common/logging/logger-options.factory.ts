import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';

const CORRELATION_ID_HEADER = 'x-request-id';
const HEALTH_PATH = '/health';

/**
 * Builds the `nestjs-pino` configuration: structured JSON logs in production,
 * human-readable pretty output in development, with sensitive headers redacted
 * and a per-request correlation id propagated to clients. Health probes are
 * excluded from automatic request logging to keep the signal clean.
 */
export function createLoggerOptions(env: Pick<EnvironmentVariables, 'NODE_ENV'>): Params {
  const isProduction = env.NODE_ENV === NodeEnv.Production;

  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      genReqId: (request: IncomingMessage, response: ServerResponse) => {
        const existing = request.headers[CORRELATION_ID_HEADER];
        const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        response.setHeader(CORRELATION_ID_HEADER, id);
        return id;
      },
      // Never log credentials or session material if they ever appear on a request.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      autoLogging: {
        ignore: (request: IncomingMessage) => request.url === HEALTH_PATH,
      },
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:standard' },
          },
    },
  };
}
