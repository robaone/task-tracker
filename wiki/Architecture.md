# Architecture

## Overview

Task Tracker follows a **modular, interface-driven architecture** with four main components. The data flow is unidirectional — commands flow from the CLI layer down through the bundler to the provider and diff module, and results bubble back up as structured data.

```
CLI Layer (src/cli.ts)
    |
    v
Bundler (src/bundler.ts)
    |
    +---> Provider (src/provider.ts)
    |         |
    |         +---> JSON backend
    |         +---> Jira backend
    |         +---> GitHub Issues backend
    |
    +---> Diff Module (src/diff.ts)
```

## Core Types (`src/types.ts`)

The central data model has two families of types:

### Task (read-only)

```typescript
interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus          // 'todo' | 'in_progress' | 'done'
  priority: Priority          // 'low' | 'medium' | 'high' | 'critical'
  labels: string[]
  assignee?: string
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
  url?: string
  metadata: Record<string, unknown>
}
```

### Context Types (for review bundles)

```typescript
interface ReviewBundle {
  task: Task
  comments: Comment[]
  references: Reference[]
  attachments: Attachment[]
  diff?: string
  diffStat?: string
  baseBranch: string
  bundlePath: string
}

interface Comment {
  id: string
  author: string
  body: string
  createdAt: string
}

interface Reference {
  id: string
  title: string
  url?: string
  type: 'ticket' | 'doc' | 'link' | 'file'
}

interface Attachment {
  id: string
  filename: string
  url?: string
  mimeType?: string
  sizeBytes?: number
}
```

## Provider Interface (`src/provider.ts`)

Every backend implements the `TaskProvider` contract:

```typescript
interface TaskProvider {
  list(filter?: TaskFilter): Promise<Task[]>
  get(id: string): Promise<Task>
  search(query: string): Promise<Task[]>
  getComments(taskId: string): Promise<Comment[]>
  getAttachments(taskId: string): Promise<Attachment[]>
  downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string>
  getReferences(taskId: string): Promise<Reference[]>
}
```

Unsupported list-returning methods return empty arrays (`[]`) rather than throwing; providers should return `undefined` or throw a clear error for unsupported downloads.

## Diff Module (`src/diff.ts`)

Pure git integration — not part of any provider since git is always available.

```typescript
interface DiffOptions {
  base?: string    // default: auto-detect from remote tracking or "main"
  cwd?: string     // default: process.cwd()
}

interface DiffResult {
  diff: string     // unified diff output
  stat: string     // diffstat summary
  files: string[]  // list of changed files
  baseBranch: string
  branch: string
}
```

Base branch auto-detection:
1. Use `base` option if provided
2. Otherwise, find upstream remote tracking branch
3. Fall back to `main` or `master`

## Bundler (`src/bundler.ts`)

Orchestrates provider + diff to produce the output directory:

```
<outDir>/
├── context.md        # Main LLM prompt (token-efficient)
├── ticket.json       # Raw task data (for reference)
├── diff.patch        # Raw unified diff (for reference)
└── attachments/      # Downloaded reference materials
    ├── design-v2.png
    └── api-spec.yaml
```

The `context.md` format:

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

## Provider Registry (`src/registry.ts`)

```typescript
function registerProvider(name: string, factory: ProviderFactory): void
function createProvider(name: string, config?: ProviderConfig): TaskProvider
```

## Library Export (`src/index.ts`)

Everything is re-exported for programmatic use:

```typescript
import { TaskProvider, createProvider, createBundle, getDiff } from 'task-tracker'

const provider = createProvider('json', { path: './tasks.json' })
const bundle = await createBundle({
  taskId: 'TASK-001',
  provider,
  outDir: '/tmp/review'
})
```
