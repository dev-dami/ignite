import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ExecutionError, logger, type ExecutionMetrics, parseRuntime } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';
import { dockerBuild, dockerRun, isDockerAvailable } from '../runtime/docker-runtime.js';
import { getRuntimeConfig } from '../runtime/runtime-registry.js';
import { parseMetrics } from './metrics.js';
import { DEFAULT_POLICY, loadPolicyFile, policyToDockerOptions } from '../security/index.js';
import type { SecurityPolicy } from '../security/security.types.js';



export interface ExecuteOptions {
  input?: unknown;
  env?: Record<string, string>;
  skipBuild?: boolean;
  audit?: boolean;
  policy?: SecurityPolicy;
  /** Called with each stdout chunk as it arrives from the container in real time */
  onStdout?: (chunk: string) => void;
  /** Called with each stderr chunk as it arrives from the container in real time */
  onStderr?: (chunk: string) => void;
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

  let policy: SecurityPolicy | undefined;
  if (options.audit) {
    policy = options.policy ?? (await loadPolicyFile(service.servicePath)) ?? DEFAULT_POLICY;
  }

  const securityOptions = policy ? policyToDockerOptions(policy) : undefined;

  const runResult = await dockerRun({
    imageName,
    containerName,
    memoryLimitMb: service.config.service.memoryMb,
    cpuLimit: service.config.service.cpuLimit,
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
    security: options.audit ? securityOptions : undefined,
    onStdout: options.onStdout,
    onStderr: options.onStderr,
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
  const spec = parseRuntime(runtime);
  const version = spec.version ?? runtimeConfig.version;
  
  const dockerfileContent = runtimeConfig.plugin.generateDockerfile(version);
  
  const tempDir = join(tmpdir(), `ignite-build-${Date.now()}`);
  const dockerfilePath = join(tempDir, 'Dockerfile');
  
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(dockerfilePath, dockerfileContent, 'utf-8');
    
    await dockerBuild({
      contextPath: service.servicePath,
      dockerfilePath,
      imageName,
      buildArgs: {
        ENTRY_FILE: service.config.service.entry,
      },
    });
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
    }
  }
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
