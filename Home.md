# Task Tracker

**A CLI tool for code review context retrieval.** Given a task ID, it fetches the ticket, comments, attachments, and git diff, then packages everything into a token-efficient directory ready for LLM consumption.

## Goal

Reduce token usage in AI-assisted code review by curating exactly what the LLM needs — no raw firehose, no noise, just the task, the discussion, and the diff.

## Key Docs

- **[Architecture](wiki/Architecture)** — System design, types, provider interface, and data flow
- **[CLI Commands](wiki/CLI-Commands)** — Full command reference with examples
- **[Providers](wiki/Providers)** — Backend abstraction and how to add new ones
- **[Feature Specifications](wiki/Feature-Specifications)** — Gherkin BDD specs for all behaviors
- **[Development Setup](wiki/Development-Setup)** — Build, test, and contribute
- **[Implementation Plan](wiki/Implementation-Plan)** — Phased roadmap from project init to complete CLI
