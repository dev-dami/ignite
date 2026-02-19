# Threat Model

This document defines Ignite security goals, trust boundaries, and explicit non-goals.

## Security Goals

Ignite aims to provide defense-in-depth for untrusted JS/TS execution.

| Goal | Mechanism |
|---|---|
| Reduce network exfiltration risk | audit mode uses network-disabled container execution |
| Reduce filesystem tampering risk | read-only root filesystem in audit mode |
| Limit privilege escalation | dropped capabilities and no-new-privileges |
| Bound runaway workloads | memory/cpu/time limits from service config |
| Preserve inspectability | structured preflight and execution reporting |

## Trust Boundaries

Trusted:

- host OS and kernel
- Docker daemon
- Ignite code and published artifacts

Untrusted:

- service source code
- service dependencies
- runtime input payloads

## Threat Classes

- accidental unsafe code produced by LLM workflows
- intentionally malicious user code
- supply-chain risk from dependencies
- abuse attempts via exposed HTTP API

## What Audit Mode Helps With

- network disablement by container flag
- read-only root filesystem enforcement
- capability stripping
- security-event collection and reporting

Audit mode should be treated as the default for untrusted workloads.

## Known Limits and Non-Goals

Ignite does not guarantee protection against:

- Docker or kernel zero-days
- side-channel attacks
- malicious code behavior within allowed CPU/time budget
- host compromise outside container boundary

## Deployment Guidance

- run Docker on dedicated hosts for untrusted workloads
- keep Docker and host kernel patched
- enable API auth when using HTTP server
- place HTTP server behind trusted network boundary/proxy
- set strict service resource limits
- monitor logs and execution anomalies

## Security Policy Files

When `--audit` is used, policy is loaded from one of:

- `ignite.policy.yaml`
- `ignite.policy.yml`
- `.ignite-policy.yaml`
- `.ignite-policy.yml`

Example:

```yaml
security:
  network:
    enabled: false
  filesystem:
    readOnly: true
  process:
    allowSpawn: false
    allowedCommands: []
```

## Responsible Disclosure

Please report vulnerabilities privately to the maintainer instead of opening public issues.
