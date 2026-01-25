# Threat Model

This document defines the security boundaries, assumptions, and limitations of Ignite's sandboxing capabilities.

## Security Goals

Ignite aims to provide **defense-in-depth** for executing untrusted JavaScript/TypeScript code:

| Goal | Mechanism |
|------|-----------|
| Prevent network exfiltration | `--network=none` in audit mode |
| Prevent filesystem tampering | `--read-only` root filesystem |
| Prevent privilege escalation | `--cap-drop=ALL`, `--no-new-privileges` |
| Prevent resource exhaustion | Docker resource limits (planned) |
| Contain malicious code | Docker container isolation |

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST SYSTEM                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    DOCKER DAEMON                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              IGNITE CONTAINER                   │  │  │
│  │  │  ┌─────────────────────────────────────────────┐│  │  │
│  │  │  │           UNTRUSTED CODE                    ││  │  │
│  │  │  │                                             ││  │  │
│  │  │  │  This is where AI-generated or user code    ││  │  │
│  │  │  │  executes. Assume fully malicious.          ││  │  │
│  │  │  └─────────────────────────────────────────────┘│  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Trusted Components
- Host operating system and kernel
- Docker daemon
- Ignite CLI and runtime images
- Container orchestration

### Untrusted Components
- User-provided code (`index.ts`, `index.js`)
- User-provided dependencies (`package.json`)
- Any files in the service directory

## Kernel Assumptions

Ignite relies on Linux kernel security primitives:

| Primitive | Purpose | Assumption |
|-----------|---------|------------|
| namespaces | Process/network/mount isolation | Kernel correctly enforces namespace boundaries |
| cgroups | Resource limits | Kernel correctly enforces limits |
| seccomp | Syscall filtering | Kernel correctly filters syscalls |
| capabilities | Privilege restriction | Kernel correctly drops capabilities |
| OverlayFS | Read-only filesystem | Kernel correctly enforces read-only mounts |

### Kernel Version Requirements
- Linux 4.x+ recommended
- Docker 20.10+ for full security feature support
- cgroups v2 preferred for resource limits

## What Ignite Protects Against

### In Audit Mode (`--audit`)

| Attack | Protection | Status |
|--------|------------|--------|
| Network data exfiltration | `--network=none` blocks all networking | ✅ Protected |
| Writing malicious files to host | `--read-only` + bind mount restrictions | ✅ Protected |
| Reading sensitive host files | No host filesystem access by default | ✅ Protected |
| Privilege escalation via setuid | `--no-new-privileges` | ✅ Protected |
| Capability abuse | `--cap-drop=ALL` | ✅ Protected |
| Fork bombs / process exhaustion | Docker process limits | ✅ Protected |
| Memory exhaustion | Docker memory limits | ⚠️ Configurable |
| CPU exhaustion | Docker CPU limits | ⚠️ Configurable |
| Disk exhaustion | tmpfs size limits | ⚠️ Configurable |

### In Normal Mode (without `--audit`)

| Attack | Protection | Status |
|--------|------------|--------|
| Container escape | Docker isolation | ✅ Protected |
| Host filesystem access | No host mounts except service dir | ✅ Protected |
| Network attacks | ⚠️ Network allowed | ❌ Not protected |
| Writing to service directory | ⚠️ Allowed | ❌ Not protected |

## Explicit Non-Goals (Out of Scope)

Ignite does **NOT** protect against:

### 1. Docker Daemon Vulnerabilities
If there's a container escape vulnerability in Docker itself, Ignite cannot prevent exploitation.

**Mitigation**: Keep Docker updated. Consider running Docker in rootless mode.

### 2. Kernel Vulnerabilities
Kernel exploits that break namespace/cgroup isolation are outside Ignite's control.

**Mitigation**: Keep kernel updated. Consider gVisor or Kata Containers for defense-in-depth.

### 3. Side-Channel Attacks
Spectre, Meltdown, and similar CPU-level attacks are not mitigated.

**Mitigation**: Use dedicated hardware for high-security workloads.

### 4. Resource Exhaustion (Without Limits)
Without explicit resource limits, malicious code can consume CPU/memory.

**Mitigation**: Always set resource limits for production:
```yaml
# Future: ignite.policy.yaml
resources:
  memory: 512M
  cpu: 0.5
  timeout: 30s
```

### 5. Malicious Dependencies
If untrusted code installs malicious npm packages, Ignite executes them.

**Mitigation**: Use `--audit` mode which blocks network during execution.

### 6. Time-of-Check to Time-of-Use (TOCTOU)
Preflight checks happen before execution. Files could change between check and run.

**Mitigation**: Run preflight immediately before execution. Consider hash verification.

### 7. Cryptomining / Abuse During Execution
Code can use CPU for mining during its allowed execution time.

**Mitigation**: Set strict CPU limits and timeouts.

## Threat Actors

| Actor | Capability | Example |
|-------|------------|---------|
| Naive malicious code | Basic file/network operations | `fs.writeFileSync('/etc/passwd', ...)` |
| Sophisticated attacker | Kernel exploit attempts, container escapes | CVE exploitation |
| AI-generated code | Unintentional dangerous operations | LLM hallucinating `rm -rf /` |
| Supply chain attacker | Malicious npm packages | Typosquatting packages |

## Security Recommendations

### For Maximum Security

```bash
# Always use audit mode for untrusted code
ignite run ./untrusted-service --audit

# Set resource limits (when available)
ignite run ./service --audit --memory=256M --timeout=10s
```

### For Production Deployments

1. **Run Docker rootless** - Limits damage from container escapes
2. **Use separate machines** - Don't run untrusted code on sensitive hosts
3. **Enable seccomp profiles** - Additional syscall filtering
4. **Monitor container behavior** - Log and alert on suspicious activity
5. **Set strict timeouts** - Kill long-running code automatically

### Defense in Depth Stack

```
Layer 1: Ignite audit mode (application level)
Layer 2: Docker container isolation
Layer 3: Linux namespaces/cgroups/seccomp
Layer 4: (Optional) gVisor/Kata Containers
Layer 5: Dedicated hardware / VM isolation
```

## Future Security Enhancements

| Feature | Status | Description |
|---------|--------|-------------|
| Seccomp profiles | Planned | Block dangerous syscalls |
| Resource limits | Planned | Memory, CPU, disk quotas |
| gVisor support | Considered | User-space kernel for stronger isolation |
| Network allowlists | Planned | Allow specific hosts only |
| Read path restrictions | Planned | Block reading sensitive paths |

## Reporting Security Issues

Found a vulnerability? Please report responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainer
3. Allow 90 days for fix before disclosure

## References

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Linux Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [Seccomp](https://man7.org/linux/man-pages/man2/seccomp.2.html)
- [gVisor](https://gvisor.dev/)
- [Kata Containers](https://katacontainers.io/)
