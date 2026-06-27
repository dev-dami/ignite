use ignite_shared::types::RuntimeSpec;

#[derive(Debug)]
pub struct RuntimeConfig {
    pub name: &'static str,
    pub default_entry: &'static str,
    pub file_extensions: &'static [&'static str],
    pub supported_versions: &'static [&'static str],
    pub default_version: &'static str,
}

pub const RUNTIMES: &[RuntimeConfig] = &[
    RuntimeConfig {
        name: "bun",
        default_entry: "index.ts",
        file_extensions: &[".ts", ".js", ".tsx", ".jsx"],
        supported_versions: &["1.0", "1.1", "1.2", "1.3"],
        default_version: "1.3",
    },
    RuntimeConfig {
        name: "node",
        default_entry: "index.js",
        file_extensions: &[".js", ".mjs", ".cjs"],
        supported_versions: &["18", "20", "22"],
        default_version: "20",
    },
    RuntimeConfig {
        name: "deno",
        default_entry: "index.ts",
        file_extensions: &[".ts", ".js", ".tsx", ".jsx"],
        supported_versions: &["1.40", "1.41", "1.42", "2.0"],
        default_version: "2.0",
    },
    RuntimeConfig {
        name: "quickjs",
        default_entry: "index.js",
        file_extensions: &[".js"],
        supported_versions: &["2024-01-13", "2023-12-09", "latest"],
        default_version: "latest",
    },
];

pub fn get_runtime_config(name: &str) -> Option<&'static RuntimeConfig> {
    RUNTIMES.iter().find(|r| r.name == name)
}

pub fn is_valid_runtime(runtime_str: &str) -> bool {
    let spec = RuntimeSpec::parse(runtime_str);
    if let Some(config) = get_runtime_config(&spec.name) {
        if let Some(v) = &spec.version {
            return config.supported_versions.contains(&v.as_str());
        }
        return true;
    }
    false
}
