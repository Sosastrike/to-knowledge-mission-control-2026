#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const outputPath = process.argv[3] || ''
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

function readApiKeyFromDb() {
  try {
    return execFileSync('sqlite3', [
      '.data/mission-control.db',
      "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;",
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function request(path, init = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(init.auth === false || !apiKey ? {} : {
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
    }),
    ...(init.headers || {}),
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  let body = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { path, status: response.status, headers: Object.fromEntries(response.headers.entries()), body, text }
}

function unsafeOutput(value) {
  return /\/Users\/|\/home\/|\/var\/folders\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|bot[0-9]+:[A-Za-z0-9_-]{20,}/
    .test(JSON.stringify(value))
}

const failures = []
const results = []

function record(name, result, pick = {}) {
  const body = result.body || {}
  results.push({
    name,
    path: result.path,
    status: result.status,
    ok: body.ok ?? null,
    mode: body.mode || null,
    canonical_status: body.canonical_status || null,
    blocker_class: body.blocker_class || null,
    blocked_reason: body.blocked_reason || body.blocker || body.error || null,
    report_id: body.report?.id || null,
    required_scope: body.required_scope || null,
    accepted_for_execution: body.accepted_for_execution === true,
    execution_enabled: body.execution_enabled === true,
    writes_enabled: body.writes_enabled === true,
    telegram_message_id: body.telegram_message_id || null,
    audit_event_id: body.audit_event_id || null,
    no_fake_done: body.no_fake_done === true,
    no_tokens_exposed: body.no_tokens_exposed === true,
    ...pick,
  })
}

const unauthStatus = await request('/api/bridge/agent-zero/telegram/status', { auth: false })
record('unauthenticated_status_requires_auth', unauthStatus)
if (unauthStatus.status !== 401) failures.push({ name: 'unauthenticated_status_requires_auth', status: unauthStatus.status, error: 'expected_401' })

const status = await request('/api/bridge/agent-zero/telegram/status')
record('authenticated_status', status)
if (status.status !== 200 || status.body?.ok !== true) failures.push({ name: 'authenticated_status', status: status.status, error: 'status_not_ok' })
if (status.body?.active_commander !== 'agent_zero') failures.push({ name: 'authenticated_status', error: 'agent_zero_not_commander' })
if (status.body?.tony_active !== false) failures.push({ name: 'authenticated_status', error: 'tony_active' })
if (status.body?.required_scope !== 'telegram.upload_report_pdf') failures.push({ name: 'authenticated_status', error: 'missing_required_scope' })
if (status.body?.execution_enabled !== false || status.body?.writes_enabled !== false) failures.push({ name: 'authenticated_status', error: 'execution_or_writes_enabled' })
if (unsafeOutput(status.body)) failures.push({ name: 'authenticated_status', error: 'unsafe_output_pattern' })

const created = await request('/api/bridge/agent-zero/reports', {
  method: 'POST',
  body: {
    title: 'Day 53 Telegram PDF Guard',
    summary: 'Proof report for Bridge-gated Telegram PDF delivery.',
    owner_message: 'Create this report and attach the PDF in Telegram.',
    requested_delivery: [{ provider: 'telegram' }],
    sections: [{ heading: 'Proof', body: ['Report generated in Mission Control only.', 'Telegram send remains blocked without exact Bridge Session scope.'] }],
  },
})
record('create_report_with_telegram_requested', created)
if (created.status !== 201 || created.body?.ok !== true || !created.body?.report?.id) {
  failures.push({ name: 'create_report_with_telegram_requested', status: created.status, error: 'report_not_created' })
}
if (created.body?.safety?.external_writes_executed !== false || created.body?.safety?.telegram_attachment_sent !== false) {
  failures.push({ name: 'create_report_with_telegram_requested', error: 'external_delivery_was_reported' })
}
if (String(created.body?.normal_reply || '').startsWith('Done')) failures.push({ name: 'create_report_with_telegram_requested', error: 'fake_done_reply' })
if (unsafeOutput(created.body)) failures.push({ name: 'create_report_with_telegram_requested', error: 'unsafe_output_pattern' })

const reportId = created.body?.report?.id
if (reportId) {
  const pdf = await fetch(`${baseUrl}/api/bridge/agent-zero/reports/${reportId}/pdf`, {
    headers: apiKey ? { 'x-api-key': apiKey, cookie: 'mc-session=runtime-smoke-proxy-pass' } : {},
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const pdfBytes = await pdf.arrayBuffer()
  results.push({
    name: 'pdf_endpoint_resolves',
    path: `/api/bridge/agent-zero/reports/${reportId}/pdf`,
    status: pdf.status,
    content_type: pdf.headers.get('content-type'),
    bytes: pdfBytes.byteLength,
    starts_pdf: Buffer.from(pdfBytes).toString('utf8', 0, 5) === '%PDF-',
  })
  if (pdf.status !== 200) failures.push({ name: 'pdf_endpoint_resolves', status: pdf.status, error: 'pdf_not_served' })
  if (Buffer.from(pdfBytes).toString('utf8', 0, 5) !== '%PDF-') failures.push({ name: 'pdf_endpoint_resolves', error: 'pdf_magic_missing' })

  const upload = await request('/api/bridge/agent-zero/telegram/upload-report', {
    method: 'POST',
    body: {
      report_id: reportId,
      bridge_session_id: 'day53-nonmatching-session',
    },
  })
  record('upload_report_stays_bridge_gated', upload)
  if (upload.status !== 423) failures.push({ name: 'upload_report_stays_bridge_gated', status: upload.status, error: 'expected_423' })
  if (upload.body?.accepted_for_execution === true || upload.body?.telegram_message_id) {
    failures.push({ name: 'upload_report_stays_bridge_gated', error: 'telegram_send_or_fake_send_reported' })
  }
  if (upload.body?.required_scope !== 'telegram.upload_report_pdf') failures.push({ name: 'upload_report_stays_bridge_gated', error: 'missing_upload_scope' })
  if (upload.body?.no_fake_done !== true || upload.body?.no_tokens_exposed !== true) failures.push({ name: 'upload_report_stays_bridge_gated', error: 'missing_safety_flags' })
  if (unsafeOutput(upload.body)) failures.push({ name: 'upload_report_stays_bridge_gated', error: 'unsafe_output_pattern' })
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'Telegram PDF delivery creates a Mission Control PDF, keeps Telegram upload Bridge-gated, and never reports fake send/done or exposes tokens.',
  failures,
  results,
}

const serialized = JSON.stringify(summary, null, 2)
if (outputPath) writeFileSync(outputPath, `${serialized}\n`, { mode: 0o600 })
if (failures.length) {
  console.error(serialized)
  process.exit(1)
}
console.log(serialized)
