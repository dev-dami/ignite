# Ignite

Run JavaScript/TypeScript microservices in isolated Docker containers with preflight safety checks.

## Install

### Mac & Linux (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/main/install.sh | bash
```

Or with a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/main/install.sh | bash -s v0.1.0
```

### Manual Download

Download the binary for your platform from [Releases](https://github.com/dev-dami/ignite/releases):

| Platform | Download |
|----------|----------|
| Linux x64 | `ignite-linux-x64.tar.gz` |
| Linux ARM64 | `ignite-linux-arm64.tar.gz` |
| macOS x64 | `ignite-darwin-x64.tar.gz` |
| macOS ARM64 (M1/M2) | `ignite-darwin-arm64.tar.gz` |

Extract and move to your PATH:

```bash
tar -xzf ignite-*.tar.gz
sudo mv ignite-* /usr/local/bin/ignite
chmod +x /usr/local/bin/ignite
```

### Build from Source

Requires [Bun](https://bun.sh) 1.3+ and Docker.

```bash
git clone https://github.com/dev-dami/ignite.git
cd ignite
bun install
bun run build
bun run scripts/build-binaries.ts
```

Binaries will be in `./bin/`.

## Quick Start

```bash
# Create a new service
ignite init hello-world
cd hello-world

# Run it
ignite run .
```

That's it. Your code runs in an isolated Docker container.

## Usage

### Create a Service

```bash
ignite init my-service              # TypeScript (Bun runtime)
ignite init my-service --runtime node   # JavaScript (Node.js runtime)
```

This creates:

```
my-service/
├── index.ts          # Your code
├── service.yaml      # Configuration
└── package.json
```

### Configure Your Service

Edit `service.yaml`:

```yaml
service:
  name: my-service
  runtime: bun          # or "node"
  entry: index.ts       # entry file
  memoryMb: 128         # memory limit
  timeoutMs: 5000       # execution timeout
  env:
    API_KEY: "xxx"      # environment variables
```

### Run Your Service

```bash
ignite run ./my-service

# With input data
ignite run ./my-service --input '{"name": "World"}'

# Skip safety checks (faster, less safe)
ignite run ./my-service --skip-preflight
```

### Check Before Running

```bash
ignite preflight ./my-service
```

This checks:
- Memory allocation vs dependencies
- Timeout configuration
- Docker image size
- Dependency count

### Start HTTP Server

```bash
ignite serve --services ./my-services --port 3000
```

Then call your services via HTTP:

```bash
# List services
curl http://localhost:3000/services

# Execute a service
curl -X POST http://localhost:3000/services/my-service/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"name": "World"}}'
```

## Commands

| Command | Description |
|---------|-------------|
| `ignite init <name>` | Create a new service |
| `ignite run <path>` | Execute a service |
| `ignite preflight <path>` | Run safety checks |
| `ignite serve` | Start HTTP API server |
| `ignite report <path>` | Generate execution report |

## Runtimes

| Runtime | Base Image | TypeScript | Best For |
|---------|------------|------------|----------|
| `bun` | `oven/bun:1.3-alpine` | Native | Fast execution, TS projects |
| `node` | `node:20-alpine` | Requires build | Compatibility, npm ecosystem |

## Requirements

- **Docker** - Services run in containers
- That's it. The CLI is a single binary.

## How It Works

1. You write a function in `index.ts` (or `index.js`)
2. Ignite builds a Docker image with your code
3. Runs preflight checks (memory, timeout, dependencies)
4. Executes your code in an isolated container
5. Returns the output and metrics

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Your Code   │ ──► │   Ignite     │ ──► │   Docker     │
│  index.ts    │     │  Preflight   │     │  Container   │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Example Service

```typescript
// index.ts
interface Input {
  name: string;
}

const input: Input = process.env.IGNITE_INPUT 
  ? JSON.parse(process.env.IGNITE_INPUT) 
  : { name: "World" };

console.log(`Hello, ${input.name}!`);

// Output JSON for structured responses
console.log(JSON.stringify({ 
  message: `Hello, ${input.name}!`,
  timestamp: new Date().toISOString()
}));
```

Run it:

```bash
ignite run . --input '{"name": "Ignite"}'
# Output: Hello, Ignite!
```

## Development

```bash
# Install dependencies
bun install

# Build packages
bun run build

# Run tests
bun run test          # All tests (requires Docker)
bun run test:unit     # Unit tests only

# Build release binaries
bun run scripts/build-binaries.ts
```

## License

MIT
