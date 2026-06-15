import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { recordJarvisAudit } from '@/lib/jarvis-audit'
import { classifyJarvisAction } from '@/lib/jarvis-action-classifier'
import { activeJarvisBridgeSession } from '@/lib/jarvis-bridge-session'

export type JarvisInternalRecord = {
  id: string
  at: string
  actor: string
  kind: string
  title: string
  payload: Record<string, unknown>
  rollback_note: string
  audit_hash: string
}

const storePath = join(config.dataDir, 'jarvis-internal-state.json')

function readRows(): JarvisInternalRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows(rows: JarvisInternalRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

export function listJarvisInternalRecords(limit = 50) {
  return readRows().slice(0, limit)
}

export function recordJarvisInternalWrite(input: {
  actor: string
  kind: string
  title: string
  payload?: Record<string, unknown>
  rollback_note?: string
}) {
  const session = activeJarvisBridgeSession()
  if (!session) {
    return {
      ok: false as const,
      exact_blocker: 'bridge_session_required',
      status: 423,
    }
  }
  const classification = classifyJarvisAction({
    action: input.kind,
    category: 'internal_state_write',
    target: input.title,
  })
  const audit = recordJarvisAudit({
    actor: input.actor,
    event: 'jarvis_internal_write',
    target: input.title,
    classification: classification.classification,
    detail: {
      kind: input.kind,
      session_id: session.id,
      rollback_note: input.rollback_note || 'Delete this internal Jarvis record and retain the audit event.',
    },
  })
  const record: JarvisInternalRecord = {
    id: `jiw_${randomUUID()}`,
    at: new Date().toISOString(),
    actor: input.actor,
    kind: input.kind,
    title: input.title,
    payload: input.payload || {},
    rollback_note: input.rollback_note || 'Delete this internal Jarvis record and retain the audit event.',
    audit_hash: audit.hash,
  }
  writeRows([record, ...readRows()])
  return { ok: true as const, record, audit }
}
