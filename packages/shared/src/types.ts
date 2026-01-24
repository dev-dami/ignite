export type RuntimeName = 'node' | 'bun';

export interface ServiceConfig {
  service: {
    name: string;
    runtime: RuntimeName;
    entry: string;
    memoryMb: number;
    timeoutMs: number;
    env?: Record<string, string>;
  };
}

export interface ExecutionMetrics {
  executionTimeMs: number;
  memoryUsageMb: number;
  coldStart: boolean;
  coldStartTimeMs?: number;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PreflightResult {
  serviceName: string;
  timestamp: string;
  checks: PreflightCheck[];
  overallStatus: 'pass' | 'warn' | 'fail';
}

export interface PreflightCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: number | string;
  threshold?: number | string;
}

export interface ExecutionReport {
  serviceName: string;
  timestamp: string;
  preflight: PreflightResult;
  execution?: ExecutionMetrics;
  warnings: Warning[];
}

export interface Warning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  suggestion?: string;
}

export interface RuntimeConfig {
  imageName: string;
  containerName: string;
  memoryLimit: string;
  timeoutMs: number;
  workDir: string;
  env: Record<string, string>;
}
