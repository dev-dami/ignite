use clap::{Parser, Subcommand};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use ignite_core::execution::{ExecuteOptions, execute_service};
use ignite_core::report::{create_report, format_report_as_text};
use ignite_core::runtime::{RUNTIMES, get_runtime_config, is_valid_runtime};
use ignite_shared::error::{IgniteError, Result};
use ignite_shared::types::{PreflightStatus, RuntimeSpec, ServiceConfig};
use ignite_shared::validation::validate_service_name;

#[derive(Parser)]
#[command(
    name = "ignite",
    version = "0.9.0",
    about = "Secure sandbox execution for JS/TS in microVMs"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new service scaffold
    Init {
        /// Name of the service
        name: String,
        /// Custom output path
        #[arg(short, long)]
        path: Option<String>,
        /// Runtime selection (bun, node, deno, quickjs)
        #[arg(short, long, default_value = "bun")]
        runtime: String,
    },
    /// Build + execute service inside a microVM sandbox
    Run {
        /// Path to service directory
        service: String,
        /// JSON-serialized input arguments
        #[arg(short, long)]
        input: Option<String>,
        /// Runtime spec override (e.g. bun@1.3)
        #[arg(short, long)]
        runtime: Option<String>,
        /// Skip preflight blocks and force execution
        #[arg(long)]
        skip_preflight: bool,
        /// Output execution report in JSON format
        #[arg(long)]
        json: bool,
        /// Run in hardened security audit mode
        #[arg(long)]
        audit: bool,
        /// Write security audit logs JSON to file
        #[arg(long)]
        audit_output: Option<String>,
        /// Show sub-millisecond timelines of VM phases
        #[arg(short, long)]
        verbose: bool,
        /// Override RAM allocation limit (in MB)
        #[arg(long)]
        memory: Option<u32>,
        /// Override CPU cores allocation limit
        #[arg(long)]
        cpus: Option<f32>,
        /// Custom guest kernel image binary path
        #[arg(long)]
        kernel: Option<PathBuf>,
        /// Custom guest root filesystem disk path
        #[arg(long)]
        rootfs: Option<PathBuf>,
        /// Custom guest language runtimes directory path
        #[arg(long)]
        runtimes_root: Option<PathBuf>,
        /// Custom VSOCK host connection port
        #[arg(long)]
        vsock_port: Option<u32>,
        /// File path to log guest serial console outputs
        #[arg(long)]
        console_out: Option<PathBuf>,
    },
    /// Run service preflight security checks only
    Preflight {
        /// Path to service directory
        service: String,
    },
    /// Start HTTP REST API server
    Serve {
        /// Port to bind API (default 3000)
        #[arg(short, long, default_value = "3000")]
        port: u16,
        /// Host to bind API (default localhost)
        #[arg(short, long, default_value = "localhost")]
        host: String,
        /// Path to services folder root
        #[arg(short, long, default_value = "./services")]
        services: String,
    },
    /// Show system status and health
    Status,
    /// Validate a service configuration without running
    Validate {
        /// Path to service directory
        service: String,
    },
    /// List supported runtimes and versions
    List,
    /// View past execution logs
    Logs {
        /// Path to service directory
        service: String,
        /// Show only the last N entries
        #[arg(short, long, default_value = "20")]
        lines: usize,
    },
    /// Show version and build information
    Version {
        /// Show detailed build information
        #[arg(short, long)]
        verbose: bool,
    },
    /// Setup runtime binaries and VM resources
    Setup {
        /// Force re-download even if files exist
        #[arg(long)]
        force: bool,
    },
    /// Manage service templates
    Templates {
        /// Template subcommand
        #[command(subcommand)]
        command: Option<TemplatesCommand>,
    },
}

#[derive(Subcommand)]
enum TemplatesCommand {
    /// List available templates
    List,
    /// Show template details
    Show {
        /// Template name
        name: String,
    },
}

