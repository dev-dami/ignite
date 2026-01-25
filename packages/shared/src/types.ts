export interface ServiceConfig {
  service: {
    name: string;
    runtime: string;
    entry: string;
    memoryMb: number;
    cpuLimit?: number;
    timeoutMs: number;
    env?: Record<string, string>;
  };
  preflight?: PreflightConfig;
}

export interface PreflightConfig {
  memory?: {
    baseMb?: number;
    perDependencyMb?: number;
    warnRatio?: number;
    failRatio?: number;
  };
  dependencies?: {
    warnCount?: number;
    infoCount?: number;
  };
  image?: {
    warnMb?: number;
    failMb?: number;
  };
  timeout?: {
    minMs?: number;
    maxMs?: number;
    coldStartBufferMs?: number;
  };
}

export interface RuntimeSpec {
  name: string;
  version?: string;
}

export function parseRuntime(runtime: string): RuntimeSpec {
  const atIndex = runtime.lastIndexOf('@');
  if (atIndex > 0) {
    return {
      name: runtime.slice(0, atIndex),
      version: runtime.slice(atIndex + 1),
    };
  }
  return { name: runtime };
}

export function formatRuntime(spec: RuntimeSpec): string {
  return spec.version ? `${spec.name}@${spec.version}` : spec.name;
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

export interface EnvironmentManifest {
  version: string;
  runtime: RuntimeSpec;
  lockfile?: string;
  checksums: Record<string, string>;
  createdAt: string;
}
