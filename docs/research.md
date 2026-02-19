# Research Notes

This document collects reproducibility guidance, benchmark interpretation, and security evaluation pointers for Ignite.

## Scope

Use this document when:

- evaluating runtime overhead
- comparing audit and non-audit execution paths
- documenting security assumptions for internal reviews

## Benchmark Methodology

Current benchmark script:

```bash
bun run scripts/benchmark.ts
```

Primary outputs:

- `benchmarks/results.md`
- `benchmarks/results.json`

Benchmark categories:

- cold start
- warm start
- docker overhead vs native
- audit mode overhead

## Reproducibility Checklist

Before collecting numbers:

1. pin Bun and Docker versions
2. record CPU model, core count, and memory
3. minimize background load
4. run multiple iterations and warmups
5. keep service fixture stable between runs

## Interpreting Results Safely

- warm/cold numbers include Docker behavior, not only Ignite overhead
- docker overhead baseline should be measured independently
- small negative deltas in audit overhead can occur from run variance
- compare medians or percentile bands in addition to mean

## Security Evaluation Topics

For threat analysis and review reports, include:

- trust boundary definition (host, Docker, service code)
- network and filesystem restrictions under audit mode
- policy coverage limits (what is not enforced)
- API exposure controls (auth, rate limits, host binding)
- runtime and dependency surface area

## Suggested Internal Study Plan

1. baseline preflight and execution on sample workloads
2. stress test memory/time limits and failure modes
3. adversarial tests (network/file/process attempts) in audit mode
4. HTTP endpoint abuse tests (auth/rate limit)
5. repeatability validation across machines/runners

## Artifacts for Reports

When producing a report for stakeholders, include:

- commit SHA
- benchmark raw JSON
- environment details
- test command outputs
- known limitations and caveats
