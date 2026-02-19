# Contributing to Ignite

Thanks for contributing. This guide covers local setup, engineering workflow, and release expectations.

## Prerequisites

- Bun `>= 1.3.0`
- Docker (required for full integration tests)

## Local Setup

```bash
git clone https://github.com/YOUR_USERNAME/ignite.git
cd ignite
bun install
bun run build
```

## Repository Layout

```text
ignite/
├── packages/
│   ├── cli/          # CLI commands and UX
│   ├── core/         # Service loading, runtime, preflight, execution
│   ├── http/         # HTTP API server
│   ├── shared/       # Shared types/errors/logging
│   └── runtime-bun/  # Runtime Dockerfile assets
├── docs/             # Product and design docs
├── examples/         # Example services
├── scripts/          # Build and release scripts
└── .github/workflows # CI/CD workflows
```

## Development Workflow

### 1) Create a branch

```bash
git checkout -b feature/your-change
```

### 2) Implement changes with tests

Use Bun for installs and scripts. Do not use npm.

### 3) Run checks

```bash
bun run lint
bun run typecheck
bun run test:unit
bun run test
```

Notes:
- `test:unit` excludes Docker-heavy suites.
- `test` is the full suite and requires Docker.

## Commit Style

We use Conventional Commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation change
- `refactor:` non-behavioral code refactor
- `test:` test changes
- `chore:` maintenance

Example:

```bash
git commit -m "feat(cli): validate runtime version overrides"
```

## Pull Requests

Please keep PRs scoped and include:

- clear summary
- rationale and behavioral impact
- verification commands and results
- docs updates for user-visible behavior changes

## CI and Release

CI (`.github/workflows/ci.yml`) runs on pushes and PRs:

1. `bun install --frozen-lockfile`
2. build
3. lint
4. typecheck
5. unit tests
6. full tests (Docker)

Release job runs on `v*` tags and:

- verifies tag version matches `package.json`
- builds binaries
- publishes archives and `SHA256SUMS`

### Local release script

```bash
bun run scripts/release.ts
```

The script now enforces:

- clean working tree
- branch detection (no hardcoded branch)
- pre-release checks (`lint`, `typecheck`, `test:unit`)

## Security Reporting

If you discover a vulnerability, please report privately to the maintainer instead of opening a public issue.
