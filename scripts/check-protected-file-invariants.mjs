#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const protectedPatterns = [
  { name: 'env_file', regex: /(^|\/)\.env($|\.)/ },
  { name: 'database_file', regex: /(^|\/)([^/]+\.)?(db|sqlite|sqlite3)$/i },
  { name: 'data_directory', regex: /^\.data\// },
  { name: 'private_key', regex: /(^|\/)(id_rsa|id_ed25519|.*\.pem|.*\.key)$/i },
  { name: 'backup_archive', regex: /(^|\/).*backup.*\.(tar|tar\.gz|tgz|zip)$/i },
]

const allowedReferencePatterns = [
  /(^|\/)\.env\.(example|sample)$/i,
  /(^|\/)\.env\.[^.]+\.sample$/i,
  /(^|\/)\.env\.production\.sample$/i,
  /^\.designer-review\//,
  /^\.designer-retirement-backups\//,
  /^runtime\/db-backups\/mission-control-before-bridge-approval-audit-\d{8}-\d{6}\.db$/,
]

function isAllowedReference(path) {
  return allowedReferencePatterns.some((pattern) => pattern.test(path))
}

function gitStatus() {
  try {
    return execFileSync('git', ['status', '--short', '--untracked-files=all'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => ({
        status: line.slice(0, 2),
        path: line.slice(3).trim().replace(/^"|"$/g, ''),
      }))
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : 'git_status_failed',
    }, null, 2))
    process.exit(1)
  }
}

const entries = gitStatus()
const protectedChanges = []
const allowedReferenceChanges = []

for (const entry of entries) {
  for (const pattern of protectedPatterns) {
    if (pattern.regex.test(entry.path)) {
      if (isAllowedReference(entry.path)) {
        allowedReferenceChanges.push({
          status: entry.status.trim() || 'modified',
          path: entry.path,
          protection: pattern.name,
        })
        continue
      }
      protectedChanges.push({
        status: entry.status.trim() || 'modified',
        path: entry.path,
        protection: pattern.name,
      })
    }
  }
}

const report = {
  ok: protectedChanges.length === 0,
  checked_at: new Date().toISOString(),
  protected_patterns: protectedPatterns.map((pattern) => pattern.name),
  allowed_reference_changes: allowedReferenceChanges,
  protected_changes: protectedChanges,
  note: 'This check inspects git status paths only. It does not read or print protected file contents.',
}

const text = JSON.stringify(report, null, 2)
if (protectedChanges.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
