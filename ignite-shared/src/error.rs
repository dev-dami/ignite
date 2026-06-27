use thiserror::Error;

#[derive(Error, Debug)]
pub enum IgniteError {
    #[error("Config Error: {message}")]
    Config {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Service Error: {message}")]
    Service {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Runtime Error: {message}")]
    Runtime {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Execution Error: {message}")]
    Execution {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Preflight Error: {message}")]
    Preflight {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML Parse Error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON Parse Error: {0}")]
    Json(#[from] serde_json::Error),
}

impl IgniteError {
    pub fn code(&self) -> &'static str {
        match self {
            IgniteError::Config { .. } => "CONFIG_ERROR",
            IgniteError::Service { .. } => "SERVICE_ERROR",
            IgniteError::Runtime { .. } => "RUNTIME_ERROR",
            IgniteError::Execution { .. } => "EXECUTION_ERROR",
            IgniteError::Preflight { .. } => "PREFLIGHT_ERROR",
            IgniteError::Io(_) => "IO_ERROR",
            IgniteError::Yaml(_) => "YAML_ERROR",
            IgniteError::Json(_) => "JSON_ERROR",
        }
    }
}

pub type Result<T> = std::result::Result<T, IgniteError>;
