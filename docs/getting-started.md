# Getting Started

This guide gets you from zero to first secure execution in under five minutes.

## Prerequisites

- Docker installed and running
- Ignite installed (single binary)

Install Docker: <https://docs.docker.com/get-docker/>

## Install Ignite

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/master/install.sh | bash
ignite --version
```

## Create a Service

```bash
ignite init hello-world
cd hello-world
```

Generated files:

```text
hello-world/
├── service.yaml
├── package.json
└── index.ts
```

`ignite init` refuses to overwrite existing generated files.

## Execute

```bash
ignite run .
```

## Pass Input

```bash
ignite run . --input '{"name":"Developer"}'
```

Input is available via `process.env.IGNITE_INPUT`.

## Run in Hardened Audit Mode

```bash
ignite run . --audit
```

Audit mode applies restrictive sandbox flags and prints a security audit summary.

## Preflight Checks

```bash
ignite preflight .
```

Preflight validates memory, dependencies, timeout, and (when image exists) image size.

## Serve Over HTTP

```bash
ignite serve --services . --port 3000
```

Then call:

```bash
curl -X POST http://localhost:3000/services/hello-world/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"name":"Developer"}}'
```

## Troubleshooting

### Docker daemon not reachable

Start Docker Desktop or the Docker service and retry.

### Docker permission denied (Linux)

```bash
sudo usermod -aG docker $USER
# sign out and sign in again
```

## Next Steps

- [Walkthrough](./walkthrough.md)
- [API Reference](./api.md)
- [Threat Model](./threat-model.md)
