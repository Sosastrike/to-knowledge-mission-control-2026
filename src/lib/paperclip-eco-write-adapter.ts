import { randomUUID } from 'node:crypto'

export const PAPERCLIP_ECO_WRITE_ADAPTER_ID = 'paperclip_eco_task_write'
export const PAPERCLIP_ECO_COMMENT_ACTION = 'paperclip.eco_issue_comment.create'
export const PAPERCLIP_ECO_WRITE_SCOPE = {
  company: 'ECO',
  operation: 'issue_comment_create',
  target: 'existing_issue',
} as const

export type PaperclipEcoWriteScope = Record<string, unknown>

export type PaperclipEcoIssueCommentPrepared =
  | {
      ok: true
      issue_identifier: string
      body: string
      idempotency_key: string
    }
  | {
      ok: false
      exact_blocker: string
    }

export type PaperclipEcoIssueCommentExecuteInput = {
  action?: string
  scope?: PaperclipEcoWriteScope
  input?: Record<string, unknown>
  idempotency_key?: string | null
  paperclip_run_id?: string | null
}

export type PaperclipEcoIssueCommentExecuteResult = {
  ok: boolean
  exact_blocker: string | null
  prepared: PaperclipEcoIssueCommentPrepared
  issue_identifier: string | null
  issue_id: string | null
  comment_id: string | null
  issue_status_before: string | null
  issue_status_after: string | null
  rollback_strategy: 'delete_if_queued_else_compensating_comment' | 'none'
  paperclip_task_created: false
  paperclip_comment_created: boolean
  paperclip_issue_modified: boolean
  tok_touched: false
  credential_values_exposed: false
  raw_comment_body_returned: false
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

function cleanString(value: unknown, limit = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function scopeMatches(scope: PaperclipEcoWriteScope | undefined) {
  return Boolean(
    scope &&
    scope.company === PAPERCLIP_ECO_WRITE_SCOPE.company &&
    scope.operation === PAPERCLIP_ECO_WRITE_SCOPE.operation &&
    scope.target === PAPERCLIP_ECO_WRITE_SCOPE.target,
  )
}

export function preparePaperclipEcoIssueCommentWrite(input: PaperclipEcoIssueCommentExecuteInput): PaperclipEcoIssueCommentPrepared {
  if (input.action !== PAPERCLIP_ECO_COMMENT_ACTION || !scopeMatches(input.scope)) {
    return { ok: false, exact_blocker: 'exact_scope_required_paperclip_eco_issue_comment_write' }
  }

  const inputObject = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
  const issueIdentifier = cleanString(inputObject.issue_identifier, 80).toUpperCase()
  if (!issueIdentifier) return { ok: false, exact_blocker: 'paperclip_write_target_required' }
  if (issueIdentifier.startsWith('TOK-')) return { ok: false, exact_blocker: 'paperclip_tok_scope_forbidden' }
  if (!/^ECO-\d+$/i.test(issueIdentifier)) return { ok: false, exact_blocker: 'paperclip_write_target_required' }

  const body = cleanString(inputObject.body, 600)
  if (!body) return { ok: false, exact_blocker: 'paperclip_comment_body_required' }
  if (/@[A-Za-z0-9_-]+/.test(body)) return { ok: false, exact_blocker: 'paperclip_comment_mentions_forbidden' }

  const idempotencyKey = cleanString(input.idempotency_key, 180) || `jarvis:paperclip-eco-comment:${randomUUID()}`
  return {
    ok: true,
    issue_identifier: issueIdentifier,
    body: `[Jarvis exact-scope proof] ${body}`,
    idempotency_key: idempotencyKey,
  }
}

export function buildPaperclipEcoIssueCommentPayload(prepared: PaperclipEcoIssueCommentPrepared) {
  return {
    body: prepared.ok ? prepared.body : '',
    reopen: false,
    resume: false,
    interrupt: false,
  }
}

function redactedPrepared(prepared: PaperclipEcoIssueCommentPrepared): PaperclipEcoIssueCommentPrepared {
  return prepared.ok ? { ...prepared, body: '[redacted]' } : prepared
}

function cleanUuid(value: unknown) {
  const cleaned = cleanString(value, 120)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : ''
}

export function paperclipApiBaseUrl(rawValue?: string | null) {
  const raw = (rawValue || process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_BASE_URL || 'http://127.0.0.1:3100').trim()
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('paperclip_endpoint_protocol_forbidden')
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) && !url.hostname.startsWith('100.')) {
    throw new Error('paperclip_endpoint_not_local_or_tailnet')
  }
  const origin = url.origin.replace(/\/+$/, '')
  return url.pathname.replace(/\/+$/, '').endsWith('/api') ? `${origin}${url.pathname.replace(/\/+$/, '')}` : `${origin}/api`
}

