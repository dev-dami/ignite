# Ignite Walkthrough

A complete guide to running code securely with Ignite - from AI agent sandboxing to isolated microservices.

## Table of Contents

1. [Understanding Ignite](#understanding-ignite)
2. [Building a Data Processing Service](#building-a-data-processing-service)
3. [Configuration Deep Dive](#configuration-deep-dive)
4. [Working with Runtimes](#working-with-runtimes)
5. [Preflight Safety Analysis](#preflight-safety-analysis)
6. [HTTP API Server](#http-api-server)
7. [Production Deployment](#production-deployment)

---

## Understanding Ignite

Ignite runs your code in isolated Docker containers. This provides:

- **Isolation** - Each execution is sandboxed
- **Reproducibility** - Same environment every time
- **Safety** - Preflight checks catch issues before execution
- **Portability** - Works anywhere Docker runs

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Ignite CLI                            │
├─────────────────────────────────────────────────────────────┤
│  Service Loader  │  Preflight Engine  │  Execution Engine   │
├─────────────────────────────────────────────────────────────┤
│                      Docker Runtime                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Bun 1.3     │  │  Node 20     │  │  Custom      │       │
│  │  Runtime     │  │  Runtime     │  │  Runtime     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Building a Data Processing Service

Let's build a real service that processes JSON data and returns results.

### Step 1: Initialize the Service

```bash
ignite init data-processor
cd data-processor
```

### Step 2: Write the Code

Edit `index.ts`:

```typescript
// index.ts - Data processing service

interface Input {
  data: number[];
  operation: 'sum' | 'average' | 'max' | 'min';
}

interface Output {
  result: number;
  operation: string;
  count: number;
  timestamp: string;
}

// Parse input from environment
const input: Input = JSON.parse(
  process.env.IGNITE_INPUT || '{"data": [], "operation": "sum"}'
);

// Process data
function processData(data: number[], operation: string): number {
  if (data.length === 0) return 0;
  
  switch (operation) {
    case 'sum':
      return data.reduce((a, b) => a + b, 0);
    case 'average':
      return data.reduce((a, b) => a + b, 0) / data.length;
    case 'max':
      return Math.max(...data);
    case 'min':
      return Math.min(...data);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Execute
const result = processData(input.data, input.operation);

// Output structured response
const output: Output = {
  result,
  operation: input.operation,
  count: input.data.length,
  timestamp: new Date().toISOString()
};

console.log(JSON.stringify(output));
```

### Step 3: Configure the Service

Edit `service.yaml`:

```yaml
service:
  name: data-processor
  runtime: bun
  entry: index.ts
  memoryMb: 64
  timeoutMs: 5000
```

### Step 4: Run It

```bash
# Sum operation
ignite run . --input '{"data": [1, 2, 3, 4, 5], "operation": "sum"}'
# Output: {"result":15,"operation":"sum","count":5,"timestamp":"..."}

# Average operation
ignite run . --input '{"data": [10, 20, 30], "operation": "average"}'
# Output: {"result":20,"operation":"average","count":3,"timestamp":"..."}
```

---

## Configuration Deep Dive

### service.yaml Structure

```yaml
service:
  # Required
  name: my-service           # Service identifier
  runtime: bun               # bun, node, deno, quickjs (optional version with @)
  entry: index.ts            # Entry file
  
  # Resource Limits
  memoryMb: 128              # Memory limit in MB (default: 128)
  timeoutMs: 30000           # Timeout in ms (default: 30000)
  
  # Environment
  env:
    API_KEY: "${API_KEY}"    # From environment
    DEBUG: "true"            # Static value
  
  # Dependencies (optional, auto-detected)
  dependencies:
    - lodash
    - axios
```

### Environment Variables

Ignite passes input via `IGNITE_INPUT` environment variable:

```typescript
const input = JSON.parse(process.env.IGNITE_INPUT || '{}');
```

Your custom environment variables are also available:

```typescript
const apiKey = process.env.API_KEY;
```

---

## Working with Runtimes

### Bun Runtime (Default)

Best for:
- TypeScript projects
- Fast cold starts
- Modern ESM modules

```yaml
service:
  runtime: bun
  entry: index.ts
```

### Runtime

Ignite supports Bun, Node, Deno, and QuickJS runtimes. Bun is the default and recommended option.

**Security considerations:**
- Additional runtimes increase the attack surface and dependency complexity.
- Use non-Bun runtimes only when required by your code or dependencies.
- Audit dependencies and keep runtime versions pinned (e.g., `node@20`, `deno@2.0`) to reduce drift.

### Using Dependencies

Add dependencies to `package.json`:

```json
{
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.6.0"
  }
}
```

Then use them:

```typescript
import _ from 'lodash';
import axios from 'axios';

const data = [1, 2, 3, 4, 5];
console.log(_.sum(data));
```

---

## Preflight Safety Analysis

Preflight checks run automatically before execution. You can also run them manually:

```bash
ignite preflight .
```

### What Gets Checked

| Check | Description | Severity |
|-------|-------------|----------|
| Memory | Memory vs dependency requirements | Warning/Error |
| Timeout | Reasonable timeout configuration | Warning |
| Image Size | Docker image size estimation | Info |
| Dependencies | Dependency count and security | Warning |

### Example Output

```
[preflight] Analyzing service: data-processor

✓ Memory Check
  Allocated: 64MB
  Estimated: 32MB
  Status: OK

✓ Timeout Check
  Configured: 5000ms
  Status: OK

✓ Image Size Check
  Base: 100MB
  Total: ~105MB
  Status: OK

✓ Dependency Check
  Count: 0
  Status: OK

[preflight] All checks passed
```

### Skipping Preflight

For faster iteration during development:

```bash
ignite run . --skip-preflight
```

> **Warning**: Only skip in development. Always run preflight in production.

---

## HTTP API Server

Serve multiple services via HTTP:

```bash
ignite serve --services ./services --port 3000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/services` | List all services |
| GET | `/services/:name` | Get service info |
| GET | `/services/:name/preflight` | Run preflight |
| POST | `/services/:name/execute` | Execute service |

### Executing via HTTP

```bash
curl -X POST http://localhost:3000/services/data-processor/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"data": [1,2,3], "operation": "sum"}}'
```

Response:

```json
{
  "success": true,
  "output": "{\"result\":6,\"operation\":\"sum\",\"count\":3,\"timestamp\":\"...\"}",
  "metrics": {
    "executionTimeMs": 1234,
    "memoryUsedMb": 32
  }
}
```

---

## Production Deployment

### Option 1: Binary Installation

Download the pre-built binary for your platform:

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/master/install.sh | bash
```

### Option 2: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  ignite:
    image: ghcr.io/dev-dami/ignite:latest
    command: serve --services /services --port 3000
    ports:
      - "3000:3000"
    volumes:
      - ./services:/services
      - /var/run/docker.sock:/var/run/docker.sock
```

### Option 3: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ignite
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ignite
  template:
    metadata:
      labels:
        app: ignite
    spec:
      containers:
      - name: ignite
        image: ghcr.io/dev-dami/ignite:latest
        command: ["ignite", "serve", "--port", "3000"]
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
```

### Best Practices

1. **Always run preflight in production** - Don't skip safety checks
2. **Set appropriate resource limits** - Memory and timeout
3. **Monitor execution metrics** - Track execution time and memory
4. **Use environment variables for secrets** - Never hardcode
5. **Keep services small and focused** - Single responsibility

---

## Next Steps

- **[API Reference](./api.md)** - Complete CLI and HTTP API documentation
- **[Architecture](./architecture.md)** - Deep dive into system design
- **[Preflight](./preflight.md)** - Detailed preflight analysis docs
