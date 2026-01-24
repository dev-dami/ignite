export { loadService } from './service/load-service.js';
export type { LoadedService, ServiceValidation } from './service/service.types.js';

export { dockerBuild, dockerRun, getImageInfo, isDockerAvailable } from './runtime/docker-runtime.js';
export type { DockerBuildOptions, DockerRunOptions, DockerRunResult, ImageInfo } from './runtime/runtime.types.js';

export { runPreflight } from './preflight/preflight.js';
export type { PreflightOptions } from './preflight/preflight.js';

export { executeService, getLastExecutionMs, resetExecutionState, getImageName, buildServiceImage } from './execution/execute.js';
export type { ExecuteOptions } from './execution/execute.js';

export { createReport, formatReportAsText } from './report/report.js';
export { generateWarnings } from './report/warnings.js';

export { getRuntimeConfig, isValidRuntime, getSupportedRuntimes } from './runtime/runtime-registry.js';
export type { RuntimeConfig } from './runtime/runtime-registry.js';
