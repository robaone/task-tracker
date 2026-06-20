import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { JsonProvider } from '../src/providers/json'
import type { Task } from '../src/types'

const testTasksPath = path.resolve(__dirname, '..', 'test-tasks.json')

const sampleTasks: Task[] = [
  {
    id: 'TASK-001',
    title: 'Fix login bug',
    description: 'Users cannot log in after session timeout',
    status: 'in_progress',
    priority: 'high',
    labels: ['bug', 'auth'],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-16T14:30:00Z',
    metadata: {},
  },
  {
    id: 'TASK-002',
    title: 'Write tests',
    description: 'Add unit tests for auth module',
    status: 'todo',
    priority: 'medium',
    labels: ['testing'],
    assignee: 'alice',
    createdAt: '2026-01-17T09:00:00Z',
    updatedAt: '2026-01-17T09:00:00Z',
    metadata: {},
  },
  {
    id: 'TASK-003',
    title: 'Deploy v2',
    description: 'Deploy version 2 to production',
    status: 'done',
    priority: 'critical',
    labels: ['deploy', 'ops'],
    assignee: 'bob',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-18T12:00:00Z',
    metadata: {},
  },
]

beforeEach(() => {
  fs.writeFileSync(testTasksPath, JSON.stringify(sampleTasks, null, 2), 'utf-8')
})

afterEach(() => {
  try { fs.unlinkSync(testTasksPath) } catch { /* ignore */ }
})

function createProvider(): JsonProvider {
  return new JsonProvider({ path: testTasksPath })
}

describe('JsonProvider', () => {
  it('list() returns all tasks', async () => {
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks).toHaveLength(3)
  })

  it('list() filters by status', async () => {
    const provider = createProvider()
    const tasks = await provider.list({ status: 'in_progress' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('TASK-001')
  })

  it('list() filters by priority', async () => {
    const provider = createProvider()
    const tasks = await provider.list({ priority: 'critical' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('TASK-003')
  })

  it('list() filters by labels', async () => {
    const provider = createProvider()
    const tasks = await provider.list({ labels: ['bug'] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('TASK-001')
  })

  it('list() filters by assignee', async () => {
    const provider = createProvider()
    const tasks = await provider.list({ assignee: 'alice' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('TASK-002')
  })

  it('list() combines multiple filters', async () => {
    const provider = createProvider()
    const tasks = await provider.list({ status: 'done', priority: 'critical' })
    expect(tasks).toHaveLength(1)
  })

  it('get() returns a task by id', async () => {
    const provider = createProvider()
    const task = await provider.get('TASK-002')
    expect(task.title).toBe('Write tests')
  })

  it('get() throws for missing task', async () => {
    const provider = createProvider()
    await expect(provider.get('TASK-999')).rejects.toThrow('not found')
  })

  it('search() finds tasks by id', async () => {
    const provider = createProvider()
    const tasks = await provider.search('TASK-001')
    expect(tasks).toHaveLength(1)
  })

  it('search() finds tasks by title', async () => {
    const provider = createProvider()
    const tasks = await provider.search('login')
    expect(tasks).toHaveLength(1)
  })

  it('search() finds tasks by description', async () => {
    const provider = createProvider()
    const tasks = await provider.search('session timeout')
    expect(tasks).toHaveLength(1)
  })

  it('getComments() returns empty array', async () => {
    const provider = createProvider()
    const comments = await provider.getComments('TASK-001')
    expect(comments).toEqual([])
  })

  it('getAttachments() returns empty array', async () => {
    const provider = createProvider()
    const attachments = await provider.getAttachments('TASK-001')
    expect(attachments).toEqual([])
  })

  it('getReferences() returns empty array', async () => {
    const provider = createProvider()
    const refs = await provider.getReferences('TASK-001')
    expect(refs).toEqual([])
  })

  it('downloadAttachment() throws', async () => {
    const provider = createProvider()
    await expect(
      provider.downloadAttachment('TASK-001', 'att-1', '/tmp')
    ).rejects.toThrow('not supported')
  })
})
