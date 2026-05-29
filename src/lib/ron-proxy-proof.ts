import { createHash, randomBytes } from 'node:crypto'

import { type NextRequest } from 'next/server'

import { getDatabase, db_helpers } from '@/lib/db'

const RON_RECOVERY_TASK_TITLE = 'Ron Weasley Runtime + Direct-Line Recovery'
const PROOF_MAX_AGE_MS = 72 * 60 * 60 * 1000

type JsonRecord = Record<string, unknown>

export type RonProxyProofResult = {
  ok: boolean
  route: 'bridge.ron.runtime-proof'
  proof_kind: 'mission_control_authenticated_proxy_send_receive'
  target_agent: 'ron-weasley'
  conversation_owner: 'ron-weasley'
  direct_line_used: boolean
  opencloud_intermediary: false
  openclaw_intermediary: false
  response_received: boolean
  authenticated_proxy_send_receive_proof: boolean
  session_id_value_exposed: false
  tokens_cookies_exposed: false
  credential_values_exposed: false
  secrets_exposed: false
  visible_task_event_written: boolean
  visible_task_id: number | null
  masked_session_ref: string | null
  proof_nonce_hash: string
  proof_recorded_at: string
  exact_blocker: string | null
  upstream_status?: number | null
}

type RunRonProxyProofOptions = {
  fetchImpl?: typeof fetch
  nonce?: string
  persist?: boolean
  pollAttempts?: number
  pollDelayMs?: number
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function proofHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function maskSessionId(sessionId: string) {
  if (!sessionId) return null
  if (sessionId.length <= 7) return 'masked'
  return `${sessionId.slice(0, 4)}...${sessionId.slice(-3)}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(fetchImpl: typeof fetch, url: string, init: RequestInit) {
  try {
    const response = await fetchImpl(url, init)
    const body = asObject(await response.json().catch(() => ({})))
    return { ok: response.ok, status: response.status, body }
  } catch {
    return { ok: false, status: null, body: {} }
  }
}

function proxyHeaders(request: NextRequest, json = true) {
  const headers: HeadersInit = { accept: 'application/json' }
  if (json) headers['content-type'] = 'application/json'
  const cookie = request.headers.get('cookie')
  if (cookie) headers.cookie = cookie
  return headers
}

function sessionIdFrom(body: JsonRecord) {
  const direct = textValue(body.session_id)
  if (direct) return direct
  const session = asObject(body.session)
  return textValue(session.session_id)
}

function sessionHasResponse(body: JsonRecord) {
  const messages = asArray(body.messages)
  const assistantMessage = messages.some((message) => {
    const item = asObject(message)
    return textValue(item.role) === 'assistant' && textValue(item.content).trim().length > 0
  })
  const session = asObject(body.session)
  return assistantMessage || numberValue(session.message_count) >= 2
}

function baseResult(input: {
  nonce: string
  sessionId?: string
  recordedAt?: Date
  visibleTaskId?: number | null
  visibleTaskEventWritten?: boolean
}): RonProxyProofResult {
  return {
    ok: false,
    route: 'bridge.ron.runtime-proof',
    proof_kind: 'mission_control_authenticated_proxy_send_receive',
    target_agent: 'ron-weasley',
    conversation_owner: 'ron-weasley',
    direct_line_used: false,
    opencloud_intermediary: false,
    openclaw_intermediary: false,
    response_received: false,
    authenticated_proxy_send_receive_proof: false,
    session_id_value_exposed: false,
    tokens_cookies_exposed: false,
    credential_values_exposed: false,
    secrets_exposed: false,
    visible_task_event_written: input.visibleTaskEventWritten || false,
    visible_task_id: input.visibleTaskId || null,
    masked_session_ref: input.sessionId ? maskSessionId(input.sessionId) : null,
    proof_nonce_hash: proofHash(input.nonce),
    proof_recorded_at: (input.recordedAt || new Date()).toISOString(),
    exact_blocker: null,
  }
}

function failure(input: {
  nonce: string
  exactBlocker: string
  status?: number | null
  sessionId?: string
}): RonProxyProofResult {
  return {
    ...baseResult({ nonce: input.nonce, sessionId: input.sessionId }),
    exact_blocker: input.exactBlocker,
    upstream_status: input.status ?? null,
  }
}

function parseMetadata(value: unknown): JsonRecord {
  if (typeof value !== 'string' || !value) return {}
  try {
    return asObject(JSON.parse(value))
  } catch {
    return {}
  }
}

function findOrCreateRonRecoveryTask() {
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const existing = db.prepare(`
    SELECT id, metadata, workspace_id
    FROM tasks
    WHERE title = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(RON_RECOVERY_TASK_TITLE) as { id: number; metadata?: string; workspace_id?: number } | undefined

  if (existing) return existing

  const metadata = {
    affected_system: 'Ron Weasley',
    current_status: 'mission_control_authenticated_proxy_send_receive_proof_pending',
    project_continues: true,
    proof_visible_to_owner: true,
    timeline: [],
  }
  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, created_at, updated_at, tags, metadata, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    RON_RECOVERY_TASK_TITLE,
    'Owner-visible recovery lane for Ron Weasley runtime and Mission Control proxy proof.',
    'in_progress',
    'urgent',
    'ron-weasley',
    'codex',
    now,
    now,
    JSON.stringify(['ron-weasley', 'runtime-proof', 'mission-control-proxy']),
    JSON.stringify(metadata),
    1,
  )

  return { id: Number(result.lastInsertRowid), metadata: JSON.stringify(metadata), workspace_id: 1 }
}

