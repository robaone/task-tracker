import * as fs from 'fs'
import * as path from 'path'
import { TaskProvider } from '../provider'
import { Task, TaskStatus, TaskFilter, Comment, Attachment, Reference } from '../types'

export interface TrelloProviderConfig {
  apiKey: string
  token: string
  boardId: string
}

interface TrelloList {
  id: string
  name: string
}

interface TrelloLabel {
  id: string
  name: string
  color: string
}

interface TrelloMember {
  id: string
  fullName: string
  username: string
}

interface TrelloAttachment {
  id: string
  name: string
  url: string
  mimeType?: string
  bytes?: number
}

interface TrelloAction {
  id: string
  type: string
  date: string
  memberCreator?: { fullName?: string; username?: string }
  data?: { text?: string }
}

interface TrelloCard {
  id: string
  name: string
  desc: string
  idList: string
  labels: TrelloLabel[]
  idMembers: string[]
  dateLastActivity: string
  shortUrl: string
  url: string
  due: string | null
  closed: boolean
}

const DEFAULT_STATUS_MAP: Record<string, TaskStatus> = {
  'to do': 'todo',
  'todo': 'todo',
  'not started': 'todo',
  'backlog': 'todo',
  'in progress': 'in_progress',
  'doing': 'in_progress',
  'in review': 'in_progress',
  'done': 'done',
  'complete': 'done',
  'completed': 'done',
}

export class TrelloProvider implements TaskProvider {
  private listsPromise: Promise<TrelloList[]> | null = null
  private membersCache: Map<string, string> = new Map()

  constructor(private config: TrelloProviderConfig) {}

  private async apiRequest<T>(path: string): Promise<T> {
    const separator = path.includes('?') ? '&' : '?'
    const url = `https://api.trello.com/1${path}${separator}key=${this.config.apiKey}&token=${this.config.token}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Trello API error (${res.status}): ${body || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  private getLists(): Promise<TrelloList[]> {
    if (!this.listsPromise) {
      this.listsPromise = this.apiRequest<TrelloList[]>(`/boards/${this.config.boardId}/lists`)
    }
    return this.listsPromise
  }

  private async getMemberName(memberId: string): Promise<string> {
    if (!this.membersCache.has(memberId)) {
      try {
        const member = await this.apiRequest<TrelloMember>(`/members/${memberId}`)
        this.membersCache.set(memberId, member.fullName || member.username)
      } catch {
        this.membersCache.set(memberId, memberId)
      }
    }
    return this.membersCache.get(memberId)!
  }

  private async resolveStatus(idList: string): Promise<TaskStatus> {
    const lists = await this.getLists()
    const list = lists.find(l => l.id === idList)
    if (!list) return 'todo'
    const lower = list.name.toLowerCase().trim()
    return DEFAULT_STATUS_MAP[lower] ?? 'todo'
  }

  private async mapCardToTask(card: TrelloCard): Promise<Task> {
    const status = await this.resolveStatus(card.idList)
    const assigneeId = card.idMembers[0]
    const assignee = assigneeId ? await this.getMemberName(assigneeId) : undefined

    const labels = card.labels
      .map(l => l.name || l.color)
      .filter(Boolean) as string[]

    let priority: Task['priority'] = 'medium'
    const priorityLabel = card.labels.find(l => {
      const n = l.name.toLowerCase()
      return n.includes('critical') || n.includes('high') || n.includes('medium') || n.includes('low')
    })
    if (priorityLabel) {
      const n = priorityLabel.name.toLowerCase()
      if (n.includes('critical')) priority = 'critical'
      else if (n.includes('high')) priority = 'high'
      else if (n.includes('medium')) priority = 'medium'
      else if (n.includes('low')) priority = 'low'
    }

    return {
      id: card.id,
      title: card.name,
      description: card.desc,
      status,
      priority,
      labels,
      assignee,
      createdAt: card.dateLastActivity,
      updatedAt: card.dateLastActivity,
      url: card.shortUrl,
      metadata: {
        trelloUrl: card.url,
        idList: card.idList,
        closed: card.closed,
        due: card.due,
      },
    }
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    const cards = await this.apiRequest<TrelloCard[]>(`/boards/${this.config.boardId}/cards`)
    let tasks = await Promise.all(cards.map(c => this.mapCardToTask(c)))

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
    const card = await this.apiRequest<TrelloCard>(`/cards/${id}`)
    return this.mapCardToTask(card)
  }

  async search(query: string): Promise<Task[]> {
    const result = await this.apiRequest<{ cards?: TrelloCard[] }>(
      `/search?query=${encodeURIComponent(query)}&modelTypes=cards&cards_limit=50`
    )
    if (!result.cards) return []
    return Promise.all(result.cards.map(c => this.mapCardToTask(c)))
  }

  async getComments(taskId: string): Promise<Comment[]> {
    const actions = await this.apiRequest<TrelloAction[]>(
      `/cards/${taskId}/actions?filter=commentCard`
    )
    return actions.map(a => ({
      id: a.id,
      author: a.memberCreator?.fullName ?? a.memberCreator?.username ?? 'unknown',
      body: a.data?.text ?? '',
      createdAt: a.date,
    }))
  }

  async getAttachments(taskId: string): Promise<Attachment[]> {
    const attachments = await this.apiRequest<TrelloAttachment[]>(
      `/cards/${taskId}/attachments`
    )
    return attachments.map(a => ({
      id: a.id,
      filename: a.name,
      url: a.url,
      mimeType: a.mimeType,
      sizeBytes: a.bytes,
    }))
  }

  async downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string> {
    const attachments = await this.getAttachments(taskId)
    const attachment = attachments.find(a => a.id === attachmentId)
    if (!attachment || !attachment.url) {
      throw new Error(`Attachment "${attachmentId}" not found on card "${taskId}"`)
    }

    const url = `${attachment.url}?key=${this.config.apiKey}&token=${this.config.token}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to download attachment: ${res.status} ${res.statusText}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const safeName = path.basename(attachment.filename)
    const filePath = path.join(destDir, safeName)
    fs.writeFileSync(filePath, buffer)
  }

  async getReferences(_taskId: string): Promise<Reference[]> {
    return []
  }
}
