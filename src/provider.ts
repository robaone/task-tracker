import { Task, TaskFilter, Comment, Attachment, Reference } from './types'

export interface TaskProvider {
  list(filter?: TaskFilter): Promise<Task[]>
  get(id: string): Promise<Task>
  search(query: string): Promise<Task[]>
  getComments(taskId: string): Promise<Comment[]>
  getAttachments(taskId: string): Promise<Attachment[]>
  downloadAttachment(taskId: string, attachmentId: string, destDir: string): Promise<string>
  getReferences(taskId: string): Promise<Reference[]>
}
