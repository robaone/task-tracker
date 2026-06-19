import * as fs from 'fs'
import * as path from 'path'
import { TaskProvider } from '../provider'
import { Task, TaskStatus, TaskFilter, Comment, Attachment, Reference, Priority } from '../types'

export interface JiraProviderConfig {
  baseUrl: string
  email: string
  apiToken: string
  project?: string
}

interface JiraUser {
  displayName?: string
  emailAddress?: string
  accountId?: string
}

interface JiraPriority {
  name: string
}

interface JiraStatus {
  name: string
}

interface JiraAttachment {
  id: string
  filename: string
  content: string
  mimeType: string
  size: number
}

interface JiraComment {
  id: string
  author: JiraUser
  body: unknown
  created: string
}

interface JiraIssue {
  id: string
  key: string
  self: string
  fields: {
    summary?: string
    description?: unknown
    status?: JiraStatus
    priority?: JiraPriority
    labels?: string[]
    assignee?: JiraUser | null
    creator?: JiraUser
    reporter?: JiraUser
    created?: string
    updated?: string
    comment?: {
      comments: JiraComment[]
      total: number
    }
    attachment?: JiraAttachment[]
    issuelinks?: Array<{
      id: string
      type?: { name: string; inward: string; outward: string }
      inwardIssue?: { key: string; fields: { summary?: string } }
      outwardIssue?: { key: string; fields: { summary?: string } }
    }>
    [key: string]: unknown
  }
}

interface JiraSearchResult {
  issues: JiraIssue[]
  total: number
  maxResults: number
  startAt: number
}

const STATUS_MAP: Record<string, TaskStatus> = {
  'to do': 'todo',
  'todo': 'todo',
  'backlog': 'todo',
  'selected for development': 'todo',
  'in progress': 'in_progress',
  'in review': 'in_progress',
  'in revision': 'in_progress',
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
  'complete': 'done',
  'completed': 'done',
}

const PRIORITY_MAP: Record<string, Priority> = {
  'highest': 'critical',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
  'lowest': 'low',
}

function extractTextFromAdf(node: unknown): string {
  if (!node || typeof node !== 'object') return String(node ?? '')
  const obj = node as Record<string, unknown>
  if (obj.text && typeof obj.text === 'string') return obj.text
  if (Array.isArray(obj.content)) {
    return (obj.content as unknown[]).map(extractTextFromAdf).join('')
  }
  return ''
}

export class JiraProvider implements TaskProvider {
  private authHeader: string

  constructor(private config: JiraProviderConfig) {
    const encoded = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    this.authHeader = `Basic ${encoded}`
  }

  private baseApiUrl(): string {
    return `${this.config.baseUrl.replace(/\/$/, '')}/rest/api/3`
  }

