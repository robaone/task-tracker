import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

async function getCurrentBranch(cwd?: string): Promise<string> {
  const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd })
  return stdout.trim()
}

async function getUpstreamBranch(branch: string, cwd?: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git rev-parse --abbrev-ref --symbolic-full-name "${branch}@{upstream}"`,
      { cwd }
    )
    const ref = stdout.trim()
    return ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^\/]+\//, '')
  } catch {
    return null
  }
}

async function getDefaultBranch(cwd?: string): Promise<string> {
  for (const candidate of ['main', 'master']) {
    try {
      await execAsync(`git rev-parse --verify "${candidate}"`, { cwd })
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

  const mergeBase = (
    await execAsync(`git merge-base "${baseBranch}" "${branch}"`, { cwd })
  ).stdout.trim()

  const [diffResult, statResult] = await Promise.all([
    execAsync(`git diff "${mergeBase}".."${branch}"`, { cwd, maxBuffer: 10 * 1024 * 1024 }),
    execAsync(`git diff --stat "${mergeBase}".."${branch}"`, { cwd }),
  ])

  const diff = diffResult.stdout
  const stat = statResult.stdout.trim()

  const files = stat
    .split('\n')
    .filter(line => line.includes('|'))
    .map(line => line.split('|')[0].trim())

  return { diff, stat, files, baseBranch, branch }
}