fn handle_init(name: String, path: Option<String>, runtime: String) -> Result<()> {
    if !is_valid_runtime(&runtime) {
        return Err(IgniteError::Config {
            message: format!(
                "Invalid runtime '{}'. Supported runtimes are: bun, node, deno, quickjs",
                runtime
            ),
            source: None,
        });
    }

    let validation = validate_service_name(&name);
    if !validation.valid {
        return Err(IgniteError::Service {
            message: validation
                .error
                .unwrap_or_else(|| "Invalid service name".to_string()),
            source: None,
        });
    }

    let target_path = path.unwrap_or_else(|| name.clone());
    let absolute_path = Path::new(&target_path).to_path_buf();

    fs::create_dir_all(&absolute_path).map_err(|e| IgniteError::Config {
        message: format!("Error creating directory {:?}", absolute_path),
        source: Some(Box::new(e)),
    })?;

    let runtime_config =
        get_runtime_config(&RuntimeSpec::parse(&runtime).name).ok_or_else(|| {
            IgniteError::Config {
                message: format!("Unknown runtime '{}'", runtime),
                source: None,
            }
        })?;
    let entry = runtime_config.default_entry;
    let is_ts = entry.ends_with(".ts") || entry.ends_with(".tsx");

    let yaml_content = format!(
        "service:\n  name: {}\n  runtime: {}\n  entry: {}\n  memoryMb: 128\n  timeoutMs: 5000\n  env:\n    NODE_ENV: production\n",
        name, runtime, entry
    );

    let pkg_content = serde_json::json!({
        "name": name,
        "version": "1.0.0",
        "type": "module",
        "main": entry,
        "scripts": {
            "start": format!("ignite run ."),
            "preflight": "ignite preflight ."
        }
    });

    let index_content = if is_ts {
        "const input = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};\nconsole.log('Hello from TS Ignite! Input:', input);\n"
    } else {
        "const input = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};\nconsole.log('Hello from JS Ignite! Input:', input);\n"
    };

    let pkg_json = serde_json::to_string_pretty(&pkg_content).map_err(IgniteError::Json)? + "\n";

    let files = [
        ("service.yaml", yaml_content),
        ("package.json", pkg_json),
        (entry, index_content.to_string()),
    ];

    for (filename, content) in &files {
        let fpath = absolute_path.join(filename);
        if fpath.exists() {
            return Err(IgniteError::Config {
                message: format!("Refusing to overwrite existing file: {:?}", fpath),
                source: None,
            });
        }
        fs::write(&fpath, content).map_err(|e| IgniteError::Config {
            message: format!("Error writing file {:?}", fpath),
            source: Some(Box::new(e)),
        })?;
    }

    println!(
        "Initialized {} service \"{}\" at {:?}",
        runtime, name, absolute_path
    );
    println!("\nNext steps:");
    println!("  1. cd {}", target_path);
    println!("  2. Edit {} with your logic", entry);
    println!("  3. Run: ignite run .");

    Ok(())
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn handle_run(
    service: String,
    input: Option<String>,
    skip_preflight: bool,
    json: bool,
    verbose: bool,
    memory: Option<u32>,
    cpus: Option<f32>,
    kernel: Option<PathBuf>,
    rootfs: Option<PathBuf>,
    runtimes_root: Option<PathBuf>,
    vsock_port: Option<u32>,
    console_out: Option<PathBuf>,
) -> Result<()> {
    let service_path = Path::new(&service);
    if !service_path.exists() {
        return Err(IgniteError::Service {
            message: format!("Service folder not found at {:?}", service),
            source: None,
        });
    }

    let mut env = HashMap::new();
    env.insert("NODE_ENV".to_string(), "production".to_string());

    let options = ExecuteOptions {
        input,
        env,
        skip_preflight,
        audit: false,
        memory_override: memory,
        cpu_override: cpus,
        kernel_path: kernel,
        rootfs_path: rootfs,
        runtimes_root,
        vsock_port,
        console_out,
    };

    if verbose {
        tracing::info!("Loading service configuration...");
    }

    let on_stdout: Option<Box<dyn Fn(&str) + Send>> = if !json {
        Some(Box::new(|chunk| {
            print!("{}", chunk);
        }))
    } else {
        None
    };

    let on_stderr: Option<Box<dyn Fn(&str) + Send>> = if !json {
        Some(Box::new(|chunk| {
            eprint!("{}", chunk);
        }))
    } else {
        None
    };

    let (preflight, metrics) = execute_service(service_path, options, on_stdout, on_stderr)?;
    let report = create_report(preflight, Some(metrics));
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(IgniteError::Json)?
        );
    } else {
        println!("{}", format_report_as_text(&report));
    }

    Ok(())
}

