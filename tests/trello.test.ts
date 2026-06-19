import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TrelloProvider } from '../src/providers/trello'
import * as fs from 'fs'

const mockBoardLists = [
  { id: 'list-todo', name: 'To Do' },
  { id: 'list-progress', name: 'In Progress' },
  { id: 'list-done', name: 'Done' },
]

const mockCards = [
  {
    id: 'card-001',
    name: 'Fix login bug',
    desc: 'Users cannot log in after session timeout',
    idList: 'list-progress',
    labels: [{ id: 'lbl-1', name: 'bug', color: 'red' }, { id: 'lbl-2', name: 'high', color: 'orange' }],
    idMembers: ['member-alice'],
    dateLastActivity: '2026-01-16T14:30:00Z',
    shortUrl: 'https://trello.com/c/abc123',
    url: 'https://trello.com/c/abc123/full',
    due: null,
    closed: false,
  },
  {
    id: 'card-002',
    name: 'Write tests',
    desc: 'Add unit tests for auth module',
    idList: 'list-todo',
    labels: [],
    idMembers: [],
    dateLastActivity: '2026-01-17T09:00:00Z',
    shortUrl: 'https://trello.com/c/def456',
    url: 'https://trello.com/c/def456/full',
    due: null,
    closed: false,
  },
  {
    id: 'card-003',
    name: 'Deploy v2',
    desc: 'Deploy version 2 to production',
    idList: 'list-done',
    labels: [{ id: 'lbl-3', name: 'critical', color: 'red' }],
    idMembers: ['member-bob'],
    dateLastActivity: '2026-01-18T12:00:00Z',
    shortUrl: 'https://trello.com/c/ghi789',
    url: 'https://trello.com/c/ghi789/full',
    due: null,
    closed: false,
  },
]

const mockComments = [
  { id: 'cmt-1', type: 'commentCard', date: '2026-01-16T15:00:00Z', memberCreator: { fullName: 'Alice', username: 'alice' }, data: { text: 'Looking into this now' } },
  { id: 'cmt-2', type: 'commentCard', date: '2026-01-16T16:00:00Z', memberCreator: { fullName: 'Bob', username: 'bob' }, data: { text: 'I think the issue is in session.ts' } },
]

const mockAttachments = [
  { id: 'att-1', name: 'session-config.png', url: 'https://trello.com/attachments/session-config.png', mimeType: 'image/png', bytes: 102400 },
  { id: 'att-2', name: 'api-spec.yaml', url: 'https://trello.com/attachments/api-spec.yaml', mimeType: 'application/x-yaml', bytes: 2048 },
]

function mockResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response
}

function mockErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    statusText: text,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(text),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response
}

function mockBinaryResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  } as Response
}

let fetchMock: ReturnType<typeof vi.fn>

function createProvider(): TrelloProvider {
  return new TrelloProvider({
    apiKey: 'test-key',
    token: 'test-token',
    boardId: 'board-123',
  })
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.stubGlobal('fetch', undefined)
  vi.restoreAllMocks()
})

describe('TrelloProvider', () => {
  it('list() returns all tasks from the board', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks).toHaveLength(3)
    expect(tasks[0].title).toBe('Fix login bug')
    expect(tasks[1].title).toBe('Write tests')
    expect(tasks[2].title).toBe('Deploy v2')
  })

  it('list() maps Trello lists to correct statuses', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'card-001')!.status).toBe('in_progress')
    expect(tasks.find(t => t.id === 'card-002')!.status).toBe('todo')
    expect(tasks.find(t => t.id === 'card-003')!.status).toBe('done')
  })

  it('list() filters by status', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list({ status: 'in_progress' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('card-001')
  })

  it('list() filters by priority', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list({ priority: 'critical' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('card-003')
  })

  it('list() filters by label', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list({ labels: ['bug'] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('card-001')
  })

  it('get() returns a single task by id', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards[0]))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const task = await provider.get('card-001')
    expect(task.title).toBe('Fix login bug')
    expect(task.status).toBe('in_progress')
  })

  it('get() throws for missing card', async () => {
    fetchMock.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'))
    const provider = createProvider()
    await expect(provider.get('card-999')).rejects.toThrow('Trello API error (404)')
  })

  it('search() queries the Trello search endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ cards: [mockCards[0]] }))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.search('login')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('card-001')
  })

  it('search() returns empty array when no cards found', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ cards: [] }))
    const provider = createProvider()
    const tasks = await provider.search('nonexistent')
    expect(tasks).toEqual([])
  })

  it('getComments() returns comments for a card', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockComments))
    const provider = createProvider()
    const comments = await provider.getComments('card-001')
    expect(comments).toHaveLength(2)
    expect(comments[0].author).toBe('Alice')
    expect(comments[0].body).toBe('Looking into this now')
    expect(comments[1].author).toBe('Bob')
  })

  it('getComments() returns empty array when no comments', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([]))
    const provider = createProvider()
    const comments = await provider.getComments('card-002')
    expect(comments).toEqual([])
  })

  it('getAttachments() returns attachments for a card', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockAttachments))
    const provider = createProvider()
    const attachments = await provider.getAttachments('card-001')
    expect(attachments).toHaveLength(2)
    expect(attachments[0].filename).toBe('session-config.png')
    expect(attachments[0].mimeType).toBe('image/png')
  })

  it('getAttachments() returns empty array when no attachments', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([]))
    const provider = createProvider()
    const attachments = await provider.getAttachments('card-001')
    expect(attachments).toEqual([])
  })

  it('downloadAttachment() downloads and saves attachment', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockAttachments))
      .mockResolvedValueOnce(mockBinaryResponse())
    const provider = createProvider()
    const tmpDir = '/tmp/test-trello-dl'
    fs.mkdirSync(tmpDir, { recursive: true })
    const filePath = await provider.downloadAttachment('card-001', 'att-1', tmpDir)
    expect(filePath).toBe(`${tmpDir}/session-config.png`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('downloadAttachment() throws for missing attachment', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockAttachments))
    const provider = createProvider()
    await expect(
      provider.downloadAttachment('card-001', 'att-999', '/tmp')
    ).rejects.toThrow('not found')
  })

  it('getReferences() returns empty array', async () => {
    const provider = createProvider()
    const refs = await provider.getReferences('card-001')
    expect(refs).toEqual([])
  })

  it('maps priority from labels', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockCards))
      .mockResolvedValueOnce(mockResponse(mockBoardLists))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'card-001')!.priority).toBe('high')
    expect(tasks.find(t => t.id === 'card-002')!.priority).toBe('medium')
    expect(tasks.find(t => t.id === 'card-003')!.priority).toBe('critical')
  })
})
