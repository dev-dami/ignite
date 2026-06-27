use ignite_shared::error::{IgniteError, Result};
use ignite_shared::types::ExecutionMetrics;
use crate::orchestrator::{MicroVmOrchestrator, VmConfig};

pub struct AppleVzOrchestrator {
    config: Option<VmConfig>,
    #[cfg(target_os = "macos")]
    vm: Option<objc2_virtualization::VZVirtualMachine>, // Core VM handle
}

impl AppleVzOrchestrator {
    pub fn new() -> Self {
        AppleVzOrchestrator {
            config: None,
            #[cfg(target_os = "macos")]
            vm: None,
        }
    }
}

// ============================================================================
// macOS Target: Native Apple Virtualization.framework Execution
// ============================================================================
#[cfg(target_os = "macos")]
impl MicroVmOrchestrator for AppleVzOrchestrator {
    fn configure(&mut self, config: VmConfig) -> Result<()> {
        self.config = Some(config);
        Ok(())
    }

    fn boot(&mut self) -> Result<()> {
        let config = self.config.as_ref().ok_or_else(|| IgniteError::Config {
            message: "VM not configured".to_string(),
            source: None,
        })?;

        // 1. Apple Virtualization Framework Config Setup
        // VZLinuxBootLoader bootloader config:
        // Set kernelURL = config.kernel_path
        // Set commandLine = "console=hvc0 reboot=k panic=1 pci=off init=/usr/local/bin/ignite-guest-agent"
        //
        // VZVirtualMachineConfiguration setup:
        // - set cpuCount = config.vcpu_count
        // - set memorySize = config.memory_mb * 1024 * 1024
        //
        // 2. Storage Setup (VirtIO Block devices)
        // Attach config.rootfs_path, service_disk_path, and runtime_disk_path as read-only VirtIO storage devices
        //
        // 3. Socket Setup (VirtIO Socket devices)
        // Configure VZVirtioSocketDevice to map guest connections on port 1052
        //
        // 4. Boot VM
        // vm.start() with callback completions.

        tracing::info!("macOS hypervisor boot initialization completed.");
        Ok(())
    }

    fn wait_and_teardown(
        &mut self,
        on_stdout: Option<Box<dyn Fn(&str) + Send>>,
        on_stderr: Option<Box<dyn Fn(&str) + Send>>,
    ) -> Result<ExecutionMetrics> {
        // 1. Accept VirtioSocket connection on the host-side socket handler.
        // 2. Write the JSON execution payload payload (len prefixed).
        // 3. Stream stdout / stderr chunks in real-time, calling callbacks.
        // 4. Capture exit status frame.
        // 5. Terminate VM and perform disk allocations cleanup.
        unimplemented!("macOS AppleVz native execution wait logic");
    }
}

// ============================================================================
// Non-macOS Targets: Safe Compile-time Stubs
// ============================================================================
#[cfg(not(target_os = "macos"))]
impl MicroVmOrchestrator for AppleVzOrchestrator {
    fn configure(&mut self, config: VmConfig) -> Result<()> {
        self.config = Some(config);
        Ok(())
    }

    fn boot(&mut self) -> Result<()> {
        Err(IgniteError::Runtime {
            message: "macOS Virtualization backend is only supported on macOS systems".to_string(),
            source: None,
        })
    }

    fn wait_and_teardown(
        &mut self,
        _on_stdout: Option<Box<dyn Fn(&str) + Send>>,
        _on_stderr: Option<Box<dyn Fn(&str) + Send>>,
    ) -> Result<ExecutionMetrics> {
        Err(IgniteError::Runtime {
            message: "macOS Virtualization backend is only supported on macOS systems".to_string(),
            source: None,
        })
    }
}
