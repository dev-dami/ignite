import type { ServiceConfig } from '@ignite/shared';

export interface LoadedService {
  config: ServiceConfig;
  servicePath: string;
  entryPath: string;
  hasNodeModules: boolean;
  nodeModulesSize?: number;
  dependencyCount?: number;
}

export interface ServiceValidation {
  valid: boolean;
  errors: string[];
}
