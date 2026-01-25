import type { PreflightResult, PreflightCheck } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';
import { analyzeImage } from './analyze-image.js';
import { analyzeMemory, analyzeDependencies } from './analyze-memory.js';
import { analyzeTimeout } from './analyze-timeout.js';

export interface PreflightOptions {
  imageName?: string;
  lastExecutionMs?: number;
}

export async function runPreflight(
  service: LoadedService,
  options: PreflightOptions = {}
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  checks.push(analyzeMemory(service));
  checks.push(analyzeDependencies(service));
  checks.push(analyzeTimeout(service, options.lastExecutionMs));

  if (options.imageName) {
    checks.push(await analyzeImage(options.imageName, service.config.preflight?.image));
  }

  const overallStatus = determineOverallStatus(checks);

  return {
    serviceName: service.config.service.name,
    timestamp: new Date().toISOString(),
    checks,
    overallStatus,
  };
}

function determineOverallStatus(
  checks: PreflightCheck[]
): 'pass' | 'warn' | 'fail' {
  const hasFail = checks.some((c) => c.status === 'fail');
  if (hasFail) return 'fail';

  const hasWarn = checks.some((c) => c.status === 'warn');
  if (hasWarn) return 'warn';

  return 'pass';
}
