# Benchmark Results

This file stores a recent benchmark snapshot and guidance for interpretation.

## Snapshot

**Date**: 2026-01-24T11:41:56.655Z

### Environment

| Property | Value |
|---|---|
| Platform | linux |
| Architecture | x64 |
| Docker | Docker version 29.1.5, build 0e6fee6 |
| Bun | 1.3.6 |

### Results

| Benchmark | Mean | Min | Max | Std Dev |
|---|---:|---:|---:|---:|
| Cold Start | 232ms | 194ms | 448ms | 73ms |
| Warm Start | 227ms | 185ms | 301ms | 34ms |
| Docker Overhead | 2108ms | 1374ms | 7616ms | 1840ms |
| Audit Mode Overhead | 10ms | -15ms | 54ms | 20ms |

## Interpretation Notes

- Warm and cold start include Docker behavior and service startup behavior.
- Docker overhead is mostly container startup cost, not Ignite-only logic.
- Audit overhead near zero indicates little additional overhead for security flags in this run.
- Large std dev in Docker overhead indicates host-level variability.

## Re-run Benchmarks

```bash
bun run scripts/benchmark.ts
```

Outputs:

- `benchmarks/results.md`
- `benchmarks/results.json`

For deeper methodology guidance, see `docs/research.md`.
