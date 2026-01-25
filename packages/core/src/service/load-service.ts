import { readFile, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ServiceError, type ServiceConfig, validateDockerName } from '@ignite/shared';
import type { LoadedService, ServiceValidation } from './service.types.js';
import { isValidRuntime, getSupportedRuntimes } from '../runtime/runtime-registry.js';

export async function loadService(servicePath: string): Promise<LoadedService> {
  const absolutePath = resolve(servicePath);
  const configPath = join(absolutePath, 'service.yaml');

  const configContent = await readFile(configPath, 'utf-8').catch((err) => {
    throw new ServiceError(`Cannot read service.yaml at ${configPath}`, err as Error);
  });

  const config = parseYaml(configContent) as ServiceConfig;
  const validation = validateServiceConfig(config);

  if (!validation.valid) {
    throw new ServiceError(`Invalid service.yaml: ${validation.errors.join(', ')}`);
  }

  const entryPath = join(absolutePath, config.service.entry);
  await stat(entryPath).catch(() => {
    throw new ServiceError(`Entry file not found: ${entryPath}`);
  });

  const nodeModulesPath = join(absolutePath, 'node_modules');
  const hasNodeModules = await stat(nodeModulesPath)
    .then((s) => s.isDirectory())
    .catch(() => false);

  let nodeModulesSize: number | undefined;
  let dependencyCount: number | undefined;

  if (hasNodeModules) {
    const sizeResult = await getDirectorySize(nodeModulesPath);
    nodeModulesSize = sizeResult;
    dependencyCount = await countDependencies(nodeModulesPath);
  }

  return {
    config,
    servicePath: absolutePath,
    entryPath,
    hasNodeModules,
    nodeModulesSize,
    dependencyCount,
  };
}

function validateServiceConfig(config: unknown): ServiceValidation {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const c = config as Record<string, unknown>;

  if (!c['service'] || typeof c['service'] !== 'object') {
    return { valid: false, errors: ['Missing service block'] };
  }

  const service = c['service'] as Record<string, unknown>;

  if (typeof service['name'] !== 'string' || !service['name']) {
    errors.push('service.name is required');
  } else {
    const name = service['name'] as string;
    const validation = validateDockerName(name);
    if (!validation.valid) {
      errors.push(`service.name invalid: ${validation.error}`);
    }
  }

  const runtime = service['runtime'];
  if (typeof runtime !== 'string' || !isValidRuntime(runtime)) {
    errors.push(`service.runtime must be one of: ${getSupportedRuntimes().join(', ')}`);
  }

  const entry = service['entry'];
  if (typeof entry !== 'string' || !entry) {
    errors.push('service.entry is required');
  } else if (entry.startsWith('/') || entry.startsWith('..')) {
    errors.push('service.entry must be a relative path within the service directory');
  }

  if (typeof service['memoryMb'] !== 'number' || service['memoryMb'] <= 0) {
    errors.push('service.memoryMb must be a positive number');
  }

  if (service['cpuLimit'] !== undefined) {
    if (typeof service['cpuLimit'] !== 'number' || service['cpuLimit'] <= 0) {
      errors.push('service.cpuLimit must be a positive number');
    }
  }

  if (typeof service['timeoutMs'] !== 'number' || service['timeoutMs'] <= 0) {
    errors.push('service.timeoutMs must be a positive number');
  }

  if (service['env'] !== undefined) {
    if (typeof service['env'] !== 'object' || service['env'] === null) {
      errors.push('service.env must be an object');
    } else {
      const env = service['env'] as Record<string, unknown>;
      for (const [key, value] of Object.entries(env)) {
        if (typeof value !== 'string') {
          errors.push(`service.env.${key} must be a string`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalSize += await getDirectorySize(entryPath);
    } else if (entry.isFile()) {
      const stats = await stat(entryPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

async function countDependencies(nodeModulesPath: string): Promise<number> {
  const entries = await readdir(nodeModulesPath, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (entry.name.startsWith('@')) {
      const scopedEntries = await readdir(join(nodeModulesPath, entry.name), {
        withFileTypes: true,
      });
      count += scopedEntries.filter((e) => e.isDirectory()).length;
    } else if (!entry.name.startsWith('.')) {
      count++;
    }
  }

  return count;
}
