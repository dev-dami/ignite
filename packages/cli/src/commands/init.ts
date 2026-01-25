import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '@ignite/shared';
import { isValidRuntime, getRuntimeConfig } from '@ignite/core';
import { parseRuntime } from '@ignite/shared';

interface InitOptions {
  path?: string;
  runtime?: string;
}

function getServiceYamlTemplate(serviceName: string, runtime: string, entry: string): string {
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

function getPackageJsonTemplate(serviceName: string, runtime: string, entry: string): string {
  const runtimeName = parseRuntime(runtime).name;
  const startCmd = runtimeName === 'bun' ? `bun run ${entry}` :
                   runtimeName === 'deno' ? `deno run ${entry}` :
                   runtimeName === 'quickjs' ? `qjs ${entry}` :
                   `node ${entry}`;
  return JSON.stringify({
    name: serviceName,
    version: '1.0.0',
    type: 'module',
    main: entry,
    scripts: {
      start: startCmd,
      preflight: 'ignite preflight .',
      run: 'ignite run .'
    }
  }, null, 2) + '\n';
}

const TS_INDEX_TEMPLATE = `interface Event {
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
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
`;

const JS_INDEX_TEMPLATE = `const input = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};

async function handler(event) {
  console.log('Received event:', event);
  
  return {
    statusCode: 200,
    body: { message: 'Hello from Ignite!', input: event }
  };
}

handler(input)
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
`;

export async function initCommand(serviceName: string, options: InitOptions): Promise<void> {
  const runtime = options.runtime ?? 'bun';
  
  if (!isValidRuntime(runtime)) {
    logger.error(`Invalid runtime: ${runtime}. Use a valid runtime like 'bun', 'node', 'deno', or 'quickjs'.`);
    process.exit(1);
  }

  const runtimeConfig = getRuntimeConfig(runtime);
  const entry = runtimeConfig.defaultEntry;
  const isTs = entry.endsWith('.ts') || entry.endsWith('.tsx');

  const targetPath = options.path ?? serviceName;
  const absolutePath = join(process.cwd(), targetPath);

  try {
    await mkdir(absolutePath, { recursive: true });

    await writeFile(join(absolutePath, 'service.yaml'), getServiceYamlTemplate(serviceName, runtime, entry));
    await writeFile(join(absolutePath, 'package.json'), getPackageJsonTemplate(serviceName, runtime, entry));
    await writeFile(join(absolutePath, entry), isTs ? TS_INDEX_TEMPLATE : JS_INDEX_TEMPLATE);

    logger.success(`Initialized ${runtime} service "${serviceName}" at ${absolutePath}`);
    logger.info('');
    logger.info('Next steps:');
    logger.info(`  1. cd ${targetPath}`);
    logger.info(`  2. Edit ${entry} with your function logic`);
    logger.info('  3. Run: ignite preflight .');
    logger.info('  4. Run: ignite run .');
  } catch (err) {
    logger.error(`Failed to initialize service: ${(err as Error).message}`);
    process.exit(1);
  }
}
