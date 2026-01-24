import type { ExecutionReport, PreflightResult, ExecutionMetrics } from '@ignite/shared';
import { generateWarnings } from './warnings.js';

export function createReport(
  preflight: PreflightResult,
  execution?: ExecutionMetrics
): ExecutionReport {
  return {
    serviceName: preflight.serviceName,
    timestamp: new Date().toISOString(),
    preflight,
    execution,
    warnings: generateWarnings(preflight, execution),
  };
}

export function formatReportAsText(report: ExecutionReport): string {
  const lines: string[] = [];
  const divider = '─'.repeat(50);

  lines.push('');
  lines.push(`  IGNITE EXECUTION REPORT`);
  lines.push(`  Service: ${report.serviceName}`);
  lines.push(`  Time: ${report.timestamp}`);
  lines.push('');
  lines.push(divider);

  lines.push('');
  lines.push('  PREFLIGHT CHECKS');
  lines.push('');

  for (const check of report.preflight.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    const color = check.status === 'pass' ? '\x1b[32m' : check.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    const reset = '\x1b[0m';
    lines.push(`  ${color}${icon}${reset} ${check.name}: ${check.message}`);
  }

  lines.push('');
  lines.push(divider);

  if (report.execution) {
    lines.push('');
    lines.push('  EXECUTION METRICS');
    lines.push('');
    lines.push(`  Duration: ${report.execution.executionTimeMs}ms`);
    lines.push(`  Memory: ${report.execution.memoryUsageMb}MB`);
    lines.push(`  Cold Start: ${report.execution.coldStart ? 'Yes' : 'No'}`);
    if (report.execution.coldStartTimeMs) {
      lines.push(`  Cold Start Time: ${report.execution.coldStartTimeMs}ms`);
    }
    lines.push(`  Exit Code: ${report.execution.exitCode}`);

    if (report.execution.stdout.trim()) {
      lines.push('');
      lines.push('  STDOUT:');
      lines.push(`  ${report.execution.stdout.trim().split('\n').join('\n  ')}`);
    }

    lines.push('');
    lines.push(divider);
  }

  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('  WARNINGS');
    lines.push('');

    for (const warning of report.warnings) {
      const icon = warning.level === 'critical' ? '✗' : warning.level === 'warning' ? '⚠' : 'ℹ';
      const color = warning.level === 'critical' ? '\x1b[31m' : warning.level === 'warning' ? '\x1b[33m' : '\x1b[36m';
      const reset = '\x1b[0m';
      lines.push(`  ${color}${icon}${reset} ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    → ${warning.suggestion}`);
      }
    }

    lines.push('');
    lines.push(divider);
  }

  const overallIcon = report.preflight.overallStatus === 'pass' ? '✓' : report.preflight.overallStatus === 'warn' ? '⚠' : '✗';
  const overallColor = report.preflight.overallStatus === 'pass' ? '\x1b[32m' : report.preflight.overallStatus === 'warn' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  lines.push('');
  lines.push(`  ${overallColor}${overallIcon} Overall Status: ${report.preflight.overallStatus.toUpperCase()}${reset}`);
  lines.push('');

  return lines.join('\n');
}
