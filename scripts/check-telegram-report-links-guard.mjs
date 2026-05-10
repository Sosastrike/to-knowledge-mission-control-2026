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

async function request(path, init = {}, authenticated = true) {
  const headers = {
    ...(authenticated ? authHeaders : {}),
    ...(init.headers || {}),
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, headers: response.headers, body, text }
}

function hasUnsafeText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return /\/Users\/|\/var\/folders\/|\/tmp\/|file:\/\/|127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/.test(text)
}

function summarizeLinks(body) {
  const links = body?.report_links
  if (!links) return null
  return {
    public_origin_available: links.public_origin_available,
    blocked_reason: links.blocked_reason,
    auth_required: links.auth_required,
    raw_local_paths_exposed: links.raw_local_paths_exposed,
    public_local_exposure: links.public_local_exposure,
    mission_control_url: links.mission_control?.url,
    mission_control_absolute_url: links.mission_control?.absolute_url,
    pdf_url: links.pdf?.url,
    markdown_url: links.markdown?.url,
  }
}

const failures = []
const results = []

const created = await request('/api/bridge/agent-zero/reports', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title: 'Day 54 Telegram Report Link Proof',
    summary: 'Protected report link smoke for Telegram report-link lane.',
    requested_delivery: [{ provider: 'telegram' }],
    sections: [{ heading: 'Proof', body: ['Protected links only.', '/tmp/unsafe-local-path'] }],
  }),
})

const reportId = created.body?.report?.id
results.push({
  name: 'create_report',
  path: '/api/bridge/agent-zero/reports',
  status: created.status,
  report_id: reportId || null,
  normal_reply: created.body?.normal_reply || null,
  link_summary: summarizeLinks(created.body),
  unsafe_text_detected: hasUnsafeText(created.body),
})
if (created.status !== 201 || !reportId) failures.push({ name: 'create_report', status: created.status, error: 'report_not_created' })
if (hasUnsafeText(created.body)) failures.push({ name: 'create_report', error: 'unsafe_text_detected' })

if (reportId) {
  const unauth = await request(`/api/bridge/agent-zero/reports/${reportId}/links`, {}, false)
  results.push({
    name: 'unauthenticated_links_requires_auth',
    path: `/api/bridge/agent-zero/reports/${reportId}/links`,
    status: unauth.status,
    unsafe_text_detected: hasUnsafeText(unauth.body),
  })
  if (unauth.status !== 401) failures.push({ name: 'unauthenticated_links_requires_auth', status: unauth.status, error: 'expected_401' })

  const links = await request(`/api/bridge/agent-zero/reports/${reportId}/links`)
  const linkSummary = summarizeLinks(links.body)
  results.push({
    name: 'authenticated_links',
    path: `/api/bridge/agent-zero/reports/${reportId}/links`,
    status: links.status,
    mode: links.body?.mode || null,
    report_id: links.body?.report_id || null,
    link_summary: linkSummary,
    unsafe_text_detected: hasUnsafeText(links.body),
  })
  if (links.status !== 200 || links.body?.mode !== 'agent_zero_protected_report_links') {
    failures.push({ name: 'authenticated_links', status: links.status, error: 'links_route_failed' })
  }
  if (!linkSummary?.auth_required || linkSummary.raw_local_paths_exposed !== false || linkSummary.public_local_exposure !== false) {
    failures.push({ name: 'authenticated_links', error: 'link_safety_contract_failed' })
  }
  if (linkSummary?.public_origin_available !== false || linkSummary?.blocked_reason !== 'mission_control_public_url_required') {
    failures.push({ name: 'authenticated_links', error: 'local_origin_not_blocked' })
  }
  if (hasUnsafeText(links.body)) failures.push({ name: 'authenticated_links', error: 'unsafe_text_detected' })

  const detail = await request(`/api/bridge/agent-zero/reports/${reportId}`)
  results.push({
    name: 'report_detail_includes_links',
    path: `/api/bridge/agent-zero/reports/${reportId}`,
    status: detail.status,
    link_summary: summarizeLinks(detail.body),
    unsafe_text_detected: hasUnsafeText(detail.body),
  })
  if (detail.status !== 200 || !detail.body?.report_links) failures.push({ name: 'report_detail_includes_links', status: detail.status, error: 'missing_report_links' })
  if (hasUnsafeText(detail.body)) failures.push({ name: 'report_detail_includes_links', error: 'unsafe_text_detected' })

  const pdfUnauth = await fetch(`${baseUrl}/api/bridge/agent-zero/reports/${reportId}/pdf`)
  results.push({
    name: 'pdf_requires_auth',
    path: `/api/bridge/agent-zero/reports/${reportId}/pdf`,
    status: pdfUnauth.status,
  })
  if (pdfUnauth.status !== 401) failures.push({ name: 'pdf_requires_auth', status: pdfUnauth.status, error: 'expected_401' })

  const markdownUnauth = await fetch(`${baseUrl}/api/bridge/agent-zero/reports/${reportId}/markdown`)
  results.push({
    name: 'markdown_requires_auth',
    path: `/api/bridge/agent-zero/reports/${reportId}/markdown`,
    status: markdownUnauth.status,
  })
  if (markdownUnauth.status !== 401) failures.push({ name: 'markdown_requires_auth', status: markdownUnauth.status, error: 'expected_401' })
}

const summary = {
  ok: failures.length === 0,
  base_url: baseUrl,
  checked: results.length,
  expectation: 'Agent Zero report links are protected, auth-gated, relative on local runtime, and free of raw paths/secrets.',
  failures,
  results,
}

if (outputPath) {
  const fs = await import('node:fs')
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
}

console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exit(1)