fn handle_preflight(service: String) -> Result<()> {
    let service_path = Path::new(&service);
    let config_path = service_path.join("service.yaml");
    if !config_path.exists() {
        return Err(IgniteError::Service {
            message: format!("Service config not found at {:?}", config_path),
            source: None,
        });
    }

    let content = fs::read_to_string(&config_path)?;
    let config: ServiceConfig = serde_yaml::from_str(&content)?;

    let result = ignite_core::preflight::run_preflight(service_path, &config, None)?;

    println!("Preflight Checks overall status: {}", result.overall_status);
    for check in &result.checks {
        let icon = match check.status {
            PreflightStatus::Pass => "✓",
            PreflightStatus::Warn => "⚠",
            PreflightStatus::Fail => "✗",
        };
        println!("  {} {}: {}", icon, check.name, check.message);
    }
    if result.overall_status == PreflightStatus::Fail {
        return Err(IgniteError::Preflight {
            message: "Preflight checks failed".to_string(),
            source: None,
        });
    }

    Ok(())
}

fn handle_status() -> Result<()> {
    println!("\n  IGNITE SYSTEM STATUS\n");

    // KVM check (Linux)
    let kvm_ok = Path::new("/dev/kvm").exists();
    let kvm_icon = if kvm_ok { "✓" } else { "✗" };
    let kvm_color = if kvm_ok { "\x1b[32m" } else { "\x1b[31m" };
    println!(
        "  {}{}\x1b[0m\x1b[0m  KVM: {}",
        kvm_color,
        kvm_icon,
        if kvm_ok {
            "available"
        } else {
            "not found (/dev/kvm)"
        }
    );

    // Check if KVM is usable (permissions)
    if kvm_ok {
        let kvm_meta = fs::metadata("/dev/kvm");
        let kvm_readable = kvm_meta
            .as_ref()
            .map(|m| m.permissions().readonly())
            .unwrap_or(false);
        let kvm_usable = kvm_meta.is_ok() && kvm_readable;
        let usable_icon = if kvm_usable { "✓" } else { "⚠" };
        let usable_color = if kvm_usable { "\x1b[32m" } else { "\x1b[33m" };
        println!(
            "  {}{}\x1b[0m\x1b[0m  KVM permissions: {}",
            usable_color,
            usable_icon,
            if kvm_usable {
                "readable"
            } else {
                "check user group"
            }
        );
    }

    // Virtualization.framework check (macOS)
    let vz_ok = cfg!(target_os = "macos");
    if vz_ok {
        let vz_icon = "✓";
        println!(
            "  \x1b[32m{}\x1b[0m  Virtualization.framework: available",
            vz_icon
        );
    }

    // Runtimes
    println!("\n  Supported runtimes:");
    for rt in RUNTIMES {
        println!(
            "    {:<10} versions: {} (default: {})",
            rt.name,
            rt.supported_versions.join(", "),
            rt.default_version
        );
    }

    if let Ok(cwd) = std::env::current_dir() {
        println!("\n  Working directory: {:?}", cwd);
    }

    println!();
    Ok(())
}

