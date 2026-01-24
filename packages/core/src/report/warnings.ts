import type { Warning, PreflightResult, ExecutionMetrics } from '@ignite/shared';

export function generateWarnings(
  preflight: PreflightResult,
  execution?: ExecutionMetrics
): Warning[] {
  const warnings: Warning[] = [];

  for (const check of preflight.checks) {
    if (check.status === 'fail') {
      warnings.push({
        level: 'critical',
        message: check.message,
        suggestion: getSuggestion(check.name, 'fail'),
      });
    } else if (check.status === 'warn') {
      warnings.push({
        level: 'warning',
        message: check.message,
        suggestion: getSuggestion(check.name, 'warn'),
      });
    }
  }

  if (execution) {
    if (execution.coldStart && execution.coldStartTimeMs && execution.coldStartTimeMs > 500) {
      warnings.push({
        level: 'warning',
        message: `Cold start time ${execution.coldStartTimeMs}ms is high`,
        suggestion: 'Reduce dependencies or use lighter base images',
      });
    }

    if (execution.exitCode !== 0) {
      warnings.push({
        level: 'critical',
        message: `Service exited with code ${execution.exitCode}`,
        suggestion: 'Check stderr output for error details',
      });
    }
  }

  return warnings;
}

function getSuggestion(checkName: string, status: 'fail' | 'warn'): string {
  const suggestions: Record<string, Record<string, string>> = {
    'image-size': {
      fail: 'Use a smaller base image like node:alpine or consider multi-stage builds',
      warn: 'Consider optimizing your Docker image by removing unused files',
    },
    'memory-allocation': {
      fail: 'Increase memoryMb in service.yaml or reduce dependencies',
      warn: 'Monitor memory usage during execution and adjust if needed',
    },
    'dependency-count': {
      fail: 'Remove unused dependencies and consider using lighter alternatives',
      warn: 'Review dependencies for unused packages',
    },
    'timeout-config': {
      fail: 'Increase timeoutMs in service.yaml or optimize function execution time',
      warn: 'Consider adding buffer time for cold starts',
    },
  };

  return suggestions[checkName]?.[status] ?? 'Review configuration';
}