export function recordRonMissionControlProxyProof(proof: RonProxyProofResult) {
  if (!proof.ok) return { written: false, taskId: null }

  const db = getDatabase()
  const task = findOrCreateRonRecoveryTask()
  const now = Math.floor(Date.now() / 1000)
  const metadata = parseMetadata(task.metadata)
  const timeline = asArray(metadata.timeline)
  const event = {
    event: 'RON_MISSION_CONTROL_PROXY_SEND_RECEIVE_PROOF',
    status: 'passed',
    created_at: proof.proof_recorded_at,
    source: 'api.bridge.ron.runtime-proof',
    proof: 'Mission Control authenticated proxy sent a safe nonce to Ron WebUI and observed response proof. Session ids, cookies, tokens, and credentials were not exposed.',
    target_agent: proof.target_agent,
    conversation_owner: proof.conversation_owner,
    direct_line_used: proof.direct_line_used,
    opencloud_intermediary: proof.opencloud_intermediary,
    authenticated_proxy_send_receive_proof: true,
    session_id_value_exposed: false,
    tokens_cookies_exposed: false,
    proof_nonce_hash: proof.proof_nonce_hash,
    masked_session_ref: proof.masked_session_ref,
  }
  const updatedMetadata = {
    ...metadata,
    current_status: 'mission_control_proxy_certified',
    blocker: null,
    mission_control_proxy_authenticated_send_receive_proof: {
      ...event,
      task_id: task.id,
    },
    timeline: [...timeline, event],
  }

  db.prepare('UPDATE tasks SET metadata = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(updatedMetadata), 'quality_review', now, task.id)
  db.prepare(`
    INSERT INTO comments (task_id, author, content, created_at, mentions, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    'codex',
    `${event.event}: ${event.proof}`,
    now,
    null,
    task.workspace_id || 1,
  )
  db_helpers.logActivity(
    'task_event_added',
    'task',
    task.id,
    'codex',
    'Ron Mission Control proxy proof recorded',
    { task_id: task.id, event: event.event, proof_nonce_hash: proof.proof_nonce_hash },
    task.workspace_id || 1,
  )

  return { written: true, taskId: task.id }
}

export function getLatestRonMissionControlProxyProof(maxAgeMs = PROOF_MAX_AGE_MS): RonProxyProofResult | null {
  try {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, metadata
      FROM tasks
      WHERE title = ?
      ORDER BY id DESC
      LIMIT 4
    `).all(RON_RECOVERY_TASK_TITLE) as Array<{ id: number; metadata?: string }>
    const now = Date.now()
    for (const row of rows) {
      const metadata = parseMetadata(row.metadata)
      const proof = asObject(metadata.mission_control_proxy_authenticated_send_receive_proof)
      if (!proof.authenticated_proxy_send_receive_proof) continue
      const recordedAt = Date.parse(textValue(proof.created_at))
      if (!Number.isFinite(recordedAt) || now - recordedAt > maxAgeMs) continue
      return {
        ...baseResult({
          nonce: textValue(proof.proof_nonce_hash) || 'persisted',
          recordedAt: new Date(recordedAt),
          visibleTaskId: row.id,
          visibleTaskEventWritten: true,
        }),
        ok: true,
        direct_line_used: true,
        response_received: true,
        authenticated_proxy_send_receive_proof: true,
        masked_session_ref: textValue(proof.masked_session_ref) || null,
        proof_nonce_hash: textValue(proof.proof_nonce_hash),
        exact_blocker: null,
      }
    }
    return null
  } catch {
    return null
  }
}

