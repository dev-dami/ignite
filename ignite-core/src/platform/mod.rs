pub mod firecracker;

#[cfg(target_os = "macos")]
pub mod apple_vz;

use crate::orchestrator::MicroVmOrchestrator;

/// Returns the native hypervisor orchestrator for the current operating system.
pub fn get_orchestrator() -> Box<dyn MicroVmOrchestrator> {
    #[cfg(target_os = "macos")]
    {
        Box::new(apple_vz::AppleVzOrchestrator::new())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Box::new(firecracker::FirecrackerOrchestrator::new())
    }
}