fn handle_validate(service: String) -> Result<()> {
    let service_path = Path::new(&service);
    let config_path = service_path.join("service.yaml");

    if !config_path.exists() {
        return Err(IgniteError::Config {
            message: format!("service.yaml not found at {:?}", config_path),
            source: None,
        });
    }

    let content = fs::read_to_string(&config_path)?;
    let config: ServiceConfig = serde_yaml::from_str(&content)?;

    println!("\n  Validating service configuration...\n");

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate name
    let name_val = validate_service_name(&config.service.name);
    if !name_val.valid {
        errors.push(format!(
            "Invalid service name: {}",
            name_val.error.unwrap_or_default()
        ));
    } else {
        println!("  ✓ name: {}", config.service.name);
    }

    // Validate runtime
    if !is_valid_runtime(&config.service.runtime) {
        errors.push(format!(
            "Invalid runtime '{}'. Supported: bun, node, deno, quickjs",
            config.service.runtime
        ));
    } else {
        println!("  ✓ runtime: {}", config.service.runtime);
    }

    // Validate entry file exists
    let entry_path = service_path.join(&config.service.entry);
    if entry_path.exists() {
        println!("  ✓ entry: {} (exists)", config.service.entry);
    } else {
        warnings.push(format!("Entry file '{}' not found", config.service.entry));
    }

    // Validate memory
    if config.service.memory_mb == 0 {
        errors.push("memoryMb must be > 0".to_string());
    } else if config.service.memory_mb < 32 {
        warnings.push(format!(
            "memoryMb {} is very low, consider 64+",
            config.service.memory_mb
        ));
    } else {
        println!("  ✓ memoryMb: {}", config.service.memory_mb);
    }

    // Validate timeout
    if config.service.timeout_ms == 0 {
        errors.push("timeoutMs must be > 0".to_string());
    } else {
        println!("  ✓ timeoutMs: {}", config.service.timeout_ms);
    }

    // Validate env
    if let Some(ref env) = config.service.env {
        println!("  ✓ env: {} variables", env.len());
    }

    // Check package.json
    let pkg_path = service_path.join("package.json");
    if pkg_path.exists() {
        println!("  ✓ package.json: exists");
    } else {
        warnings.push("package.json not found (required for dependency installs)".to_string());
    }

    println!();
    if !errors.is_empty() {
        for e in &errors {
            println!("  \x1b[31m✗ {}\x1b[0m", e);
        }
        return Err(IgniteError::Config {
            message: format!("{} validation error(s)", errors.len()),
            source: None,
        });
    }

    if !warnings.is_empty() {
        for w in &warnings {
            println!("  \x1b[33m⚠ {}\x1b[0m", w);
        }
        println!();
    }

    println!("  \x1b[32m✓ Configuration is valid\x1b[0m\n");
    Ok(())
}

fn handle_list() -> Result<()> {
    println!("\n  SUPPORTED RUNTIMES\n");
    println!("  {:<10} {:<30} DEFAULT", "RUNTIME", "VERSIONS");
    println!("  {}", "─".repeat(55));

    for rt in RUNTIMES {
        println!(
            "  {:<10} {:<30} {}",
            rt.name,
            rt.supported_versions.join(", "),
            rt.default_version
        );
    }

    println!(
        "\n  Use `ignite init --runtime <name>` to create a service with a specific runtime.\n"
    );
    Ok(())
}

