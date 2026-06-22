import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { JARVIS_ACTOR_ID } from '@/lib/jarvis-owner-operator-policy'

export type JarvisAuditEvent = {
  id: string
  at: string
  actor: string
  event: string
  target: string
  classification: string
  status: 'recorded' | 'blocked' | 'failed'
  detail: Record<string, unknown>
  previous_hash: string
  hash: string
}

type AuditInput = {
  actor?: string
  event: string
  target: string
  classification: string
  status?: JarvisAuditEvent['status']
  detail?: Record<string, unknown>
}

const auditPath = join(config.dataDir, 'jarvis-audit.jsonl')

function redactString(value: string) {
  return value
    .replace(/\/home\/[^/\s]+/g, '/<redacted-home>')
    .replace(/\/Users\/[^/\s]+/g, '/<redacted-home>')
    .replace(/(sk-[A-Za-z0-9_-]{8,})/g, '<redacted-secret>')
    .replace(/(xox[baprs]-[A-Za-z0-9-]+)/g, '<redacted-secret>')
    .replace(/(ghp_[A-Za-z0-9_]+)/g, '<redacted-secret>')
    .replace(/(github_pat_[A-Za-z0-9_]+)/g, '<redacted-secret>')
    .replace(/([A-Za-z0-9+/]{40,}={0,2})/g, '<redacted-token>')
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase()
      if (lower.includes('secret') || lower.includes('token') || lower.includes('password') || lower.includes('cookie')) {
        return [key, '<redacted>']
      }
      return [key, redact(item)]
    }))
  }
  return value
}

function readRows(): JarvisAuditEvent[] {
  try {
    return readFileSync(auditPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as JarvisAuditEvent)
  } catch {
    return []
  }
}

function hashRow(row: Omit<JarvisAuditEvent, 'hash'>) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex')
}

export function recordJarvisAudit(input: AuditInput): JarvisAuditEvent {
  const rows = readRows()
  const previous = rows.at(-1)?.hash || 'GENESIS'
  const base: Omit<JarvisAuditEvent, 'hash'> = {
    id: `jau_${randomUUID()}`,
    at: new Date().toISOString(),
    actor: input.actor || JARVIS_ACTOR_ID,
    event: input.event,
    target: input.target,
    classification: input.classification,
    status: input.status || 'recorded',
    detail: redact(input.detail || {}) as Record<string, unknown>,
    previous_hash: previous,
  }
  const row = { ...base, hash: hashRow(base) }
  mkdirSync(dirname(auditPath), { recursive: true })
  writeFileSync(auditPath, `${rows.map((item) => JSON.stringify(item)).join('\n')}${rows.length ? '\n' : ''}${JSON.stringify(row)}\n`, 'utf8')
  return row
}

export function listJarvisAudit(limit = 50) {
  return readRows().slice(-limit).reverse()
}

export function jarvisAuditSummary() {
  const rows = readRows()
  return {
    total: rows.length,
    last_hash: rows.at(-1)?.hash || null,
    hash_chained: rows.every((row, index) => index === 0 ? row.previous_hash === 'GENESIS' : row.previous_hash === rows[index - 1].hash),
    persistence: 'jsonl',
    secret_values_exposed: false,
  }
}
