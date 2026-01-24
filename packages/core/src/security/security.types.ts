export interface SecurityPolicy {
  network: NetworkPolicy;
  filesystem: FilesystemPolicy;
  process: ProcessPolicy;
}

export interface NetworkPolicy {
  enabled: boolean;
  allowedHosts?: string[];
  allowedPorts?: number[];
}

export interface FilesystemPolicy {
  readOnly: boolean;
  allowedWritePaths?: string[];
  blockedReadPaths?: string[];
}

export interface ProcessPolicy {
  allowSpawn: boolean;
  allowedCommands?: string[];
}

export interface SecurityEvent {
  type: 'network' | 'filesystem' | 'process';
  action: 'read' | 'write' | 'connect' | 'spawn' | 'blocked';
  target: string;
  timestamp: number;
  allowed: boolean;
  details?: string;
}

export interface SecurityAudit {
  events: SecurityEvent[];
  summary: SecuritySummary;
  policy: SecurityPolicy;
}

export interface SecuritySummary {
  networkAttempts: number;
  networkBlocked: number;
  filesystemReads: number;
  filesystemWrites: number;
  filesystemBlocked: number;
  processSpawns: number;
  processBlocked: number;
  overallStatus: 'clean' | 'violations';
}

export const DEFAULT_POLICY: SecurityPolicy = {
  network: {
    enabled: false,
  },
  filesystem: {
    readOnly: true,
    allowedWritePaths: ['/tmp'],
    blockedReadPaths: ['/etc/passwd', '/etc/shadow', '/etc/hosts', '/proc', '/sys'],
  },
  process: {
    allowSpawn: false,
  },
};
