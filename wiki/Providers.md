# Providers

Task Tracker uses a **provider abstraction** to support multiple task management backends through a single read-only interface.

## Planned Providers

### JSON (local file)

Reads tasks from a local JSON file. Tasks are managed externally (by whatever tool writes to that file); Task Tracker never modifies them.

```json
[
  {
    "id": "TASK-001",
    "title": "Fix login bug",
    "description": "Users cannot log in after session timeout",
    "status": "in_progress",
    "priority": "high",
    "labels": ["bug", "auth"],
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-16T14:30:00Z"
  }
]
```

Configure via `task-tracker init` and selecting `json` backend.

## Provider Interface

Every backend implements this contract:

```typescript
interface TaskProvider {
  // Read operations
  list(filter?: TaskFilter): Promise<Task[]>
  get(id: string): Promise<Task>
  search(query: string): Promise<Task[]>

  // Context retrieval
  getComments(taskId: string): Promise<Comment[]>
  getAttachments(taskId: string): Promise<Attachment[]>
  downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string>
  getReferences(taskId: string): Promise<Reference[]>
}

interface TaskFilter {
  status?: 'todo' | 'in_progress' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  labels?: string[]
  assignee?: string
}
```

Methods that aren't supported by a given backend return **empty arrays** (`[]`) rather than throwing. The interface is designed to be entirely safe to call — any method can fail with a clear error, but unsupported features degrade gracefully.

## Adding a New Backend

Adding a new backend (Jira, GitHub Issues, Linear, Trello, Notion, etc.) is straightforward:

1. Create `src/providers/<name>.ts` implementing `TaskProvider`
2. Implement all read-only methods (`list`, `get`, `search`) + context methods
3. Write tests
4. Register it in the registry

```typescript
// src/providers/jira.ts
import { TaskProvider, Task, Comment, Attachment, Reference, TaskFilter } from '../types'

export class JiraProvider implements TaskProvider {
  constructor(private config: { baseUrl: string; token: string }) {}

  async list(filter?: TaskFilter): Promise<Task[]> {
    // Call Jira REST API, map results to Task[]
  }

  async get(id: string): Promise<Task> {
    // GET /rest/api/3/issue/{id}
  }

  // ... implement remaining methods
}
```

```typescript
// Register in src/registry.ts
registerProvider('jira', (config) => new JiraProvider(config))
```

Since the interface is read-only, every backend is expected to support all methods. Context methods like `getAttachments` may return `[]` if not applicable. No `NotSupportedError` is needed — the interface simply doesn't include write operations.

## Planned Backends

| Backend | Status | Notes |
|---------|--------|-------|
| JSON (local) | Planned | Phase 1 implementation |
| GitHub Issues | Planned | Via GitHub REST API |
| Jira | Future | Via Jira REST API |
| Linear | Future | Via Linear GraphQL API |
| Trello | Future | Via Trello REST API |
| Notion | Future | Via Notion API |

## Configuration

The `.task-tracker.json` configuration file specifies which backend to use:

```json
{
  "backend": "json",
  "config": {
    "path": "/home/user/tasks.json"
  }
}
```

```json
{
  "backend": "github",
  "config": {
    "repo": "my-org/my-repo",
    "tokenEnv": "GITHUB_TOKEN"
  }
}
```
