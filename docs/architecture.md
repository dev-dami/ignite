# Ignite Architecture

## Overview

Ignite is a secure execution sandbox for JavaScript/TypeScript code. It runs code in isolated Docker containers with network blocking, filesystem restrictions, and security auditing. Designed for AI agents, untrusted code execution, and isolated microservices.

**Bun-first** runtime.

## Package Structure

```
ignite/
├── packages/
│   ├── cli/          # Command-line interface
│   ├── core/         # Framework core logic
│   ├── runtime-bun/  # Bun runtime adapter
│   └── shared/       # Shared types and utilities
└── examples/         # Example services
```

## Core Components

### Service Loader
Parses `service.yaml` configuration and validates service structure.

### Runtime Registry
Manages runtime configuration for the execution environment:
- **bun**: Bun runtime with native TypeScript support (default)
- **node**: Node.js runtime for JS compatibility
- **deno**: Deno runtime with secure defaults
- **quickjs**: QuickJS runtime for minimal overhead

### Docker Runtime
Manages Docker image building and container execution.

### Preflight Engine
Performs pre-execution checks:
- Image size analysis
- Memory allocation estimation
- Timeout configuration validation
- Dependency count assessment

### Execution Engine
Runs services in isolated containers and captures metrics.

### Report Generator
Creates structured execution reports with warnings.

## Data Flow

```
service.yaml
     │
     ▼
┌─────────────────┐
│  Service Loader │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Runtime Registry │──► Select runtime (Bun default)
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Preflight Engine├────►│    Warnings     │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Execution Engine│──► Docker (Bun)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Report Generator│
└─────────────────┘
```

## Runtime Isolation

Each service runs in its own Docker container with:
- Memory limits enforced at container level
- Timeout enforcement via process monitoring
- Volume mounting for source code (read-only)
- Environment variable injection
- Metrics emission via entrypoint wrapper

Security note: Bun is the default runtime. Supporting additional runtimes increases the attack surface, so use them only when required and keep versions pinned.

## Runtime Registry

The runtime registry (`packages/core/src/runtime/runtime-registry.ts`) provides:

```typescript
interface RuntimeConfig {
  name: RuntimeName;           // 'bun' (default), 'node', 'deno', 'quickjs'
  dockerfileDir: string;       // Directory containing Dockerfile
  defaultEntry: string;        // Default entry file
  fileExtensions: string[];    // Supported file extensions
}
```

## Adding New Runtimes

To add a new runtime in the future:

1. Create `packages/runtime-<name>/Dockerfile`
2. Add entry to runtime registry
3. Update shared types

## Metrics Collection

Each runtime's Dockerfile includes an entrypoint that:
1. Records start time
2. Executes the service entry file
3. Emits `IGNITE_INIT_TIME` and `IGNITE_MEMORY_MB` to stderr

This ensures consistent metrics across all runtimes.
