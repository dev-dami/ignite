# Architecture

Ignite is a Bun-first monorepo for secure execution of JS/TS services inside Docker.

## Packages

```text
packages/
├── cli          # command parsing and user-facing workflows
├── core         # service loading, runtime, preflight, execution, reporting
├── http         # Elysia server wrapping core execution
├── shared       # shared types, errors, logging, helpers
└── runtime-bun  # runtime Dockerfile assets
```

## Execution Pipeline

```text
service.yaml
  -> loadService()
  -> runtime resolution (runtime registry)
  -> build image (if needed)
  -> runPreflight()
  -> executeService()
  -> report + optional security audit parsing
```

## Runtime Registry

Runtime configuration is provided by built-in and optional custom runtime plugins.

Built-ins:

- `bun`
- `node`
- `deno`
- `quickjs`

Runtime specs can be version-qualified (`name@version`) and are validated against supported versions.

## Container Execution Model

Core container controls include:

- memory and CPU limits
- timeout termination handling
- controlled mounts for service directory
- environment variable injection

When audit mode is enabled, additional hardening options are applied (for example network disablement and read-only root filesystem).

## HTTP Layer

The HTTP package provides:

- health endpoint
- service listing
- preflight endpoint
- execute endpoint
- optional bearer auth
- in-memory rate limiting

HTTP routes delegate execution and validation to `@ignite/core`.

## Data Contracts

Shared types in `@ignite/shared` define:

- `ServiceConfig`
- `PreflightResult`
- `ExecutionMetrics`
- environment manifest (`ignite.lock`) types

These contracts are consumed consistently by CLI and HTTP packages.

## Security Boundaries

Ignite security posture depends on:

- host OS and kernel behavior
- Docker daemon isolation guarantees
- runtime image integrity

For full threat assumptions and non-goals, see [threat-model.md](./threat-model.md).
