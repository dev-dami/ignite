import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { logger, type RuntimeName } from '@ignite/shared';

interface InitOptions {
  path?: string;
  runtime?: string;
}

function getServiceYamlTemplate(serviceName: string, runtime: RuntimeName): string {
  const entry = runtime === 'bun' ? 'index.ts' : 'index.js';
  return `service:
  name: ${serviceName}
  runtime: ${runtime}
  entry: ${entry}
  memoryMb: 128
  timeoutMs: 5000
  env:
    NODE_ENV: production
`;
}

const NODE_INDEX_TEMPLATE = `const input = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};

async function handler(event) {
  console.log('Received event:', event);
  
  return {
    statusCode: 200,
    body: { message: 'Hello from Ignite!', input: event }
  };
}

handler(input)
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
`;

const BUN_INDEX_TEMPLATE = `interface Event {
  [key: string]: unknown;
}

interface Response {
  statusCode: number;
  body: {
    message: string;
    input: Event;
  };
}

const input: Event = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};

async function handler(event: Event): Promise<Response> {
  console.log('Received event:', event);
  
  return {
    statusCode: 200,
    body: { message: 'Hello from Ignite!', input: event }
  };
}

handler(input)
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
`;

export async function initCommand(serviceName: string, options: InitOptions): Promise<void> {
  const runtime = (options.runtime as RuntimeName) ?? 'bun';
  
  if (runtime !== 'node' && runtime !== 'bun') {
    logger.error(`Invalid runtime: ${options.runtime}. Must be 'node' or 'bun'.`);
    process.exit(1);
  }

  const targetPath = options.path ?? serviceName;
  const absolutePath = join(process.cwd(), targetPath);
  const entryFile = runtime === 'bun' ? 'index.ts' : 'index.js';
  const indexTemplate = runtime === 'bun' ? BUN_INDEX_TEMPLATE : NODE_INDEX_TEMPLATE;

  try {
    await mkdir(absolutePath, { recursive: true });

    await writeFile(join(absolutePath, 'service.yaml'), getServiceYamlTemplate(serviceName, runtime));
    await writeFile(join(absolutePath, entryFile), indexTemplate);

    logger.success(`Initialized ${runtime} service "${serviceName}" at ${absolutePath}`);
    logger.info('');
    logger.info('Next steps:');
    logger.info(`  1. cd ${targetPath}`);
    logger.info(`  2. Edit ${entryFile} with your function logic`);
    logger.info('  3. Run: ignite preflight .');
    logger.info('  4. Run: ignite run .');
  } catch (err) {
    logger.error(`Failed to initialize service: ${(err as Error).message}`);
    process.exit(1);
  }
}
