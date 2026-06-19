import * as fs from 'fs'
import * as path from 'path'
import { TaskProvider } from '../provider'
import { Task, TaskStatus, TaskFilter, Comment, Attachment, Reference, Priority } from '../types'

export interface GitHubProviderConfig {
  repo: string
  token: string
}

interface GitHubLabel {
  name: string
}

interface GitHubUser {
  login: string
}

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  labels: GitHubLabel[]
  assignee: GitHubUser | null
  assignees: GitHubUser[]
  created_at: string
  updated_at: string
  html_url: string
  pull_request?: unknown
}

interface GitHubComment {
  id: number
  user: GitHubUser
  body: string
  created_at: string
}

interface GitHubSearchResult {
  items: GitHubIssue[]
  total_count: number
}

const STATUS_LABELS = ['in progress', 'in_progress', 'in review', 'blocked']

export class GitHubProvider implements TaskProvider {
  private owner: string
  private repo: string

  constructor(private config: GitHubProviderConfig) {
    const parts = config.repo.split('/')
    if (parts.length !== 2) {
      throw new Error(`Invalid repo format: "${config.repo}". Expected "owner/repo".`)
    }
    this.owner = parts[0]
    this.repo = parts[1]
  }

  private async apiRequest<T>(path: string): Promise<T> {
    const url = `https://api.github.com${path}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'task-tracker',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API error (${res.status}): ${body || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  private mapStatus(issue: GitHubIssue): TaskStatus {
    if (issue.state === 'closed') return 'done'
    const labelNames = issue.labels.map(l => l.name.toLowerCase())
    const hasStatusLabel = STATUS_LABELS.some(s => labelNames.includes(s))
    return hasStatusLabel ? 'in_progress' : 'todo'
  }

  private mapPriority(labels: GitHubLabel[]): Priority {
    for (const label of labels) {
      const n = label.name.toLowerCase()
      if (n === 'critical' || n === 'p0') return 'critical'
      if (n === 'high' || n === 'p1') return 'high'
      if (n === 'medium' || n === 'p2') return 'medium'
      if (n === 'low' || n === 'p3') return 'low'
    }
    return 'medium'
  }

  private mapIssueToTask(issue: GitHubIssue): Task {
    const assigneeName = issue.assignee?.login ?? issue.assignees?.[0]?.login
    return {
      id: String(issue.number),
      title: issue.title,
      description: issue.body ?? '',
      status: this.mapStatus(issue),
      priority: this.mapPriority(issue.labels),
      labels: issue.labels.map(l => l.name),
      assignee: assigneeName,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      metadata: {
        repo: this.config.repo,
        number: issue.number,
        state: issue.state,
      },
    }
  }

  private buildListQuery(filter?: TaskFilter): string {
    const params = new URLSearchParams()
    params.set('per_page', '100')
    params.set('state', 'all')
    if (filter?.status === 'done') {
      params.set('state', 'closed')
    } else if (filter?.status) {
      params.set('state', 'open')
    }
    if (filter?.labels && filter.labels.length > 0) {
      params.set('labels', filter.labels.join(','))
    }
    if (filter?.assignee) {
      params.set('assignee', filter.assignee)
    }
    params.set('sort', 'updated')
    params.set('direction', 'desc')
    return params.toString()
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    const query = this.buildListQuery(filter)
    const issues = await this.apiRequest<GitHubIssue[]>(
      `/repos/${this.owner}/${this.repo}/issues?${query}`
    )

    const tasks = issues
      .filter(i => !i.pull_request)
      .map(i => this.mapIssueToTask(i))

    if (filter) {
      if (filter.priority) {
        return tasks.filter(t => t.priority === filter.priority)
      }
    }

    return tasks
  }

  async get(id: string): Promise<Task> {
    const issue = await this.apiRequest<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${id}`
    )
    return this.mapIssueToTask(issue)
  }

  async search(query: string): Promise<Task[]> {
    const encoded = encodeURIComponent(`${query} repo:${this.config.repo}`)
    const result = await this.apiRequest<GitHubSearchResult>(
      `/search/issues?q=${encoded}&per_page=50`
    )
    return result.items
      .filter(i => !i.pull_request)
      .map(i => this.mapIssueToTask(i))
  }

  async getComments(taskId: string): Promise<Comment[]> {
    const comments = await this.apiRequest<GitHubComment[]>(
      `/repos/${this.owner}/${this.repo}/issues/${taskId}/comments`
    )
    return comments.map(c => ({
      id: String(c.id),
      author: c.user?.login ?? 'unknown',
      body: c.body,
      createdAt: c.created_at,
    }))
  }

  async getAttachments(_taskId: string): Promise<Attachment[]> {
    return []
  }

  async downloadAttachment(_taskId: string, _attachmentId: string, _destDir: string): Promise<string> {
    throw new Error('Attachments not supported by GitHub provider')
  }

  async getReferences(taskId: string): Promise<Reference[]> {
    const issue = await this.apiRequest<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${taskId}`
    )
    const refs: Reference[] = []
    if (issue.body) {
      const pattern = /(#\d+)|([\w-]+\/[\w-]+#\d+)/g
      const matches = issue.body.match(pattern)
      if (matches) {
        const seen = new Set<string>()
        for (const match of matches) {
          if (!seen.has(match)) {
            seen.add(match)
            refs.push({
              id: match,
              title: `Referenced issue ${match}`,
              url: match.startsWith('#')
                ? `https://github.com/${this.config.repo}/issues/${match.slice(1)}`
                : `https://github.com/${match.replace('#', '/issues/')}`,
              type: 'ticket',
            })
          }
        }
      }
    }
    return refs
  }
}
