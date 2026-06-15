import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export const JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID = 'agentmail_draft_create'
export const JARVIS_AGENTMAIL_DRAFT_ACTION = 'agentmail.draft.create'
export const JARVIS_AGENTMAIL_DRAFT_SESSION_SCOPE = 'agentmail_draft_create'

type AgentMailDraftInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type AgentMailDraftRecord = {
  id: string
  at: string
  recipient_label: string
  subject: string
  body: string
  body_preview: string
  send_enabled: false
  external_delivery_performed: false
  credential_values_exposed: false
  raw_recipient_address_exposed: false
}

type AgentMailDraftDeps = {
  writeDraft?: (draft: AgentMailDraftRecord) => AgentMailDraftRecord
}

export type AgentMailDraftResult = {
  ok: boolean
  adapter_id: typeof JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID
  action: string
  draft_created: boolean
  draft_id: string | null
  recipient_label: string | null
  subject: string | null
  body_preview: string | null
  email_sent: false
  external_delivery_performed: false
  credential_values_exposed: false
  raw_recipient_address_exposed: false
  exact_blocker: string | null
}

const draftStorePath = join(config.dataDir, 'agentmail-drafts.json')

function readDrafts(): AgentMailDraftRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(draftStorePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDrafts(rows: AgentMailDraftRecord[]) {
  mkdirSync(dirname(draftStorePath), { recursive: true })
  writeFileSync(draftStorePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function defaultWriteDraft(draft: AgentMailDraftRecord) {
  writeDrafts([draft, ...readDrafts()])
  return draft
}

function clean(value: unknown, fallback: string, max = 500) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function blockResult(action: string, blocker: string): AgentMailDraftResult {
  return {
    ok: false,
    adapter_id: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
    action: action || 'unknown',
    draft_created: false,
    draft_id: null,
    recipient_label: null,
    subject: null,
    body_preview: null,
    email_sent: false,
    external_delivery_performed: false,
    credential_values_exposed: false,
    raw_recipient_address_exposed: false,
    exact_blocker: blocker,
  }
}

export function executeJarvisAgentMailDraftCreate(
  request: AgentMailDraftInput,
  deps: AgentMailDraftDeps = {},
): AgentMailDraftResult {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_AGENTMAIL_DRAFT_ACTION ||
    scope.system !== 'agentmail' ||
    scope.operation !== 'create_draft' ||
    scope.target !== 'internal_draft'
  ) {
    return blockResult(action, 'exact_scope_required_agentmail_internal_draft_create')
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const recipientLabel = clean(input.recipient_label, 'owner', 120)
  if (!recipientLabel || recipientLabel.includes('@') || recipientLabel.includes('/')) {
    return blockResult(action, 'agentmail_draft_recipient_label_required')
  }

  const subject = clean(input.subject, 'Jarvis Mission Control draft', 160)
  const body = clean(input.body, 'Jarvis prepared this internal draft. No email was sent.', 4000)
  const draft: AgentMailDraftRecord = {
    id: `amd_${randomUUID()}`,
    at: new Date().toISOString(),
    recipient_label: recipientLabel,
    subject,
    body,
    body_preview: body.slice(0, 180),
    send_enabled: false,
    external_delivery_performed: false,
    credential_values_exposed: false,
    raw_recipient_address_exposed: false,
  }
  const written = (deps.writeDraft || defaultWriteDraft)(draft)

  return {
    ok: true,
    adapter_id: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
    action: JARVIS_AGENTMAIL_DRAFT_ACTION,
    draft_created: true,
    draft_id: written.id,
    recipient_label: written.recipient_label,
    subject: written.subject,
    body_preview: written.body_preview,
    email_sent: false,
    external_delivery_performed: false,
    credential_values_exposed: false,
    raw_recipient_address_exposed: false,
    exact_blocker: null,
  }
}
