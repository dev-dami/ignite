# Architecture

Ignite is a Rust cargo workspace for secure, hardware-virtualized execution of JS/TS services inside microVMs.

## Cargo Workspace Packages

```text
ignite/
├── Cargo.toml
├── ignite-shared/          # Shared type models (ServiceConfig, metrics), error maps, and validators
├── ignite-core/            # Hypervisor engine selector, disk formatter, and platform hypervisors
├── ignite-cli/             # Clap-based command line interface binary
├── ignite-http/            # Axum-based HTTP REST API server
└── ignite-guest-agent/     # Static guest agent init system (target: x86_64-unknown-linux-musl)
```

## Storage Device Mapping

To minimize vulnerabilities in the guest VM, the root filesystem is built without a shell, libraries, or network utilities. The host maps the VM's storage dynamically:

```text
                ┌──────────────────────┐
                │      Guest VM        │
                │                      │
/dev/vda ──────>│ / (Rootfs)           │  <- Static guest agent init binary only
                │                      │
/dev/vdb ──────>│ /app (Service)       │  <- Service code, files, package.json (Read-Only)
                │                      │
/dev/vdc ──────>│ /runtime (Engine)    │  <- Language runtime executable e.g. bun (Read-Only)
                └──────────────────────┘
```

1. **`/dev/vda` (Root filesystem)**: Contains only the statically compiled `/sbin/init` (the `ignite-guest-agent` binary).
2. **`/dev/vdb` (Service filesystem)**: Holds service source code files, formatted dynamically on-the-fly by the host using `mke2fs` without loopback privileges. Mounted read-only at `/app`.
3. **`/dev/vdc` (Runtime engine)**: Holds the selected language runtime (Node, Deno, Bun, or QuickJS) from the host's runtime library folder. Mounted read-only at `/runtime`.

## Lifecycle Execution Flow

```text
ignite-cli/ignite-http
  -> Loads service.yaml
  -> Runs preflight checks (dependency counts, RAM allocations)
  -> Calls mke2fs to format service.ext4 and runtime.ext4 in user-space
  -> Binds host VSOCK listener on Unix Socket (/tmp/ignite-vsock-VMID_1052)
  -> Spawns hypervisor process (Firecracker or Apple VZ)
  -> Hypervisor loads kernel (vmlinux), boots guest VM
  -> Guest Agent (init) mounts /dev/vdb to /app and /dev/vdc to /runtime
  -> Guest Agent connects back to host over VSOCK channel (port 1052)
  -> Host transmits JSON payload (environment, execution script)
  -> Guest Agent executes runtime command inside microVM sandbox
  -> Guest Agent streams stdout/stderr multiplexed frames over VSOCK
  -> Guest Agent captures exit code and triggers reboot(POWER_OFF)
  -> Host tears down hypervisor and deletes temporary UDS socket files
```

## VSOCK Multiplexed Communication

The guest-host communication uses virtual sockets (VSOCK). It sends length-prefixed multiplexed frames:

* **Header (5 bytes)**: `[1-byte stream type] [4-byte big-endian payload length]`
  * `type = 1`: stdout
  * `type = 2`: stderr
  * `type = 3`: exit code (captured from runtime child execution)
* **Body**: Raw UTF-8 bytes payload.

This eliminates guest networking interfaces entirely, reducing the attack surface.
