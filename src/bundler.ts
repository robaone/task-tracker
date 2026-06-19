import * as fs from 'fs'
import * as path from 'path'
import { TaskProvider } from './provider'
import { ReviewBundle, Comment, Reference } from './types'
import { getDiff, DiffOptions } from './diff'

export interface BundleOptions {
  taskId: string
  provider: TaskProvider
  outDir?: string
  baseBranch?: string
  includeDiff?: boolean
}

function formatContextMd(bundle: ReviewBundle): string {
  const lines: string[] = []
  lines.push(`# Code Review: ${bundle.task.id} — ${bundle.task.title}`)
  lines.push('')
  lines.push('## Task Details')
  lines.push(`- **Status:** ${bundle.task.status}`)
  lines.push(`- **Priority:** ${bundle.task.priority}`)
  if (bundle.task.labels.length > 0) {
    lines.push(`- **Labels:** ${bundle.task.labels.join(', ')}`)
  }
  if (bundle.task.assignee) {
    lines.push(`- **Assignee:** ${bundle.task.assignee}`)
  }
  lines.push('')
  lines.push(bundle.task.description)
  lines.push('')

  if (bundle.comments.length > 0) {
    lines.push('## Comments')
    for (const comment of bundle.comments) {
      lines.push(`**${comment.author}** (${comment.createdAt}): ${comment.body}`)
    }
    lines.push('')
  }

  if (bundle.references.length > 0) {
    lines.push('## References')
    for (const ref of bundle.references) {
      const url = ref.url ? ` (${ref.url})` : ''
      lines.push(`- ${ref.title}${url}`)
    }
    lines.push('')
  }

  if (bundle.diff !== undefined) {
    lines.push(`## Changes (vs ${bundle.baseBranch})`)
    if (bundle.diffStat) {
      lines.push('```')
      lines.push(bundle.diffStat)
      lines.push('```')
      lines.push('')
    }
    lines.push('```diff')
    lines.push(bundle.diff)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

export async function createBundle(options: BundleOptions): Promise<ReviewBundle> {
  const { taskId, provider, baseBranch, includeDiff } = options
  const outDir = options.outDir ?? path.resolve(process.cwd(), `review-${taskId}`)

  const task = await provider.get(taskId)

  const [comments, attachments, references] = await Promise.all([
    provider.getComments(taskId),
    provider.getAttachments(taskId),
    provider.getReferences(taskId),
  ])

  let diffResult
  if (includeDiff !== false) {
    const diffOptions: DiffOptions = {}
    if (baseBranch) diffOptions.base = baseBranch
    diffResult = await getDiff(diffOptions)
  }

  const bundle: ReviewBundle = {
    task,
    comments,
    references,
    attachments,
    diff: diffResult?.diff,
    diffStat: diffResult?.stat,
    baseBranch: diffResult?.baseBranch ?? baseBranch ?? '',
    bundlePath: outDir,
  }

  fs.mkdirSync(outDir, { recursive: true })

  const attachmentsDir = path.join(outDir, 'attachments')
  fs.mkdirSync(attachmentsDir, { recursive: true })

  for (const attachment of attachments) {
    try {
      await provider.downloadAttachment(taskId, attachment.id, attachmentsDir)
    } catch {
      // skip attachments that fail to download
    }
  }

  const contextMd = formatContextMd(bundle)
  fs.writeFileSync(path.join(outDir, 'context.md'), contextMd, 'utf-8')

  const ticketJson = JSON.stringify({
    task,
    comments,
    references,
  }, null, 2)
  fs.writeFileSync(path.join(outDir, 'ticket.json'), ticketJson, 'utf-8')

  if (diffResult) {
    fs.writeFileSync(path.join(outDir, 'diff.patch'), diffResult.diff, 'utf-8')
  }

  return bundle
}