fn handle_logs(service: String, lines: usize) -> Result<()> {
    let service_path = Path::new(&service);

    // Check for audit output or console out
    let audit_path = service_path.join("audit.json");
    let console_path = service_path.join("console.log");

    let has_audit = audit_path.exists();
    let has_console = console_path.exists();

    if !has_audit && !has_console {
        println!("\n  No logs found in {:?}\n", service_path);
        println!(
            "  Run with --audit-output audit.json or --console-out console.log to generate logs.\n"
        );
        return Ok(());
    }

    if has_audit {
        println!("\n  SECURITY AUDIT LOG\n");
        let content = fs::read_to_string(&audit_path)?;
        // Try to parse and show summary
        if let Ok(audit) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(summary) = audit.get("summary") {
                println!(
                    "  Network attempts: {}",
                    summary
                        .get("networkAttempts")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  Network blocked:  {}",
                    summary
                        .get("networkBlocked")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  FS reads:         {}",
                    summary
                        .get("filesystemReads")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  FS writes:        {}",
                    summary
                        .get("filesystemWrites")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  FS blocked:       {}",
                    summary
                        .get("filesystemBlocked")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  Process spawns:   {}",
                    summary
                        .get("processSpawns")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  Process blocked:  {}",
                    summary
                        .get("processBlocked")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0)
                );
                println!(
                    "  Status:           {}",
                    summary
                        .get("overallStatus")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                );
            }

            if let Some(events) = audit.get("events").and_then(|v| v.as_array()) {
                let show = events.iter().rev().take(lines).collect::<Vec<_>>();
                if !show.is_empty() {
                    println!("\n  Last {} events:", show.len());
                    for event in show.iter().rev() {
                        let typ = event.get("type").and_then(|v| v.as_str()).unwrap_or("?");
                        let action = event.get("action").and_then(|v| v.as_str()).unwrap_or("?");
                        let target = event.get("target").and_then(|v| v.as_str()).unwrap_or("?");
                        let allowed = event
                            .get("allowed")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(true);
                        let icon = if allowed { "✓" } else { "✗" };
                        let color = if allowed { "\x1b[32m" } else { "\x1b[31m" };
                        println!(
                            "    {}{}\x1b[0m\x1b[0m {}: {} -> {}",
                            color, icon, typ, action, target
                        );
                    }
                }
            }
        } else {
            // Raw output
            let all_lines: Vec<&str> = content.lines().collect();
            let start = all_lines.len().saturating_sub(lines);
            for line in &all_lines[start..] {
                println!("  {}", line);
            }
        }
        println!();
    }

    if has_console {
        println!("\n  CONSOLE OUTPUT\n");
        let content = fs::read_to_string(&console_path)?;
        let all_lines: Vec<&str> = content.lines().collect();
        let start = all_lines.len().saturating_sub(lines);
        for line in &all_lines[start..] {
            println!("  {}", line);
        }
        println!();
    }

    Ok(())
}

fn handle_version(verbose: bool) -> Result<()> {
    println!("\n  ignite {}", env!("CARGO_PKG_VERSION"));

    if verbose {
        println!("  Binary:    {}", env!("CARGO_PKG_NAME"));
        println!("  Edition:   2024");
        println!(
            "  Authors:   {}",
            option_env!("CARGO_PKG_AUTHORS").unwrap_or("unknown")
        );
        println!(
            "  License:   {}",
            option_env!("CARGO_PKG_LICENSE").unwrap_or("unknown")
        );
        println!(
            "  Repository: {}",
            option_env!("CARGO_PKG_REPOSITORY").unwrap_or("https://github.com/dev-dami/ignite")
        );

        let build_time = option_env!("IGNITE_BUILD_TIME").unwrap_or("unknown");
        let git_hash = option_env!("IGNITE_GIT_HASH").unwrap_or("unknown");
        println!("  Built:     {}", build_time);
        println!("  Git:       {}", git_hash);
    }

    println!();
    Ok(())
}

struct TemplateInfo {
    name: &'static str,
    description: &'static str,
    runtime: &'static str,
    files: &'static [&'static str],
}

const BUILTIN_TEMPLATES: &[TemplateInfo] = &[
    TemplateInfo {
        name: "basic-bun",
        description: "Minimal Bun TypeScript service",
        runtime: "bun",
        files: &["service.yaml", "package.json", "index.ts"],
    },
    TemplateInfo {
        name: "basic-node",
        description: "Minimal Node.js service",
        runtime: "node",
        files: &["service.yaml", "package.json", "index.js"],
    },
    TemplateInfo {
        name: "basic-deno",
        description: "Minimal Deno TypeScript service",
        runtime: "deno",
        files: &["service.yaml", "package.json", "index.ts"],
    },
    TemplateInfo {
        name: "api-endpoint",
        description: "HTTP API endpoint with JSON input/output",
        runtime: "bun",
        files: &["service.yaml", "package.json", "index.ts"],
    },
    TemplateInfo {
        name: "worker",
        description: "Background worker with queue processing",
        runtime: "bun",
        files: &["service.yaml", "package.json", "index.ts"],
    },
];

