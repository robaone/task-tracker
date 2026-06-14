# Task Tracker — Plan

## Goals

Build a local CLI tool that serves as a **single command for code review context retrieval**. It has two pillars:

1. **Task tracking** — language-agnostic abstraction for tracking tasks across backends (Jira, GitHub Issues, Linear, markdown files, etc.) with a common CRUD interface.
2. **Code review context** — given a task ID, fetch the task, its comments/attachments/references, compute the git diff against a base branch, and package everything into a structured directory ready for LLM consumption.

The primary driver is pillar 2 (the `review-prep` workflow). Pillar 1 exists to make pillar 2 work across different backends (work Jira, personal GitHub Issues, local markdown files).

## Stack

- **Language:** TypeScript / Node.js
- **Interface:** CLI tool (primary) + importable library (secondary)
- **Initial backend:** Local JSON files
- **CLI framework:** Commander or Yargs
- **Testing:** Vitest

---

## Phase 1: Core Data Model (`src/types.ts`)

### Task type & DTOs (original)

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
  metadata: Record<string, unknown>
}

type TaskStatus = 'todo' | 'in_progress' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'
```

DTOs:
- `CreateTaskInput` — partial type omitting `id`, `createdAt`, `updatedAt`
- `UpdateTaskInput` — partial type where all fields are optional

### Context types (new)

```ts
interface Attachment {
  id: string
  filename: string
  url?: string
  mimeType?: string
  sizeBytes?: number
}

interface Comment {
  id: string
  author: string
  body: string
  createdAt: string  // ISO 8601
}

interface Reference {
  id: string
  title: string
  url?: string
  type: 'ticket' | 'doc' | 'link' | 'file'
}