function statusBlocker(status: number, stage: 'issue_read' | 'comment_create') {
  if (status === 401 || status === 403) return 'paperclip_write_credential_required'
  if (status === 404) return 'paperclip_write_target_required'
  if (status === 409) return 'paperclip_write_target_not_safe'
  return `paperclip_write_failed_${stage}_http_${status}`
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function executePaperclipEcoIssueCommentWrite(input: PaperclipEcoIssueCommentExecuteInput & {
  apiKey?: string | null
  apiBaseUrl?: string | null
  fetchImpl?: FetchLike
}): Promise<PaperclipEcoIssueCommentExecuteResult> {
  const prepared = preparePaperclipEcoIssueCommentWrite(input)
  const responsePrepared = redactedPrepared(prepared)

  if (!prepared.ok) {
    return {
      ok: false,
      exact_blocker: prepared.exact_blocker,
      prepared: responsePrepared,
      issue_identifier: null,
      issue_id: null,
      comment_id: null,
      issue_status_before: null,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  const apiKey = cleanString(input.apiKey, 5000)
  if (!apiKey) {
    return {
      ok: false,
      exact_blocker: 'paperclip_write_credential_required',
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: null,
      comment_id: null,
      issue_status_before: null,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  let apiBaseUrl: string
  try {
    apiBaseUrl = paperclipApiBaseUrl(input.apiBaseUrl)
  } catch {
    return {
      ok: false,
      exact_blocker: 'paperclip_write_auth_path_missing',
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: null,
      comment_id: null,
      issue_status_before: null,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  const fetcher = input.fetchImpl || fetch
  const paperclipRunId = cleanUuid(input.paperclip_run_id)
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': prepared.idempotency_key,
  }
  const issueUrl = `${apiBaseUrl}/issues/${encodeURIComponent(prepared.issue_identifier)}`
  const issueResponse = await fetcher(issueUrl, { headers, cache: 'no-store' })
  if (!issueResponse.ok) {
    return {
      ok: false,
      exact_blocker: statusBlocker(issueResponse.status, 'issue_read'),
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: null,
      comment_id: null,
      issue_status_before: null,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  const issue = await readJson(issueResponse)
  const issueId = cleanString(issue?.id, 120)
  const identifier = cleanString(issue?.identifier, 80).toUpperCase()
  const statusBefore = cleanString(issue?.status, 80) || null
  const assigneeAgentId = cleanString(issue?.assigneeAgentId, 120)
  if (!issueId || identifier !== prepared.issue_identifier) {
    return {
      ok: false,
      exact_blocker: 'paperclip_write_target_required',
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: issueId || null,
      comment_id: null,
      issue_status_before: statusBefore,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }
  if (assigneeAgentId || ['in_progress', 'blocked', 'closed', 'done'].includes((statusBefore || '').toLowerCase())) {
    return {
      ok: false,
      exact_blocker: 'paperclip_write_target_not_controlled',
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: issueId,
      comment_id: null,
      issue_status_before: statusBefore,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  const commentResponse = await fetcher(`${issueUrl}/comments`, {
    method: 'POST',
    headers: {
      ...headers,
      ...(paperclipRunId ? { 'X-Paperclip-Run-Id': paperclipRunId } : {}),
    },
    body: JSON.stringify(buildPaperclipEcoIssueCommentPayload(prepared)),
    cache: 'no-store',
  })
  const comment = await readJson(commentResponse)
  if (!commentResponse.ok) {
    return {
      ok: false,
      exact_blocker: statusBlocker(commentResponse.status, 'comment_create'),
      prepared: responsePrepared,
      issue_identifier: prepared.issue_identifier,
      issue_id: issueId,
      comment_id: null,
      issue_status_before: statusBefore,
      issue_status_after: null,
      rollback_strategy: 'none',
      paperclip_task_created: false,
      paperclip_comment_created: false,
      paperclip_issue_modified: false,
      tok_touched: false,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
    }
  }

  const commentId = cleanString(comment?.id, 120)
  const afterResponse = await fetcher(issueUrl, { headers, cache: 'no-store' })
  const issueAfter = afterResponse.ok ? await readJson(afterResponse) : null
  const statusAfter = cleanString(issueAfter?.status, 80) || statusBefore

  return {
    ok: Boolean(commentId),
    exact_blocker: commentId ? null : 'paperclip_write_failed',
    prepared: responsePrepared,
    issue_identifier: prepared.issue_identifier,
    issue_id: issueId,
    comment_id: commentId || null,
    issue_status_before: statusBefore,
    issue_status_after: statusAfter,
    rollback_strategy: commentId ? 'delete_if_queued_else_compensating_comment' : 'none',
    paperclip_task_created: false,
    paperclip_comment_created: Boolean(commentId),
    paperclip_issue_modified: statusAfter !== statusBefore,
    tok_touched: false,
    credential_values_exposed: false,
    raw_comment_body_returned: false,
  }
}
