#!/usr/bin/env node

const baseUrl = process.argv[2] || 'http://127.0.0.1:3337'
const outFile = process.argv[3] || null
const apiKey = process.env.MISSION_CONTROL_API_KEY || ''

const unsafePattern = /(sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|agentmail-placeholder|AGENTMAIL_API_KEY=.*|AGENTMAIL_TOKEN=.*|\/Users\/sosastrike|file:\/\/)/i

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  }
  if (options.auth) headers['x-api-key'] = apiKey
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json'
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  return {
    path,
    status: response.status,
    body,
    text,
    unsafe_text_detected: unsafePattern.test(text),
  }
}

const results = []
const failures = []

const unauth = await request('/api/bridge/agent-zero/agentmail/send', {
  method: 'POST',
  body: {
    recipient: 'owner@example.com',
    subject: 'Day 56 AgentMail guard',
    text: 'This unauthenticated probe must be rejected.',
  },
})
results.push({
  name: 'unauthenticated_send_requires_auth',
  path: unauth.path,
  status: unauth.status,
  unsafe_text_detected: unauth.unsafe_text_detected,
})
if (unauth.status !== 401) failures.push({ name: 'unauthenticated_send_requires_auth', error: `expected_401_got_${unauth.status}` })
if (unauth.unsafe_text_detected) failures.push({ name: 'unauthenticated_send_requires_auth', error: 'unsafe_text_detected' })

const status = await request('/api/bridge/agent-zero/agentmail/status', { auth: true })
results.push({
  name: 'authenticated_status',
  path: status.path,
  status: status.status,
  mode: status.body?.mode || null,
  canonical_status: status.body?.canonical_status || null,
  blocker_class: status.body?.blocker_class || null,
  blocked_reason: status.body?.blocked_reason || null,
  outgoing_status: status.body?.outgoing?.status || null,
  required_scope: status.body?.outgoing?.required_scope || null,
  writes_enabled: status.body?.outgoing?.writes_enabled ?? null,
  no_email_sent: status.body?.no_email_sent ?? status.body?.outgoing?.no_email_sent ?? null,
  no_fake_done: status.body?.outgoing?.no_fake_done ?? null,
  unsafe_text_detected: status.unsafe_text_detected,
})
if (status.status !== 200) failures.push({ name: 'authenticated_status', error: `expected_200_got_${status.status}` })
if (status.body?.outgoing?.required_scope !== 'agentmail.send') failures.push({ name: 'authenticated_status', error: 'missing_agentmail_scope' })
if (status.body?.outgoing?.writes_enabled !== false) failures.push({ name: 'authenticated_status', error: 'writes_not_disabled' })
if (status.unsafe_text_detected) failures.push({ name: 'authenticated_status', error: 'unsafe_text_detected' })

const send = await request('/api/bridge/agent-zero/agentmail/send', {
  method: 'POST',
  auth: true,
  body: {
    recipient: 'owner@example.com',
    subject: 'Day 56 AgentMail guard',
    text: 'This runtime proof must not send without credentials and Bridge scope.',
  },
})
results.push({
  name: 'authenticated_send_stays_gated',
  path: send.path,
  status: send.status,
  action: send.body?.action || null,
  delivery_status: send.body?.status || null,
  accepted_for_execution: send.body?.accepted_for_execution ?? null,
  required_scope: send.body?.required_scope || null,
  blocked_reason: send.body?.blocked_reason || null,
  approval_request_created: send.body?.approval_request_created ?? null,
  agentmail_message_id: send.body?.agentmail_message_id || null,
  no_email_sent: send.body?.no_email_sent ?? null,
  no_fake_done: send.body?.no_fake_done ?? null,
  no_tokens_exposed: send.body?.no_tokens_exposed ?? null,
  unsafe_text_detected: send.unsafe_text_detected,
})
if (![200, 423, 424, 502].includes(send.status)) failures.push({ name: 'authenticated_send_stays_gated', error: `unexpected_status_${send.status}` })
if (send.body?.required_scope !== 'agentmail.send') failures.push({ name: 'authenticated_send_stays_gated', error: 'missing_agentmail_scope' })
if (send.body?.accepted_for_execution !== false) failures.push({ name: 'authenticated_send_stays_gated', error: 'unexpected_execution_acceptance' })
if (send.body?.agentmail_message_id !== null) failures.push({ name: 'authenticated_send_stays_gated', error: 'fake_or_unapproved_message_id' })
if (send.body?.no_fake_done !== true) failures.push({ name: 'authenticated_send_stays_gated', error: 'missing_no_fake_done' })
if (send.body?.no_tokens_exposed !== true) failures.push({ name: 'authenticated_send_stays_gated', error: 'missing_no_tokens_exposed' })
if (send.unsafe_text_detected) failures.push({ name: 'authenticated_send_stays_gated', error: 'unsafe_text_detected' })

const payload = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'AgentMail send route is authenticated, Bridge-gated, credential-safe, and never fakes email delivery.',
  failures,
  results,
}

if (outFile) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`)
}

console.log(JSON.stringify(payload, null, 2))
if (failures.length) process.exit(1)
