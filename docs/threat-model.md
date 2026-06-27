# Threat Model

This document defines Ignite's security goals, trust boundaries, and assumptions for microVM sandboxed executions.

## Security Goals

Ignite aims to provide defense-in-depth for executing untrusted JS/TS code inside virtualized microVMs.

| Goal | Mechanism |
|---|---|
| Mitigate network exfiltration | VMs are started without virtual network interfaces. |
| Mitigate host file tampering | App files (`/app`) and engine code (`/runtime`) are attached as read-only virtual block devices. |
| Limit privilege escalation | No shell (`/bin/sh`), compiler, or system utilities exist in the guest rootfs. |
| Bound runaway processes | Memory, vCPUs, and time execution limits are enforced directly by the hypervisor process. |
| VSOCK Only handshake | Handshake and stdout/stderr pipes occur over a dedicated virtual socket (VSOCK) connection. |

## Trust Boundaries

### Trusted

- Host OS kernel and CPU virtualization (Intel VT-x / Apple Silicon).
- Native hypervisor processes (Firecracker / macOS Virtualization.framework).
- Statically compiled guest agent init binary (`ignite-guest-agent`).

### Untrusted

- Guest service source code.
- NPM/Bun third-party dependencies (`node_modules`).
- Input payloads sent during execution.

## Hardening Mechanism

By relying on microVMs instead of containers:

1. **Kernel Separation**: The untrusted code runs on a separate guest Linux kernel. A kernel panic or privilege escalation in the guest does not compromise the host kernel.
2. **Distroless Guest Rootfs**: The rootfs image contains nothing except the `/sbin/init` guest agent binary. This makes it impossible for an attacker to run utilities like `sh`, `bash`, `nc`, or `curl`.
3. **No Network Layer**: The hypervisor configures no virtio-net or tap interfaces. VSOCK is the sole communication mechanism.
4. **Read-Only Storage**: All mapped disks (`/app` and `/runtime`) are formatted as ext4 read-only block devices.

## Known Limits & Non-Goals

Ignite does not guarantee protection against:

- CPU hardware vulnerabilities (e.g. Spectre, Meltdown).
- MicroVM escape vulnerabilities in Firecracker or macOS Virtualization.framework.
- Resource consumption within the allowed limits (e.g. infinite loops within the timeoutMs budget).
- Host memory exhaustion if multiple server slots are launched concurrently.
