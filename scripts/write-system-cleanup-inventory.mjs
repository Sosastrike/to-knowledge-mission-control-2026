#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const outputPath = process.argv[2] || 'runtime/system-cleanup-inventory-report.md'

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
      ...options,
    })
  } catch {
    return ''
  }
}

function gitStatusEntries() {
  const raw = run('git', ['status', '--short'])
  return raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim()
      const path = line.slice(3).trim()
      return { status, path }
    })
}

function isTracked(path) {
  return run('git', ['ls-files', '--error-unmatch', path]) !== ''
}

function countReferences(path) {
  const needle = path.replace(/\/$/, '')
  if (!needle) return 0
  const raw = run('rg', [
    '--fixed-strings',
    '--count-matches',
    '--glob', '!.git',
    '--glob', '!node_modules',
    '--glob', '!.next',
    '--glob', '!runtime/system-cleanup-inventory-report.md',
    needle,
    '.',
  ])
  return raw
    .split('\n')
    .filter(Boolean)
    .reduce((total, line) => {
      const match = line.match(/:(\d+)$/)
      return total + (match ? Number(match[1]) : 0)
    }, 0)
}

function classify(path) {
  if (path.includes('.designer-review/')) return 'designer_review_reference'
  if (path.includes('.bak') || path.includes('.DISABLED')) return 'old_backup'
  if (path.endsWith('.pdf') || path.endsWith('.mp4')) return 'untracked_artifact'
  if (path.endsWith('.sh') || path.endsWith('.cjs') || path.endsWith('.mjs')) return 'untracked_helper'
  if (path.includes('runtime/')) return 'runtime_report'
  return 'untracked_file'
}

function riskFor(entry) {
  if (entry.path.includes('.env')) return 'high'
  if (entry.path.includes('src/app/') || entry.path.includes('public/')) return 'medium'
  if (entry.reference_count > 0) return 'medium'
  return 'low'
}

function recommendationFor(entry) {
  if (entry.category === 'designer_review_reference') return 'keep_reference'
  if (entry.path.includes('.env')) return 'needs_owner_approval'
  if (entry.reference_count > 0 || entry.risk === 'medium') return 'quarantine_after_checks'
  return 'review_before_action'
}

function rollbackFor(entry) {
  if (entry.recommendation === 'keep_reference') return 'none'
  if (entry.recommendation === 'quarantine_after_checks') {
    return `restore from runtime/archive/system-cleanup/<batch>/${entry.path}`
  }
  return 'owner-approved rollback plan required'
}

const entries = gitStatusEntries().map((item) => {
  const entry = {
    ...item,
    tracked: isTracked(item.path),
    category: classify(item.path),
    reference_count: countReferences(item.path),
  }
  entry.risk = riskFor(entry)
  entry.recommendation = recommendationFor(entry)
  entry.rollback = rollbackFor(entry)
  return entry
})

const byCategory = entries.reduce((acc, entry) => {
  acc[entry.category] = (acc[entry.category] || 0) + 1
  return acc
}, {})

const safeLater = entries.filter((entry) => entry.recommendation === 'quarantine_after_checks')
const keepReference = entries.filter((entry) => entry.recommendation === 'keep_reference')
const needsApproval = entries.filter((entry) => entry.recommendation === 'needs_owner_approval')

const lines = [
  '# System Cleanup Inventory Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  'Mode: inventory only. No delete. No quarantine. No protected action.',
  '',
  '## Summary',
  `- Total dirty-tree candidates: ${entries.length}`,
  ...Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, count]) => `- ${category}: ${count}`),
  '',
  '## Current Candidates',
]

for (const entry of entries) {
  lines.push(
    `- ${entry.path}`,
    `  - git status: ${entry.status}`,
    `  - category: ${entry.category}`,
    `  - tracked: ${entry.tracked ? 'yes' : 'no'}`,
    `  - reference count: ${entry.reference_count}`,
    `  - production risk: ${entry.risk}`,
    `  - recommended action: ${entry.recommendation}`,
    `  - rollback: ${entry.rollback}`,
  )
}

lines.push(
  '',
  '## Safe To Quarantine Later After Checks',
  ...(safeLater.length ? safeLater.map((entry) => `- ${entry.path}`) : ['- None']),
  '',
  '## Reference Material To Keep Out Of Runtime Releases',
  ...(keepReference.length ? keepReference.map((entry) => `- ${entry.path}`) : ['- None']),
  '',
  '## Needs Explicit Owner Approval Before Any Removal',
  ...(needsApproval.length ? needsApproval.map((entry) => `- ${entry.path}`) : ['- None from the current dirty tree']),
  '',
  '## Required Checks Before Future Quarantine',
  '- `git status --short`',
  '- fixed-string reference scan',
  '- route smoke checks',
  '- `pnpm run typecheck`',
  '- `pnpm run build`',
  '- `node scripts/check-overnight-readonly-safety.mjs http://127.0.0.1:3337`',
  '- secret-pattern scan',
  '- public login smoke check',
  '',
  '## Current Action',
  '- No files were deleted.',
  '- No files were quarantined.',
  '- No production data, credentials, backups, memory, governance, or active service files were touched.',
  '- Keep the dirty-tree reference material separated from release commits unless the owner explicitly approves an archive/docs batch.',
  '',
)

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${lines.join('\n')}\n`)
console.log(JSON.stringify({ ok: true, outputPath, candidates: entries.length, byCategory }, null, 2))
