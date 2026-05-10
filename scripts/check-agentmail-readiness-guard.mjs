#!/usr/bin/env node

const baseUrl = (process.argv[2] || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const outputPath = process.argv[3] || null
const apiKey = process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || ''
const authHeaders = apiKey
  ? {
      'x-api-key': apiKey,
      cookie: 'mc-session=runtime-smoke-proxy-pass',
    }
  : {}

async function request(path, authenticated = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authenticated ? authHeaders : {},
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text }
}

function hasUnsafeText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return /AGENTMAIL_(?:API_KEY|TOKEN|API_KEY_FILE)=|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|\/Users\/|\/var\/folders\/|\/tmp\//.test(text)
}

const failures = []
const results = []
const path = '/api/bridge/agent-zero/agentmail/status'

const unauth = await request(path, false)
results.push({
  name: 'unauthenticated_status_requires_auth',
  path,
  status: unauth.status,
  unsafe_text_detected: hasUnsafeText(unauth.body),
})
if (unauth.status !== 401) failures.push({ name: 'unauthenticated_status_requires_auth', status: unauth.status, error: 'expected_401' })
if (hasUnsafeText(unauth.body)) failures.push({ name: 'unauthenticated_status_requires_auth', error: 'unsafe_text_detected' })

const auth = await request(path, true)
const body = auth.body || {}
results.push({
  name: 'authenticated_status',
  path,
  status: auth.status,
  mode: body.mode || null,
  canonical_status: body.canonical_status || null,
  blocker_class: body.blocker_class || null,
  blocker_kind: body.blocker_kind || null,
  blocked_reason: body.blocked_reason || null,
  credential_present: body.credential_present === true,
  incoming_status: body.incoming?.status || null,
  outgoing_status: body.outgoing?.status || null,
  required_scope: body.outgoing?.required_scope || null,
  writes_enabled: body.outgoing?.writes_enabled === true,
  no_email_sent: body.no_email_sent === true,
  no_fake_done: body.no_fake_done === true,
  no_tokens_exposed: body.no_tokens_exposed === true,
  unsafe_text_detected: hasUnsafeText(body),
})

if (auth.status !== 200 || body.mode !== 'agentmail_readiness') failures.push({ name: 'authenticated_status', status: auth.status, error: 'status_route_failed' })
if (!['READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'BLOCKED', 'SERVICE_DOWN', 'DISABLED'].includes(body.canonical_status)) failures.push({ name: 'authenticated_status', error: 'invalid_canonical_status' })
if (!['NONE', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED', 'HARD_RESET_REQUIRED'].includes(body.blocker_class)) failures.push({ name: 'authenticated_status', error: 'invalid_blocker_class' })
if (!['NONE', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BACKEND_MISSING', 'ROUTE_MISSING', 'AUTH_REQUIRED', 'EXECUTION_DISABLED', 'WRITE_DISABLED', 'EXTERNAL_WRITE_DISABLED', 'UNKNOWN'].includes(body.blocker_kind)) failures.push({ name: 'authenticated_status', error: 'invalid_blocker_kind' })
if (body.credential_values_exposed !== false) failures.push({ name: 'authenticated_status', error: 'credential_values_exposed' })
if (body.outgoing?.required_scope !== 'agentmail.send') failures.push({ name: 'authenticated_status', error: 'missing_agentmail_scope' })
if (body.outgoing?.bridge_session_required !== true) failures.push({ name: 'authenticated_status', error: 'missing_bridge_requirement' })
if (body.outgoing?.writes_enabled !== false) failures.push({ name: 'authenticated_status', error: 'writes_enabled_without_bridge' })
if (body.no_email_sent !== true || body.no_fake_done !== true || body.no_tokens_exposed !== true) failures.push({ name: 'authenticated_status', error: 'safety_flags_failed' })
if (hasUnsafeText(body)) failures.push({ name: 'authenticated_status', error: 'unsafe_text_detected' })

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'AgentMail readiness is auth-gated, credential-safe, truthful, and never sends email.',
  failures,
  results,
}

if (outputPath) {
  const fs = await import('node:fs')
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
}

console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exit(1)
