import type { PreflightCheck } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';

const DEFAULT_MEMORY_PER_DEP_MB = 2;
const DEFAULT_BASE_MEMORY_MB = 50;
const DEFAULT_WARN_RATIO = 1;
const DEFAULT_FAIL_RATIO = 0.8;

export function analyzeMemory(service: LoadedService): PreflightCheck {
  const configuredMemoryMb = service.config.service.memoryMb;
  const depCount = service.dependencyCount ?? 0;
  const memoryConfig = service.config.preflight?.memory;
  const baseMemoryMb = memoryConfig?.baseMb ?? DEFAULT_BASE_MEMORY_MB;
  const perDependencyMb = memoryConfig?.perDependencyMb ?? DEFAULT_MEMORY_PER_DEP_MB;
  const warnRatio = memoryConfig?.warnRatio ?? DEFAULT_WARN_RATIO;
  const failRatio = memoryConfig?.failRatio ?? DEFAULT_FAIL_RATIO;
  const estimatedMemoryMb = baseMemoryMb + depCount * perDependencyMb;
  const warnThreshold = estimatedMemoryMb * warnRatio;
  const failThreshold = estimatedMemoryMb * failRatio;

  if (configuredMemoryMb < failThreshold) {
    return {
      name: 'memory-allocation',
      status: 'fail',
      message: `Configured memory ${configuredMemoryMb}MB may be insufficient. Estimated need: ${estimatedMemoryMb}MB based on ${depCount} dependencies`,
      value: configuredMemoryMb,
      threshold: Math.round(failThreshold),
    };
  }

  if (configuredMemoryMb < warnThreshold) {
    return {
      name: 'memory-allocation',
      status: 'warn',
      message: `Configured memory ${configuredMemoryMb}MB is close to estimated need of ${estimatedMemoryMb}MB`,
      value: configuredMemoryMb,
      threshold: Math.round(warnThreshold),
    };
  }

  return {
    name: 'memory-allocation',
    status: 'pass',
    message: `Configured memory ${configuredMemoryMb}MB exceeds estimated need of ${estimatedMemoryMb}MB`,
    value: configuredMemoryMb,
    threshold: Math.round(warnThreshold),
  };
}

export function analyzeDependencies(service: LoadedService): PreflightCheck {
  const depCount = service.dependencyCount ?? 0;
  const nodeModulesSizeMb = service.nodeModulesSize
    ? Math.round(service.nodeModulesSize / 1024 / 1024)
    : 0;
  const dependencyConfig = service.config.preflight?.dependencies;
  const warnCount = dependencyConfig?.warnCount ?? 100;
  const infoCount = dependencyConfig?.infoCount ?? 50;

  if (depCount > warnCount) {
    return {
      name: 'dependency-count',
      status: 'warn',
      message: `High dependency count (${depCount}). node_modules size: ${nodeModulesSizeMb}MB. Consider reducing dependencies for faster cold starts.`,
      value: depCount,
      threshold: warnCount,
    };
  }

  if (depCount > infoCount) {
    return {
      name: 'dependency-count',
      status: 'pass',
      message: `Moderate dependency count (${depCount}). node_modules size: ${nodeModulesSizeMb}MB`,
      value: depCount,
      threshold: infoCount,
    };
  }

  return {
    name: 'dependency-count',
    status: 'pass',
    message: `Low dependency count (${depCount}). node_modules size: ${nodeModulesSizeMb}MB`,
    value: depCount,
    threshold: infoCount,
  };
}
