# Getting Started

This guide gets you from zero to first secure microVM execution in under five minutes.

## Prerequisites

- **Linux**: KVM enabled (verify with `kvm-ok` or that `/dev/kvm` exists) and `e2fsprogs` package installed.
- **macOS**: macOS 13 or later.

## Setup & Compilation

Clone and build the release binary:

```bash
git clone https://github.com/dev-dami/ignite.git
cd ignite
cargo build --release
```

The output binary is compiled at `target/release/ignite-cli`. Copy it to your PATH:

```bash
cp target/release/ignite-cli /usr/local/bin/ignite
ignite --version
```

## Resources Configuration

By default, the CLI expects the kernel image, rootfs, and language runtimes in the folder `./resources/`:

* `resources/vmlinux`: Uncompressed Linux kernel binary.
* `resources/rootfs.ext4`: Minimal ext4 root filesystem containing the guest agent.
* `resources/runtimes/`: Directories containing versioned runtimes (e.g. `resources/runtimes/bun/bin/bun`).

These can be configured via environment variables or CLI flags (e.g., `--kernel`, `--rootfs`, `--runtimes-root`).

## Initialize a Service

Generate a new service directory:

```bash
ignite init hello-world
cd hello-world
```

This creates:
- `service.yaml`: Sandbox configurations.
- `package.json`: Legacy metadata file.
- `index.js` or `index.ts`: The entrypoint logic.

## Execute inside Sandbox

Run the service inside a microVM:

```bash
ignite run .
```

To enable verbose logs showing microsecond timings for each execution phase:

```bash
ignite run . --verbose
```

## Preflight Checks

Run validators to check memory allocations and dependencies sizes:

```bash
ignite preflight .
```

## Serve HTTP Server

Start the REST API:

```bash
ignite serve --services ./services --port 3000
```

Execute a service over REST:

```bash
curl -X POST http://localhost:3000/services/hello-world/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"message":"Hello Ignite"}}'
```
