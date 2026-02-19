<p align="center">
  <img src="./assets/logo.png" alt="Ignite" width="120" />
</p>

<h1 align="center">Ignite</h1>

<p align="center">
  <strong>Secure sandbox execution for AI-generated code, untrusted scripts, and JS/TS services.</strong>
</p>

<p align="center">
  <a href="https://github.com/dev-dami/ignite/releases"><img src="https://img.shields.io/github/v/release/dev-dami/ignite?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/dev-dami/ignite/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/dev-dami/ignite/actions"><img src="https://img.shields.io/github/actions/workflow/status/dev-dami/ignite/ci.yml?style=flat-square" alt="Build"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.3+-f472b6?style=flat-square&logo=bun" alt="Bun"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-required-2496ED?style=flat-square&logo=docker" alt="Docker"></a>
</p>

## Overview

Ignite runs JavaScript/TypeScript code inside isolated Docker containers with optional hardened audit mode. It is designed for systems that execute code you do not fully trust:

- AI agent generated code
- plugin or extension ecosystems
- user submissions and sandboxed automation
- security-sensitive CI checks

## Why Ignite

- Container isolation with resource limits (`memoryMb`, `cpuLimit`, `timeoutMs`)
- Preflight checks before execution (memory, dependency load, timeout, image size)
- Security audit mode (`--audit`) with network blocking and read-only root filesystem
- Runtime registry with versioned runtime selection (`bun@1.3`, `node@20`, `deno@2.0`, `quickjs@latest`)
- CLI and HTTP server interfaces

## Quick Start

### 1) Install

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/master/install.sh | bash
ignite --version
```

### 2) Initialize a service

```bash
ignite init hello-world
cd hello-world
```

### 3) Run it

```bash
ignite run .
```

### 4) Run in hardened audit mode

```bash
ignite run . --audit
```

## CLI At A Glance

| Command | Purpose |
|---|---|
| `ignite init <name>` | Generate a new service scaffold |
| `ignite run <path>` | Build + execute service in Docker |
| `ignite preflight <path>` | Run safety checks only |
| `ignite report <path>` | Generate preflight report |
| `ignite lock <path>` | Create/update `ignite.lock` manifest |
| `ignite env [path]` | Show environment/runtime information |
| `ignite serve` | Start HTTP API server |

## Runtime Support

| Runtime | Supported versions | Default |
|---|---|---|
| Bun | `1.0`, `1.1`, `1.2`, `1.3` | `1.3` |
| Node | `18`, `20`, `22` | `20` |
| Deno | `1.40`, `1.41`, `1.42`, `2.0` | `2.0` |
| QuickJS | `2024-01-13`, `2023-12-09`, `latest` | `latest` |

Ignite accepts version-qualified runtime values and validates compatibility. Examples: `bun@1.3`, `node@20.12.0`.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Walkthrough](./docs/walkthrough.md)
- [API Reference](./docs/api.md)
- [Architecture](./docs/architecture.md)
- [Preflight Checks](./docs/preflight.md)
- [Threat Model](./docs/threat-model.md)
- [Research Notes](./docs/research.md)
- [Interactive Docs Website](./docs/site/index.html)

## Build From Source

```bash
git clone https://github.com/dev-dami/ignite.git
cd ignite
bun install
bun run build
```

To build release binaries and checksums:

```bash
bun run scripts/build-binaries.ts
```

Artifacts are written to `dist/`:

- `ignite-<platform>.tar.gz`
- `SHA256SUMS`

## Verify Release Artifacts

```bash
cd dist
sha256sum -c SHA256SUMS
```

## Security Notes

`--audit` is the recommended mode for untrusted code. In this mode Ignite applies restrictive Docker flags and emits a security audit report. See [Threat Model](./docs/threat-model.md) for boundaries, assumptions, and non-goals.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, test workflow, and release process.

## License

MIT (see [LICENSE](./LICENSE)).