  private async apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseApiUrl()}${path}`
    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Jira API error (${res.status}): ${text || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  private getDefaultJql(): string {
    if (this.config.project) {
      return `project = "${this.config.project}" ORDER BY updated DESC`
    }
    return 'ORDER BY updated DESC'
  }

  private mapStatus(jiraStatusName: string): TaskStatus {
    return STATUS_MAP[jiraStatusName.toLowerCase().trim()] ?? 'todo'
  }

  private mapPriority(jiraPriorityName: string): Priority {
    return PRIORITY_MAP[jiraPriorityName.toLowerCase().trim()] ?? 'medium'
  }

  private extractDescription(description: unknown): string {
    if (!description) return ''
    if (typeof description === 'string') return description
    return extractTextFromAdf(description)
  }

  private mapIssueToTask(issue: JiraIssue): Task {
    const f = issue.fields
    const status = f.status ? this.mapStatus(f.status.name) : 'todo'
    const priority = f.priority ? this.mapPriority(f.priority.name) : 'medium'
    const assignee = f.assignee?.displayName ?? f.assignee?.emailAddress

    return {
      id: issue.key,
      title: f.summary ?? '',
      description: this.extractDescription(f.description),
      status,
      priority,
      labels: f.labels ?? [],
      assignee,
      createdAt: f.created ?? '',
      updatedAt: f.updated ?? '',
      url: `${this.config.baseUrl.replace(/\/$/, '')}/browse/${issue.key}`,
      metadata: {
        jiraId: issue.id,
        self: issue.self,
        project: this.config.project,
      },
    }
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    const jql = this.getDefaultJql()
    const result = await this.apiRequest<JiraSearchResult>('POST', '/search', {
      jql,
      maxResults: 100,
      fields: ['summary', 'status', 'priority', 'labels', 'assignee', 'created', 'updated', 'description'],
    })

    let tasks = result.issues.map(i => this.mapIssueToTask(i))

    if (filter) {
      if (filter.status) {
        tasks = tasks.filter(t => t.status === filter.status)
      }
      if (filter.priority) {
        tasks = tasks.filter(t => t.priority === filter.priority)
      }
      if (filter.labels && filter.labels.length > 0) {
        tasks = tasks.filter(t =>
          filter.labels!.some(label => t.labels.includes(label))
        )
      }
      if (filter.assignee) {
        tasks = tasks.filter(t => t.assignee === filter.assignee)
      }
    }

    return tasks
  }

  async get(id: string): Promise<Task> {
    const issue = await this.apiRequest<JiraIssue>('GET', `/issue/${encodeURIComponent(id)}`)
    return this.mapIssueToTask(issue)
  }

  async search(query: string): Promise<Task[]> {
    let jql: string
    if (this.config.project) {
      jql = `project = "${this.config.project}" AND text ~ "${query.replace(/"/g, '\\"')}"`
    } else {
      jql = `text ~ "${query.replace(/"/g, '\\"')}"`
    }
    const result = await this.apiRequest<JiraSearchResult>('POST', '/search', {
      jql,
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'labels', 'assignee', 'created', 'updated', 'description'],
    })
    return result.issues.map(i => this.mapIssueToTask(i))
  }

  async getComments(taskId: string): Promise<Comment[]> {
    const result = await this.apiRequest<{ comments: JiraComment[] }>(
      'GET', `/issue/${encodeURIComponent(taskId)}/comment`
    )
    return (result.comments ?? []).map(c => ({
      id: c.id,
      author: c.author?.displayName ?? c.author?.emailAddress ?? c.author?.accountId ?? 'unknown',
      body: typeof c.body === 'string' ? c.body : extractTextFromAdf(c.body),
      createdAt: c.created,
    }))
  }

  async getAttachments(taskId: string): Promise<Attachment[]> {
    const issue = await this.apiRequest<JiraIssue>(
      'GET', `/issue/${encodeURIComponent(taskId)}?fields=attachment`
    )
    const attachments = issue.fields.attachment ?? []
    return attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      url: a.content,
      mimeType: a.mimeType,
      sizeBytes: a.size,
    }))
  }

  async downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string> {
    const issue = await this.apiRequest<JiraIssue>(
      'GET', `/issue/${encodeURIComponent(taskId)}?fields=attachment`
    )
    const attachment = (issue.fields.attachment ?? []).find(a => a.id === attachmentId)
    if (!attachment) {
      throw new Error(`Attachment "${attachmentId}" not found on issue "${taskId}"`)
    }

    const res = await fetch(attachment.content, {
      headers: { 'Authorization': this.authHeader },
    })
    if (!res.ok) {
      throw new Error(`Failed to download attachment: ${res.status} ${res.statusText}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const safeName = path.basename(attachment.filename)
    const filePath = path.join(destDir, safeName)
    fs.writeFileSync(filePath, buffer)
    return filePath
  }

  async getReferences(taskId: string): Promise<Reference[]> {
    const issue = await this.apiRequest<JiraIssue>(
      'GET', `/issue/${encodeURIComponent(taskId)}?fields=issuelinks`
    )
    const links = issue.fields.issuelinks ?? []
    return links.map(link => {
      const target = link.inwardIssue ?? link.outwardIssue
      const direction = link.inwardIssue ? 'inward' : 'outward'
      const linkType = link.type?.name ?? 'linked'
      return {
        id: link.id,
        title: `${linkType} ${direction === 'inward' ? 'from' : 'to'} ${target?.key ?? 'unknown'}`,
        url: target?.key
          ? `${this.config.baseUrl.replace(/\/$/, '')}/browse/${target.key}`
          : undefined,
        type: 'ticket' as const,
      }
    })
  }
}
