use ignite_shared::types::{
    ExecutionMetrics, ExecutionReport, PreflightResult, PreflightStatus, Warning, WarningLevel,
};

const COLD_START_WARNING_THRESHOLD_MS: u64 = 500;

pub fn generate_warnings(
    preflight: &PreflightResult,
    execution: Option<&ExecutionMetrics>,
) -> Vec<Warning> {
    let mut warnings = Vec::new();

    for check in &preflight.checks {
        if check.status == PreflightStatus::Fail {
            warnings.push(Warning {
                level: WarningLevel::Critical,
                message: check.message.clone(),
                suggestion: Some(get_suggestion(&check.name, &PreflightStatus::Fail)),
            });
        } else if check.status == PreflightStatus::Warn {
            warnings.push(Warning {
                level: WarningLevel::Warning,
                message: check.message.clone(),
                suggestion: Some(get_suggestion(&check.name, &PreflightStatus::Warn)),
            });
        }
    }

    if let Some(exec) = execution {
        if exec.cold_start {
            if let Some(cold_time) = exec.cold_start_time_ms {
                if cold_time > COLD_START_WARNING_THRESHOLD_MS {
                    warnings.push(Warning {
                        level: WarningLevel::Warning,
                        message: format!("Cold start time {}ms is high", cold_time),
                        suggestion: Some("Reduce dependencies or use lighter base images".to_string()),
                    });
                }
            }
        }

        if exec.exit_code != 0 {
            warnings.push(Warning {
                level: WarningLevel::Critical,
                message: format!("Service exited with code {}", exec.exit_code),
                suggestion: Some("Check stderr output for error details".to_string()),
            });
        }
    }

    warnings
}

fn get_suggestion(check_name: &str, status: &PreflightStatus) -> String {
    match (check_name, status) {
        ("image-size", PreflightStatus::Fail) => "Use a smaller base image or consider multi-stage builds".to_string(),
        ("image-size", PreflightStatus::Warn) => "Consider optimizing your disk image by removing unused files".to_string(),
        ("memory-allocation", PreflightStatus::Fail) => "Increase memoryMb in service.yaml or reduce dependencies".to_string(),
        ("memory-allocation", PreflightStatus::Warn) => "Monitor memory usage during execution and adjust if needed".to_string(),
        ("dependency-count", PreflightStatus::Fail) => "Remove unused dependencies and consider using lighter alternatives".to_string(),
        ("dependency-count", PreflightStatus::Warn) => "Review dependencies for unused packages".to_string(),
        ("timeout-config", PreflightStatus::Fail) => "Increase timeoutMs in service.yaml or optimize function execution time".to_string(),
        ("timeout-config", PreflightStatus::Warn) => "Consider adding buffer time for cold starts".to_string(),
        _ => "Review configuration".to_string(),
    }
}

pub fn create_report(
    preflight: PreflightResult,
    execution: Option<ExecutionMetrics>,
) -> ExecutionReport {
    let timestamp = chrono::Utc::now().to_rfc3339();
    let warnings = generate_warnings(&preflight, execution.as_ref());
    ExecutionReport {
        service_name: preflight.service_name.clone(),
        timestamp,
        preflight,
        execution,
        warnings,
    }
}

pub fn format_report_as_text(report: &ExecutionReport) -> String {
    let mut lines = Vec::new();
    let divider = "─".repeat(50);

    lines.push(String::new());
    lines.push("  IGNITE EXECUTION REPORT".to_string());
    lines.push(format!("  Service: {}", report.service_name));
    lines.push(format!("  Time: {}", report.timestamp));
    lines.push(String::new());
    lines.push(divider.clone());

    lines.push(String::new());
    lines.push("  PREFLIGHT CHECKS".to_string());
    lines.push(String::new());

    for check in &report.preflight.checks {
        let icon = match check.status {
            PreflightStatus::Pass => "✓",
            PreflightStatus::Warn => "⚠",
            PreflightStatus::Fail => "✗",
        };
        let color = match check.status {
            PreflightStatus::Pass => "\x1b[32m",
            PreflightStatus::Warn => "\x1b[33m",
            PreflightStatus::Fail => "\x1b[31m",
        };
        let reset = "\x1b[0m";
        lines.push(format!("  {}{}{} {}: {}", color, icon, reset, check.name, check.message));
    }

    lines.push(String::new());
    lines.push(divider.clone());

    if let Some(ref exec) = report.execution {
        lines.push(String::new());
        lines.push("  EXECUTION METRICS".to_string());
        lines.push(String::new());
        lines.push(format!("  Duration: {}ms", exec.execution_time_ms));
        lines.push(format!("  Memory: {}MB", exec.memory_usage_mb));
        lines.push(format!("  Cold Start: {}", if exec.cold_start { "Yes" } else { "No" }));
        if let Some(cold_time) = exec.cold_start_time_ms {
            lines.push(format!("  Cold Start Time: {}ms", cold_time));
        }
        lines.push(format!("  Exit Code: {}", exec.exit_code));

        if !exec.stdout.trim().is_empty() {
            lines.push(String::new());
            lines.push("  STDOUT:".to_string());
            let indent_stdout: Vec<String> = exec.stdout.trim().lines().map(|l| format!("  {}", l)).collect();
            lines.push(indent_stdout.join("\n"));
        }

        lines.push(String::new());
        lines.push(divider.clone());
    }

    if !report.warnings.is_empty() {
        lines.push(String::new());
        lines.push("  WARNINGS".to_string());
        lines.push(String::new());

    for warning in &report.warnings {
        let icon = match warning.level {
            WarningLevel::Critical => "✗",
            WarningLevel::Warning => "⚠",
            WarningLevel::Info => "ℹ",
        };
        let color = match warning.level {
            WarningLevel::Critical => "\x1b[31m",
            WarningLevel::Warning => "\x1b[33m",
            WarningLevel::Info => "\x1b[36m",
        };
            let reset = "\x1b[0m";
            lines.push(format!("  {}{}{} {}", color, icon, reset, warning.message));
            if let Some(ref suggestion) = warning.suggestion {
                lines.push(format!("    → {}", suggestion));
            }
        }

        lines.push(String::new());
        lines.push(divider.clone());
    }

    let overall_icon = match report.preflight.overall_status {
        PreflightStatus::Pass => "✓",
        PreflightStatus::Warn => "⚠",
        PreflightStatus::Fail => "✗",
    };
    let overall_color = match report.preflight.overall_status {
        PreflightStatus::Pass => "\x1b[32m",
        PreflightStatus::Warn => "\x1b[33m",
        PreflightStatus::Fail => "\x1b[31m",
    };
    let reset = "\x1b[0m";

    lines.push(String::new());
    lines.push(format!(
        "  {}{}{} Overall Status: {}",
        overall_color,
        overall_icon,
        reset,
        report.preflight.overall_status
    ));
    lines.push(String::new());

    lines.join("\n")
}
