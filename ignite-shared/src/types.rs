use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PreflightStatus {
    Pass,
    Warn,
    Fail,
}

impl fmt::Display for PreflightStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PreflightStatus::Pass => write!(f, "PASS"),
            PreflightStatus::Warn => write!(f, "WARN"),
            PreflightStatus::Fail => write!(f, "FAIL"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WarningLevel {
    Info,
    Warning,
    Critical,
}

impl fmt::Display for WarningLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WarningLevel::Info => write!(f, "INFO"),
            WarningLevel::Warning => write!(f, "WARNING"),
            WarningLevel::Critical => write!(f, "CRITICAL"),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub service: ServiceDetails,
    pub preflight: Option<PreflightConfig>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDetails {
    pub name: String,
    pub runtime: String,
    pub entry: String,
    pub memory_mb: u32,
    pub cpu_limit: Option<f32>,
    pub timeout_ms: u32,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreflightConfig {
    pub memory: Option<MemoryPreflightConfig>,
    pub dependencies: Option<DependencyPreflightConfig>,
    pub image: Option<ImagePreflightConfig>,
    pub timeout: Option<TimeoutPreflightConfig>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPreflightConfig {
    pub base_mb: Option<u32>,
    pub per_dependency_mb: Option<u32>,
    pub warn_ratio: Option<f32>,
    pub fail_ratio: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DependencyPreflightConfig {
    pub warn_count: Option<u32>,
    pub info_count: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImagePreflightConfig {
    pub warn_mb: Option<u32>,
    pub fail_mb: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimeoutPreflightConfig {
    pub min_ms: Option<u32>,
    pub max_ms: Option<u32>,
    pub cold_start_buffer_ms: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSpec {
    pub name: String,
    pub version: Option<String>,
}

impl RuntimeSpec {
    pub fn parse(runtime: &str) -> Self {
        if let Some(at_idx) = runtime.rfind('@').filter(|&idx| idx > 0) {
            return RuntimeSpec {
                name: runtime[..at_idx].to_string(),
                version: Some(runtime[at_idx + 1..].to_string()),
            };
        }
        RuntimeSpec {
            name: runtime.to_string(),
            version: None,
        }
    }

    pub fn format(&self) -> String {
        match &self.version {
            Some(v) => format!("{}@{}", self.name, v),
            None => self.name.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionMetrics {
    pub execution_time_ms: u64,
    pub memory_usage_mb: f64,
    pub cold_start: bool,
    pub cold_start_time_ms: Option<u64>,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResult {
    pub service_name: String,
    pub timestamp: String,
    pub checks: Vec<PreflightCheck>,
    pub overall_status: PreflightStatus,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreflightCheck {
    pub name: String,
    pub status: PreflightStatus,
    pub message: String,
    pub value: Option<serde_json::Value>,
    pub threshold: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    pub level: WarningLevel,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionReport {
    pub service_name: String,
    pub timestamp: String,
    pub preflight: PreflightResult,
    pub execution: Option<ExecutionMetrics>,
    pub warnings: Vec<Warning>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentManifest {
    pub version: String,
    pub runtime: RuntimeSpec,
    pub lockfile: Option<String>,
    pub checksums: HashMap<String, String>,
    pub created_at: String,
}

// Security Policy Structures
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecurityPolicy {
    pub network: NetworkPolicy,
    pub filesystem: FilesystemPolicy,
    pub process: ProcessPolicy,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkPolicy {
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilesystemPolicy {
    pub read_only: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessPolicy {
    pub allow_spawn: bool,
    pub allowed_commands: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecurityEvent {
    pub r#type: String, // "network" | "filesystem" | "process"
    pub action: String, // "read" | "write" | "connect" | "spawn" | "blocked"
    pub target: String,
    pub timestamp: u64,
    pub allowed: bool,
    pub details: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySummary {
    pub network_attempts: u32,
    pub network_blocked: u32,
    pub filesystem_reads: u32,
    pub filesystem_writes: u32,
    pub filesystem_blocked: u32,
    pub process_spawns: u32,
    pub process_blocked: u32,
    pub overall_status: String, // "clean" | "violations"
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecurityAudit {
    pub events: Vec<SecurityEvent>,
    pub summary: SecuritySummary,
    pub policy: SecurityPolicy,
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        SecurityPolicy {
            network: NetworkPolicy { enabled: false },
            filesystem: FilesystemPolicy { read_only: true },
            process: ProcessPolicy {
                allow_spawn: false,
                allowed_commands: None,
            },
        }
    }
}
