import type { PreflightCheck } from '@ignite/shared';
import type { LoadedService } from '../service/service.types.js';

const DEFAULT_MIN_TIMEOUT_MS = 100;
const DEFAULT_MAX_TIMEOUT_MS = 30000;
const DEFAULT_COLD_START_BUFFER_MS = 500;

export function analyzeTimeout(
  service: LoadedService,
  lastExecutionMs?: number
): PreflightCheck {
  const configuredTimeoutMs = service.config.service.timeoutMs;
  const timeoutConfig = service.config.preflight?.timeout;
  const minTimeoutMs = timeoutConfig?.minMs ?? DEFAULT_MIN_TIMEOUT_MS;
  const maxTimeoutMs = timeoutConfig?.maxMs ?? DEFAULT_MAX_TIMEOUT_MS;
  const coldStartBufferMs = timeoutConfig?.coldStartBufferMs ?? DEFAULT_COLD_START_BUFFER_MS;

  if (configuredTimeoutMs < minTimeoutMs) {
    return {
      name: 'timeout-config',
      status: 'fail',
      message: `Timeout ${configuredTimeoutMs}ms is below minimum ${minTimeoutMs}ms`,
      value: configuredTimeoutMs,
      threshold: minTimeoutMs,
    };
  }

  if (configuredTimeoutMs > maxTimeoutMs) {
    return {
      name: 'timeout-config',
      status: 'warn',
      message: `Timeout ${configuredTimeoutMs}ms exceeds recommended maximum ${maxTimeoutMs}ms`,
      value: configuredTimeoutMs,
      threshold: maxTimeoutMs,
    };
  }

  if (lastExecutionMs !== undefined) {
    const estimatedWithColdStart = lastExecutionMs + coldStartBufferMs;

    if (configuredTimeoutMs < estimatedWithColdStart) {
      return {
        name: 'timeout-config',
        status: 'warn',
        message: `Timeout ${configuredTimeoutMs}ms may be too short. Last execution: ${lastExecutionMs}ms + ${coldStartBufferMs}ms cold start buffer = ${estimatedWithColdStart}ms`,
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
    threshold: maxTimeoutMs,
  };
}
