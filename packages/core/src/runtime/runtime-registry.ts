import type { RuntimeName } from '@ignite/shared';

export interface RuntimeConfig {
  name: RuntimeName;
  dockerfileDir: string;
  defaultEntry: string;
  fileExtensions: string[];
}

const runtimeConfigs: Record<RuntimeName, RuntimeConfig> = {
  node: {
    name: 'node',
    dockerfileDir: 'runtime-node',
    defaultEntry: 'index.js',
    fileExtensions: ['.js', '.mjs', '.cjs'],
  },
  bun: {
    name: 'bun',
    dockerfileDir: 'runtime-bun',
    defaultEntry: 'index.ts',
    fileExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  },
};

export function getRuntimeConfig(runtime: RuntimeName): RuntimeConfig {
  return runtimeConfigs[runtime];
}

export function isValidRuntime(runtime: string): runtime is RuntimeName {
  return runtime === 'node' || runtime === 'bun';
}

export function getSupportedRuntimes(): RuntimeName[] {
  return Object.keys(runtimeConfigs) as RuntimeName[];
}
