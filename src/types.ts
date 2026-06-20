export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  labels: string[]
  assignee?: string
  createdAt: string
  updatedAt: string
  url?: string
  metadata: Record<string, unknown>
}

export interface Attachment {
  id: string
  filename: string
  url?: string
  mimeType?: string
  sizeBytes?: number
}

export interface Comment {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface Reference {
  id: string
  title: string
  url?: string
  type: 'ticket' | 'doc' | 'link' | 'file'
}

export interface ReviewBundle {
  task: Task
  comments: Comment[]
  references: Reference[]
  attachments: Attachment[]
  diff?: string
  diffStat?: string
  baseBranch: string
  bundlePath: string
}

export interface TaskFilter {
  status?: TaskStatus
  priority?: Priority
  labels?: string[]
  assignee?: string
}
