import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitHubProvider } from '../src/providers/github'

const mockIssues = [
  {
    number: 42,
    title: 'Fix login bug',
    body: 'Users cannot log in after session timeout',
    state: 'open',
    labels: [{ name: 'bug' }, { name: 'auth' }, { name: 'high' }],
    assignee: { login: 'alice' },
    assignees: [{ login: 'alice' }],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-16T14:30:00Z',
    html_url: 'https://github.com/my-org/my-repo/issues/42',
  },
  {
    number: 43,
    title: 'Write tests',
    body: 'Add unit tests for auth module',
    state: 'open',
    labels: [{ name: 'testing' }],
    assignee: null,
    assignees: [],
    created_at: '2026-01-17T09:00:00Z',
    updated_at: '2026-01-17T09:00:00Z',
    html_url: 'https://github.com/my-org/my-repo/issues/43',
  },
  {
    number: 44,
    title: 'Deploy v2',
    body: 'Deploy version 2 to production',
    state: 'closed',
    labels: [{ name: 'deploy' }, { name: 'critical' }],
    assignee: { login: 'bob' },
    assignees: [{ login: 'bob' }],
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-18T12:00:00Z',
    html_url: 'https://github.com/my-org/my-repo/issues/44',
  },
  {
    number: 45,
    title: 'Refactor auth',
    body: 'Refactor authentication middleware',
    state: 'open',
    labels: [{ name: 'in progress' }, { name: 'auth' }],
    assignee: { login: 'alice' },
    assignees: [{ login: 'alice' }],
    created_at: '2026-01-19T10:00:00Z',
    updated_at: '2026-01-19T12:00:00Z',
    html_url: 'https://github.com/my-org/my-repo/issues/45',
  },
]

const mockComments = [
  { id: 1001, user: { login: 'alice' }, body: 'Looking into this now', created_at: '2026-01-16T15:00:00Z' },
  { id: 1002, user: { login: 'bob' }, body: 'I think the issue is in session.ts', created_at: '2026-01-16T16:00:00Z' },
]

const mockIssueWithRefs = {
  number: 42,
  title: 'Fix login bug',
  body: 'See also #43 and my-org/my-repo#44 for related changes',
  state: 'open',
  labels: [],
  assignee: null,
  assignees: [],
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-16T14:30:00Z',
  html_url: 'https://github.com/my-org/my-repo/issues/42',
}

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  } as Response
}

let fetchMock: ReturnType<typeof vi.fn>

function createProvider(): GitHubProvider {
  return new GitHubProvider({
    repo: 'my-org/my-repo',
    token: 'ghp_test-token',
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

describe('GitHubProvider', () => {
  it('list() returns all non-PR issues', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks).toHaveLength(4)
  })

  it('list() filters out pull requests', async () => {
    const issuesWithPR = [
      ...mockIssues,
      { number: 99, title: 'PR', state: 'open', labels: [], assignee: null, assignees: [], body: '', created_at: '', updated_at: '', html_url: '', pull_request: {} },
    ]
    fetchMock.mockResolvedValueOnce(mockResponse(issuesWithPR))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks).toHaveLength(4)
  })

  it('list() maps closed issues to done status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '44')!.status).toBe('done')
  })

  it('list() maps open issues to todo status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '42')!.status).toBe('todo')
  })

  it('list() maps open issues with in progress label to in_progress', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '45')!.status).toBe('in_progress')
  })

  it('list() maps priority from labels', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '42')!.priority).toBe('high')
    expect(tasks.find(t => t.id === '43')!.priority).toBe('medium')
    expect(tasks.find(t => t.id === '44')!.priority).toBe('critical')
  })

  it('list() maps assignee', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '42')!.assignee).toBe('alice')
    expect(tasks.find(t => t.id === '43')!.assignee).toBeUndefined()
  })

  it('list() maps labels', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '42')!.labels).toEqual(['bug', 'auth', 'high'])
  })

  it('list() includes html_url', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list()
    expect(tasks.find(t => t.id === '42')!.url).toBe('https://github.com/my-org/my-repo/issues/42')
  })

  it('list() filters by status done', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([mockIssues[2]]))
    const provider = createProvider()
    const tasks = await provider.list({ status: 'done' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('44')
  })

  it('list() filters by priority client-side', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues))
    const provider = createProvider()
    const tasks = await provider.list({ priority: 'critical' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('44')
  })

  it('list() filters by labels server-side', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues.filter(i => i.labels.some(l => l.name === 'bug'))))
    const provider = createProvider()
    const tasks = await provider.list({ labels: ['bug'] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('42')
  })

  it('get() returns a single issue by number', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[0]))
    const provider = createProvider()
    const task = await provider.get('42')
    expect(task.title).toBe('Fix login bug')
    expect(task.id).toBe('42')
  })

  it('get() throws for missing issue', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, 404))
    const provider = createProvider()
    await expect(provider.get('999')).rejects.toThrow('GitHub API error (404)')
  })

  it('search() scopes to repo', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ items: [mockIssues[0]], total_count: 1 }))
    const provider = createProvider()
    const tasks = await provider.search('login')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('42')
  })

  it('search() filters out pull requests', async () => {
    const results = [
      mockIssues[0],
      { number: 99, title: 'PR', state: 'open', labels: [], assignee: null, assignees: [], body: '', created_at: '', updated_at: '', html_url: '', pull_request: {} },
    ]
    fetchMock.mockResolvedValueOnce(mockResponse({ items: results, total_count: 2 }))
    const provider = createProvider()
    const tasks = await provider.search('login')
    expect(tasks).toHaveLength(1)
  })

  it('search() returns empty array on no matches', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ items: [], total_count: 0 }))
    const provider = createProvider()
    const tasks = await provider.search('nonexistent')
    expect(tasks).toEqual([])
  })

  it('getComments() returns comments for an issue', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockComments))
    const provider = createProvider()
    const comments = await provider.getComments('42')
    expect(comments).toHaveLength(2)
    expect(comments[0].author).toBe('alice')
    expect(comments[0].body).toBe('Looking into this now')
    expect(comments[1].author).toBe('bob')
  })

  it('getComments() returns empty array when no comments', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([]))
    const provider = createProvider()
    const comments = await provider.getComments('43')
    expect(comments).toEqual([])
  })

  it('getAttachments() returns empty array', async () => {
    const provider = createProvider()
    const attachments = await provider.getAttachments('42')
    expect(attachments).toEqual([])
  })

  it('downloadAttachment() throws', async () => {
    const provider = createProvider()
    await expect(
      provider.downloadAttachment('42', 'att-1', '/tmp')
    ).rejects.toThrow('not supported')
  })

  it('getReferences() extracts issue references from body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssueWithRefs))
    const provider = createProvider()
    const refs = await provider.getReferences('42')
    expect(refs).toHaveLength(2)
    expect(refs[0].title).toContain('#43')
    expect(refs[0].url).toContain('/issues/43')
    expect(refs[1].title).toContain('my-org/my-repo#44')
  })

  it('getReferences() returns empty array when no references in body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(mockIssues[1]))
    const provider = createProvider()
    const refs = await provider.getReferences('43')
    expect(refs).toEqual([])
  })

  it('getReferences() handles null body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ...mockIssues[0], body: null }))
    const provider = createProvider()
    const refs = await provider.getReferences('42')
    expect(refs).toEqual([])
  })

  it('constructor throws for invalid repo format', () => {
    expect(() => new GitHubProvider({ repo: 'invalid', token: 'test' })).toThrow('Invalid repo format')
  })
})
