# Task Tracker Abstraction — Plan

## Goals
Build a language-agnostic abstraction layer for task tracking tools (Jira, Trello, Obsidian, markdown files, etc.) behind a common interface. Start local, expand to cloud backends later.

## Stack
- **Language:** TypeScript / Node.js
- **Interface:** Both CLI tool and importable library
- **Initial backend:** Local JSON files only

---

## Phase 1: Core Data Model (`src/types.ts`)

Define the canonical task schema that every backend must conform to.

```ts
interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  labels: string[]
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
  metadata: Record<string, unknown>  // backend-specific extras
}

type TaskStatus = 'todo' | 'in_progress' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'
```

Plus DTOs for creating and updating:
- `CreateTaskInput` — partial type omitting `id`, `createdAt`, `updatedAt`
- `UpdateTaskInput` — partial type where all fields are optional

---

## Phase 2: Provider Interface (`src/provider.ts`)

A `TaskProvider` interface (or abstract class) that every backend implements. This is the contract.

```ts
interface TaskProvider {
  list(filter?: TaskFilter): Promise<Task[]>
  get(id: string): Promise<Task>
  create(input: CreateTaskInput): Promise<Task>
  update(id: string, input: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
  search(query: string): Promise<Task[]>
}
```

`TaskFilter` allows filtering by `status`, `priority`, `labels`, date ranges, etc.

---

## Phase 3: JSON File Backend (`src/providers/json.ts`)

Implement `TaskProvider` against a local JSON file.

- Reads/writes a single `tasks.json` file (or directory of per-task files)
- Handles atomic writes (write to temp, rename) to prevent corruption
- Serves as the reference implementation for testing the interface
- Zero external dependencies beyond Node built-ins

---

## Phase 4: Provider Registry (`src/registry.ts`)

A registry mapping string names to provider constructors / config factories.

```ts
function registerProvider(name: string, factory: ProviderFactory): void
function createProvider(name: string, config?: ProviderConfig): TaskProvider
```

This lets consumers say `"json"` and get the right backend wired up without knowing the class name.

---

## Phase 5: CLI Layer (`src/cli.ts`)

Using `commander` or `yargs`, expose these commands:

```
task-tracker list [--status] [--priority] [--label]
task-tracker get <id>
task-tracker add <title> [--desc] [--priority] [--labels]
task-tracker update <id> [--title] [--status] [--priority] [--labels]
task-tracker delete <id>
task-tracker search <query>
task-tracker init            # creates the tasks.json file
```

Every command calls `TaskProvider` — zero awareness of which backend is active.

---

## Phase 6: Library Export (`src/index.ts`)

Re-export everything so consumers can do:

```ts
import { TaskProvider, createProvider, Task, CreateTaskInput } from 'task-tracker'
const provider = createProvider('json', { path: './tasks.json' })
const tasks = await provider.list()
```

---

## Directory Structure

```
task-tracker/
├── src/
│   ├── types.ts            # Core types & DTOs
│   ├── provider.ts         # TaskProvider interface
│   ├── registry.ts         # Provider registry
│   ├── providers/
│   │   └── json.ts         # Local JSON backend
│   ├── cli.ts              # CLI entry point
│   └── index.ts            # Public API barrel
├── tests/
│   └── json.test.ts        # Tests for JSON provider
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Implementation Order

1. **Init project** — `npm init`, TypeScript, Vitest, ESLint/Prettier
2. **Types** — `src/types.ts`
3. **Interface** — `src/provider.ts`
4. **JSON backend** — `src/providers/json.ts` + tests
5. **Registry** — `src/registry.ts`
6. **CLI** — `src/cli.ts`
7. **Library barrel** — `src/index.ts`

---

## Future Expansion

Adding a new backend (Trello, Jira, Notion, etc.) is always:
1. Create `src/providers/<name>.ts` implementing `TaskProvider`
2. Write tests
3. Register it in the registry
4. Done — CLI and library consumers get it for free
