# Implementation Plan

The project is implemented in **phases**, with each phase building on the previous one. The first phase establishes the foundation; the last phase delivers the complete CLI and library.

## Phase 1: Init Project

- [ ] `npm init`, install TypeScript, Vitest, ESLint, Prettier
- [ ] Configure `tsconfig.json` (strict mode)
- [ ] Configure `vitest.config.ts`
- [ ] Set up npm scripts (`test`, `typecheck`, `lint`, `build`)
- [ ] Create `src/` and `tests/` directory structure

## Phase 2: Core Types (`src/types.ts`)

- [ ] Define `Task` interface (read-only, no DTOs)
- [ ] Define `TaskStatus` and `Priority` union types
- [ ] Define context types: `Attachment`, `Comment`, `Reference`, `ReviewBundle`
- [ ] Define `TaskFilter` interface

## Phase 3: Provider Interface (`src/provider.ts`)

- [ ] Define `TaskProvider` interface (read-only + context methods)
- [ ] Import types from `src/types.ts`

## Phase 4: JSON Backend (`src/providers/json.ts`)

- [ ] Implement `TaskProvider` for local JSON files
- [ ] Read-only: parse file, filter, search
- [ ] Context methods return `[]` for unsupported features
- [ ] Write tests in `tests/json.test.ts`

## Phase 5: Provider Registry (`src/registry.ts`)

- [ ] Implement `registerProvider` and `createProvider` functions
- [ ] Auto-register built-in providers

## Phase 6: Diff Module (`src/diff.ts`)

- [ ] Implement `getDiff` with base branch auto-detection
- [ ] Return unified diff, diffstat, changed files list
- [ ] Write tests in `tests/diff.test.ts`

## Phase 7: Bundler (`src/bundler.ts`)

- [ ] Implement `createBundle` orchestrator
- [ ] Generate `context.md` in token-efficient format
- [ ] Write raw task JSON and diff patch files
- [ ] Download attachments to `attachments/` directory

## Phase 8: CLI Layer (`src/cli.ts`)

- [ ] Implement `init` command (interactive backend config)
- [ ] Implement `list` command (with status/priority/label filters)
- [ ] Implement `get` command (single task details)
- [ ] Implement `search` command (query-based)
- [ ] Implement `download` command (export to JSON)
- [ ] Implement `review-prep` command (primary workflow)
- [ ] Implement `diff` command (standalone git diff)

## Phase 9: Library Barrel (`src/index.ts`)

- [ ] Re-export all public types and functions
- [ ] Ensure programmatic usage works (see Architecture page)

## Future Backends

After the core is complete, add backends in priority order:

- **GitHub Issues** — Via Octokit / GitHub REST API
- **Jira** — Via Jira REST API
- **Linear** — Via Linear GraphQL API
- **Trello** — Via Trello REST API
- **Notion** — Via Notion API

Each new backend requires:
1. Create `src/providers/<name>.ts`
2. Implement `TaskProvider`
3. Write tests
4. Register in registry
