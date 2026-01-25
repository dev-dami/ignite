import { parseRuntime, type RuntimeSpec } from '@ignite/shared';
import { BUILTIN_RUNTIMES, type RuntimePlugin } from './runtime-plugin.js';

export interface RuntimeConfig {
  name: string;
  version?: string;
  dockerfileDir: string;
  defaultEntry: string;
  fileExtensions: string[];
  plugin: RuntimePlugin;
}

const customRuntimes = new Map<string, RuntimePlugin>();

export function registerRuntime(plugin: RuntimePlugin): void {
  customRuntimes.set(plugin.name, plugin);
}

export function unregisterRuntime(name: string): boolean {
  return customRuntimes.delete(name);
}

export function getRegisteredRuntimes(): string[] {
  return [...Object.keys(BUILTIN_RUNTIMES), ...customRuntimes.keys()];
}

export function getRuntimePlugin(name: string): RuntimePlugin | undefined {
  return customRuntimes.get(name) ?? BUILTIN_RUNTIMES[name];
}

export function getRuntimeConfig(runtime: string): RuntimeConfig {
  const spec = parseRuntime(runtime);
  const plugin = getRuntimePlugin(spec.name);
  
  if (!plugin) {
    throw new Error(
      `Unknown runtime: ${spec.name}. ` +
      `Available runtimes: ${getRegisteredRuntimes().join(', ')}. ` +
      `Register custom runtimes with registerRuntime().`
    );
  }

  const version = spec.version ?? plugin.defaultVersion;

  return {
    name: spec.name,
    version,
    dockerfileDir: `runtime-${spec.name}`,
    defaultEntry: plugin.defaultEntry,
    fileExtensions: plugin.fileExtensions,
    plugin,
  };
}

export function isValidRuntime(runtime: string): boolean {
  const spec = parseRuntime(runtime);
  return getRuntimePlugin(spec.name) !== undefined;
}

export function getSupportedRuntimes(): string[] {
  return getRegisteredRuntimes();
}

export function getSupportedVersions(runtimeName: string): string[] {
  const plugin = getRuntimePlugin(runtimeName);
  return plugin?.supportedVersions ?? [];
}

export { type RuntimePlugin, createRuntimePlugin } from './runtime-plugin.js';
