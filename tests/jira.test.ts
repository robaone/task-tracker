import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JiraProvider } from '../src/providers/jira'
import * as fs from 'fs'

const mockIssues = [
  {
    id: '10001',
    key: 'PROJ-123',
    self: 'https://jira.example.com/rest/api/3/issue/10001',
    fields: {
      summary: 'Fix login bug',
      description: {
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Users cannot log in after session timeout' }] },
        ],
      },
      status: { name: 'In Progress' },
      priority: { name: 'High' },
      labels: ['bug', 'auth'],
      assignee: { displayName: 'Alice', emailAddress: 'alice@example.com' },
      created: '2026-01-15T10:00:00.000Z',
      updated: '2026-01-16T14:30:00.000Z',
    },
  },
  {
    id: '10002',
    key: 'PROJ-456',
    self: 'https://jira.example.com/rest/api/3/issue/10002',
    fields: {
      summary: 'Write tests',
      description: 'Add unit tests for auth module',
      status: { name: 'To Do' },
      priority: { name: 'Medium' },
      labels: ['testing'],
      assignee: null,
      created: '2026-01-17T09:00:00.000Z',
      updated: '2026-01-17T09:00:00.000Z',
    },
  },
  {
    id: '10003',
    key: 'PROJ-789',
    self: 'https://jira.example.com/rest/api/3/issue/10003',
    fields: {
      summary: 'Deploy v2',
      description: 'Deploy version 2 to production',
      status: { name: 'Done' },
      priority: { name: 'Highest' },
      labels: ['deploy', 'ops'],
      assignee: { displayName: 'Bob' },
      created: '2026-01-10T08:00:00.000Z',
      updated: '2026-01-18T12:00:00.000Z',
    },
  },
]

const mockSearchResult = {
  issues: mockIssues,
  total: 3,
  maxResults: 100,
  startAt: 0,
}

const mockComments = {
  comments: [
    {
      id: '101',
      author: { displayName: 'Alice', emailAddress: 'alice@example.com' },
      body: {
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Looking into this now' }] },
        ],
      },
      created: '2026-01-16T15:00:00.000Z',
    },
    {
      id: '102',
      author: { displayName: 'Bob' },
      body: 'I think the issue is in session.ts',
      created: '2026-01-16T16:00:00.000Z',
    },
  ],
  total: 2,
  maxResults: 100,
  startAt: 0,
}

const mockIssueWithAttachments = {
  id: '10001',
  key: 'PROJ-123',
  self: 'https://jira.example.com/rest/api/3/issue/10001',
  fields: {
    attachment: [
      { id: 'att-1', filename: 'session-config.png', content: 'https://jira.example.com/attachments/session-config.png', mimeType: 'image/png', size: 102400 },
      { id: 'att-2', filename: 'api-spec.yaml', content: 'https://jira.example.com/attachments/api-spec.yaml', mimeType: 'application/x-yaml', size: 2048 },
    ],
  },
}

const mockIssueWithLinks = {
  id: '10001',
  key: 'PROJ-123',
  self: 'https://jira.example.com/rest/api/3/issue/10001',
  fields: {
    issuelinks: [
      {
        id: 'link-1',
        type: { name: 'Relates', inward: 'relates to', outward: 'relates to' },
        outwardIssue: { key: 'PROJ-456', fields: { summary: 'Write tests' } },
      },
      {
        id: 'link-2',
        type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        inwardIssue: { key: 'PROJ-789', fields: { summary: 'Deploy v2' } },
      },
    ],
  },
}

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
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

