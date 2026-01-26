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

  const preflight = c['preflight'];
  if (preflight !== undefined) {
    if (typeof preflight !== 'object' || preflight === null) {
      errors.push('preflight must be an object');
    } else {
      const pf = preflight as Record<string, unknown>;

      validatePreflightSection(pf['memory'], 'preflight.memory', errors, {
        baseMb: 'positive',
        perDependencyMb: 'positive',
        warnRatio: 'positive',
        failRatio: 'positive',
      });

      const memoryConfig = pf['memory'] as Record<string, unknown> | undefined;
      const warnRatio = memoryConfig?.['warnRatio'];
      const failRatio = memoryConfig?.['failRatio'];
      if (typeof warnRatio === 'number' && typeof failRatio === 'number') {
        if (warnRatio >= failRatio) {
          errors.push('preflight.memory.warnRatio must be less than preflight.memory.failRatio');
        }
      }

      validatePreflightSection(pf['dependencies'], 'preflight.dependencies', errors, {
        warnCount: 'positive',
        infoCount: 'positive',
      });

      const dependencyConfig = pf['dependencies'] as Record<string, unknown> | undefined;
      const warnCount = dependencyConfig?.['warnCount'];
      const infoCount = dependencyConfig?.['infoCount'];
      if (typeof warnCount === 'number' && typeof infoCount === 'number') {
        if (infoCount >= warnCount) {
          errors.push('preflight.dependencies.infoCount must be less than preflight.dependencies.warnCount');
        }
      }

      validatePreflightSection(pf['image'], 'preflight.image', errors, {
        warnMb: 'positive',
        failMb: 'positive',
      });

      const imageConfig = pf['image'] as Record<string, unknown> | undefined;
      const warnMb = imageConfig?.['warnMb'];
      const failMb = imageConfig?.['failMb'];
      if (typeof warnMb === 'number' && typeof failMb === 'number') {
        if (warnMb >= failMb) {
          errors.push('preflight.image.warnMb must be less than preflight.image.failMb');
        }
      }

      validatePreflightSection(pf['timeout'], 'preflight.timeout', errors, {
        minMs: 'positive',
        maxMs: 'positive',
        coldStartBufferMs: 'positive',
      });

      const timeoutConfig = pf['timeout'] as Record<string, unknown> | undefined;
      const minMs = timeoutConfig?.['minMs'];
      const maxMs = timeoutConfig?.['maxMs'];
      if (typeof minMs === 'number' && typeof maxMs === 'number') {
        if (minMs >= maxMs) {
          errors.push('preflight.timeout.minMs must be less than preflight.timeout.maxMs');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validatePreflightSection(
  section: unknown,
  path: string,
  errors: string[],
  fields: Record<string, 'positive'>
): void {
  if (section === undefined) return;
  if (typeof section !== 'object' || section === null) {
    errors.push(`${path} must be an object`);
    return;
  }

  const record = section as Record<string, unknown>;
  for (const [key, rule] of Object.entries(fields)) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${path}.${key} must be a number`);
      continue;
    }
    if (rule === 'positive' && value <= 0) {
      errors.push(`${path}.${key} must be a positive number`);
    }
  }
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