fn handle_templates(command: Option<TemplatesCommand>) -> Result<()> {
    match command {
        Some(TemplatesCommand::List) | None => {
            println!("\n  AVAILABLE TEMPLATES\n");
            println!("  {:<20} {:<40} RUNTIME", "NAME", "DESCRIPTION");
            println!("  {}", "─".repeat(65));

            for tmpl in BUILTIN_TEMPLATES {
                println!(
                    "  {:<20} {:<40} {}",
                    tmpl.name, tmpl.description, tmpl.runtime
                );
            }

            // Check for user templates
            let user_dir = dirs().map(|d| d.join("templates"));
            if let Some(ref user_dir) = user_dir
                && user_dir.exists()
                && let Ok(entries) = fs::read_dir(user_dir)
            {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        println!("  {:<20} {:<40} custom", name, "(user template)");
                    }
                }
            }

            println!("\n  Use `ignite init --runtime <name>` to create from defaults.");
            println!("  User templates go in: ~/.ignite/templates/<name>/\n");
            Ok(())
        }
        Some(TemplatesCommand::Show { name }) => {
            if let Some(tmpl) = BUILTIN_TEMPLATES.iter().find(|t| t.name == name) {
                println!("\n  Template: {}", tmpl.name);
                println!("  Description: {}", tmpl.description);
                println!("  Runtime: {}", tmpl.runtime);
                println!("  Files: {}", tmpl.files.join(", "));
                println!();
            } else {
                println!("\n  Template '{}' not found.\n", name);
                println!("  Available templates:");
                for tmpl in BUILTIN_TEMPLATES {
                    println!("    - {}", tmpl.name);
                }
                println!();
            }
            Ok(())
        }
    }
}

fn dirs() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".ignite"))
}

