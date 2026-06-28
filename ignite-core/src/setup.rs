use crate::disk::create_ext4_image;
use ignite_shared::error::{IgniteError, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const BUN_DOWNLOAD_URL_BASE: &str = "https://github.com/oven-sh/bun/releases/latest/download";

#[derive(Debug)]
pub struct SetupReport {
    pub ignite_dir: PathBuf,
    pub runtimes_dir: PathBuf,
    pub kernel_path: PathBuf,
    pub rootfs_path: PathBuf,
    pub bun_binary: Option<PathBuf>,
    pub guest_agent_binary: Option<PathBuf>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn get_ignite_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".ignite")
    } else {
        PathBuf::from(".ignite")
    }
}

pub fn check_existing() -> SetupReport {
    let ignite_dir = get_ignite_dir();
    let runtimes_dir = ignite_dir.join("runtimes");
    let kernel_path = ignite_dir.join("vmlinux");
    let rootfs_path = ignite_dir.join("rootfs.ext4");
    let bun_binary = runtimes_dir.join("bun/bin/bun");
    let guest_agent_binary = ignite_dir.join("guest-agent");

    SetupReport {
        ignite_dir,
        runtimes_dir,
        kernel_path,
        rootfs_path,
        bun_binary: if bun_binary.exists() {
            Some(bun_binary)
        } else {
            None
        },
        guest_agent_binary: if guest_agent_binary.exists() {
            Some(guest_agent_binary)
        } else {
            None
        },
        errors: Vec::new(),
        warnings: Vec::new(),
    }
}

pub fn create_directories(ignite_dir: &Path) -> Result<()> {
    fs::create_dir_all(ignite_dir)?;
    fs::create_dir_all(ignite_dir.join("runtimes"))?;
    Ok(())
}

