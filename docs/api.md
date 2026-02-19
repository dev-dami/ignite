# API Reference

Authoritative reference for Ignite CLI and HTTP endpoints.

## CLI

### `ignite init <name>`

Initialize a new service scaffold.

```bash
ignite init <name> [options]
```

Options:

- `-p, --path <path>`: custom output path
- `-r, --runtime <runtime>`: runtime spec (default `bun`)

Examples:

```bash
ignite init my-service
ignite init my-service --runtime node@20
ignite init my-service --path ./services/my-service
```

Notes:

- Runtime is validated against supported runtimes/versions.
- Existing generated files are not overwritten.

### `ignite run <service>`

Execute a service in Docker.

```bash
ignite run <service> [options]
```

Options:

- `-i, --input <json>`
- `-r, --runtime <runtime>`
- `--skip-preflight`
- `--json`
- `--audit`
- `--audit-output <file>`

Examples:

```bash
ignite run ./my-service
ignite run ./my-service --input '{"name":"world"}'
ignite run ./my-service --runtime node@22
ignite run ./my-service --audit --json --audit-output audit.json
```

Behavior note:

- `--skip-preflight` bypasses fail-fast blocking, but preflight still runs and is included in reporting.

### `ignite preflight <service>`

Run preflight checks without execution.

```bash
ignite preflight <service>
```

Example:

```bash
ignite preflight ./my-service
```

Exit behavior:

- exits non-zero when overall status is `fail`

### `ignite report <service>`

Generate preflight report.

```bash
ignite report <service> [options]
```

Options:

- `-o, --output <file>`
- `--json`

Examples:

```bash
ignite report ./my-service
ignite report ./my-service --json
ignite report ./my-service --json --output report.json
```

### `ignite serve`

Start HTTP server.

```bash
ignite serve [options]
```

Options:

- `-p, --port <port>` (default `3000`)
- `-h, --host <host>` (default `localhost`)
- `-s, --services <path>` (default `./services`)

Example:

```bash
ignite serve --services ./services --host 127.0.0.1 --port 3000
```

### `ignite lock <service>`

Manage `ignite.lock` environment manifest.

```bash
ignite lock <service> [options]
```

Options:

- `-u, --update`
- `-c, --check`

Examples:

```bash
ignite lock ./my-service
ignite lock ./my-service --update
ignite lock ./my-service --check
```

### `ignite env [service]`

Show environment info or list runtimes.

```bash
ignite env [service] [options]
```

Options:

- `--runtimes`

Examples:

```bash
ignite env ./my-service
ignite env --runtimes
```

## HTTP API

Base URL defaults to `http://localhost:3000`.

### `GET /health`

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 123
}
```

### `GET /services`

List service directories under configured services path.

Response:

```json
{
  "services": ["service-a", "service-b"]
}
```

### `GET /services/:serviceName/preflight`

Run preflight for a service.

Response:

```json
{
  "serviceName": "data-processor",
  "preflight": {
    "serviceName": "data-processor",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "checks": [],
    "overallStatus": "pass"
  }
}
```

### `POST /services/:serviceName/execute`

Execute service.

Request body:

```json
{
  "input": { "data": [1, 2, 3] },
  "skipPreflight": false,
  "skipBuild": false,
  "audit": true
}
```

Response:

```json
{
  "success": true,
  "serviceName": "data-processor",
  "metrics": {
    "executionTimeMs": 120,
    "memoryUsageMb": 40,
    "coldStart": true,
    "exitCode": 0,
    "stdout": "...",
    "stderr": "..."
  },
  "preflight": {
    "serviceName": "data-processor",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "checks": [],
    "overallStatus": "pass"
  },
  "securityAudit": {
    "events": [],
    "summary": {
      "networkAttempts": 0,
      "networkBlocked": 0,
      "filesystemReads": 0,
      "filesystemWrites": 0,
      "filesystemBlocked": 0,
      "processSpawns": 0,
      "processBlocked": 0,
      "overallStatus": "clean"
    },
    "policy": {
      "network": { "enabled": false },
      "filesystem": { "readOnly": true },
      "process": { "allowSpawn": false }
    }
  }
}
```

Error response shape (execute endpoint):

```json
{
  "success": false,
  "serviceName": "data-processor",
  "error": "message"
}
```

Common status codes:

- `400`: invalid service name or preflight fail in execute path
- `401`: missing/invalid bearer token when API key auth is configured
- `404`: route not found
- `429`: rate limit exceeded
- `500`: internal/service execution errors

## Configuration Schema (`service.yaml`)

```yaml
service:
  name: my-service
  runtime: bun@1.3
  entry: index.ts
  memoryMb: 128
  cpuLimit: 1
  timeoutMs: 30000
  env:
    NODE_ENV: production

preflight:
  memory:
    baseMb: 50
    perDependencyMb: 2
    warnRatio: 1
    failRatio: 0.8
  dependencies:
    warnCount: 100
    infoCount: 50
  image:
    warnMb: 500
    failMb: 1000
  timeout:
    minMs: 100
    maxMs: 30000
    coldStartBufferMs: 500
```

Security policy file names (loaded in audit mode):

- `ignite.policy.yaml`
- `ignite.policy.yml`
- `.ignite-policy.yaml`
- `.ignite-policy.yml`
