export interface SecurityPolicy {
  network: NetworkPolicy;
  filesystem: FilesystemPolicy;
}

export interface NetworkPolicy {
  enabled: boolean;
}

export interface FilesystemPolicy {
  readOnly: boolean;
}

export interface SecurityEvent {
  type: 'network' | 'filesystem';
  action: 'read' | 'write' | 'connect' | 'blocked';
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
  overallStatus: 'clean' | 'violations';
}

export const DEFAULT_POLICY: SecurityPolicy = {
  network: {
    enabled: false,
  },
  filesystem: {
    readOnly: true,
  },
};
