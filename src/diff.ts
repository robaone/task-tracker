import { spawn } from 'child_process'

export interface DiffOptions {
  base?: string
  cwd?: string
}

export interface DiffResult {
  diff: string
  stat: string
  files: string[]
  baseBranch: string
  branch: string
}

function git(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `git exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

async function getCurrentBranch(cwd?: string): Promise<string> {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
}

async function getUpstreamBranch(branch: string, cwd?: string): Promise<string | null> {
  try {
    const ref = await git(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`],
      cwd
    )
    return ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^\/]+\//, '')
  } catch {
    return null
  }
}

async function getDefaultBranch(cwd?: string): Promise<string> {
  for (const candidate of ['main', 'master']) {
    try {
      await git(['rev-parse', '--verify', candidate], cwd)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error('Could not detect default branch (tried main, master)')
}

export async function getDiff(options?: DiffOptions): Promise<DiffResult> {
  const cwd = options?.cwd
  const branch = await getCurrentBranch(cwd)

  let baseBranch: string
  if (options?.base) {
    baseBranch = options.base
  } else {
    const upstream = await getUpstreamBranch(branch, cwd)
    baseBranch = upstream ?? await getDefaultBranch(cwd)
  }

  const mergeBase = await git(['merge-base', baseBranch, branch], cwd)

  const [diff, stat] = await Promise.all([
    git(['diff', `${mergeBase}..${branch}`], cwd),
    git(['diff', '--stat', `${mergeBase}..${branch}`], cwd),
  ])

  const files = stat
    .split('\n')
    .filter(line => line.includes('|'))
    .map(line => line.split('|')[0].trim())

  return { diff, stat, files, baseBranch, branch }
}
