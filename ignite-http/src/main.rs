use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use ignite_http::server::{create_router, RateLimiter, ServerState};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let services_path = std::env::var("IGNITE_SERVICES_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./services"));

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3000);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());

    let api_key = std::env::var("IGNITE_API_KEY").ok();

    let state = Arc::new(ServerState {
        services_path,
        api_key,
        rate_limiter: RateLimiter::new(60, 60),
        kernel_path: std::env::var("IGNITE_KERNEL_PATH").ok().map(PathBuf::from),
        rootfs_path: std::env::var("IGNITE_ROOTFS_PATH").ok().map(PathBuf::from),
        runtimes_root: std::env::var("IGNITE_RUNTIMES_ROOT").ok().map(PathBuf::from),
    });

    let app = create_router(state);
    let socket_addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], port)));

    tracing::info!("Ignite HTTP API server listening on http://{}", socket_addr);
    let listener = tokio::net::TcpListener::bind(socket_addr)
        .await
        .expect("Failed to bind TCP listener");
    axum::serve(listener, app)
        .await
        .expect("HTTP server failed");
}
