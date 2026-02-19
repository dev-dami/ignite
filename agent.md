# AGENTS.md

This guide tells coding agents how to work safely and effectively in this repository.

## Core Rule

- Use Bun for all package installs and scripts.
- Never use npm.

## Repository Map

- `packages/core`: sandbox lifecycle, loaders, preflight, execution engine.
- `packages/cli`: `ignite` CLI commands.
- `packages/http`: HTTP server surface for sandbox execution.
- `packages/shared`: shared types/utilities used across packages.
- `packages/runtime-bun`: Bun runtime image files.
- `examples/*`: sample services used for smoke/manual verification.
- `docs/*`: user-facing docs and architecture notes.
- `scripts/*`: release/build helper scripts.

## Local Workflow

1. Install deps: `bun install`
2. Build all packages: `bun run build`
3. Run lint: `bun run lint`
4. Run typecheck: `bun run typecheck`
5. Run tests:
   - Unit-only (fast): `bun run test:unit`
   - Full suite (requires Docker): `bun run test`

## Change Rules

- Keep changes scoped to the task; avoid drive-by refactors.
- When behavior changes, add or update tests in the relevant package.
- If CLI/API behavior changes, update docs in `README.md` and/or `docs/*`.
- Use existing naming patterns and file structure within each package.
- Prefer small, composable functions over large rewrites.

## Security Guardrails (Important)

Ignite runs untrusted code. Treat security defaults as product-critical.

- Do not weaken sandbox restrictions (network/filesystem/capabilities) without explicit task requirements.
- If security logic changes, include tests that prove both allowed and blocked behavior.
- Never introduce secrets, tokens, or host-specific paths into committed code.

## Validation Matrix

- `packages/shared` change: run `bun run build`, `bun run test:unit`.
- `packages/core` change: run `bun run test:unit`; run `bun run test` if execution behavior changed.
- `packages/cli` change: run `bun run test:unit`; manually smoke command paths when possible.
- `packages/http` change: run `bun run test:unit`; verify request/response behavior for changed endpoints.
- `docs`-only change: lint/typecheck optional, tests not required.

## Commit & PR Hygiene

- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Keep PRs focused and include a short verification summary (commands run + results).
- Mention Docker dependency when full test suite could not be run.
