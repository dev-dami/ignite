export class IgniteError extends Error {
  public readonly code: string;

  constructor(message: string, code: string, cause?: Error) {
    super(message, { cause });
    this.code = code;
    this.name = 'IgniteError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigError extends IgniteError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

export class ServiceError extends IgniteError {
  constructor(message: string, cause?: Error) {
    super(message, 'SERVICE_ERROR', cause);
    this.name = 'ServiceError';
  }
}

export class RuntimeError extends IgniteError {
  constructor(message: string, cause?: Error) {
    super(message, 'RUNTIME_ERROR', cause);
    this.name = 'RuntimeError';
  }
}

export class ExecutionError extends IgniteError {
  constructor(message: string, cause?: Error) {
    super(message, 'EXECUTION_ERROR', cause);
    this.name = 'ExecutionError';
  }
}

export class PreflightError extends IgniteError {
  constructor(message: string, cause?: Error) {
    super(message, 'PREFLIGHT_ERROR', cause);
    this.name = 'PreflightError';
  }
}
