# Preflight Checks

Preflight checks run before execution to surface configuration risk early.

## What Is Evaluated

- memory sizing
- dependency load
- timeout configuration
- image size (when image name is available)

## Check Semantics

Each check returns:

- `name`
- `status` (`pass`, `warn`, `fail`)
- `message`
- optional `value`
- optional `threshold`

Overall preflight status:

- `fail` if any check fails
- `warn` if no failures and at least one warning
- `pass` otherwise

## Run Manually

```bash
ignite preflight ./my-service
```

## Preflight During `ignite run`

`ignite run` performs preflight as part of execution flow.

- default behavior: `fail` status blocks execution
- with `--skip-preflight`: run continues even if preflight returns `fail`

## Custom Thresholds (`service.yaml`)

```yaml
preflight:
  memory:
    baseMb: 60
    perDependencyMb: 3
    warnRatio: 1
    failRatio: 0.85
  dependencies:
    warnCount: 120
    infoCount: 60
  image:
    warnMb: 600
    failMb: 1200
  timeout:
    minMs: 200
    maxMs: 45000
    coldStartBufferMs: 750
```

Validation rules:

- all numeric fields must be positive
- ratio/count pairs must satisfy ordering constraints
- invalid preflight config causes service validation failure
