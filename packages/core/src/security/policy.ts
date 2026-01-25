import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { SecurityPolicy, NetworkPolicy, FilesystemPolicy, ProcessPolicy } from './security.types.js';
import { DEFAULT_POLICY } from './security.types.js';

export interface PolicyFile {
  security?: {
    network?: {
      enabled?: boolean;
    };
    filesystem?: {
      readOnly?: boolean;
    };
    process?: {
      allowSpawn?: boolean;
      allowedCommands?: string[];
    };
  };
}

export async function loadPolicyFile(servicePath: string): Promise<SecurityPolicy | null> {
  const policyPaths = [
    resolve(servicePath, 'ignite.policy.yaml'),
    resolve(servicePath, 'ignite.policy.yml'),
    resolve(servicePath, '.ignite-policy.yaml'),
    resolve(servicePath, '.ignite-policy.yml'),
  ];

  for (const policyPath of policyPaths) {
    try {
      const content = await readFile(policyPath, 'utf-8');
      const parsed = parseYaml(content) as PolicyFile;
      return mergePolicies(DEFAULT_POLICY, parsed);
    } catch {
      continue;
    }
  }

  return null;
}

function mergePolicies(base: SecurityPolicy, file: PolicyFile): SecurityPolicy {
  const security = file.security ?? {};

  const network: NetworkPolicy = {
    enabled: security.network?.enabled ?? base.network.enabled,
  };

  const filesystem: FilesystemPolicy = {
    readOnly: security.filesystem?.readOnly ?? base.filesystem.readOnly,
  };

  const process: ProcessPolicy = {
    allowSpawn: security.process?.allowSpawn ?? base.process.allowSpawn,
    allowedCommands: security.process?.allowedCommands ?? base.process.allowedCommands,
  };

  return { network, filesystem, process };
}

export function policyToDockerOptions(policy: SecurityPolicy): {
  networkDisabled: boolean;
  readOnlyRootfs: boolean;
  dropCapabilities: boolean;
  noNewPrivileges: boolean;
  tmpfsPaths: string[];
} {
  return {
    networkDisabled: !policy.network.enabled,
    readOnlyRootfs: policy.filesystem.readOnly,
    dropCapabilities: true,
    noNewPrivileges: true,
    tmpfsPaths: ['/tmp'],
  };
}
