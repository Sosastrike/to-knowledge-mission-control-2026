#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function run(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

function runOrEmpty(args) {
  try {
    return run(args)
  } catch {
    return ''
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function categoryFor(rel, status) {
  const base = path.basename(rel)
  if (/^\.env(\.|$)/.test(base)) return 'protected_secret_or_env'
  if (/mission-control\.db$|\.sqlite$|\.sqlite3$/.test(base)) return 'protected_database'
  if (/^docs\/migrations\/draft-/.test(rel)) return 'old_draft'
  if (/^docs\/migrations\/proposed-/.test(rel)) return 'canonical_keep'
  if (/^public\/designer-mission-control\/src\/replicas\/.*\.bak/.test(rel)) return 'obsolete_prototype_backup'
  if (base.startsWith('._')) return 'untracked_temporary_file'
  if (/\.(log|pid)$/.test(base)) return 'untracked_temporary_file'
  if (/\.bak(\.|$|-)/.test(base)) return 'old_backup'
  if (/^\.designer-review\//.test(rel)) return 'designer_review_reference'
  if (/^public\/designer-mission-control\//.test(rel)) return 'active_route_or_designer_asset'
  if (status === 'M') return 'modified_tracked_file'
  if (status === '??') return 'untracked_file'
  return 'risky_unknown'
}

function riskFor(category) {
  if (category.startsWith('protected_')) return 'high'
  if (category === 'active_route_or_designer_asset') return 'high'
  if (category === 'modified_tracked_file') return 'medium'
  if (category === 'risky_unknown') return 'medium'
  if (category === 'old_backup' || category === 'obsolete_prototype_backup') return 'medium'
  return 'low'
}

function actionFor(category) {
  if (category === 'canonical_keep') return 'keep'
  if (category.startsWith('protected_')) return 'needs_owner_approval'
  if (category === 'active_route_or_designer_asset') return 'needs_owner_approval'
  if (category === 'old_draft') return 'mark_reference_only'
  if (category === 'designer_review_reference') return 'keep_reference'
  if (category === 'modified_tracked_file') return 'review_release_group'
  if (category === 'untracked_temporary_file') return 'quarantine_after_checks'
  if (category === 'old_backup' || category === 'obsolete_prototype_backup') return 'quarantine_after_checks'
  return 'review_before_action'
}

function rollbackFor(rel, action) {
  if (action === 'keep' || action === 'keep_reference') return 'none'
  if (action === 'review_release_group') return `git checkout -- ${rel} (only after owner confirms it is unrelated)`
  if (action === 'mark_reference_only') return 'git revert cleanup commit'
  if (action === 'quarantine_after_checks') return `cp -a runtime/archive/system-cleanup/<batch>/${rel} ${rel}`
  return 'owner-approved rollback plan required'
}

function parseStatus() {
  return run(['status', '--short'])
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || line.slice(0, 2)
      const rel = line.slice(3).replace(/^"|"$/g, '')
      return { status, rel }
    })
}

function evidenceFor(rel) {
  const tracked = runOrEmpty(['ls-files', '--error-unmatch', rel]).trim() === rel
  const imported = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)
    ? runOrEmpty(['grep', '-F', '-n', rel]).trim().length > 0
    : false
  return {
    exists: exists(rel),
    git_tracked: tracked,
    imported_by_code: imported,
    referenced_by_docs: false,
    referenced_by_service: false,
    referenced_by_route: /^src\/app\//.test(rel) || /^public\/designer-mission-control\//.test(rel),
  }
}

const items = parseStatus().map(({ status, rel }) => {
  const category = categoryFor(rel, status)
  const production_risk = riskFor(category)
  const recommended_action = actionFor(category)
  return {
    path: rel,
    git_status: status,
    category,
    reason: `${category} detected from live git status`,
    current_usage_evidence: evidenceFor(rel),
    production_risk,
    recommended_action,
    rollback_plan: rollbackFor(rel, recommended_action),
  }
})

const byCategory = items.reduce((acc, item) => {
  acc[item.category] = (acc[item.category] || 0) + 1
  return acc
}, {})

const report = {
  ok: true,
  mode: 'inventory_only_no_delete_no_quarantine',
  generated_at: new Date().toISOString(),
  total: items.length,
  by_category: byCategory,
  protected_actions_taken: false,
  deletion_performed: false,
  quarantine_performed: false,
  items,
  next_action: 'Review medium/high-risk items, then quarantine only after owner-approved checks. Do not delete in the first pass.',
}

console.log(JSON.stringify(report, null, 2))
