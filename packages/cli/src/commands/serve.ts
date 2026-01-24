import { Command } from 'commander';
import { resolve } from 'node:path';
import { logger } from '@ignite/shared';

export const serveCommand = new Command('serve')
  .description('Start the HTTP server for service execution')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-s, --services <path>', 'Path to services directory', './services')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const host = options.host;
    const servicesPath = resolve(options.services);

    try {
      const { createServer } = await import('@ignite/http');
      
      const server = createServer({
        port,
        host,
        servicesPath,
      });

      server.start();

      logger.info(`Services directory: ${servicesPath}`);
      logger.info('Press Ctrl+C to stop');

      process.on('SIGINT', () => {
        server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        server.stop();
        process.exit(0);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Failed to start server: ${errorMessage}`);
      process.exit(1);
    }
  });
