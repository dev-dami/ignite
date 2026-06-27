use std::collections::HashMap;
use std::ffi::CString;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::os::unix::io::FromRawFd;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use serde::Deserialize;

const VSOCK_PORT: u32 = 1052;
const VSOCK_CID_HOST: u32 = 2;
const VSOCK_RETRY_COUNT: u32 = 10;
const VSOCK_RETRY_DELAY_MS: u64 = 50;
const VSOCK_TYPE_STDOUT: u8 = 1;
const VSOCK_TYPE_STDERR: u8 = 2;
const VSOCK_TYPE_EXIT: u8 = 3;
const IO_BUFFER_SIZE: usize = 4096;

#[derive(Deserialize, Debug)]
struct ExecutionPayload {
    env: HashMap<String, String>,
    runtime_args: Vec<String>,
    entrypoint: String,
    input: Option<String>,
}

fn log_info(msg: &str) {
    if let Ok(mut f) = OpenOptions::new().write(true).open("/dev/console") {
        let _ = writeln!(f, "[ignite-agent] {}", msg);
    } else {
        println!("[ignite-agent] {}", msg);
    }
}

fn log_error(msg: &str) {
    if let Ok(mut f) = OpenOptions::new().write(true).open("/dev/console") {
        let _ = writeln!(f, "[ignite-agent] [ERROR] {}", msg);
    } else {
        eprintln!("[ignite-agent] [ERROR] {}", msg);
    }
}

