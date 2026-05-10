#!/usr/bin/env node

const baseUrl = process.argv[2] || 'http://127.0.0.1:3337'
const outFile = process.argv[3] || null
const apiKey = process.env.MISSION_CONTROL_API_KEY || ''

const unsafePattern = /(GOOGLE_DRIVE_(?:CREDENTIALS|ACCESS_TOKEN|REFRESH_TOKEN)=|GOOGLE_SERVICE_ACCOUNT_JSON=|Bearer\s+[A-Za-z0-9._-]{20,}|ya29\.[A-Za-z0-9._-]+|\/Users\/sosastrike|file:\/\/|\/var\/folders\/)/i

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
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

const unauth = await request('/api/bridge/agent-zero/google-drive/status')
results.push({
  name: 'unauthenticated_status_requires_auth',
  path: unauth.path,
  status: unauth.status,
  unsafe_text_detected: unauth.unsafe_text_detected,
})
if (unauth.status !== 401) failures.push({ name: 'unauthenticated_status_requires_auth', error: `expected_401_got_${unauth.status}` })
if (unauth.unsafe_text_detected) failures.push({ name: 'unauthenticated_status_requires_auth', error: 'unsafe_text_detected' })

const status = await request('/api/bridge/agent-zero/google-drive/status', { auth: true })
results.push({
  name: 'authenticated_status',
  path: status.path,
  status: status.status,
  mode: status.body?.mode || null,
  canonical_status: status.body?.canonical_status || null,
  blocker_class: status.body?.blocker_class || null,
  blocked_reason: status.body?.blocked_reason || null,
  credential_present: status.body?.credential_present ?? null,
  required_scope: status.body?.required_scope || null,
  target_folder_required: status.body?.target_folder_required ?? null,
  target_folder_configured: status.body?.target_folder_configured ?? null,
  upload_connector_configured: status.body?.upload_connector_configured ?? null,
  writes_enabled: status.body?.writes_enabled ?? null,
  no_upload_performed: status.body?.no_upload_performed ?? null,
  no_fake_done: status.body?.no_fake_done ?? null,
  no_tokens_exposed: status.body?.no_tokens_exposed ?? null,
  unsafe_text_detected: status.unsafe_text_detected,
})
if (status.status !== 200) failures.push({ name: 'authenticated_status', error: `expected_200_got_${status.status}` })
if (status.body?.required_scope !== 'google_drive.upload') failures.push({ name: 'authenticated_status', error: 'missing_google_drive_scope' })
if (status.body?.target_folder_required !== true) failures.push({ name: 'authenticated_status', error: 'missing_target_folder_requirement' })
if (status.body?.writes_enabled !== false) failures.push({ name: 'authenticated_status', error: 'writes_not_disabled' })
if (status.body?.no_upload_performed !== true) failures.push({ name: 'authenticated_status', error: 'missing_no_upload_performed' })
if (status.body?.no_fake_done !== true) failures.push({ name: 'authenticated_status', error: 'missing_no_fake_done' })
if (status.body?.no_tokens_exposed !== true) failures.push({ name: 'authenticated_status', error: 'missing_no_tokens_exposed' })
if (status.unsafe_text_detected) failures.push({ name: 'authenticated_status', error: 'unsafe_text_detected' })

const upload = await request('/api/bridge/agent-zero/google-drive/upload-report', {
  method: 'POST',
  auth: true,
  body: { report_id: 'azr_missing_day57', folder: 'Reports' },
})
results.push({
  name: 'authenticated_upload_stays_blocked',
  path: upload.path,
  status: upload.status,
  action: upload.body?.action || null,
  accepted_for_execution: upload.body?.accepted_for_execution ?? null,
  blocked_reason: upload.body?.blocked_reason || null,
  upload_connector_configured: upload.body?.upload_connector_configured ?? null,
  no_fake_done: upload.body?.no_fake_done ?? null,
  no_tokens_exposed: upload.body?.no_tokens_exposed ?? null,
  unsafe_text_detected: upload.unsafe_text_detected,
})
if (upload.status !== 423) failures.push({ name: 'authenticated_upload_stays_blocked', error: `expected_423_got_${upload.status}` })
if (upload.body?.accepted_for_execution !== false) failures.push({ name: 'authenticated_upload_stays_blocked', error: 'unexpected_execution_acceptance' })
if (upload.body?.no_fake_done !== true) failures.push({ name: 'authenticated_upload_stays_blocked', error: 'missing_no_fake_done' })
if (upload.body?.no_tokens_exposed !== true) failures.push({ name: 'authenticated_upload_stays_blocked', error: 'missing_no_tokens_exposed' })
if (upload.unsafe_text_detected) failures.push({ name: 'authenticated_upload_stays_blocked', error: 'unsafe_text_detected' })

const payload = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'Google Drive readiness is authenticated, canonical, folder-aware, and never fakes upload.',
  failures,
  results,
}

if (outFile) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`)
}

console.log(JSON.stringify(payload, null, 2))
if (failures.length) process.exit(1)