pub fn build_guest_agent(ignite_dir: &Path) -> Result<PathBuf> {
    let agent_path = ignite_dir.join("guest-agent");
    if agent_path.exists() {
        return Ok(agent_path);
    }

    // Try to find the workspace root
    let workspace_root = find_workspace_root();

    let cargo_bin = which("cargo").ok_or_else(|| IgniteError::Config {
        message: "cargo not found. Install Rust toolchain first.".to_string(),
        source: None,
    })?;

    let manifest_path = workspace_root.join("ignite-guest-agent/Cargo.toml");
    if !manifest_path.exists() {
        return Err(IgniteError::Config {
            message: format!("Guest agent manifest not found at {:?}", manifest_path),
            source: None,
        });
    }

    let output = Command::new(&cargo_bin)
        .args([
            "build",
            "--release",
            "--bin",
            "ignite-guest-agent",
            "--manifest-path",
        ])
        .arg(&manifest_path)
        .output()
        .map_err(|e| IgniteError::Runtime {
            message: format!("Failed to run cargo build: {}", e),
            source: Some(Box::new(e)),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(IgniteError::Runtime {
            message: format!("Guest agent build failed: {}", stderr),
            source: None,
        });
    }

    let built_binary = workspace_root.join("target/release/ignite-guest-agent");
    if !built_binary.exists() {
        return Err(IgniteError::Runtime {
            message: "Guest agent binary not found after build".to_string(),
            source: None,
        });
    }

    fs::copy(&built_binary, &agent_path)?;
    Ok(agent_path)
}

pub fn create_rootfs(ignite_dir: &Path, agent_path: &Path) -> Result<PathBuf> {
    let rootfs_path = ignite_dir.join("rootfs.ext4");
    if rootfs_path.exists() {
        return Ok(rootfs_path);
    }

    let temp_dir = tempfile::tempdir()?;
    let rootfs_dir = temp_dir.path().join("rootfs");
    let sbin_dir = rootfs_dir.join("sbin");
    fs::create_dir_all(&sbin_dir)?;

    fs::copy(agent_path, sbin_dir.join("init"))?;
    Command::new("chmod")
        .arg("+x")
        .arg(sbin_dir.join("init"))
        .output()?;

    create_ext4_image(&rootfs_dir, &rootfs_path)?;

    Ok(rootfs_path)
}

pub fn download_bun(runtimes_dir: &Path) -> Result<PathBuf> {
    let bun_dir = runtimes_dir.join("bun");
    if bun_dir.join("bin/bun").exists() {
        return Ok(bun_dir.join("bin/bun"));
    }

    let platform = detect_platform()?;
    let url = format!("{}/bun-{}.zip", BUN_DOWNLOAD_URL_BASE, platform);

    let temp_dir = tempfile::tempdir()?;
    let zip_path = temp_dir.path().join("bun.zip");

    let curl_bin = which("curl").ok_or_else(|| IgniteError::Config {
        message: "curl not found. Install curl to download runtimes.".to_string(),
        source: None,
    })?;

    let output = Command::new(&curl_bin)
        .args(["-fSL", "-o"])
        .arg(&zip_path)
        .arg(&url)
        .output()
        .map_err(|e| IgniteError::Runtime {
            message: format!("Failed to download Bun: {}", e),
            source: Some(Box::new(e)),
        })?;

    if !output.status.success() {
        return Err(IgniteError::Runtime {
            message: format!(
                "Failed to download Bun from {}. Check your network connection.",
                url
            ),
            source: None,
        });
    }

    // Extract
    fs::create_dir_all(&bun_dir)?;
    let unzip_bin = which("unzip").ok_or_else(|| IgniteError::Config {
        message: "unzip not found. Install unzip to extract runtimes.".to_string(),
        source: None,
    })?;

    let output = Command::new(&unzip_bin)
        .args(["-q", "-o"])
        .arg(&zip_path)
        .arg("-d")
        .arg(&bun_dir)
        .output()
        .map_err(|e| IgniteError::Runtime {
            message: format!("Failed to extract Bun: {}", e),
            source: Some(Box::new(e)),
        })?;

    if !output.status.success() {
        return Err(IgniteError::Runtime {
            message: "Failed to extract Bun archive".to_string(),
            source: None,
        });
    }

    // Bun zip extracts to bun-<platform>/bun, find it
    let bin_dir = bun_dir.join("bin");
    fs::create_dir_all(&bin_dir)?;

    // Check common extraction patterns
    let candidates = [
        bun_dir.join("bun"),
        bun_dir.join("bun-linux-x64/bun"),
        bun_dir.join("bun-linux-arm64/bun"),
        bun_dir.join("bun-darwin-x64/bun"),
        bun_dir.join("bun-darwin-arm64/bun"),
    ];

    let mut found = false;
    for candidate in &candidates {
        if candidate.exists() {
            fs::copy(candidate, bin_dir.join("bun"))?;
            found = true;
            break;
        }
    }

    if !found {
        return Err(IgniteError::Runtime {
            message: "Bun binary not found after extraction".to_string(),
            source: None,
        });
    }

    Ok(bin_dir.join("bun"))
}

pub fn download_kernel(ignite_dir: &Path) -> Result<PathBuf> {
    let kernel_path = ignite_dir.join("vmlinux");
    if kernel_path.exists() {
        return Ok(kernel_path);
    }

    // Try to find and copy the host kernel
    let uname_output = std::process::Command::new("uname").arg("-r").output();
    let kernel_release = uname_output
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let candidates: Vec<PathBuf> = [
        "/boot/vmlinuz",
        "/boot/vmlinuz-linux",
        "/boot/vmlinuz-linux-lts",
    ]
    .iter()
    .map(PathBuf::from)
    .chain(if kernel_release.is_empty() {
        None
    } else {
        Some(PathBuf::from(format!("/boot/vmlinuz-{}", kernel_release)))
    })
    .chain([
        PathBuf::from("/boot/bzImage"),
        PathBuf::from("/boot/kernel"),
    ])
    .collect();

    for path in &candidates {
        if path.exists() {
            fs::copy(path, &kernel_path)?;
            return Ok(kernel_path);
        }
    }

    Err(IgniteError::Config {
        message: "No Linux kernel found in /boot. Set IGNITE_KERNEL_PATH to provide one."
            .to_string(),
        source: None,
    })
}

pub fn detect_platform() -> Result<String> {
    let os = match std::env::consts::OS {
        "linux" => "linux",
        "macos" => "darwin",
        _ => {
            return Err(IgniteError::Config {
                message: format!("Unsupported OS: {}", std::env::consts::OS),
                source: None,
            });
        }
    };

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        _ => {
            return Err(IgniteError::Config {
                message: format!("Unsupported architecture: {}", std::env::consts::ARCH),
                source: None,
            });
        }
    };

    Ok(format!("{}-{}", os, arch))
}

fn which(name: &str) -> Option<PathBuf> {
    if let Ok(output) = Command::new("which").arg(name).output()
        && output.status.success()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(PathBuf::from(path));
        }
    }
    None
}

fn find_workspace_root() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    loop {
        if path.join("Cargo.toml").exists() && path.join("ignite-core").exists() {
            return path;
        }
        if !path.pop() {
            break;
        }
    }
    PathBuf::from(".")
}
