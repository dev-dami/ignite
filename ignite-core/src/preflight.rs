use std::fs;
use std::path::Path;

use ignite_shared::error::Result;
use ignite_shared::types::{PreflightCheck, PreflightResult, PreflightStatus, ServiceConfig};

const DEFAULT_MEMORY_PER_DEP_MB: u32 = 2;
const DEFAULT_BASE_MEMORY_MB: u32 = 50;
const DEFAULT_WARN_RATIO: f32 = 1.0;
const DEFAULT_FAIL_RATIO: f32 = 0.8;

const DEFAULT_MIN_TIMEOUT_MS: u32 = 100;
const DEFAULT_MAX_TIMEOUT_MS: u32 = 30000;
const DEFAULT_COLD_START_BUFFER_MS: u32 = 500;

fn count_dependencies(node_modules_path: &Path) -> u32 {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(node_modules_path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.path().is_dir() {
                if name.starts_with('@') {
                    if let Ok(sub_entries) = fs::read_dir(entry.path()) {
                        count += sub_entries
                            .flatten()
                            .filter(|e| e.path().is_dir())
                            .count() as u32;
                    }
                } else if !name.starts_with('.') {
                    count += 1;
                }
            }
        }
    }
    count
}

pub fn run_preflight(
    service_path: &Path,
    config: &ServiceConfig,
    last_execution_ms: Option<u64>,
) -> Result<PreflightResult> {
    let mut checks = Vec::new();

    // 1. Dependency analysis
    let node_modules_path = service_path.join("node_modules");
    let dep_count = if node_modules_path.exists() {
        count_dependencies(&node_modules_path)
    } else {
        0
    };

    let dep_config = config.preflight.as_ref().and_then(|p| p.dependencies.as_ref());
    let warn_count = dep_config.and_then(|d| d.warn_count).unwrap_or(100);
    let info_count = dep_config.and_then(|d| d.info_count).unwrap_or(50);

    let dep_check = if dep_count > warn_count {
        PreflightCheck {
            name: "dependency-count".to_string(),
            status: PreflightStatus::Warn,
            message: format!("High dependency count ({}). Consider reducing for faster cold starts.", dep_count),
            value: Some(serde_json::json!(dep_count)),
            threshold: Some(serde_json::json!(warn_count)),
        }
    } else if dep_count > info_count {
        PreflightCheck {
            name: "dependency-count".to_string(),
            status: PreflightStatus::Pass,
            message: format!("Moderate dependency count ({})", dep_count),
            value: Some(serde_json::json!(dep_count)),
            threshold: Some(serde_json::json!(info_count)),
        }
    } else {
        PreflightCheck {
            name: "dependency-count".to_string(),
            status: PreflightStatus::Pass,
            message: format!("Low dependency count ({})", dep_count),
            value: Some(serde_json::json!(dep_count)),
            threshold: Some(serde_json::json!(info_count)),
        }
    };
    checks.push(dep_check);

    // 2. Memory analysis
    let configured_memory = config.service.memory_mb;
    let mem_config = config.preflight.as_ref().and_then(|p| p.memory.as_ref());
    let base_mb = mem_config.and_then(|m| m.base_mb).unwrap_or(DEFAULT_BASE_MEMORY_MB);
    let per_dep_mb = mem_config.and_then(|m| m.per_dependency_mb).unwrap_or(DEFAULT_MEMORY_PER_DEP_MB);
    let warn_ratio = mem_config.and_then(|m| m.warn_ratio).unwrap_or(DEFAULT_WARN_RATIO);
    let fail_ratio = mem_config.and_then(|m| m.fail_ratio).unwrap_or(DEFAULT_FAIL_RATIO);

    let estimated_need = base_mb + dep_count * per_dep_mb;
    let warn_threshold = (estimated_need as f32 * warn_ratio).round() as u32;
    let fail_threshold = (estimated_need as f32 * fail_ratio).round() as u32;

    let mem_check = if configured_memory < fail_threshold {
        PreflightCheck {
            name: "memory-allocation".to_string(),
            status: PreflightStatus::Fail,
            message: format!("Configured memory {}MB may be insufficient. Estimated need: {}MB based on {} dependencies", configured_memory, estimated_need, dep_count),
            value: Some(serde_json::json!(configured_memory)),
            threshold: Some(serde_json::json!(fail_threshold)),
        }
    } else if configured_memory < warn_threshold {
        PreflightCheck {
            name: "memory-allocation".to_string(),
            status: PreflightStatus::Warn,
            message: format!("Configured memory {}MB is close to estimated need of {}MB", configured_memory, estimated_need),
            value: Some(serde_json::json!(configured_memory)),
            threshold: Some(serde_json::json!(warn_threshold)),
        }
    } else {
        PreflightCheck {
            name: "memory-allocation".to_string(),
            status: PreflightStatus::Pass,
            message: format!("Configured memory {}MB exceeds estimated need of {}MB", configured_memory, estimated_need),
            value: Some(serde_json::json!(configured_memory)),
            threshold: Some(serde_json::json!(warn_threshold)),
        }
    };
    checks.push(mem_check);

    // 3. Timeout analysis
    let configured_timeout = config.service.timeout_ms;
    let timeout_config = config.preflight.as_ref().and_then(|p| p.timeout.as_ref());
    let min_ms = timeout_config.and_then(|t| t.min_ms).unwrap_or(DEFAULT_MIN_TIMEOUT_MS);
    let max_ms = timeout_config.and_then(|t| t.max_ms).unwrap_or(DEFAULT_MAX_TIMEOUT_MS);
    let cold_start_buffer = timeout_config.and_then(|t| t.cold_start_buffer_ms).unwrap_or(DEFAULT_COLD_START_BUFFER_MS);

    let timeout_check = if configured_timeout < min_ms {
        PreflightCheck {
            name: "timeout-config".to_string(),
            status: PreflightStatus::Fail,
            message: format!("Timeout {}ms is below minimum {}ms", configured_timeout, min_ms),
            value: Some(serde_json::json!(configured_timeout)),
            threshold: Some(serde_json::json!(min_ms)),
        }
    } else if configured_timeout > max_ms {
        PreflightCheck {
            name: "timeout-config".to_string(),
            status: PreflightStatus::Warn,
            message: format!("Timeout {}ms exceeds recommended maximum {}ms", configured_timeout, max_ms),
            value: Some(serde_json::json!(configured_timeout)),
            threshold: Some(serde_json::json!(max_ms)),
        }
    } else if let Some(last_exec) = last_execution_ms {
        let estimated_limit = last_exec + cold_start_buffer as u64;
        if (configured_timeout as u64) < estimated_limit {
            PreflightCheck {
                name: "timeout-config".to_string(),
                status: PreflightStatus::Warn,
                message: format!("Timeout {}ms may be too short. Last execution: {}ms + {}ms buffer = {}ms", configured_timeout, last_exec, cold_start_buffer, estimated_limit),
                value: Some(serde_json::json!(configured_timeout)),
                threshold: Some(serde_json::json!(estimated_limit)),
            }
        } else {
            PreflightCheck {
                name: "timeout-config".to_string(),
                status: PreflightStatus::Pass,
                message: format!("Timeout {}ms is within acceptable range", configured_timeout),
                value: Some(serde_json::json!(configured_timeout)),
                threshold: Some(serde_json::json!(max_ms)),
            }
        }
    } else {
        PreflightCheck {
            name: "timeout-config".to_string(),
            status: PreflightStatus::Pass,
            message: format!("Timeout {}ms is within acceptable range", configured_timeout),
            value: Some(serde_json::json!(configured_timeout)),
            threshold: Some(serde_json::json!(max_ms)),
        }
    };
    checks.push(timeout_check);

    // Determine overall status
    let overall_status = if checks.iter().any(|c| c.status == PreflightStatus::Fail) {
        PreflightStatus::Fail
    } else if checks.iter().any(|c| c.status == PreflightStatus::Warn) {
        PreflightStatus::Warn
    } else {
        PreflightStatus::Pass
    };

    let timestamp = chrono::Utc::now().to_rfc3339();

    Ok(PreflightResult {
        service_name: config.service.name.clone(),
        timestamp,
        checks,
        overall_status,
    })
}
