use regex::Regex;
use std::sync::OnceLock;

static DOCKER_NAME_RE: OnceLock<Regex> = OnceLock::new();

fn get_docker_name_regex() -> &'static Regex {
    DOCKER_NAME_RE
        .get_or_init(|| Regex::new(r"^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$").unwrap())
}

#[derive(Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
}

pub fn validate_service_name(name: &str) -> ValidationResult {
    if name.is_empty() {
        return ValidationResult {
            valid: false,
            error: Some("Name is required".to_string()),
        };
    }

    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return ValidationResult {
            valid: false,
            error: Some("Name contains invalid characters".to_string()),
        };
    }

    let re = get_docker_name_regex();
    if !re.is_match(name) {
        return ValidationResult {
            valid: false,
            error: Some(
                "Name must be lowercase alphanumeric with hyphens (1-63 chars)".to_string(),
            ),
        };
    }

    ValidationResult {
        valid: true,
        error: None,
    }
}

pub fn is_valid_service_name(name: &str) -> bool {
    validate_service_name(name).valid
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_service_name() {
        assert!(is_valid_service_name("hello-bun"));
        assert!(is_valid_service_name("hello"));
        assert!(is_valid_service_name("a"));
        assert!(!is_valid_service_name(""));
        assert!(!is_valid_service_name("-hello"));
        assert!(!is_valid_service_name("hello-"));
        assert!(!is_valid_service_name("hello/world"));
        assert!(!is_valid_service_name("hello..world"));
    }
}
