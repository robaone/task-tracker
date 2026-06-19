#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { createProvider, getRegisteredProviders } from './registry'
import { JsonProvider } from './providers/json'
import { TrelloProvider } from './providers/trello'
import { JiraProvider } from './providers/jira'
import { GitHubProvider } from './providers/github'
import { registerProvider } from './registry'
import { createBundle } from './bundler'
import { getDiff } from './diff'

registerProvider('json', (config) => new JsonProvider(config as { path: string }))
registerProvider('trello', (config) => new TrelloProvider(config as { apiKey: string; token: string; boardId: string }))
registerProvider('jira', (config) => new JiraProvider(config as { baseUrl: string; email: string; apiToken: string; project?: string }))
registerProvider('github', (config) => new GitHubProvider(config as { repo: string; token: string }))

interface Config {
  backend: string
  config: Record<string, unknown>
}

function loadConfig(): Config {
  const configPath = path.resolve(process.cwd(), '.task-tracker.json')
  if (!fs.existsSync(configPath)) {
    console.error('Error: Not initialized. Run "task-tracker init" first.')
    process.exit(2)
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

const program = new Command()

program
  .name('task-tracker')
  .description('CLI tool for code review context retrieval')
  .version('0.1.0')

program
  .command('init')
  .description('Configure the CLI to point at an existing task store')
  .action(async () => {
    const providers = getRegisteredProviders()
    console.log('Available backends:', providers.join(', '))
    console.log('')
    console.log('For interactive setup, please create .task-tracker.json manually:')
    console.log('')
    console.log('  Example for JSON backend:')
    console.log('  {')
    console.log('    "backend": "json",')
    console.log('    "config": {')
    console.log('      "path": "/path/to/tasks.json"')
    console.log('    }')
    console.log('  }')
    console.log('')
    console.log('  Example for Trello backend:')
    console.log('  {')
    console.log('    "backend": "trello",')
    console.log('    "config": {')
    console.log('      "apiKey": "your-trello-api-key",')
    console.log('      "token": "your-trello-token",')
    console.log('      "boardId": "your-board-id"')
    console.log('    }')
    console.log('  }')
    console.log('')
    console.log('  Example for Jira backend:')
    console.log('  {')
    console.log('    "backend": "jira",')
    console.log('    "config": {')
    console.log('      "baseUrl": "https://your-domain.atlassian.net",')
    console.log('      "email": "you@example.com",')
    console.log('      "apiToken": "your-jira-api-token",')
    console.log('      "project": "PROJ"')
    console.log('    }')
    console.log('  }')
    console.log('')
    console.log('  Example for GitHub Issues backend:')
    console.log('  {')
    console.log('    "backend": "github",')
    console.log('    "config": {')
    console.log('      "repo": "owner/repo",')
    console.log('      "token": "ghp_your-personal-access-token"')
    console.log('    }')
    console.log('  }')

    const configPath = path.resolve(process.cwd(), '.task-tracker.json')
    if (fs.existsSync(configPath)) {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      console.log('')
      console.log(`Current config: backend="${existing.backend}"`)
    }
  })

program
  .command('list')
  .description('List tasks with optional filtering')
  .option('--status <status>', 'Filter by status (todo, in_progress, done)')
  .option('--priority <priority>', 'Filter by priority (low, medium, high, critical)')
  .option('--label <label>', 'Filter by label (repeatable)', (val: string, acc: string[]) => acc.concat(val), [] as string[])
  .option('--assignee <assignee>', 'Filter by assignee')
  .action(async (opts) => {
    try {
      const cfg = loadConfig()
      const provider = createProvider(cfg.backend, cfg.config)
      const tasks = await provider.list({
        status: opts.status,
        priority: opts.priority,
        labels: opts.label.length > 0 ? opts.label : undefined,
        assignee: opts.assignee,
      })
      for (const task of tasks) {
        console.log(`${task.id}\t${task.title}\t${task.status}\t${task.priority}`)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program
  .command('get')
  .description('Get details of a specific task')
  .argument('<id>', 'Task ID')
  .action(async (id: string) => {
    try {
      const cfg = loadConfig()
      const provider = createProvider(cfg.backend, cfg.config)
      const task = await provider.get(id)
      console.log(JSON.stringify(task, null, 2))
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program
  .command('search')
  .description('Search for tasks by query string')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    try {
      const cfg = loadConfig()
      const provider = createProvider(cfg.backend, cfg.config)
      const tasks = await provider.search(query)
      for (const task of tasks) {
        console.log(`${task.id}\t${task.title}\t${task.status}`)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program
  .command('download')
  .description('Export a task to a JSON file')
  .argument('<id>', 'Task ID')
  .option('-o, --out <file>', 'Output file path')
  .action(async (id: string, opts: { out?: string }) => {
    try {
      const cfg = loadConfig()
      const provider = createProvider(cfg.backend, cfg.config)
      const task = await provider.get(id)
      const safeId = path.basename(id)
      const outPath = opts.out ? path.resolve(opts.out) : path.resolve(`${safeId}.json`)
      fs.writeFileSync(outPath, JSON.stringify(task, null, 2), 'utf-8')
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program
  .command('review-prep')
  .description('Prepare a code review context bundle from a task')
  .argument('<id>', 'Task ID')
  .option('--base <branch>', 'Base branch for git diff')
  .option('-o, --out <dir>', 'Output directory')
  .option('--no-diff', 'Skip git diff')
  .action(async (id: string, opts: { base?: string; out?: string; diff: boolean }) => {
    try {
      const cfg = loadConfig()
      const provider = createProvider(cfg.backend, cfg.config)
      const bundle = await createBundle({
        taskId: id,
        provider,
        outDir: opts.out,
        baseBranch: opts.base,
        includeDiff: opts.diff,
      })
      console.log(`Review bundle created at ${bundle.bundlePath}`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program
  .command('diff')
  .description('Show the git diff against a base branch')
  .option('--base <branch>', 'Base branch (default: auto-detected)')
  .action(async (opts: { base?: string }) => {
    try {
      const result = await getDiff({ base: opts.base })
      console.log(`Branch: ${result.branch}`)
      console.log(`Base:   ${result.baseBranch}`)
      console.log('')
      console.log(result.stat)
      console.log('')
      console.log(result.diff)
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error:', String(err))
      }
      process.exit(1)
    }
  })

program.parse(process.argv)
