use clap::{Parser, Subcommand};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use ignite_core::execution::{ExecuteOptions, execute_service};
use ignite_core::report::{create_report, format_report_as_text};
use ignite_core::runtime::{get_runtime_config, is_valid_runtime};
use ignite_shared::error::{IgniteError, Result};
use ignite_shared::types::{PreflightStatus, RuntimeSpec, ServiceConfig};
use ignite_shared::validation::validate_service_name;

#[derive(Parser)]
#[command(
    name = "ignite",
    version = "0.3.0",
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
    }

    Ok(())
}
