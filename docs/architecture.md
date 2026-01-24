# Ignite Architecture

## Overview

Ignite is a local execution framework for JavaScript/TypeScript microservices that runs each service in an isolated Docker container and performs pre-execution safety analysis.

**Bun-first** with Node.js support.

## Package Structure

```
ignite/
├── packages/
│   ├── cli/          # Command-line interface
│   ├── core/         # Framework core logic
│   ├── runtime-bun/  # Bun runtime adapter
│   ├── runtime-node/ # Node.js runtime adapter
│   └── shared/       # Shared types and utilities
└── examples/         # Example services
```

## Core Components

### Service Loader
Parses `service.yaml` configuration and validates service structure.

### Runtime Registry
Manages runtime configurations for different execution environments:
- **bun**: Bun runtime with native TypeScript support
- **node**: Node.js runtime for JavaScript

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
│Runtime Registry │──► Select Bun or Node.js
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Preflight Engine├────►│    Warnings     │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Execution Engine│──► Docker (Bun/Node)
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

## Runtime Registry

The runtime registry (`packages/core/src/runtime/runtime-registry.ts`) provides:

```typescript
interface RuntimeConfig {
  name: RuntimeName;           // 'bun' | 'node'
  dockerfileDir: string;       // Directory containing Dockerfile
  defaultEntry: string;        // Default entry file
  fileExtensions: string[];    // Supported file extensions
}
```

## Adding New Runtimes

To add a new runtime:

1. Create `packages/runtime-<name>/Dockerfile`
2. Add entry to runtime registry
3. Update shared types

## Metrics Collection

Each runtime's Dockerfile includes an entrypoint that:
1. Records start time
2. Executes the service entry file
3. Emits `IGNITE_INIT_TIME` and `IGNITE_MEMORY_MB` to stderr

This ensures consistent metrics across all runtimes.
