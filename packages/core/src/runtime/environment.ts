import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { parseRuntime, formatRuntime, type EnvironmentManifest } from '@ignite/shared';
import { getRuntimeConfig } from './runtime-registry.js';

const MANIFEST_FILENAME = 'ignite.lock';

export interface EnvironmentInfo {
  manifest: EnvironmentManifest | null;
  isLocked: boolean;
  isDrift: boolean;
  driftDetails?: string[];
}

export async function loadEnvironmentManifest(servicePath: string): Promise<EnvironmentManifest | null> {
  const manifestPath = join(servicePath, MANIFEST_FILENAME);
  
  try {
    const content = await readFile(manifestPath, 'utf-8');
    return parseYaml(content) as EnvironmentManifest;
  } catch {
    return null;
  }
}

export async function saveEnvironmentManifest(
  servicePath: string,
  manifest: EnvironmentManifest
): Promise<void> {
  const manifestPath = join(servicePath, MANIFEST_FILENAME);
  const content = stringifyYaml(manifest);
  await writeFile(manifestPath, content, 'utf-8');
}

export async function createEnvironmentManifest(
  servicePath: string,
  runtime: string
): Promise<EnvironmentManifest> {
  const spec = parseRuntime(runtime);
  const config = getRuntimeConfig(runtime);
  const version = spec.version ?? config.version ?? 'latest';

  const checksums: Record<string, string> = {};

  const filesToHash = [
    'package.json',
    'bun.lockb',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ];

  for (const file of filesToHash) {
    const filePath = join(servicePath, file);
    try {
      const content = await readFile(filePath);
      checksums[file] = createHash('sha256').update(content).digest('hex');
    } catch {
    }
  }

  const lockfile = await detectLockfile(servicePath);

  return {
    version: '1.0',
    runtime: { name: spec.name, version },
    lockfile: lockfile ?? undefined,
    checksums,
    createdAt: new Date().toISOString(),
  };
}

export async function checkEnvironmentDrift(
  servicePath: string,
  currentRuntime: string
): Promise<EnvironmentInfo> {
  const manifest = await loadEnvironmentManifest(servicePath);
  
  if (!manifest) {
    return {
      manifest: null,
      isLocked: false,
      isDrift: false,
    };
  }

  const driftDetails: string[] = [];
  const currentSpec = parseRuntime(currentRuntime);

  if (manifest.runtime.name !== currentSpec.name) {
    driftDetails.push(
      `Runtime changed: ${manifest.runtime.name} -> ${currentSpec.name}`
    );
  }

  if (currentSpec.version && manifest.runtime.version !== currentSpec.version) {
    driftDetails.push(
      `Version changed: ${manifest.runtime.version} -> ${currentSpec.version}`
    );
  }

  for (const [file, expectedHash] of Object.entries(manifest.checksums)) {
    const filePath = join(servicePath, file);
    try {
      const content = await readFile(filePath);
      const actualHash = createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        driftDetails.push(`File modified: ${file}`);
      }
    } catch {
      driftDetails.push(`File removed: ${file}`);
    }
  }

  return {
    manifest,
    isLocked: true,
    isDrift: driftDetails.length > 0,
    driftDetails: driftDetails.length > 0 ? driftDetails : undefined,
  };
}

export async function lockEnvironment(
  servicePath: string,
  runtime: string
): Promise<EnvironmentManifest> {
  const manifest = await createEnvironmentManifest(servicePath, runtime);
  await saveEnvironmentManifest(servicePath, manifest);
  return manifest;
}

async function detectLockfile(servicePath: string): Promise<string | null> {
  const lockfiles = [
    'bun.lockb',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ];

  for (const lockfile of lockfiles) {
    try {
      await stat(join(servicePath, lockfile));
      return lockfile;
    } catch {
      continue;
    }
  }

  return null;
}

export function formatEnvironmentInfo(info: EnvironmentInfo): string {
  const lines: string[] = [];
  
  if (!info.isLocked) {
    lines.push('Environment: Not locked');
    lines.push('  Run `ignite lock` to create ignite.lock');
    return lines.join('\n');
  }

  const manifest = info.manifest!;
  lines.push(`Environment: Locked`);
  lines.push(`  Runtime: ${formatRuntime(manifest.runtime)}`);
  lines.push(`  Locked at: ${manifest.createdAt}`);
  
  if (manifest.lockfile) {
    lines.push(`  Lockfile: ${manifest.lockfile}`);
  }

  if (info.isDrift) {
    lines.push('');
    lines.push('WARNING: Environment drift detected:');
    for (const detail of info.driftDetails ?? []) {
      lines.push(`    - ${detail}`);
    }
    lines.push('');
    lines.push('  Run `ignite lock --update` to update the manifest');
  } else {
    lines.push('');
    lines.push('Environment matches manifest');
  }

  return lines.join('\n');
}
