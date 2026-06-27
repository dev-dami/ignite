use axum::{
    Json, Router,
    extract::{FromRef, Path as AxumPath, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tower_http::cors::CorsLayer;

use ignite_core::execution::{ExecuteOptions, execute_service};
use ignite_shared::types::ExecutionMetrics;

pub struct ServerState {
    pub services_path: PathBuf,
    pub api_key: Option<String>,
    pub rate_limiter: RateLimiter,
    pub kernel_path: Option<PathBuf>,
    pub rootfs_path: Option<PathBuf>,
    pub runtimes_root: Option<PathBuf>,
}

pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        RateLimiter {
            requests: Mutex::new(HashMap::new()),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    fn check(&self, ip: String) -> bool {
        let mut map = self.requests.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        let timestamps = map.entry(ip).or_default();

        timestamps.retain(|&t| now.duration_since(t) < self.window);

        if timestamps.len() >= self.max_requests {
            false
        } else {
            timestamps.push(now);
            true
        }
    }
}

// Extractor to require Bearer auth if API Key is configured
pub struct RequireAuth;

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for RequireAuth
where
    S: Send + Sync,
    Arc<ServerState>: axum::extract::FromRef<S>,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let server_state: Arc<ServerState> = FromRef::from_ref(state);

        // 1. Check rate limit first
        let client_ip = parts
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown")
            .to_string();

        if !server_state.rate_limiter.check(client_ip) {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({ "error": "Rate limit exceeded. Retry later." })),
            ));
        }

        // 2. Validate API key if configured
        if let Some(ref key) = server_state.api_key {
            let auth = parts
                .headers
                .get("Authorization")
                .and_then(|v| v.to_str().ok());

            if auth.filter(|t| t.starts_with("Bearer ") && &t[7..] == key).is_some() {
                return Ok(RequireAuth);
            }
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized: Invalid or missing API key" })),
            ));
        }

        Ok(RequireAuth)
    }
}

// REST Route handlers
async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0",
        "uptime": 0
    }))
}

async fn list_services(
    _auth: RequireAuth,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    let mut services = Vec::new();
    if let Ok(entries) = fs::read_dir(&state.services_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()).filter(|_| path.is_dir()) {
                services.push(name.to_string());
            }
        }
    }
    Json(serde_json::json!({ "services": services }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteRequest {
    input: Option<serde_json::Value>,
    skip_preflight: Option<bool>,
    audit: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteResponse {
    success: bool,
    service_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    metrics: Option<ExecutionMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preflight: Option<ignite_shared::types::PreflightResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

async fn execute_service_handler(
    _auth: RequireAuth,
    State(state): State<Arc<ServerState>>,
    AxumPath(service_name): AxumPath<String>,
    Json(body): Json<ExecuteRequest>,
) -> impl IntoResponse {
    if service_name.contains('/') || service_name.contains('\\') || service_name.contains("..") {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExecuteResponse {
                success: false,
                service_name,
                metrics: None,
                preflight: None,
                error: Some("Invalid service name: path traversal not allowed".to_string()),
            }),
        );
    }

    let service_dir = state.services_path.join(&service_name);
    if !service_dir.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(ExecuteResponse {
                success: false,
                service_name,
                metrics: None,
                preflight: None,
                error: Some("Service directory not found".to_string()),
            }),
        );
    }

    let input_str = body.input.map(|v| v.to_string());

    let options = ExecuteOptions {
        input: input_str,
        env: HashMap::new(),
        skip_preflight: body.skip_preflight.unwrap_or(false),
        audit: body.audit.unwrap_or(false),
        memory_override: None,
        cpu_override: None,
        kernel_path: state.kernel_path.clone(),
        rootfs_path: state.rootfs_path.clone(),
        runtimes_root: state.runtimes_root.clone(),
        vsock_port: None,
        console_out: None,
    };

    match execute_service(&service_dir, options, None, None) {
        Ok((preflight, metrics)) => (
            StatusCode::OK,
            Json(ExecuteResponse {
                success: true,
                service_name,
                metrics: Some(metrics),
                preflight: Some(preflight),
                error: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExecuteResponse {
                success: false,
                service_name,
                metrics: None,
                preflight: None,
                error: Some(e.to_string()),
            }),
        ),
    }
}

pub fn create_router(state: Arc<ServerState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/services", get(list_services))
        .route(
            "/services/:serviceName/execute",
            post(execute_service_handler),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
                .allow_headers(tower_http::cors::Any),
        )
        .with_state(state)
}
