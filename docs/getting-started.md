# Getting Started with Ignite

Get your first microservice running in under 5 minutes.

## Prerequisites

- **Docker** - [Install Docker](https://docs.docker.com/get-docker/)
- That's it. Ignite is a single binary.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/main/install.sh | bash
```

Verify installation:

```bash
ignite --version
```

## Create Your First Service

```bash
ignite init hello-world
cd hello-world
```

This creates:

```
hello-world/
├── index.ts          # Your code
├── service.yaml      # Configuration
└── package.json      # Dependencies
```

## Run It

```bash
ignite run .
```

You should see output like:

```
[ignite] Loading service: hello-world
[ignite] Building Docker image...
[ignite] Running preflight checks...
[ignite] Executing...
Hello, World!
[ignite] Completed in 1.2s
```

## Pass Input Data

```bash
ignite run . --input '{"name": "Developer"}'
```

Output:

```
Hello, Developer!
```

## Check Safety Before Running

```bash
ignite preflight .
```

This analyzes:
- Memory allocation vs dependencies
- Timeout configuration
- Docker image size
- Dependency security

## What Just Happened?

1. **Ignite loaded** your `service.yaml` configuration
2. **Built a Docker image** with your code and dependencies
3. **Ran preflight checks** to ensure safe execution
4. **Executed your code** in an isolated container
5. **Returned the output** and cleaned up

## Next Steps

- **[Full Walkthrough](./walkthrough.md)** - Build a real-world service
- **[API Reference](./api.md)** - Complete CLI and HTTP API docs
- **[Architecture](./architecture.md)** - How Ignite works under the hood

## Common Issues

### Docker not running

```
Error: Cannot connect to Docker daemon
```

**Fix**: Start Docker Desktop or the Docker service.

### Permission denied

```
Error: Permission denied while trying to connect to Docker
```

**Fix**: Add your user to the docker group:

```bash
sudo usermod -aG docker $USER
# Then log out and back in
```

### Port already in use

```
Error: Port 3000 is already in use
```

**Fix**: Use a different port:

```bash
ignite serve --port 3001
```
