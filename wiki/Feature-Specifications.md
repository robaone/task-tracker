# Feature Specifications

This project uses **Gherkin feature files** (BDD) to define behavior. Feature files live in the `features/` directory.

## Init

**File:** `features/task-init.feature`

Configure the CLI to point at an existing task store.

### Scenarios

- **Configure local JSON backend** — Interactive prompt to select `json` backend, specify path to an existing JSON file, and generate `.task-tracker.json` config
- **Configure GitHub Issues backend** — Interactive prompt to select `github` backend, specify `owner/repo` and token environment variable name

### Key behaviors

- No files are created or modified in the task store
- The configuration file `.task-tracker.json` is created in the current directory
- The user is prompted for connection details appropriate to the selected backend

## List Tasks

**File:** `features/task-list.feature`

List tasks with status filtering.

### Scenarios

- **Filter by `in_progress`** — Only tasks with that status appear in output
- **Filter by `todo`** — Multiple pending tasks are listed, completed ones excluded
- **Filter by `done`** — Completed tasks shown, others excluded

### Key behaviors

- Output is plain text, one task per line with id and title
- Filtering is case-sensitive and exact match
- Empty results produce no output (exit code 0)

## Download Task

**File:** `features/task-download.feature`

Export a task to a JSON file.

### Scenarios

- **Download a specific task by ID** — Given a task exists, running `task-tracker download TASK-001 -o $TEMP/export.json` produces a file containing the task data

### Key behaviors

- Output file contains the full task object as JSON
- File path is customizable via `-o` flag

## Review Prep

**File:** `features/task-review-prep.feature`

Prepare a code review context bundle from a task. This is the **primary workflow** for the project.

### Scenarios

- **Full review context** — Task with comments, attachments, and references produces a complete output directory with `context.md`, `ticket.json`, `diff.patch`, and `attachments/`
- **No comments or attachments** — Task with no discussion or files still produces a valid bundle, omitting empty sections from `context.md`
- **Explicit base branch** — `--base develop` overrides auto-detection; the diff section and `diff.patch` reflect this
- **Task not found** — Non-existent task produces a non-zero exit code and an error message containing "not found"
- **Default output directory** — Running without `--out` creates `./review-<id>/` in the current directory

### Output verification

The `context.md` file must contain:
- Task title and status
- Task description
- Git diffstat and diff content
- Comments section (when comments exist)
- No "## Comments" heading (when no comments exist)

The directory structure must include:
- `context.md` — Always present
- `ticket.json` — Always present
- `diff.patch` — Present when diff is computed
- `attachments/` — Created even if empty
