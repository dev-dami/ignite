# Contributing to Ignite

Thanks for your interest in contributing to Ignite! This document outlines the process for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ignite.git
   cd ignite
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Build the project:
   ```bash
   bun run build
   ```

## Development Workflow

### Running Tests

```bash
# Unit tests only (no Docker required)
bun run test:unit

# All tests (requires Docker)
bun run test
```

### Building

```bash
# Build all packages
bun run build

# Build binaries
bun run scripts/build-binaries.ts
```

### Project Structure

```
ignite/
├── packages/
│   ├── cli/       # Command-line interface
│   ├── core/      # Core functionality (loader, preflight, execution)
│   ├── http/      # HTTP server
│   ├── shared/    # Shared types and utilities
│   └── runtime-bun/   # Bun runtime Dockerfile
├── examples/      # Example services
├── docs/          # Documentation
└── scripts/       # Build scripts
```

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Ensure tests pass:
   ```bash
   bun run test:unit
   ```

4. Commit your changes:
   ```bash
   git commit -m "feat: add your feature"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes
- Follow the existing code style

## Reporting Issues

When reporting issues, please include:

- Ignite version (`ignite --version`)
- Operating system and version
- Docker version (`docker --version`)
- Steps to reproduce
- Expected vs actual behavior

## Questions?

Feel free to open an issue for questions or discussions.
