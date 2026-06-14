# CLI Commands

## Configuration

### `task-tracker init`

Configure the CLI to point at an existing task store. Prompts for backend selection and connection details. No files are created or modified in the task store — this only creates the local `.task-tracker.json` configuration file.

```
task-tracker init
```

## Task Operations (Read-Only)

### `task-tracker list`

List tasks with optional filtering.

```bash
task-tracker list
task-tracker list --status todo
task-tracker list --status in_progress
task-tracker list --status done
task-tracker list --priority high
task-tracker list --label bug
```

| Flag | Description |
|------|-------------|
| `--status` | Filter by status (`todo`, `in_progress`, `done`) |
| `--priority` | Filter by priority (`low`, `medium`, `high`, `critical`) |
| `--label` | Filter by label |
| `--assignee` | Filter by assignee |

### `task-tracker get`

Get details of a specific task.

```bash
task-tracker get TASK-001
```

### `task-tracker search`

Search for tasks by query string.

```bash
task-tracker search "login bug"
task-tracker search "auth"
```

### `task-tracker download`

Export a task to a JSON file.

```bash
task-tracker download TASK-001
task-tracker download TASK-001 -o /path/to/export.json
```

| Flag | Description |
|------|-------------|
| `-o, --out` | Output file path (default: `<id>.json`) |

## Code Review Commands

### `task-tracker review-prep` (Primary)

Prepare a complete code review context bundle from a task. This is the **main workflow command** — it fetches the task, comments, attachments, and references from the configured backend, computes the git diff, and packages everything into a structured output directory.

```bash
task-tracker review-prep TASK-001
task-tracker review-prep TASK-001 --base main
task-tracker review-prep TASK-001 --base main --out /tmp/review
task-tracker review-prep TASK-001 --no-diff
```

| Flag | Description |
|------|-------------|
| `--base` | Base branch for git diff (default: auto-detected) |
| `-o, --out` | Output directory path (default: `./review-<id>`) |
| `--no-diff` | Skip git diff (useful for non-code tasks) |

### `task-tracker diff`

Show the git diff against a base branch without any task context.

```bash
task-tracker diff
task-tracker diff --base main
task-tracker diff --base develop
```

| Flag | Description |
|------|-------------|
| `--base` | Base branch (default: auto-detected) |

## Output Directory Structure

```
<outDir>/
├── context.md        # Main LLM prompt — everything an LLM needs
├── ticket.json       # Raw task data (for reference/debugging)
├── diff.patch        # Raw unified diff (for reference)
└── attachments/      # Downloaded attachments
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error (e.g., task not found, provider error) |
| `2` | Configuration error (not initialized, invalid config) |
