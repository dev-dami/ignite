import type { ExecutionMetrics } from '@ignite/shared';
import type { DockerRunResult } from '../runtime/runtime.types.js';

const COLD_START_THRESHOLD_MS = 200;

export function parseMetrics(
  runResult: DockerRunResult,
  isColdStart: boolean
): ExecutionMetrics {
  const coldStartTimeMs = isColdStart ? estimateColdStartTime(runResult) : undefined;

  return {
    executionTimeMs: runResult.durationMs,
    memoryUsageMb: parseMemoryFromStderr(runResult.stderr),
    coldStart: isColdStart,
    coldStartTimeMs,
    exitCode: runResult.exitCode,
    stdout: runResult.stdout,
    stderr: cleanStderr(runResult.stderr),
  };
}

function estimateColdStartTime(runResult: DockerRunResult): number {
  const memoryLine = runResult.stderr
    .split('\n')
    .find((line) => line.includes('IGNITE_INIT_TIME:'));

  if (memoryLine) {
    const match = memoryLine.match(/IGNITE_INIT_TIME:(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return Math.min(runResult.durationMs, COLD_START_THRESHOLD_MS);
}

function parseMemoryFromStderr(stderr: string): number {
  const memoryLine = stderr
    .split('\n')
    .find((line) => line.includes('IGNITE_MEMORY_MB:'));

  if (memoryLine) {
    const match = memoryLine.match(/IGNITE_MEMORY_MB:(\d+(?:\.\d+)?)/);
    if (match?.[1]) {
      return parseFloat(match[1]);
    }
  }

  return 0;
}

function cleanStderr(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => !line.startsWith('IGNITE_'))
    .join('\n')
    .trim();
}