export async function runRonMissionControlProxyProof(
  request: NextRequest,
  options: RunRonProxyProofOptions = {},
): Promise<RonProxyProofResult> {
  const fetchImpl = options.fetchImpl || fetch
  const nonce = options.nonce || `RON_PROXY_PROOF_${new Date().toISOString()}_${randomBytes(3).toString('hex')}`
  const origin = new URL(request.url).origin
  const sessionUrl = new URL('/gateway/agent-hub/ron/webui/api/session/new', origin).href
  const sendUrl = new URL('/gateway/agent-hub/ron/webui/api/chat/start', origin).href
  const message = `RON_PROXY_PROOF ${nonce}. Safe proof only: acknowledge target_agent=ron-weasley without tools or external actions.`

  const sessionResponse = await fetchJson(fetchImpl, sessionUrl, {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify({
      title: `Mission Control Ron proxy proof ${proofHash(nonce)}`,
    }),
    cache: 'no-store',
  })
  const sessionId = sessionIdFrom(sessionResponse.body)
  if (!sessionResponse.ok || !sessionId) {
    return failure({ nonce, exactBlocker: 'ron_proxy_session_create_failed', status: sessionResponse.status })
  }

  const sendResponse = await fetchJson(fetchImpl, sendUrl, {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify({
      session_id: sessionId,
      message,
    }),
    cache: 'no-store',
  })
  if (!sendResponse.ok) {
    return failure({ nonce, exactBlocker: 'ron_proxy_send_failed', status: sendResponse.status, sessionId })
  }

  const sessionReadUrl = new URL('/gateway/agent-hub/ron/webui/api/session', origin)
  sessionReadUrl.searchParams.set('session_id', sessionId)
  sessionReadUrl.searchParams.set('messages', '1')
  sessionReadUrl.searchParams.set('resolve_model', '0')
  sessionReadUrl.searchParams.set('msg_limit', '8')

  let responseReceived = false
  let upstreamStatus: number | null = null
  const attempts = Math.max(1, options.pollAttempts ?? 8)
  const pollDelay = Math.max(0, options.pollDelayMs ?? 750)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0 && pollDelay > 0) await delay(pollDelay)
    const sessionRead = await fetchJson(fetchImpl, sessionReadUrl.href, {
      method: 'GET',
      headers: proxyHeaders(request, false),
      cache: 'no-store',
    })
    upstreamStatus = sessionRead.status
    if (sessionRead.ok && sessionHasResponse(sessionRead.body)) {
      responseReceived = true
      break
    }
  }

  if (!responseReceived) {
    return failure({ nonce, exactBlocker: 'ron_proxy_response_timeout', status: upstreamStatus, sessionId })
  }

  const proof = {
    ...baseResult({ nonce, sessionId }),
    ok: true,
    direct_line_used: true,
    response_received: true,
    authenticated_proxy_send_receive_proof: true,
  }

  if (options.persist === false) return proof

  try {
    const event = recordRonMissionControlProxyProof(proof)
    if (!event.written || !event.taskId) {
      return {
        ...proof,
        ok: false,
        authenticated_proxy_send_receive_proof: false,
        exact_blocker: 'ron_proxy_visible_task_event_failed',
      }
    }
    return {
      ...proof,
      visible_task_event_written: true,
      visible_task_id: event.taskId,
    }
  } catch {
    return {
      ...proof,
      ok: false,
      authenticated_proxy_send_receive_proof: false,
      exact_blocker: 'ron_proxy_visible_task_event_failed',
    }
  }
}
