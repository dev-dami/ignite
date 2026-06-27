use std::fs;
use std::io::{Read, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::thread;
use std::time::{Duration, Instant};

use crate::orchestrator::{MicroVmOrchestrator, VmConfig};
use ignite_shared::error::{IgniteError, Result};
use ignite_shared::types::ExecutionMetrics;

#[derive(Debug)]
pub struct FirecrackerOrchestrator {
    child_process: Option<Child>,
    config: Option<VmConfig>,
    api_socket_path: PathBuf,
}

const DEFAULT_API_SOCKET: &str = "/tmp/firecracker-api.sock";
const API_SOCKET_PREFIX: &str = "/tmp/ignite-api-";
const VSOCK_PORT_SUFFIX: &str = "_1052";
const API_READY_TIMEOUT_MS: u64 = 500;
const API_READY_POLL_MS: u64 = 5;
const GUEST_CID: u32 = 3;

impl Default for FirecrackerOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

impl FirecrackerOrchestrator {
    pub fn new() -> Self {
        FirecrackerOrchestrator {
            child_process: None,
            config: None,
            api_socket_path: PathBuf::from(DEFAULT_API_SOCKET),
        }
    }
}

fn send_put_uds(socket_path: &Path, endpoint: &str, body: &str) -> Result<()> {
    let mut stream = UnixStream::connect(socket_path)?;
    let request = format!(
        "PUT {} HTTP/1.1\r\n\
         Host: localhost\r\n\
         Connection: close\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\r\n\
         {}",
        endpoint,
        body.len(),
        body
    );
    stream.write_all(request.as_bytes())?;

    let mut response = String::new();
    // Read the server reply. Because Connection: close is set, this reads until EOF.
    let _ = stream.read_to_string(&mut response);

    if !response.contains("HTTP/1.1 2") {
        return Err(IgniteError::Runtime {
            message: format!(
                "Firecracker API (PUT {}) returned error: {}",
                endpoint, response
            ),
            source: None,
        });
    }
    Ok(())
}

impl MicroVmOrchestrator for FirecrackerOrchestrator {
    fn configure(&mut self, config: VmConfig) -> Result<()> {
        self.api_socket_path =
            PathBuf::from(format!("{}{}.sock", API_SOCKET_PREFIX, config.service_name));
        self.config = Some(config);
        Ok(())
    }

    fn boot(&mut self) -> Result<()> {
        let config = self.config.as_ref().ok_or_else(|| IgniteError::Config {
            message: "VM not configured before boot".to_string(),
            source: None,
        })?;

        // 1. Clean up any stale sockets
        let _ = fs::remove_file(&self.api_socket_path);
        let _ = fs::remove_file(&config.vsock_uds_path);

        let vsock_listener_path = format!(
            "{}{}",
            config.vsock_uds_path.to_string_lossy(),
            VSOCK_PORT_SUFFIX
        );
        let _ = fs::remove_file(&vsock_listener_path);

        // 2. Spawn firecracker process
        let child = Command::new("firecracker")
            .arg("--api-sock")
            .arg(&self.api_socket_path)
            .spawn()
            .map_err(|e| IgniteError::Runtime {
                message: format!(
                    "Failed to launch firecracker daemon. Ensure it is installed: {}",
                    e
                ),
                source: Some(Box::new(e)),
            })?;
        self.child_process = Some(child);

        // 3. Wait for UDS API to become ready (timeout 500ms)
        let start = Instant::now();
        let api_ready = loop {
            if self.api_socket_path.exists() && UnixStream::connect(&self.api_socket_path).is_ok() {
                break true;
            }
            if start.elapsed() > Duration::from_millis(API_READY_TIMEOUT_MS) {
                break false;
            }
            thread::sleep(Duration::from_millis(API_READY_POLL_MS));
        };

        if !api_ready {
            if let Some(mut child) = self.child_process.take() {
                let _ = child.kill();
            }
            return Err(IgniteError::Runtime {
                message: "Timeout waiting for Firecracker API socket to be active".to_string(),
                source: None,
            });
        }

        // 4. Configure Virtual Machine parameters
        // Machine config
        let machine_body = serde_json::json!({
            "vcpu_count": config.vcpu_count,
            "mem_size_mib": config.memory_mb,
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/machine-config", &machine_body)?;

        // Boot Source & Kernel config
        let boot_body = serde_json::json!({
            "kernel_image_path": config.kernel_path,
            "boot_args": "console=ttyS0 reboot=k panic=1 pci=off init=/usr/local/bin/ignite-guest-agent",
        }).to_string();
        send_put_uds(&self.api_socket_path, "/boot-source", &boot_body)?;

        // Storage attachment - Root FS (/dev/vda)
        let rootfs_body = serde_json::json!({
            "drive_id": "rootfs",
            "path_on_host": config.rootfs_path,
            "is_root_device": true,
            "is_read_only": true,
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/drives/rootfs", &rootfs_body)?;

        // Storage attachment - Service files (/dev/vdb)
        let service_body = serde_json::json!({
            "drive_id": "service",
            "path_on_host": config.service_disk_path,
            "is_root_device": false,
            "is_read_only": true,
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/drives/service", &service_body)?;

        // Storage attachment - Language runtime binaries (/dev/vdc)
        let runtime_body = serde_json::json!({
            "drive_id": "runtime",
            "path_on_host": config.runtime_disk_path,
            "is_root_device": false,
            "is_read_only": true,
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/drives/runtime", &runtime_body)?;

        // VSOCK Device setup
        let vsock_body = serde_json::json!({
            "vsock_id": "vsock0",
            "guest_cid": GUEST_CID,
            "uds_path": config.vsock_uds_path,
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/vsock", &vsock_body)?;

        // Start VM instance
        let action_body = serde_json::json!({
            "action_type": "InstanceStart",
        })
        .to_string();
        send_put_uds(&self.api_socket_path, "/actions", &action_body)?;

        Ok(())
    }

    fn wait_and_teardown(
        &mut self,
        on_stdout: Option<Box<dyn Fn(&str) + Send>>,
        on_stderr: Option<Box<dyn Fn(&str) + Send>>,
    ) -> Result<ExecutionMetrics> {
        let config = self.config.as_ref().ok_or_else(|| IgniteError::Config {
            message: "VM not configured".to_string(),
            source: None,
        })?;

        let vsock_listener_path = format!(
            "{}{}",
            config.vsock_uds_path.to_string_lossy(),
            VSOCK_PORT_SUFFIX
        );

        // 1. Host VSOCK listener for guest-initiated connections
        let listener = UnixListener::bind(&vsock_listener_path)?;
        listener.set_nonblocking(true)?;

        let start_time = Instant::now();
        let mut socket = loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    stream.set_nonblocking(false)?;
                    break stream;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if start_time.elapsed().as_millis() > (config.timeout_ms as u128) {
                        self.cleanup_vm_processes();
                        return Err(IgniteError::Execution {
                            message: "Timeout waiting for guest agent to connect over VSOCK"
                                .to_string(),
                            source: None,
                        });
                    }
                    thread::sleep(Duration::from_millis(5));
                }
                Err(e) => {
                    self.cleanup_vm_processes();
                    return Err(e.into());
                }
            }
        };

        // 2. Transmit execution payload (length-prefixed)
        let payload = serde_json::json!({
            "env": config.env,
            "runtime_args": config.runtime_args,
            "entrypoint": config.entrypoint,
            "input": config.input,
        });

        let payload_bytes = serde_json::to_vec(&payload)?;
        let len = payload_bytes.len() as u32;
        socket.write_all(&len.to_be_bytes())?;
        socket.write_all(&payload_bytes)?;

        // 3. Process multiplexed stdout/stderr streams
        let mut exit_code = 1;
        let mut stdout_accum = String::new();
        let mut stderr_accum = String::new();

        loop {
            let mut type_byte = [0u8; 1];
            if socket.read_exact(&mut type_byte).is_err() {
                break; // VM socket disconnected
            }

            let mut len_bytes = [0u8; 4];
            if socket.read_exact(&mut len_bytes).is_err() {
                break;
            }
            let length = u32::from_be_bytes(len_bytes) as usize;

            let mut data = vec![0u8; length];
            if socket.read_exact(&mut data).is_err() {
                break;
            }

            let chunk = String::from_utf8_lossy(&data);
            match type_byte[0] {
                1 => {
                    // stdout
                    stdout_accum.push_str(&chunk);
                    if let Some(ref cb) = on_stdout {
                        cb(&chunk);
                    }
                }
                2 => {
                    // stderr
                    stderr_accum.push_str(&chunk);
                    if let Some(ref cb) = on_stderr {
                        cb(&chunk);
                    }
                }
                3 => {
                    // exit code
                    if let Some(arr) = data.get(..4).and_then(|slice| slice.try_into().ok()) {
                        exit_code = i32::from_be_bytes(arr);
                    }
                    break;
                }
                _ => {}
            }
        }

        let duration_ms = start_time.elapsed().as_millis() as u64;

        // 4. Teardown hypervisor processes and socket files
        self.cleanup_vm_processes();

        Ok(ExecutionMetrics {
            execution_time_ms: duration_ms,
            memory_usage_mb: 0.0, // Will be parsed out of stderr by metric utilities
            cold_start: false,
            cold_start_time_ms: None,
            exit_code,
            stdout: stdout_accum,
            stderr: stderr_accum,
        })
    }
}

impl FirecrackerOrchestrator {
    fn cleanup_vm_processes(&mut self) {
        if let Some(mut child) = self.child_process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let _ = fs::remove_file(&self.api_socket_path);
        if let Some(ref config) = self.config {
            let vsock_listener_path = format!(
                "{}{}",
                config.vsock_uds_path.to_string_lossy(),
                VSOCK_PORT_SUFFIX
            );
            let _ = fs::remove_file(&config.vsock_uds_path);
            let _ = fs::remove_file(&vsock_listener_path);
        }
    }
}
