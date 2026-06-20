import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { getDiff } from '../src/diff'

function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe.skipIf(!isGitRepo())('getDiff', () => {
  it('returns diff result with branch info', async () => {
    const result = await getDiff({ base: 'HEAD' })
    expect(result).toHaveProperty('diff')
    expect(result).toHaveProperty('stat')
    expect(result).toHaveProperty('files')
    expect(result).toHaveProperty('baseBranch')
    expect(result).toHaveProperty('branch')
    expect(result.baseBranch).toBe('HEAD')
    expect(typeof result.diff).toBe('string')
  })

  it('returns files list as array', async () => {
    const result = await getDiff({ base: 'HEAD' })
    expect(Array.isArray(result.files)).toBe(true)
  })
})
