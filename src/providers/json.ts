import * as fs from 'fs'
import * as path from 'path'
import { TaskProvider } from '../provider'
import { Task, TaskFilter, Comment, Attachment, Reference } from '../types'

export interface JsonProviderConfig {
  path: string
}

export class JsonProvider implements TaskProvider {
  private tasks: Task[] = []

  constructor(private config: JsonProviderConfig) {
    this.load()
  }

  private load(): void {
    const filePath = path.resolve(this.config.path)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('JSON file must contain an array of tasks')
    }
    this.tasks = parsed as Task[]
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    let result = this.tasks
    if (filter) {
      if (filter.status) {
        result = result.filter(t => t.status === filter.status)
      }
      if (filter.priority) {
        result = result.filter(t => t.priority === filter.priority)
      }
      if (filter.labels && filter.labels.length > 0) {
        result = result.filter(t =>
          filter.labels!.some(label => t.labels.includes(label))
        )
      }
      if (filter.assignee) {
        result = result.filter(t => t.assignee === filter.assignee)
      }
    }
    return result
  }

  async get(id: string): Promise<Task> {
    const task = this.tasks.find(t => t.id === id)
    if (!task) {
      throw new Error(`Task "${id}" not found`)
    }
    return task
  }

  async search(query: string): Promise<Task[]> {
    const lower = query.toLowerCase()
    return this.tasks.filter(
      t =>
        t.id.toLowerCase().includes(lower) ||
        t.title.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower)
    )
  }

  async getComments(_taskId: string): Promise<Comment[]> {
    return []
  }

  async getAttachments(_taskId: string): Promise<Attachment[]> {
    return []
  }

  async downloadAttachment(_taskId: string, _attachmentId: string, _destDir: string): Promise<string> {
    throw new Error('Attachments not supported by JSON provider')
  }

  async getReferences(_taskId: string): Promise<Reference[]> {
    return []
  }
}
