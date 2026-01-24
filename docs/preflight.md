# Preflight Checks

## Overview

Preflight checks analyze your service before execution to identify potential issues related to resource allocation, performance, and configuration.

## Available Checks

### Memory Allocation
Estimates required memory based on dependency count and compares against configured limits.

**Formula:**
```
estimated_memory = BASE_MEMORY (50MB) + (dependency_count * 2MB)
```

**Status:**
- PASS: Configured memory > estimated need
- WARN: Configured memory close to estimated need
- FAIL: Configured memory < 80% of estimated need

### Dependency Count
Analyzes `node_modules` for potential cold start impact.

**Thresholds:**
- < 50 dependencies: PASS
- 50-100 dependencies: PASS with note
- > 100 dependencies: WARN

### Timeout Configuration
Validates timeout settings are within acceptable ranges.

**Thresholds:**
- Minimum: 100ms
- Maximum recommended: 30,000ms

### Image Size (when image exists)
Checks Docker image size for deployment concerns.

**Thresholds:**
- < 500MB: PASS
- 500-1000MB: WARN
- > 1000MB: FAIL

## Running Preflight

```bash
ignite preflight ./my-service
```

## Interpreting Results

Each check returns:
- **name**: Check identifier
- **status**: pass | warn | fail
- **message**: Human-readable explanation
- **value**: Measured value
- **threshold**: Comparison threshold

## Customizing Thresholds

Thresholds are currently hardcoded. Future versions will support configuration via `service.yaml`:

```yaml
service:
  name: my-service
  preflight:
    memory_buffer: 1.5
    max_dependencies: 150
```
