use ignite_shared::error::{IgniteError, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn get_dir_size<P: AsRef<Path>>(path: P) -> Result<u64> {
    let mut size = 0;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            size += get_dir_size(entry.path())?;
        } else {
            size += metadata.len();
        }
    }
    Ok(size)
}

fn find_mke2fs() -> Option<PathBuf> {
    // 1. Try checking standard PATH first
    if let Some(output) = Command::new("which").arg("mke2fs").output().ok().filter(|o| o.status.success()) {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            return Some(PathBuf::from(path_str));
        }
    }

    // 2. Fallback to common absolute search locations
    let locations = [
        "/sbin/mke2fs",
        "/usr/sbin/mke2fs",
        "/usr/local/bin/mke2fs",
        "/opt/homebrew/opt/e2fsprogs/sbin/mke2fs", // Homebrew on Apple Silicon macOS
        "/usr/local/opt/e2fsprogs/sbin/mke2fs",    // Homebrew on Intel macOS
    ];

    for &loc in &locations {
        let p = PathBuf::from(loc);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Create an ext4 disk image from a host directory source.
/// Populates files user-space side using modern mke2fs populate directory flags.
pub fn create_ext4_image(src_dir: &Path, output_img: &Path) -> Result<()> {
    let mke2fs_bin = find_mke2fs().ok_or_else(|| IgniteError::Config {
        message: "mke2fs binary not found. Please install e2fsprogs.".to_string(),
        source: None,
    })?;

    // Check directory size to allocate appropriate block limits (dir size + 4MB buffer)
    let src_size = get_dir_size(src_dir).unwrap_or(0);
    let size_mb = ((src_size as f64) / (1024.0 * 1024.0)).ceil() as u64 + 4;
    let size_mb = std::cmp::max(size_mb, 8); // Minimum 8MB size to prevent format allocation errors

    // Make sure target output directory structure exists
    if let Some(parent) = output_img.parent() {
        fs::create_dir_all(parent)?;
    }

    // If file already exists, remove it first to avoid collision and prompt confirmations
    if output_img.exists() {
        let _ = fs::remove_file(output_img);
    }

    let status = Command::new(&mke2fs_bin)
        .arg("-d")
        .arg(src_dir)
        .arg("-t")
        .arg("ext4")
        .arg("-O")
        .arg("^64bit")
        .arg("-E")
        .arg("no_copy_xattrs")
        .arg("-m")
        .arg("0")
        .arg(output_img)
        .arg(format!("{}M", size_mb))
        .output()?;

    if !status.status.success() {
        let err = String::from_utf8_lossy(&status.stderr).into_owned();
        return Err(IgniteError::Execution {
            message: format!("Failed to create ext4 image via mke2fs: {}", err),
            source: None,
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_ext4_image() {
        // Only run if mke2fs is installed in host context
        if find_mke2fs().is_none() {
            println!("Skipping test: mke2fs not found on host");
            return;
        }

        let dir = tempdir().unwrap();
        let src_path = dir.path().join("src");
        fs::create_dir(&src_path).unwrap();
        fs::write(src_path.join("hello.txt"), "hello world").unwrap();

        let output_img = dir.path().join("test.ext4");
        let result = create_ext4_image(&src_path, &output_img);
        assert!(result.is_ok(), "Failed to create ext4 image: {:?}", result);
        assert!(output_img.exists());
    }
}
