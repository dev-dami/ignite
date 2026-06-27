use ignite_shared::error::Result;
use ignite_shared::types::ExecutionMetrics;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct VmConfig {
    pub service_name: String,
    pub kernel_path: PathBuf,
    pub rootfs_path: PathBuf,
    pub service_disk_path: PathBuf,
    pub runtime_disk_path: PathBuf,
    pub memory_mb: u32,
    pub vcpu_count: u8,
    pub vsock_port: u32,
    pub vsock_uds_path: PathBuf,
    pub env: HashMap<String, String>,
    pub entrypoint: String,
    pub input: Option<String>,
    pub runtime_args: Vec<String>,
    pub console_out: Option<PathBuf>,
    pub timeout_ms: u32,
}

pub trait MicroVmOrchestrator {
    /// Configure microVM settings (CPUs, RAM, storage attachments, VSOCK channels)
    fn configure(&mut self, config: VmConfig) -> Result<()>;

    /// Launch/boot the configured microVM
    fn boot(&mut self) -> Result<()>;

    /// Block, stream child standard streams (via VSOCK), capture exit code, and cleanly tear down loopbacks
    #[allow(clippy::type_complexity)]
    fn wait_and_teardown(
        &mut self,
        on_stdout: Option<Box<dyn Fn(&str) + Send>>,
        on_stderr: Option<Box<dyn Fn(&str) + Send>>,
    ) -> Result<ExecutionMetrics>;
}
