# API Reference

Authoritative reference for Ignite CLI and HTTP endpoints.

## CLI

### `ignite init <name>`

Initialize a new service scaffold.

```bash
ignite init <name> [options]
```

Options:

- `-p, --path <path>`: custom output path (defaults to name)
- `-r, --runtime <runtime>`: runtime spec (default `bun`)

### `ignite run <service>`

Execute a service inside a virtualized microVM sandbox.

```bash
ignite run <service> [options]
```

Options:

- `-i, --input <json>`: JSON-serialized payload sent to guest runtime.
- `-r, --runtime <runtime>`: runtime spec override.
- `--skip-preflight`: run preflight checks but do not block execution on failure.
- `--json`: output execution report in JSON format.
- `--verbose`: show sub-millisecond timings of all microVM lifecycle phases.
- `--memory <mb>`: override RAM allocation limit (in MB) assigned to the VM.
- `--cpus <cores>`: override CPU cores assigned to the VM.
- `--kernel <path>`: path to custom guest vmlinux kernel.
- `--rootfs <path>`: path to custom guest rootfs disk.
- `--runtimes-root <path>`: path to custom host language runtimes folder.
- `--vsock-port <port>`: custom host-guest VSOCK communication port.
- `--console-out <path>`: file path to log guest serial console outputs.

### `ignite preflight <service>`

Run preflight validators without execution.

```bash
ignite preflight <service>
```

Exit behavior:

- exits with code `0` on `pass`/`warn` statuses, and code `1` on `fail`.

### `ignite serve`

Start HTTP REST API server.

```bash
ignite serve [options]
```

Options:

- `-p, --port <port>`: API port (default `3000`)
- `-h, --host <host>`: host IP to bind (default `localhost`)
- `-s, --services <path>`: path to services root folder (default `./services`)

---

## HTTP REST API

### `GET /health`

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 0
}
```

### `GET /services`

List service folders under the configured services path root.

Response:

```json
{
  "services": ["hello-world", "data-processor"]
}
```

### `POST /services/:serviceName/execute`

Execute service inside microVM sandbox.

Request body:

```json
{
  "input": { "data": [1, 2, 3] },
  "skipPreflight": false,
  "audit": false
}
```

Response:

```json
{
  "success": true,
  "serviceName": "data-processor",
  "metrics": {
    "executionTimeMs": 85,
    "memoryUsageMb": 34.2,
    "coldStart": true,
    "coldStartTimeMs": 14,
    "exitCode": 0,
    "stdout": "...",
    "stderr": "..."
  },
  "preflight": {
    "serviceName": "data-processor",
    "timestamp": "2026-06-27T17:33:00.000Z",
    "checks": [
      {
        "name": "dependency-count",
        "status": "pass",
        "message": "Low dependency count (0)",
        "value": 0,
        "threshold": 50
      }
    ],
    "overallStatus": "pass"
  }
}
```

Error response:

```json
{
  "success": false,
  "serviceName": "data-processor",
  "error": "Detailed error message"
}
```