function createProvider(project?: string): JiraProvider {
  return new JiraProvider({
    baseUrl: 'https://jira.example.com',
    email: 'user@example.com',
    apiToken: 'test-token',
    project,
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

describe('JiraProvider', () => {
  it('list() returns all issues from the project', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list()
    expect(tasks).toHaveLength(3)
    expect(tasks[0].title).toBe('Fix login bug')
    expect(tasks[1].title).toBe('Write tests')
    expect(tasks[2].title).toBe('Deploy v2')
  })

  it('list() maps Jira statuses correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'PROJ-123')!.status).toBe('in_progress')
    expect(tasks.find(t => t.id === 'PROJ-456')!.status).toBe('todo')
    expect(tasks.find(t => t.id === 'PROJ-789')!.status).toBe('done')
  })

  it('list() maps Jira priorities correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'PROJ-123')!.priority).toBe('high')
    expect(tasks.find(t => t.id === 'PROJ-456')!.priority).toBe('medium')
    expect(tasks.find(t => t.id === 'PROJ-789')!.priority).toBe('critical')
  })

  it('list() maps labels correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'PROJ-123')!.labels).toEqual(['bug', 'auth'])
    expect(tasks.find(t => t.id === 'PROJ-456')!.labels).toEqual(['testing'])
  })

  it('list() assigns assignee display name', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === 'PROJ-123')!.assignee).toBe('Alice')
    expect(tasks.find(t => t.id === 'PROJ-456')!.assignee).toBeUndefined()
  })

  it('list() filters by status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list({ status: 'in_progress' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('PROJ-123')
  })

  it('list() filters by priority', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list({ priority: 'critical' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('PROJ-789')
  })

  it('list() filters by labels', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.list({ labels: ['bug'] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('PROJ-123')
  })

  it('list() works without a project filter', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks).toHaveLength(3)
  })

  it('get() returns a single issue by key', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[0]))
    const provider = createProvider('PROJ')
    const task = await provider.get('PROJ-123')
    expect(task.title).toBe('Fix login bug')
    expect(task.status).toBe('in_progress')
  })

  it('get() extracts description from ADF format', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[0]))
    const provider = createProvider('PROJ')
    const task = await provider.get('PROJ-123')
    expect(task.description).toBe('Users cannot log in after session timeout')
  })

  it('get() handles plain text description', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[1]))
    const provider = createProvider('PROJ')
    const task = await provider.get('PROJ-456')
    expect(task.description).toBe('Add unit tests for auth module')
  })

  it('get() throws for missing issue', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ message: 'Issue does not exist' }, 404))
    const provider = createProvider('PROJ')
    await expect(provider.get('PROJ-999')).rejects.toThrow('Jira API error (404)')
  })

  it('get() includes the browse URL', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[0]))
    const provider = createProvider('PROJ')
    const task = await provider.get('PROJ-123')
    expect(task.url).toBe('https://jira.example.com/browse/PROJ-123')
  })

  it('search() sends JQL with text search', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockSearchResult))
    const provider = createProvider('PROJ')
    const tasks = await provider.search('login')
    expect(tasks).toHaveLength(3)
  })

  it('search() returns empty array on no matches', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ issues: [], total: 0, maxResults: 50, startAt: 0 }))
    const provider = createProvider('PROJ')
    const tasks = await provider.search('nonexistent')
    expect(tasks).toEqual([])
  })

  it('getComments() returns comments for an issue', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockComments))
    const provider = createProvider('PROJ')
    const comments = await provider.getComments('PROJ-123')
    expect(comments).toHaveLength(2)
    expect(comments[0].author).toBe('Alice')
    expect(comments[0].body).toBe('Looking into this now')
    expect(comments[1].author).toBe('Bob')
    expect(comments[1].body).toBe('I think the issue is in session.ts')
  })

  it('getComments() extracts text from ADF comment bodies', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockComments))
    const provider = createProvider('PROJ')
    const comments = await provider.getComments('PROJ-123')
    expect(comments[0].body).toBe('Looking into this now')
  })

  it('getComments() returns empty array when no comments', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ comments: [], total: 0, maxResults: 100, startAt: 0 }))
    const provider = createProvider('PROJ')
    const comments = await provider.getComments('PROJ-456')
    expect(comments).toEqual([])
  })

  it('getAttachments() returns attachments for an issue', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssueWithAttachments))
    const provider = createProvider('PROJ')
    const attachments = await provider.getAttachments('PROJ-123')
    expect(attachments).toHaveLength(2)
    expect(attachments[0].filename).toBe('session-config.png')
    expect(attachments[0].mimeType).toBe('image/png')
    expect(attachments[0].sizeBytes).toBe(102400)
  })

  it('getAttachments() returns empty array when no attachments', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: '10001', key: 'PROJ-123', fields: { attachment: [] } }))
    const provider = createProvider('PROJ')
    const attachments = await provider.getAttachments('PROJ-123')
    expect(attachments).toEqual([])
  })

  it('downloadAttachment() downloads and saves attachment', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(mockIssueWithAttachments))
      .mockResolvedValueOnce(mockBinaryResponse())
    const provider = createProvider('PROJ')
    const tmpDir = '/tmp/test-jira-dl'
    fs.mkdirSync(tmpDir, { recursive: true })
    const filePath = await provider.downloadAttachment('PROJ-123', 'att-1', tmpDir)
    expect(filePath).toBe(`${tmpDir}/session-config.png`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('downloadAttachment() throws for missing attachment', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssueWithAttachments))
    const provider = createProvider('PROJ')
    await expect(
      provider.downloadAttachment('PROJ-123', 'att-999', '/tmp')
    ).rejects.toThrow('not found')
  })

  it('getReferences() returns issue links', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssueWithLinks))
    const provider = createProvider('PROJ')
    const refs = await provider.getReferences('PROJ-123')
    expect(refs).toHaveLength(2)
    expect(refs[0].title).toContain('PROJ-456')
    expect(refs[0].type).toBe('ticket')
    expect(refs[1].title).toContain('PROJ-789')
  })

  it('getReferences() returns empty array when no links', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: '10001', key: 'PROJ-123', fields: { issuelinks: [] } }))
    const provider = createProvider('PROJ')
    const refs = await provider.getReferences('PROJ-123')
    expect(refs).toEqual([])
  })
})