interface ReviewBundle {
  task: Task
  comments: Comment[]
  references: Reference[]
  attachments: Attachment[]
  diff?: string
  diffStat?: string  // shortstat summary e.g. "3 files changed, +45/-12"
  baseBranch: string
  bundlePath: string  // path to the output directory
}
```

### Filter type (new)

```ts
interface TaskFilter {
  status?: TaskStatus
  priority?: Priority
  labels?: string[]
  assignee?: string
}
```

---

## Phase 2: Provider Interface (`src/provider.ts`)

A `TaskProvider` interface that every backend implements. This is the contract for both CRUD and context retrieval.

```ts
interface TaskProvider {
  // CRUD
  list(filter?: TaskFilter): Promise<Task[]>
  get(id: string): Promise<Task>
  create(input: CreateTaskInput): Promise<Task>
  update(id: string, input: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
  search(query: string): Promise<Task[]>

  // Context retrieval
  getComments(taskId: string): Promise<Comment[]>
  getAttachments(taskId: string): Promise<Attachment[]>
  downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string>
  getReferences(taskId: string): Promise<Reference[]>
}
```

Methods that aren't supported by a given backend should return empty arrays (`[]`) rather than throwing. For example, a local JSON backend may have no attachments or comments.

---

## Phase 3: Diff Module (`src/diff.ts`)

Pure git integration. Not part of any provider — git is always available.

```ts
interface DiffOptions {
  base?: string        // default: auto-detect from remote tracking or "main"
  cwd?: string         // default: process.cwd()
}

interface DiffResult {
  diff: string         // unified diff output
  stat: string         // diffstat summary
  files: string[]      // list of changed files
  baseBranch: string   // resolved base branch
  branch: string       // current branch
}

function getDiff(options?: DiffOptions): Promise<DiffResult>
```

Auto-detection of base branch:
1. If `base` is provided, use it.
2. Otherwise, detect the current branch and find its upstream remote tracking branch.
3. Fall back to `main` or `master`.

---

## Phase 4: Bundler (`src/bundler.ts`)

Orchestrates provider + diff to produce a `review-prep` output directory.

```ts
interface BundleOptions {
  taskId: string
  provider: TaskProvider
  outDir?: string         // default: ./review-<taskId>
  baseBranch?: string     // passed to getDiff
  includeDiff?: boolean   // default: true
}

interface BundleResult extends ReviewBundle {
  bundlePath: string
}

async function createBundle(options: BundleOptions): Promise<BundleResult>
```

Output directory structure:

```
<outDir>/
├── context.md        # Single markdown file — the main LLM prompt
├── ticket.json       # Raw task + comments + references (for reference)
├── diff.patch        # Raw unified diff (for reference)
└── attachments/      # Downloaded reference materials
    ├── design-v2.png
    └── api-spec.yaml
```

The `context.md` file is the star — a formatted, token-efficient document containing everything an LLM needs to perform a code review:

```markdown
# Code Review: <id> — <title>

## Task Details
- **Status:** <status>
- **Priority:** <priority>
- **Labels:** <labels>

<description>

## Comments
<author> (<date>): <body>

## References
- <title> (<url>)

## Changes (vs <baseBranch>)
<diffstat>

<diff>
```

---

## Phase 5: Provider Registry (`src/registry.ts`)

Unchanged from original plan:

```ts
function registerProvider(name: string, factory: ProviderFactory): void
function createProvider(name: string, config?: ProviderConfig): TaskProvider
```

---

## Phase 6: CLI Layer (`src/cli.ts`)

### Task management commands (original)

```
task-tracker list [--status] [--priority] [--label]
task-tracker get <id>
task-tracker add <title> [--desc] [--priority] [--labels]
task-tracker update <id> [--title] [--status] [--priority] [--labels]
task-tracker delete <id>
task-tracker search <query>
task-tracker init
```

### Code review commands (new)

```
task-tracker review-prep <id> [--base main] [--out ./dir]
task-tracker diff [--base main]                    # just show the diff
```

`review-prep` is the primary workflow command. It:
1. Reads the config to determine which backend provider to use
2. Calls `provider.get(id)` and the context methods
3. Computes the git diff
4. Writes the output directory

---

## Phase 7: Library Export (`src/index.ts`)

Re-export everything for programmatic use:

```ts
import { TaskProvider, createProvider, createBundle, getDiff } from 'task-tracker'

const provider = createProvider('json', { path: './tasks.json' })
const bundle = await createBundle({
  taskId: 'TASK-001',
  provider,
  outDir: '/tmp/review'
})
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
│   ├── diff.ts             # Git diff module
│   ├── bundler.ts          # Review bundle orchestrator
│   ├── cli.ts              # CLI entry point
│   └── index.ts            # Public API barrel
├── tests/
│   ├── json.test.ts        # Tests for JSON provider
│   └── diff.test.ts        # Tests for diff module
├── features/               # Gherkin feature files
│   ├── task-list.feature
│   ├── task-init.feature
│   ├── task-download.feature
│   └── task-review-prep.feature
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Implementation Order

1. **Init project** — `npm init`, TypeScript, Vitest, ESLint/Prettier
2. **Types** — `src/types.ts` (Task + context types)
3. **Interface** — `src/provider.ts` (CRUD + context methods)
4. **JSON backend** — `src/providers/json.ts` + tests
5. **Registry** — `src/registry.ts`
6. **Diff module** — `src/diff.ts` + tests
7. **Bundler** — `src/bundler.ts`
8. **CLI** — `src/cli.ts` (CRUD + review-prep commands)
9. **Library barrel** — `src/index.ts`

---

## Future Backend Expansion

Adding a new backend (Jira, GitHub Issues, Linear, Trello, Notion, etc.) is always:
1. Create `src/providers/<name>.ts` implementing `TaskProvider`
2. Implement CRUD methods + context methods
3. Write tests
4. Register it in the registry
5. Done — CLI and library consumers get everything for free

Backend methods that can't be supported (e.g. `create` on a read-only Jira token) return empty results or throw a clear `NotSupportedError`.
