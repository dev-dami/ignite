# API Reference

Complete reference for Ignite CLI commands and HTTP API endpoints.

## Table of Contents

- [CLI Commands](#cli-commands)
  - [ignite init](#ignite-init)
  - [ignite run](#ignite-run)
  - [ignite preflight](#ignite-preflight)
  - [ignite serve](#ignite-serve)
  - [ignite report](#ignite-report)
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
| `--runtime <runtime>` | `bun` | Runtime: `bun` or `node` |
| `--template <template>` | `default` | Template to use |

**Examples:**

```bash
# Create Bun service
ignite init my-service

# Create Node.js service
ignite init my-service --runtime node
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
| `--skip-preflight` | `false` | Skip safety checks |
| `--verbose` | `false` | Verbose output |

**Examples:**

```bash
# Basic execution
ignite run ./my-service

# With input data
ignite run ./my-service --input '{"name": "World"}'

# Skip preflight (development only)
ignite run ./my-service --skip-preflight

# Verbose output
ignite run ./my-service --verbose
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
  runtime: string        # "bun" or "node"
  entry: string          # Entry file path

  # Optional fields
  memoryMb: number       # Memory limit (default: 128)
  timeoutMs: number      # Timeout (default: 30000)
  env: object            # Environment variables
  dependencies: array    # Explicit dependencies (auto-detected by default)
```

**Full Example:**

```yaml
service:
  name: my-service
  runtime: bun
  entry: index.ts
  memoryMb: 256
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
