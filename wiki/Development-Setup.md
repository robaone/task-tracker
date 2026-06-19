# Development Setup

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Git

## Getting Started

> If you don't see a `package.json` at the repo root yet, the TypeScript/Node implementation hasn't been bootstrapped—start with [Implementation Plan](./Implementation-Plan.md) Phase 1, then run the commands below.
```bash
# Clone the repository
git clone git@github.com:robaone/task-tracker.git
cd task-tracker

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check
npm run typecheck

# Lint
npm run lint
```

## Planned Project Structure

> This is the intended layout once the TypeScript implementation exists (see [Implementation Plan](./Implementation-Plan.md)).
```
task-tracker/
├── src/
│   ├── types.ts            # Core types
│   ├── provider.ts         # TaskProvider interface
│   ├── registry.ts         # Provider registry
│   ├── providers/
│   │   └── json.ts         # Local JSON backend
│   ├── diff.ts             # Git diff module
│   ├── bundler.ts          # Review bundle orchestrator
│   ├── cli.ts              # CLI entry point
│   └── index.ts            # Public API barrel
├── tests/
│   ├── json.test.ts
│   └── diff.test.ts
├── features/               # Gherkin feature files
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Technology Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript |
| Runtime | Node.js |
| CLI framework | Commander or Yargs |
| Testing | Vitest |
| Linting | ESLint |
| Formatting | Prettier |

## Testing

Tests are written using **Vitest** and follow the project structure:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest tests/json.test.ts
```

Feature files (`.feature` files in `features/`) describe behavior in Gherkin syntax and serve as acceptance criteria.

## Adding a New Provider

See [Providers](./Providers.md) for the full guide on implementing and registering new backends.

## Code Style

- TypeScript with strict mode
- No classes where plain functions/interfaces suffice
- Read-only interfaces only — no DTOs or write models
- Async/await throughout
- Descriptive variable names, minimal comments
