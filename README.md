# Task Tracker

A CLI tool for code review context retrieval and task tracking. Given a task ID, it fetches the task details, comments, attachments, and references from your configured backend (Jira, GitHub Issues, local JSON, etc.), computes the git diff against a base branch, and packages everything into a structured directory ready for LLM consumption.

## Usage

```bash
# Primary workflow — prepare code review context
task-tracker review-prep TASK-001 --base main --out $TEMP/review

# Task management
task-tracker list [--status <todo|in_progress|done>]
task-tracker get <id>
task-tracker search <query>
task-tracker download <id> [-o file]

# Init
task-tracker init
```

## How it works

1. **Provider** fetches task data from your backend (JSON file, Jira API, GitHub Issues, etc.)
2. **Diff module** computes the git diff against the base branch
3. **Bundler** combines everything into a single output directory with a `context.md` file formatted for LLM consumption

See the [wiki](https://github.com/robaone/task-tracker/wiki) for architecture, CLI reference, provider docs, and more.
