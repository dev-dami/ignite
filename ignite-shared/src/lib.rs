pub mod types;
pub mod error;
pub mod validation;

// Re-export common dependencies
pub use error::{IgniteError, Result};
pub use types::*;
pub use validation::validate_service_name;
