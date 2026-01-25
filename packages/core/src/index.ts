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

export { 
  getRuntimeConfig, 
  isValidRuntime, 
  getSupportedRuntimes,
  registerRuntime,
  unregisterRuntime,
  getRuntimePlugin,
  getSupportedVersions,
} from './runtime/runtime-registry.js';
export type { RuntimeConfig } from './runtime/runtime-registry.js';

export {
  createRuntimePlugin,
  BUILTIN_RUNTIMES,
  BUN_RUNTIME,
  NODE_RUNTIME,
  DENO_RUNTIME,
  QUICKJS_RUNTIME,
} from './runtime/runtime-plugin.js';
export type { RuntimePlugin, RuntimePluginConfig } from './runtime/runtime-plugin.js';

export {
  loadEnvironmentManifest,
  saveEnvironmentManifest,
  createEnvironmentManifest,
  checkEnvironmentDrift,
  lockEnvironment,
  formatEnvironmentInfo,
} from './runtime/environment.js';
export type { EnvironmentInfo } from './runtime/environment.js';

export { parseAuditFromOutput, formatSecurityAudit, DEFAULT_POLICY, loadPolicyFile, policyToDockerOptions } from './security/index.js';
export type { SecurityPolicy, SecurityAudit, SecurityEvent, SecuritySummary } from './security/index.js';
