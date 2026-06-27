use crate::disk::create_ext4_image;
use crate::orchestrator::VmConfig;
use crate::platform::get_orchestrator;
use crate::preflight::run_preflight;
use ignite_shared::error::{IgniteError, Result};
use ignite_shared::types::{ExecutionMetrics, PreflightResult, PreflightStatus, ServiceConfig};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ExecuteOptions {
    pub input: Option<String>,
    pub env: HashMap<String, String>,
    pub skip_preflight: bool,
    pub audit: bool,
    pub memory_override: Option<u32>,
    pub cpu_override: Option<f32>,
    pub kernel_path: Option<PathBuf>,
    pub rootfs_path: Option<PathBuf>,
    pub runtimes_root: Option<PathBuf>,
    pub vsock_port: Option<u32>,
    pub console_out: Option<PathBuf>,
}

fn load_service_config(service_path: &Path) -> Result<ServiceConfig> {
    let yaml_path = service_path.join("service.yaml");
    if !yaml_path.exists() {
        return Err(IgniteError::Service {
            message: format!("Cannot read service.yaml at {:?}", yaml_path),
            source: None,
        });
    }
    let content = fs::read_to_string(&yaml_path)?;
    let config: ServiceConfig = serde_yaml::from_str(&content)?;
    Ok(config)
}

#[allow(clippy::type_complexity)]
pub fn execute_service(
    service_path: &Path,
    options: ExecuteOptions,
    on_stdout: Option<Box<dyn Fn(&str) + Send>>,
    on_stderr: Option<Box<dyn Fn(&str) + Send>>,
) -> Result<(PreflightResult, ExecutionMetrics)> {
    // 1. Load service configuration
    let config = load_service_config(service_path)?;

    // 2. Preflight checks
    let preflight_result = run_preflight(service_path, &config, None)?;
    if !options.skip_preflight && preflight_result.overall_status == PreflightStatus::Fail {
        return Err(IgniteError::Preflight {
            message: "Preflight checks failed. Service execution blocked.".to_string(),
            source: None,
        });
    }

    // 3. Setup temporary folder for block disks
    let temp_dir = tempfile::tempdir()?;
    let service_disk_path = temp_dir.path().join("service.ext4");
    let runtime_disk_path = temp_dir.path().join("runtime.ext4");

    // 4. Generate ext4 block device for service files
    create_ext4_image(service_path, &service_disk_path)?;

    // 5. Generate ext4 block device for target runtime binaries
    let runtime_spec = ignite_shared::types::RuntimeSpec::parse(&config.service.runtime);
    let runtimes_base = options
        .runtimes_root
        .clone()
        .unwrap_or_else(|| PathBuf::from("./resources/runtimes"));
    let runtime_src_path = runtimes_base.join(&runtime_spec.name);

    if !runtime_src_path.exists() {
        return Err(IgniteError::Config {
            message: format!(
                "Language runtime binaries folder not found: {:?}. Ensure e2fsprogs and runtimes are setup.",
                runtime_src_path
            ),
            source: None,
        });
    }
    create_ext4_image(&runtime_src_path, &runtime_disk_path)?;

    // 6. Resolve Hypervisor VM config
    let kernel_path = options
        .kernel_path
        .clone()
        .unwrap_or_else(|| PathBuf::from("./resources/vmlinux"));
    let rootfs_path = options
        .rootfs_path
        .clone()
        .unwrap_or_else(|| PathBuf::from("./resources/rootfs.ext4"));

    if !kernel_path.exists() {
        return Err(IgniteError::Config {
            message: format!("Linux kernel binary not found: {:?}", kernel_path),
            source: None,
        });
    }
    if !rootfs_path.exists() {
        return Err(IgniteError::Config {
            message: format!("Root filesystem image not found: {:?}", rootfs_path),
            source: None,
        });
    }

    const DEFAULT_VSOCK_PORT: u32 = 1052;
    let vsock_port = options.vsock_port.unwrap_or(DEFAULT_VSOCK_PORT);
    let vm_id = format!(
        "{}-{:x}",
        config.service.name,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let sanitized_name = config.service.name.replace(['/', '\\', '.'], "_");
    let vsock_uds_path = PathBuf::from(format!("/tmp/ignite-vsock-{}-{}", sanitized_name, vm_id));

    // Merge environment variables
    let mut env = config.service.env.clone().unwrap_or_default();
    env.extend(options.env.clone());

    let mut runtime_args = Vec::new();
    // Default runtime execution command lookup
    let binary_name = &runtime_spec.name;
    runtime_args.push(format!("/runtime/bin/{}", binary_name));
    runtime_args.push(format!("/app/{}", config.service.entry));

    let vm_config = VmConfig {
        service_name: config.service.name.clone(),
        kernel_path,
        rootfs_path,
        service_disk_path,
        runtime_disk_path,
        memory_mb: options.memory_override.unwrap_or(config.service.memory_mb),
        vcpu_count: options
            .cpu_override
            .map(|c| c as u8)
            .unwrap_or(config.service.cpu_limit.map(|c| c as u8).unwrap_or(1)),
        vsock_port,
        vsock_uds_path,
        env,
        entrypoint: config.service.entry.clone(),
        input: options.input,
        runtime_args,
        console_out: options.console_out,
        timeout_ms: config.service.timeout_ms,
    };

    // 7. Boot microVM and capture execution outputs
    let mut orchestrator = get_orchestrator();
    orchestrator.configure(vm_config)?;
    orchestrator.boot()?;

    let mut metrics = orchestrator.wait_and_teardown(on_stdout, on_stderr)?;

    // Parse memory metrics from stderr trace (mimics TS implementation)
    metrics.memory_usage_mb = parse_memory_from_stderr(&metrics.stderr);
    metrics.cold_start_time_ms = if metrics.cold_start {
        Some(estimate_cold_start_time(
            &metrics.stderr,
            metrics.execution_time_ms,
        ))
    } else {
        None
    };

    Ok((preflight_result, metrics))
}

fn parse_memory_from_stderr(stderr: &str) -> f64 {
    for line in stderr.lines() {
        if let Some(pos) = line.find("IGNITE_MEMORY_MB:") {
            let val_str = &line[pos + "IGNITE_MEMORY_MB:".len()..];
            if let Ok(val) = val_str.trim().parse::<f64>() {
                return val;
            }
        }
    }
    0.0
}

fn estimate_cold_start_time(stderr: &str, duration_ms: u64) -> u64 {
    for line in stderr.lines() {
        if let Some(pos) = line.find("IGNITE_INIT_TIME:") {
            let val_str = &line[pos + "IGNITE_INIT_TIME:".len()..];
            if let Ok(val) = val_str.trim().parse::<u64>() {
                return val;
            }
        }
    }
    std::cmp::min(duration_ms, 200)
}
