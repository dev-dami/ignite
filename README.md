<p align="center">
  <img src="./assets/logo.png" alt="Ignite" width="120" />
</p>

<h1 align="center">Ignite</h1>

<p align="center">
  <strong>Ultra-secure microVM sandboxing for JS/TS services, AI-generated code, and untrusted scripts.</strong>
</p>

<p align="center">
  <a href="https://github.com/dev-dami/ignite/releases"><img src="https://img.shields.io/github/v/release/dev-dami/ignite?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/dev-dami/ignite/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/dev-dami/ignite/actions"><img src="https://img.shields.io/github/actions/workflow/status/dev-dami/ignite/ci.yml?style=flat-square" alt="Build"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-1.75+-orange?style=flat-square&logo=rust" alt="Rust"></a>
</p>

## Overview

Ignite runs JavaScript/TypeScript code inside isolated, hardware-virtualized microVMs rather than containers. It supports native **Firecracker** on Linux and Apple's **Virtualization.framework** on macOS out of the box, with zero external VM dependencies.

It is designed for systems that execute code you do not fully trust:

- AI agent generated code
- Plugin or extension ecosystems
- User submissions and sandboxed automation
- Security-sensitive CI checks

## Key Features

- **Dual-Hypervisor Core**: Uses KVM-backed Firecracker on Linux, and native `Virtualization.framework` on macOS.
- **Host-Reliant Disk Mounts**: The guest microVM has no shell, utilities, or libraries. Service code and language runtimes (Bun, Node, Deno, QuickJS) are compiled on the host and attached as read-only virtual block devices (`/dev/vdb` and `/dev/vdc`).
- **VSOCK Multiplexing**: Low-latency communication handshakes stream stdout/stderr and exit codes directly back to the host via virtual sockets, bypassing network interfaces.
- **Preflight & Metric Timelines**: Sub-millisecond logging of all VM lifecycle transitions (disk format, boot connect, execution, cleanup).

## Quick Start

### 1) Prerequisites

- **Linux**: KVM enabled (`/dev/kvm` accessible) and `e2fsprogs` installed.
- **macOS**: macOS 13 or later.

### 2) Build from Source

```bash
git clone https://github.com/dev-dami/ignite.git
cd ignite
cargo build --release
```

Release binaries will be compiled under `target/release/ignite-cli` (installed as `ignite`).

### 3) Initialize a Service

```bash
ignite init hello-world
cd hello-world
```

### 4) Run the VM Sandbox

```bash
ignite run .
```

To run with trace timelines of startup transitions:

```bash
ignite run . --verbose
```

---

## CLI at a Glance

| Command | Purpose |
|---|---|
| `ignite init <name>` | Generate a new service scaffold |
| `ignite run <path>` | Build + execute service in a microVM |
| `ignite preflight <path>` | Run safety validator checks |
| `ignite serve` | Start HTTP REST API server |

## Runtime Support

| Runtime | Supported versions | Default |
|---|---|---|
| Bun | `1.0`, `1.1`, `1.2`, `1.3` | `1.3` |
| Node | `18`, `20`, `22` | `20` |
| Deno | `1.40`, `1.41`, `1.42`, `2.0` | `2.0` |
| QuickJS | `2024-01-13`, `2023-12-09`, `latest` | `latest` |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Walkthrough](./docs/walkthrough.md)
- [API Reference](./docs/api.md)
- [Architecture](./docs/architecture.md)
- [Threat Model](./docs/threat-model.md)

## License

MIT (see [LICENSE](./LICENSE)).
