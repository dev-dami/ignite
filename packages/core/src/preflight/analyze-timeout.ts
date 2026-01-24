import type { PreflightCheck } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';

const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 30000;
const COLD_START_BUFFER_MS = 500;

export function analyzeTimeout(
  service: LoadedService,
  lastExecutionMs?: number
): PreflightCheck {
  const configuredTimeoutMs = service.config.service.timeoutMs;

  if (configuredTimeoutMs < MIN_TIMEOUT_MS) {
    return {
      name: 'timeout-config',
      status: 'fail',
      message: `Timeout ${configuredTimeoutMs}ms is below minimum ${MIN_TIMEOUT_MS}ms`,
      value: configuredTimeoutMs,
      threshold: MIN_TIMEOUT_MS,
    };
  }

  if (configuredTimeoutMs > MAX_TIMEOUT_MS) {
    return {
      name: 'timeout-config',
      status: 'warn',
      message: `Timeout ${configuredTimeoutMs}ms exceeds recommended maximum ${MAX_TIMEOUT_MS}ms`,
      value: configuredTimeoutMs,
      threshold: MAX_TIMEOUT_MS,
    };
  }

  if (lastExecutionMs !== undefined) {
    const estimatedWithColdStart = lastExecutionMs + COLD_START_BUFFER_MS;

    if (configuredTimeoutMs < estimatedWithColdStart) {
      return {
        name: 'timeout-config',
        status: 'warn',
        message: `Timeout ${configuredTimeoutMs}ms may be too short. Last execution: ${lastExecutionMs}ms + ${COLD_START_BUFFER_MS}ms cold start buffer = ${estimatedWithColdStart}ms`,
        value: configuredTimeoutMs,
        threshold: estimatedWithColdStart,
      };
    }
  }

  return {
    name: 'timeout-config',
    status: 'pass',
    message: `Timeout ${configuredTimeoutMs}ms is within acceptable range`,
    value: configuredTimeoutMs,
    threshold: MAX_TIMEOUT_MS,
  };
}
