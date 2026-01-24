import type { ExecutionMetrics, PreflightResult } from '@ignite/shared';

export interface ServiceExecutionRequest {
  input?: unknown;
  skipPreflight?: boolean;
  skipBuild?: boolean;
  audit?: boolean;
}

export interface ServiceExecutionResponse {
  success: boolean;
  serviceName: string;
  metrics?: ExecutionMetrics;
  preflight?: PreflightResult;
  error?: string;
}

export interface ServicePreflightResponse {
  serviceName: string;
  preflight: PreflightResult;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
}
