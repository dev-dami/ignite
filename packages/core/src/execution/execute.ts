import { resolve } from 'node:path';
import { ExecutionError, logger, type ExecutionMetrics } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';
import { dockerBuild, dockerRun, isDockerAvailable } from '../runtime/docker-runtime.js';
import { getRuntimeConfig } from '../runtime/runtime-registry.js';
import { parseMetrics } from './metrics.js';

function findRuntimeRoot(): string {
  const { statSync } = require('node:fs');
  const { homedir } = require('node:os');
  
  const locations = [
    process.env['IGNITE_HOME'],
    resolve(homedir(), '.ignite'),
    resolve(process.cwd(), 'packages'),
    resolve(process.cwd(), '..', 'packages'),
  ].filter(Boolean) as string[];

  for (const loc of locations) {
    try {
      const bunRuntime = resolve(loc, 'runtime-bun', 'Dockerfile');
      const nodeRuntime = resolve(loc, 'runtime-node', 'Dockerfile');
      if (statSync(bunRuntime).isFile() || statSync(nodeRuntime).isFile()) {
        return loc;
      }
    } catch {
      continue;
    }
  }

  for (const loc of locations) {
    try {
      const packagesPath = resolve(loc);
      if (statSync(packagesPath).isDirectory()) {
        return packagesPath;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not find Ignite runtime files. ' +
    'Set IGNITE_HOME environment variable or reinstall Ignite.'
  );
}

export interface ExecuteOptions {
  input?: unknown;
  env?: Record<string, string>;
  skipBuild?: boolean;
}

interface ExecutionState {
  lastExecutionMs?: number;
  runCount: number;
}

const executionState = new Map<string, ExecutionState>();

export async function executeService(
  service: LoadedService,
  options: ExecuteOptions = {}
): Promise<ExecutionMetrics> {
  if (!(await isDockerAvailable())) {
    throw new ExecutionError('Docker is not available. Please ensure Docker is running.');
  }

  const serviceName = service.config.service.name;
  const imageName = `ignite-${serviceName}:latest`;
  const containerName = `ignite-${serviceName}-${Date.now()}`;

  const state = executionState.get(serviceName) ?? { runCount: 0 };
  const isColdStart = state.runCount === 0;

  if (!options.skipBuild) {
    logger.info(`Building image for ${serviceName}...`);
    await buildServiceImage(service, imageName);
  }

  logger.info(`Executing ${serviceName}...`);

  const runResult = await dockerRun({
    imageName,
    containerName,
    memoryLimitMb: service.config.service.memoryMb,
    timeoutMs: service.config.service.timeoutMs,
    workDir: '/app',
    volumes: [
      {
        hostPath: service.servicePath,
        containerPath: '/app',
        readonly: true,
      },
    ],
    env: {
      ...service.config.service.env,
      ...options.env,
      IGNITE_INPUT: options.input ? JSON.stringify(options.input) : '',
      NODE_ENV: 'production',
    },
  });

  const metrics = parseMetrics(runResult, isColdStart);

  state.lastExecutionMs = metrics.executionTimeMs;
  state.runCount++;
  executionState.set(serviceName, state);

  if (runResult.oomKilled) {
    throw new ExecutionError(
      `Service ${serviceName} was killed due to memory limit (${service.config.service.memoryMb}MB)`
    );
  }

  return metrics;
}

export async function buildServiceImage(
  service: LoadedService,
  imageName: string
): Promise<void> {
  const runtime = service.config.service.runtime;
  const runtimeConfig = getRuntimeConfig(runtime);
  const runtimeRoot = findRuntimeRoot();
  const runtimePath = resolve(runtimeRoot, runtimeConfig.dockerfileDir);

  await dockerBuild({
    contextPath: service.servicePath,
    dockerfilePath: `${runtimePath}/Dockerfile`,
    imageName,
    buildArgs: {
      ENTRY_FILE: service.config.service.entry,
    },
  });
}

export function getLastExecutionMs(serviceName: string): number | undefined {
  return executionState.get(serviceName)?.lastExecutionMs;
}

export function resetExecutionState(serviceName: string): void {
  executionState.delete(serviceName);
}

export function getImageName(serviceName: string): string {
  return `ignite-${serviceName}:latest`;
}
