#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export const CORE_ROLLBACK_LANES = [
  { id: 'mission-control', rollback: 'git revert <commit> && restart Mission Control' },
  { id: 'gateway-agent-hub', rollback: 'git revert <commit> && rebuild/restart Mission Control' },
  { id: 'agent-zero', rollback: 'git revert <commit>; disable changed Agent Zero route if needed' },
  { id: 'hermes', rollback: 'git revert <commit>; keep Hermes writes Bridge-gated' },
  { id: 'pi', rollback: 'git revert <commit>; Pi remains advisory only' },
  { id: 'spaceagent', rollback: 'git revert <commit>; disable read-only research runner if needed' },
  { id: 'paperclip', rollback: 'git revert <commit>; stop local Paperclip sandbox only if this lane started it' },
  { id: 'openclaw-plus', rollback: 'git revert <commit>; do not remove skills/agents/memory' },
  { id: 'bridge-session', rollback: 'git revert <commit>; revoke pending approval scope if needed' },
  { id: 'buildwiki-farmer', rollback: 'git revert <commit>; systemctl --user stop opencloud-docs-farmer.service only for a started run' },
  { id: 'delivery-connectors', rollback: 'git revert <commit>; do not delete OAuth or connector credentials' },
  { id: 'brain', rollback: 'git revert <commit>; do not delete vaults, indexes, or memory stores' },
  { id: 'runtime-deployment', rollback: 'git revert <commit>; restart previous known-good Mission Control build' },
  { id: 'security', rollback: 'git revert <commit>; keep scans/report artifacts for audit unless unsafe' },
  { id: 'ux', rollback: 'git revert <commit>; restore previous visual contract state' },
]

const rollbackPattern = /\b(rollback|revert)\b[\s\S]{0,220}\b(git revert|restart|disable|stop|restore|previous known-good)\b/i

export function checkRollbackText(path, text) {
  const ok = rollbackPattern.test(text)
  return {
    path,
    ok,
    reason: ok ? 'rollback_present' : 'rollback_missing',
  }
}

function recentDayCloseouts() {
  try {
    const files = execFileSync('git', [
      'ls-files',
      'runtime/day-6[3-9]-*.md',
      'runtime/day-7[0-2]-*.md',
    ], {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
    })
    return files.split('\n').map((file) => file.trim()).filter(Boolean)
  } catch (error) {
    return []
  }
}

export function buildRollbackPlanReport({
  checked_at,
  closeout_results,
}) {
  const missingRollbackReports = closeout_results.filter((result) => !result.ok)
  return {
    ok: missingRollbackReports.length === 0,
    checked_at,
    mode: 'rollback_plan_per_lane',
    blocker_class: missingRollbackReports.length ? 'BLOCKED' : 'NONE',
    rollback_values_printed: false,
    closeout_files_checked: closeout_results.length,
    core_lanes: CORE_ROLLBACK_LANES,
    missing_rollback_reports: missingRollbackReports,
    closeout_results,
  }
}

function run() {
  const closeoutResults = recentDayCloseouts().map((path) => checkRollbackText(
    path,
    readFileSync(path, 'utf8'),
  ))
  const report = buildRollbackPlanReport({
    checked_at: new Date().toISOString(),
    closeout_results: closeoutResults,
  })

  const text = JSON.stringify(report, null, 2)
  console.log(text)
  if (!report.ok) {
    process.exit(1)
  }
}

if (import.meta.url === `${['file', '://'].join('')}${process.argv[1]}`) {
  run()
}
