import type { SecurityAudit, SecurityEvent, SecurityPolicy, SecuritySummary } from './security.types.js';
import { DEFAULT_POLICY } from './security.types.js';

export function parseAuditFromOutput(
  stdout: string,
  stderr: string,
  policy: SecurityPolicy = DEFAULT_POLICY
): SecurityAudit {
  const events: SecurityEvent[] = [];
  const now = Date.now();

  const networkPatterns = [
    { pattern: /ENOTFOUND|ENETUNREACH|ECONNREFUSED|getaddrinfo/gi, action: 'connect' as const },
    { pattern: /fetch failed|network request failed/gi, action: 'connect' as const },
    { pattern: /socket hang up|ETIMEDOUT/gi, action: 'connect' as const },
    { pattern: /aborted|abort.*signal|signal.*abort/gi, action: 'connect' as const },
    { pattern: /network request.*api\.openai\.com|api\.openai\.com.*network/gi, action: 'connect' as const },
    { pattern: /Attempting network request to ([^\s.]+\.[^\s.]+)/gi, action: 'connect' as const },
  ];

  const filesystemPatterns = [
    { pattern: /EACCES.*?['"]([^'"]+)['"]/gi, action: 'blocked' as const },
    { pattern: /EROFS.*?['"]([^'"]+)['"]/gi, action: 'write' as const },
    { pattern: /ENOENT.*?['"]([^'"]+)['"]/gi, action: 'read' as const },
    { pattern: /permission denied.*?['"]?([\/\w.-]+)['"]?/gi, action: 'blocked' as const },
  ];

  const processPatterns = [
    { pattern: /spawn.*EACCES/gi, action: 'spawn' as const },
    { pattern: /child_process.*blocked/gi, action: 'spawn' as const },
  ];

  const combined = stdout + '\n' + stderr;

  for (const { pattern, action } of networkPatterns) {
    const matches = combined.matchAll(pattern);
    for (const match of matches) {
      events.push({
        type: 'network',
        action,
        target: extractTarget(match[0]) || 'unknown host',
        timestamp: now,
        allowed: false,
        details: match[0],
      });
    }
  }

  for (const { pattern, action } of filesystemPatterns) {
    const matches = combined.matchAll(pattern);
    for (const match of matches) {
      const target = match[1] || extractPath(match[0]) || 'unknown path';
      events.push({
        type: 'filesystem',
        action,
        target,
        timestamp: now,
        allowed: false,
        details: match[0],
      });
    }
  }

  for (const { pattern, action } of processPatterns) {
    const matches = combined.matchAll(pattern);
    for (const match of matches) {
      events.push({
        type: 'process',
        action,
        target: extractCommand(match[0]) || 'unknown command',
        timestamp: now,
        allowed: false,
        details: match[0],
      });
    }
  }

  const summary = calculateSummary(events);

  return { events, summary, policy };
}

function extractTarget(text: string): string | null {
  const hostMatch = text.match(/(?:host|address|to)\s+['"]?([a-zA-Z0-9.-]+)['"]?/i);
  if (hostMatch?.[1]) return hostMatch[1];
  
  const urlMatch = text.match(/https?:\/\/([^\/\s'"]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  
  return null;
}

function extractPath(text: string): string | null {
  const pathMatch = text.match(/['"]?(\/[^\s'"]+)['"]?/);
  return pathMatch?.[1] ?? null;
}

function extractCommand(text: string): string | null {
  const cmdMatch = text.match(/spawn\s+['"]?(\w+)['"]?/i);
  return cmdMatch?.[1] ?? null;
}

function calculateSummary(events: SecurityEvent[]): SecuritySummary {
  const networkEvents = events.filter(e => e.type === 'network');
  const filesystemEvents = events.filter(e => e.type === 'filesystem');
  const processEvents = events.filter(e => e.type === 'process');

  const hasViolations = events.some(e => !e.allowed);

  return {
    networkAttempts: networkEvents.length,
    networkBlocked: networkEvents.filter(e => !e.allowed).length,
    filesystemReads: filesystemEvents.filter(e => e.action === 'read').length,
    filesystemWrites: filesystemEvents.filter(e => e.action === 'write').length,
    filesystemBlocked: filesystemEvents.filter(e => !e.allowed).length,
    processSpawns: processEvents.length,
    processBlocked: processEvents.filter(e => !e.allowed).length,
    overallStatus: hasViolations ? 'violations' : 'clean',
  };
}

export function formatSecurityAudit(audit: SecurityAudit): string {
  const lines: string[] = [];
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';
  const BOLD = '\x1b[1m';
  const NC = '\x1b[0m';

  lines.push('');
  lines.push(`  ${CYAN}${BOLD}SECURITY AUDIT${NC}`);
  lines.push('');

  lines.push(`  ${DIM}Policy:${NC}`);
  lines.push(`    Network: ${audit.policy.network.enabled ? `${YELLOW}enabled${NC}` : `${GREEN}blocked${NC}`}`);
  lines.push(`    Filesystem: ${audit.policy.filesystem.readOnly ? `${GREEN}read-only${NC}` : `${YELLOW}read-write${NC}`}`);
  lines.push(`    Process spawn: ${audit.policy.process.allowSpawn ? `${YELLOW}allowed${NC}` : `${GREEN}blocked${NC}`}`);
  lines.push('');

  if (audit.events.length === 0) {
    lines.push(`  ${GREEN}✓${NC} No security events detected`);
    lines.push(`  ${GREEN}✓${NC} Service ran in complete isolation`);
  } else {
    lines.push(`  ${DIM}Events:${NC}`);
    
    const networkEvents = audit.events.filter(e => e.type === 'network');
    const fsEvents = audit.events.filter(e => e.type === 'filesystem');
    const procEvents = audit.events.filter(e => e.type === 'process');

    if (networkEvents.length > 0) {
      lines.push('');
      lines.push(`  ${BOLD}Network${NC}`);
      for (const event of networkEvents) {
        const icon = event.allowed ? `${GREEN}✓${NC}` : `${RED}✗${NC}`;
        const status = event.allowed ? 'allowed' : 'blocked';
        lines.push(`    ${icon} ${event.action}: ${event.target} ${DIM}(${status})${NC}`);
      }
    }

    if (fsEvents.length > 0) {
      lines.push('');
      lines.push(`  ${BOLD}Filesystem${NC}`);
      for (const event of fsEvents) {
        const icon = event.allowed ? `${GREEN}✓${NC}` : `${RED}✗${NC}`;
        const status = event.allowed ? 'allowed' : 'blocked';
        lines.push(`    ${icon} ${event.action}: ${event.target} ${DIM}(${status})${NC}`);
      }
    }

    if (procEvents.length > 0) {
      lines.push('');
      lines.push(`  ${BOLD}Process${NC}`);
      for (const event of procEvents) {
        const icon = event.allowed ? `${GREEN}✓${NC}` : `${RED}✗${NC}`;
        const status = event.allowed ? 'allowed' : 'blocked';
        lines.push(`    ${icon} ${event.action}: ${event.target} ${DIM}(${status})${NC}`);
      }
    }
  }

  lines.push('');
  lines.push('─'.repeat(50));

  const { summary } = audit;
  if (summary.overallStatus === 'clean') {
    lines.push(`  ${GREEN}✓ Security Status: CLEAN${NC}`);
  } else {
    const violations = summary.networkBlocked + summary.filesystemBlocked + summary.processBlocked;
    lines.push(`  ${RED}✗ Security Status: ${violations} VIOLATION(S) BLOCKED${NC}`);
  }
  lines.push('');

  return lines.join('\n');
}
