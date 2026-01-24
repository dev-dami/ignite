import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { loadService, executeService, runPreflight, getImageName, buildServiceImage } from '@ignite/core';
import { logger } from '@ignite/shared';
import type {
  ServiceExecutionRequest,
  ServiceExecutionResponse,
  ServicePreflightResponse,
  HealthResponse,
  ErrorResponse,
} from './types.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  servicesPath?: string;
}

const startTime = Date.now();

export function createServer(options: ServerOptions = {}) {
  const { port = 3000, host = 'localhost', servicesPath = './services' } = options;

  const app = new Elysia()
    .use(cors())
    .onError(({ code, error, set }) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Request error: ${errorMessage}`);
      set.status = code === 'NOT_FOUND' ? 404 : 500;
      return {
        error: errorMessage,
        code: String(code),
      } satisfies ErrorResponse;
    })
    .get('/health', (): HealthResponse => ({
      status: 'ok',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    }))
    .post(
      '/services/:serviceName/execute',
      async ({ params, body, set }): Promise<ServiceExecutionResponse> => {
        const { serviceName } = params;
        const { input, skipPreflight, skipBuild } = body as ServiceExecutionRequest;

        try {
          const servicePath = `${servicesPath}/${serviceName}`;
          const service = await loadService(servicePath);

          let preflightResult = undefined;
          if (!skipPreflight) {
            const imageName = getImageName(service.config.service.name);
            if (!skipBuild) {
              await buildServiceImage(service, imageName);
            }
            preflightResult = await runPreflight(service, { imageName });

            if (preflightResult.overallStatus === 'fail') {
              set.status = 400;
              return {
                success: false,
                serviceName,
                preflight: preflightResult,
                error: 'Preflight checks failed',
              };
            }
          }

          const metrics = await executeService(service, { input, skipBuild });

          return {
            success: true,
            serviceName,
            metrics,
            preflight: preflightResult,
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Execution failed for ${serviceName}: ${errorMessage}`);
          set.status = 500;
          return {
            success: false,
            serviceName,
            error: errorMessage,
          };
        }
      },
      {
        body: t.Object({
          input: t.Optional(t.Unknown()),
          skipPreflight: t.Optional(t.Boolean()),
          skipBuild: t.Optional(t.Boolean()),
        }),
      }
    )
    .get('/services/:serviceName/preflight', async ({ params, set }): Promise<ServicePreflightResponse | ErrorResponse> => {
      const { serviceName } = params;

      try {
        const servicePath = `${servicesPath}/${serviceName}`;
        const service = await loadService(servicePath);
        const imageName = getImageName(service.config.service.name);

        await buildServiceImage(service, imageName);
        const preflight = await runPreflight(service, { imageName });

        return {
          serviceName,
          preflight,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Preflight failed for ${serviceName}: ${errorMessage}`);
        set.status = 500;
        return {
          error: errorMessage,
          code: 'PREFLIGHT_ERROR',
        };
      }
    })
    .get('/services', async ({ set }): Promise<{ services: string[] } | ErrorResponse> => {
      try {
        const { readdir } = await import('node:fs/promises');
        const entries = await readdir(servicesPath, { withFileTypes: true });
        const services = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        return { services };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        set.status = 500;
        return {
          error: errorMessage,
          code: 'LIST_ERROR',
        };
      }
    });

  let isRunning = false;

  return {
    app,
    start: () => {
      app.listen({ port, hostname: host });
      isRunning = true;
      logger.info(`Ignite HTTP server running at http://${host}:${port}`);
      return app;
    },
    stop: () => {
      if (isRunning) {
        app.stop();
        isRunning = false;
        logger.info('Ignite HTTP server stopped');
      }
    },
    handle: (request: Request) => app.handle(request),
  };
}