fn mount_device(source: &str, target: &str, fstype: &str) -> Result<(), std::io::Error> {
    let src = CString::new(source)?;
    let tgt = CString::new(target)?;
    let fs = CString::new(fstype)?;

    std::fs::create_dir_all(target)?;

    let res = unsafe {
        libc::mount(
            src.as_ptr(),
            tgt.as_ptr(),
            fs.as_ptr(),
            libc::MS_RDONLY,
            std::ptr::null(),
        )
    };

    if res != 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

fn connect_vsock(port: u32) -> Result<TcpStream, std::io::Error> {
    let fd = unsafe { libc::socket(libc::AF_VSOCK, libc::SOCK_STREAM, 0) };
    if fd < 0 {
        return Err(std::io::Error::last_os_error());
    }

    let mut addr: libc::sockaddr_vm = unsafe { std::mem::zeroed() };
    addr.svm_family = libc::AF_VSOCK as u16;
    addr.svm_port = port;
    addr.svm_cid = VSOCK_CID_HOST;

    let res = unsafe {
        libc::connect(
            fd,
            &addr as *const _ as *const libc::sockaddr,
            std::mem::size_of::<libc::sockaddr_vm>() as libc::socklen_t,
        )
    };

    if res != 0 {
        unsafe { libc::close(fd); }
        return Err(std::io::Error::last_os_error());
    }

    // Wrap the raw file descriptor in a standard TcpStream
    let stream = unsafe { TcpStream::from_raw_fd(fd) };
    Ok(stream)
}

fn connect_vsock_retry(port: u32, retries: u32, delay_ms: u64) -> Result<TcpStream, std::io::Error> {
    let mut last_err = std::io::Error::other("Failed to connect to host over VSOCK");
    for i in 0..retries {
        match connect_vsock(port) {
            Ok(stream) => return Ok(stream),
            Err(e) => {
                last_err = e;
                log_info(&format!("VSOCK connection attempt {}/{} failed, retrying in {}ms...", i + 1, retries, delay_ms));
                thread::sleep(std::time::Duration::from_millis(delay_ms));
            }
        }
    }
    Err(last_err)
}

fn main() {
    log_info("Starting Guest Agent init...");

    // 1. Mount read-only blocks
    log_info("Mounting service partition (/dev/vdb)...");
    if let Err(e) = mount_device("/dev/vdb", "/app", "ext4") {
        log_error(&format!("Failed to mount /dev/vdb: {}", e));
    } else {
        log_info("Successfully mounted /dev/vdb at /app");
    }

    log_info("Mounting runtime partition (/dev/vdc)...");
    if let Err(e) = mount_device("/dev/vdc", "/runtime", "ext4") {
        log_error(&format!("Failed to mount /dev/vdc: {}", e));
    } else {
        log_info("Successfully mounted /dev/vdc at /runtime");
    }

    // 2. Connect to Host over VSOCK with retry (default port 1052)
    log_info("Establishing connection to host...");
    let mut stream = match connect_vsock_retry(VSOCK_PORT, VSOCK_RETRY_COUNT, VSOCK_RETRY_DELAY_MS) {
        Ok(s) => s,
        Err(e) => {
            log_error(&format!("Failed to connect to host over VSOCK: {}", e));
            log_info("Halting system.");
            halt_vm();
            return;
        }
    };
    log_info("Connected to host.");

    // 3. Read execution payload (length prefixed)
    log_info("Reading configuration payload...");
    let mut len_bytes = [0u8; 4];
    if let Err(e) = stream.read_exact(&mut len_bytes) {
        log_error(&format!("Failed to read payload length: {}", e));
        halt_vm();
        return;
    }
    let length = u32::from_be_bytes(len_bytes) as usize;
    log_info(&format!("Payload size: {} bytes", length));

    let mut payload_bytes = vec![0u8; length];
    if let Err(e) = stream.read_exact(&mut payload_bytes) {
        log_error(&format!("Failed to read payload body: {}", e));
        halt_vm();
        return;
    }

    let payload: ExecutionPayload = match serde_json::from_slice(&payload_bytes) {
        Ok(p) => p,
        Err(e) => {
            log_error(&format!("Failed to parse payload: {}", e));
            halt_vm();
            return;
        }
    };

    // 4. Launch runtime and run entrypoint
    log_info(&format!("Executing: {:?}", payload.runtime_args));
    if payload.runtime_args.is_empty() {
        log_error("Invalid runtime command: empty args list");
        halt_vm();
        return;
    }

    let mut cmd = Command::new(&payload.runtime_args[0]);
    if payload.runtime_args.len() > 1 {
        cmd.args(&payload.runtime_args[1..]);
    }

    // Set environments
    for (k, v) in &payload.env {
        cmd.env(k, v);
    }
    cmd.env("ENTRY_FILE", &payload.entrypoint);
    if let Some(ref input) = payload.input {
        cmd.env("IGNITE_INPUT", input);
    }

    // Redirect outputs to pipe
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            log_error(&format!("Failed to spawn child process: {}", e));
            halt_vm();
            return;
        }
    };

    // Clone the stream for concurrent writing
    let shared_stream = Arc::new(Mutex::new(stream));

    // Handle stdout pipe
    let stdout_stream = Arc::clone(&shared_stream);
    let mut child_stdout = child.stdout.take().expect("stdout pipe not captured");
    let stdout_thread = thread::spawn(move || {
        let mut buffer = [0u8; IO_BUFFER_SIZE];
        loop {
            match child_stdout.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let mut s = stdout_stream.lock().unwrap_or_else(|e| e.into_inner());
                    let _ = s.write_all(&[VSOCK_TYPE_STDOUT]);
                    let _ = s.write_all(&(n as u32).to_be_bytes());
                    let _ = s.write_all(&buffer[..n]);
                }
                Err(_) => break,
            }
        }
    });

    // Handle stderr pipe
    let stderr_stream = Arc::clone(&shared_stream);
    let mut child_stderr = child.stderr.take().expect("stderr pipe not captured");
    let stderr_thread = thread::spawn(move || {
        let mut buffer = [0u8; IO_BUFFER_SIZE];
        loop {
            match child_stderr.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let mut s = stderr_stream.lock().unwrap_or_else(|e| e.into_inner());
                    let _ = s.write_all(&[VSOCK_TYPE_STDERR]);
                    let _ = s.write_all(&(n as u32).to_be_bytes());
                    let _ = s.write_all(&buffer[..n]);
                }
                Err(_) => break,
            }
        }
    });

    // Wait for output readers to finish
    let _ = stdout_thread.join();
    let _ = stderr_thread.join();

    // 5. Gather metrics and finalize execution
    let exit_code = match child.wait() {
        Ok(status) => status.code().unwrap_or(0),
        Err(e) => {
            log_error(&format!("Error waiting for child exit: {}", e));
            1
        }
    };
    log_info(&format!("Execution finished. Child exit code: {}", exit_code));

    // Send exit status frame
    {
        let mut s = shared_stream.lock().unwrap_or_else(|e| e.into_inner());
        let _ = s.write_all(&[VSOCK_TYPE_EXIT]);
        let _ = s.write_all(&(4u32).to_be_bytes());
        let _ = s.write_all(&exit_code.to_be_bytes());
    }

    log_info("Halting guest VM.");
    halt_vm();
}

fn halt_vm() {
    unsafe {
        libc::reboot(libc::RB_POWER_OFF);
    }
}