fn handle_setup(force: bool) -> Result<()> {
    use ignite_core::setup;

    println!("\n  IGNITE SETUP\n");

    let ignite_dir = setup::get_ignite_dir();
    println!("  Install directory: {:?}\n", ignite_dir);

    // Create directories
    setup::create_directories(&ignite_dir)?;
    println!("  \x1b[32m✓\x1b[0m Directories created");

    // Use host kernel
    let kernel_path = ignite_dir.join("vmlinux");
    if kernel_path.exists() && !force {
        println!("  \x1b[32m✓\x1b[0m Kernel already exists");
    } else {
        print!("  Locating host kernel... ");
        std::io::Write::flush(&mut std::io::stdout()).ok();
        match setup::download_kernel(&ignite_dir) {
            Ok(path) => println!("\x1b[32m✓\x1b[0m {:?}", path),
            Err(e) => println!("\x1b[33m⚠\x1b[0m {}", e),
        }
    }

    // Download Bun runtime
    let bun_path = ignite_dir.join("runtimes/bun/bin/bun");
    if bun_path.exists() && !force {
        println!("  \x1b[32m✓\x1b[0m Bun runtime already exists");
    } else {
        print!("  Download Bun runtime (~10MB)? [y/N] ");
        std::io::Write::flush(&mut std::io::stdout()).ok();
        let mut input = String::new();
        std::io::stdin().read_line(&mut input).ok();
        if input.trim().eq_ignore_ascii_case("y") {
            print!("  Downloading Bun... ");
            std::io::Write::flush(&mut std::io::stdout()).ok();
            match setup::download_bun(&ignite_dir.join("runtimes")) {
                Ok(path) => println!("\x1b[32m✓\x1b[0m {:?}", path),
                Err(e) => println!("\x1b[33m⚠\x1b[0m {}", e),
            }
        } else {
            println!("  \x1b[33m⚠\x1b[0m Skipped. You can run `ignite setup --force` later.");
        }
    }

    // Rootfs check
    let rootfs_path = ignite_dir.join("rootfs.ext4");
    let agent_path = ignite_dir.join("guest-agent");
    if rootfs_path.exists() {
        println!("  \x1b[32m✓\x1b[0m Rootfs image exists");
    } else if agent_path.exists() {
        print!("  Creating rootfs image... ");
        std::io::Write::flush(&mut std::io::stdout()).ok();
        match setup::create_rootfs(&ignite_dir, &agent_path) {
            Ok(path) => println!("\x1b[32m✓\x1b[0m {:?}", path),
            Err(e) => println!("\x1b[33m⚠\x1b[0m {}", e),
        }
    } else {
        println!("  \x1b[33m⚠\x1b[0m Rootfs not found. Build guest agent first:");
        println!("      cargo build --release --bin ignite-guest-agent");
        println!("      cp target/release/ignite-guest-agent ~/.ignite/guest-agent");
        println!("      Then re-run: ignite setup");
    }

    // Summary
    println!("\n  Setup complete!");
    println!("\n  To verify:");
    println!("    ignite status");
    println!();

    Ok(())
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Init {
            name,
            path,
            runtime,
        } => {
            handle_init(name, path, runtime)?;
        }
        Commands::Run {
            service,
            input,
            skip_preflight,
            json,
            verbose,
            memory,
            cpus,
            kernel,
            rootfs,
            runtimes_root,
            vsock_port,
            console_out,
            ..
        } => {
            handle_run(
                service,
                input,
                skip_preflight,
                json,
                verbose,
                memory,
                cpus,
                kernel,
                rootfs,
                runtimes_root,
                vsock_port,
                console_out,
            )?;
        }
        Commands::Preflight { service } => {
            handle_preflight(service)?;
        }
        Commands::Status => {
            handle_status()?;
        }
        Commands::Validate { service } => {
            handle_validate(service)?;
        }
        Commands::List => {
            handle_list()?;
        }
        Commands::Logs { service, lines } => {
            handle_logs(service, lines)?;
        }
        Commands::Version { verbose } => {
            handle_version(verbose)?;
        }
        Commands::Templates { command } => {
            handle_templates(command)?;
        }
        Commands::Serve {
            port,
            host,
            services,
        } => {
            let state = std::sync::Arc::new(ignite_http::server::ServerState {
                services_path: PathBuf::from(services),
                api_key: std::env::var("IGNITE_API_KEY").ok(),
                rate_limiter: ignite_http::server::RateLimiter::new(60, 60),
                kernel_path: std::env::var("IGNITE_KERNEL_PATH").ok().map(PathBuf::from),
                rootfs_path: std::env::var("IGNITE_ROOTFS_PATH").ok().map(PathBuf::from),
                runtimes_root: std::env::var("IGNITE_RUNTIMES_ROOT")
                    .ok()
                    .map(PathBuf::from),
            });
            let app = ignite_http::server::create_router(state);
            let socket_addr: std::net::SocketAddr = format!("{}:{}", host, port)
                .parse()
                .unwrap_or_else(|_| std::net::SocketAddr::from(([127, 0, 0, 1], port)));

            tracing::info!("Ignite HTTP API server listening on http://{}", socket_addr);
            let listener = tokio::net::TcpListener::bind(socket_addr)
                .await
                .map_err(|e| IgniteError::Runtime {
                    message: format!("Failed to bind TCP listener on {}", socket_addr),
                    source: Some(Box::new(e)),
                })?;
            axum::serve(listener, app)
                .await
                .map_err(|e| IgniteError::Runtime {
                    message: "HTTP server error".to_string(),
                    source: Some(Box::new(e)),
                })?;
        }
        Commands::Setup { force } => {
            handle_setup(force)?;
        }
    }

    Ok(())
}
