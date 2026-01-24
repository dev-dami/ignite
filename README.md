<p align="center">
  <img src="https://raw.githubusercontent.com/dev-dami/ignite/main/.github/logo.svg" alt="Ignite" width="120" />
</p>

<h1 align="center">Ignite</h1>

<p align="center">
  <strong>Run JS/TS microservices in isolated Docker containers with preflight safety checks</strong>
</p>

<p align="center">
  <a href="https://github.com/dev-dami/ignite/releases"><img src="https://img.shields.io/github/v/release/dev-dami/ignite?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/dev-dami/ignite/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/dev-dami/ignite/actions"><img src="https://img.shields.io/github/actions/workflow/status/dev-dami/ignite/ci.yml?style=flat-square" alt="Build"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.3+-f472b6?style=flat-square&logo=bun" alt="Bun"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-required-2496ED?style=flat-square&logo=docker" alt="Docker"></a>
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="./docs/getting-started.md">Getting Started</a> •
  <a href="./docs/walkthrough.md">Walkthrough</a> •
  <a href="./docs/api.md">API Reference</a>
</p>

---

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Overview

Ignite is a **Bun-first execution framework** that runs your JavaScript/TypeScript code in isolated Docker containers. It provides pre-execution safety analysis to catch issues before they happen.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Your Code   │ ──► │   Ignite     │ ──► │   Docker     │
│  index.ts    │     │  Preflight   │     │  Container   │
└──────────────┘     └──────────────┘     └──────────────┘
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Stats

| Metric | Value |
|--------|-------|
| **Runtimes** | Bun, Node |
| **Base Images** | Alpine (minimal) |
| **Platforms** | Linux x64/ARM64, macOS x64/ARM64 |
| **Dependencies** | Docker only |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Install

```bash
# One-liner (Mac & Linux)
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/main/install.sh | bash

# Or download from releases
# https://github.com/dev-dami/ignite/releases
```

<details>
<summary><strong>Build from source</strong></summary>

```bash
git clone https://github.com/dev-dami/ignite.git && cd ignite
bun install && bun run build
bun run scripts/build-binaries.ts
```
</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Quick Start

```bash
# Create a service
ignite init hello-world
cd hello-world

# Run it
ignite run .
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Commands

| Command | Description |
|---------|-------------|
| `ignite init <name>` | Create new service |
| `ignite run <path>` | Execute in Docker |
| `ignite preflight <path>` | Safety checks |
| `ignite serve` | HTTP API server |
| `ignite report <path>` | Execution report |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## Documentation

| Doc | Description |
|-----|-------------|
| **[Getting Started](./docs/getting-started.md)** | 5-minute beginner guide |
| **[Walkthrough](./docs/walkthrough.md)** | Complete tutorial |
| **[API Reference](./docs/api.md)** | CLI & HTTP API docs |
| **[Architecture](./docs/architecture.md)** | System design |
| **[Preflight](./docs/preflight.md)** | Safety analysis |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow" width="100%">

## License

MIT © [dev-dami](https://github.com/dev-dami)
