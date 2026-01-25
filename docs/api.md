# API Reference

Complete reference for Ignite CLI commands and HTTP API endpoints.

## Table of Contents

- [CLI Commands](#cli-commands)
  - [ignite init](#ignite-init)
  - [ignite run](#ignite-run)
  - [ignite preflight](#ignite-preflight)
  - [ignite serve](#ignite-serve)
  - [ignite report](#ignite-report)
  - [ignite lock](#ignite-lock)
  - [ignite env](#ignite-env)
- [HTTP API](#http-api)
  - [Health Check](#get-health)
  - [List Services](#get-services)
  - [Get Service](#get-servicesname)
  - [Run Preflight](#get-servicesnamepreflight)
  - [Execute Service](#post-servicesnameexecute)
- [Configuration](#configuration)
  - [service.yaml](#serviceyaml-schema)

---

## CLI Commands

### ignite init

Create a new service from template.

```bash
ignite init <name> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Service name (creates directory) |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--runtime <runtime>` | `bun` | Runtime: `bun`, `node`, `deno`, `quickjs` (with optional version: `bun@1.2`) |
| `--path <path>` | `./<name>` | Custom path for the service directory |

**Examples:**

```bash
# Create Bun service (default)
ignite init my-service

# Create Node.js service
ignite init my-service --runtime node

# Create with specific version
ignite init my-service --runtime node@20

# Create Deno service
ignite init my-service --runtime deno

# Create QuickJS service (fast cold start)
ignite init my-service --runtime quickjs
```

**Generated Files:**

```
my-service/
├── index.ts          # Entry point
├── service.yaml      # Configuration
└── package.json      # Dependencies
```

---

### ignite run

Execute a service in Docker.

```bash
ignite run <path> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `path` | Path to service directory |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--input <json>` | `{}` | Input data as JSON string |
| `--runtime <runtime>` | (from service.yaml) | Override runtime (e.g., `node@20`, `bun@1.2`) |
| `--skip-preflight` | `false` | Skip safety checks |
| `--json` | `false` | Output results as JSON |
| `--audit` | `false` | Run with security audit (blocks network, read-only filesystem) |

**Examples:**

```bash
# Basic execution
ignite run ./my-service

# With input data
ignite run ./my-service --input '{"name": "World"}'

# Override runtime version
ignite run ./my-service --runtime node@22

# Skip preflight (development only)
ignite run ./my-service --skip-preflight

# Security audit mode (for AI agent sandboxing)
ignite run ./my-service --audit
```

**Security Audit Mode (`--audit`):**

When running with `--audit`, the service runs in a hardened sandbox:

- Network completely disabled (`--network=none`)
- Read-only root filesystem (`--read-only`)
- Writable `/tmp` only (`--tmpfs /tmp`)
- All Linux capabilities dropped (`--cap-drop=ALL`)
- No privilege escalation (`--security-opt=no-new-privileges`)

The audit report shows any blocked security violations:

```
SECURITY AUDIT

Policy:
  Network: blocked
  Filesystem: read-only
  Process spawn: blocked

Events:

Network
  ✗ connect: api.openai.com (blocked)

Filesystem
  ✗ write: /app/malicious.txt (blocked)

──────────────────────────────────────────────────
✗ Security Status: 2 VIOLATION(S) BLOCKED
```

**Output:**

```
[ignite] Loading service: my-service
[ignite] Building Docker image...
[ignite] Running preflight checks...
[ignite] Executing...
Hello, World!
[ignite] Completed in 1.2s
```

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Execution error |
| 2 | Preflight failed |
| 3 | Configuration error |

---

### ignite preflight

Run safety analysis without executing.

```bash
ignite preflight <path> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `path` | Path to service directory |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text` or `json` |

**Examples:**

```bash
# Text output
ignite preflight ./my-service

# JSON output
ignite preflight ./my-service --format json
```

**Checks Performed:**

| Check | Description |
|-------|-------------|
| Memory | Memory allocation vs requirements |
| Timeout | Timeout configuration |
| Image Size | Docker image size estimation |
| Dependencies | Dependency count and analysis |

---

### ignite serve

Start HTTP API server.

```bash
ignite serve [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--port <port>` | `3000` | Server port |
| `--host <host>` | `0.0.0.0` | Server host |
| `--services <path>` | `.` | Path to services directory |

**Examples:**

```bash
# Default settings
ignite serve

# Custom port and services path
ignite serve --port 8080 --services ./services

# Bind to localhost only
ignite serve --host 127.0.0.1
```

**Output:**

```
[ignite] Starting HTTP server...
[ignite] Services directory: ./services
[ignite] Listening on http://0.0.0.0:3000
```

---

### ignite report

Generate execution report for a service.

```bash
ignite report <path> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `path` | Path to service directory |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text` or `json` |
| `--output <file>` | `stdout` | Output file path |

**Examples:**

```bash
# Console output
ignite report ./my-service

# JSON to file
ignite report ./my-service --format json --output report.json
```

---

### ignite lock

Create or update environment manifest (`ignite.lock`) for reproducible builds.

```bash
ignite lock <path> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `path` | Path to service directory |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--update` | `false` | Update existing manifest |
| `--check` | `false` | Check for drift without modifying |

**Examples:**

```bash
# Create ignite.lock
ignite lock ./my-service

# Update existing manifest
ignite lock ./my-service --update

# Check for environment drift (CI/CD)
ignite lock ./my-service --check
```

**Generated File (`ignite.lock`):**

```yaml
version: "1.0"
runtime:
  name: bun
  version: "1.3"
lockfile: bun.lockb
checksums:
  package.json: sha256:abc123...
  bun.lockb: sha256:def456...
createdAt: "2024-01-15T10:30:00.000Z"
```

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success / No drift detected |
| 1 | Drift detected (with `--check`) |

---

### ignite env

Display environment information and available runtimes.

```bash
ignite env [path] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `path` | Path to service directory (optional) |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--runtimes` | `false` | List all supported runtimes |

**Examples:**

```bash
# Show service environment info
ignite env ./my-service

# List all available runtimes
ignite env --runtimes
```

**Output (service info):**

```
Service: my-service
Runtime: bun@1.3

Environment: Locked
  Runtime: bun@1.3
  Locked at: 2024-01-15T10:30:00.000Z
  Lockfile: bun.lockb

✓ Environment matches manifest
```

**Output (runtimes list):**

```
Supported Runtimes:

  bun
    Default entry: index.ts
    Extensions: .ts, .js, .tsx, .jsx
    Versions: 1.0, 1.1, 1.2, 1.3 (default: 1.3)

  node
    Default entry: index.js
    Extensions: .js, .mjs, .cjs
    Versions: 18, 20, 22 (default: 20)

  deno
    Default entry: index.ts
    Extensions: .ts, .js, .tsx, .jsx
    Versions: 1.40, 1.41, 1.42, 2.0 (default: 2.0)

  quickjs
    Default entry: index.js
    Extensions: .js
    Versions: latest (default: latest)

Usage examples:
  service.yaml: runtime: bun
  service.yaml: runtime: bun@1.2
  service.yaml: runtime: node@20
  ignite run . --runtime node@22
```

---

## HTTP API

Base URL: `http://localhost:3000` (default)

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### GET /services

List all available services.

**Response:**

```json
{
  "services": [
    {
      "name": "data-processor",
      "runtime": "bun",
      "entry": "index.ts"
    },
    {
      "name": "image-resizer",
      "runtime": "node",
      "entry": "index.js"
    }
  ]
}
```

---

### GET /services/:name

Get service details.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Service name |

**Response:**

```json
{
  "name": "data-processor",
  "runtime": "bun",
  "entry": "index.ts",
  "memoryMb": 128,
  "timeoutMs": 30000,
  "env": {
    "DEBUG": "true"
  }
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 404 | Service not found |

---

### GET /services/:name/preflight

Run preflight checks for a service.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Service name |

**Response:**

```json
{
  "success": true,
  "checks": [
    {
      "name": "memory",
      "status": "passed",
      "details": {
        "allocated": 128,
        "estimated": 64
      }
    },
    {
      "name": "timeout",
      "status": "passed",
      "details": {
        "configured": 30000
      }
    },
    {
      "name": "imageSize",
      "status": "passed",
      "details": {
        "estimatedMb": 105
      }
    },
    {
      "name": "dependencies",
      "status": "passed",
      "details": {
        "count": 2
      }
    }
  ]
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 404 | Service not found |
| 422 | Preflight failed |

---

### POST /services/:name/execute

Execute a service.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Service name |

**Request Body:**

```json
{
  "input": {
    "data": [1, 2, 3],
    "operation": "sum"
  },
  "skipPreflight": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | object | No | Input data passed to service |
| `skipPreflight` | boolean | No | Skip safety checks |

**Response:**

```json
{
  "success": true,
  "output": "{\"result\":6}",
  "metrics": {
    "executionTimeMs": 1234,
    "memoryUsedMb": 32,
    "exitCode": 0
  }
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 404 | Service not found |
| 422 | Preflight failed |
| 500 | Execution error |

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "EXECUTION_TIMEOUT",
    "message": "Service execution timed out after 30000ms"
  }
}
```

---

## Configuration

### service.yaml Schema

```yaml
service:
  # Required fields
  name: string           # Service identifier (alphanumeric, hyphens)
  runtime: string        # Runtime with optional version (see below)
  entry: string          # Entry file path

  # Optional fields
  memoryMb: number       # Memory limit (default: 128)
  cpuLimit: number       # CPU limit in cores (default: 1)
  timeoutMs: number      # Timeout (default: 30000)
  env: object            # Environment variables
  dependencies: array    # Explicit dependencies (auto-detected by default)
```

**Supported Runtimes:**

| Runtime | Versions | Default Entry | Notes |
|---------|----------|---------------|-------|
| `bun` | 1.0, 1.1, 1.2, 1.3 | index.ts | TypeScript native, fastest |
| `node` | 18, 20, 22 | index.js | Node.js compatibility |
| `deno` | 1.40, 1.41, 1.42, 2.0 | index.ts | Secure by default |
| `quickjs` | latest | index.js | Ultra-fast cold start (~10ms) |

**Runtime Version Syntax:**

```yaml
# Use default version
runtime: bun

# Specify version
runtime: bun@1.2
runtime: node@20
runtime: deno@2.0
```

**Full Example:**

```yaml
service:
  name: my-service
  runtime: bun@1.3
  entry: index.ts
  memoryMb: 256
  cpuLimit: 0.5
  timeoutMs: 60000
  env:
    NODE_ENV: production
    API_KEY: "${API_KEY}"
    DEBUG: "false"
  dependencies:
    - lodash
    - axios
```

### Environment Variable Substitution

Use `${VAR_NAME}` syntax to inject environment variables:

```yaml
env:
  API_KEY: "${API_KEY}"        # From host environment
  DB_URL: "${DATABASE_URL}"    # From host environment
  DEBUG: "true"                # Static value
```

### ignite.policy.yaml (Security Policy)

Create an `ignite.policy.yaml` file to customize security settings:

```yaml
security:
  network:
    enabled: false              # Block all network (default)
    allowedHosts:               # Optional: allow specific hosts
      - api.example.com
    allowedPorts:               # Optional: allow specific ports
      - 443

  filesystem:
    readOnly: true              # Read-only root filesystem
    allowedWritePaths:          # Paths that can be written to
      - /tmp
    blockedReadPaths:           # Paths blocked from reading
      - /etc/passwd
      - /etc/shadow
      - /proc
      - /sys

  process:
    allowSpawn: false           # Block spawning child processes
    allowedCommands: []         # Optional: allow specific commands
```

The policy file is automatically loaded when using `--audit` mode.

### Memory Guidelines

| Use Case | Recommended Memory |
|----------|-------------------|
| Simple data processing | 64 MB |
| API calls, JSON parsing | 128 MB |
| File processing | 256 MB |
| Image processing | 512 MB |
| Heavy computation | 1024 MB |

### Timeout Guidelines

| Use Case | Recommended Timeout |
|----------|---------------------|
| Quick calculations | 5000 ms |
| API calls | 30000 ms |
| File processing | 60000 ms |
| Heavy computation | 300000 ms |
