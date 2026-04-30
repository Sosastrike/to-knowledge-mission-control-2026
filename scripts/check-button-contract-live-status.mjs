#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const contractPath = path.join(root, 'src/app/api/bridge/button-contracts/route.ts')
const allowedMissing = new Set(['/api/notifications/stream'])

function normalizeEndpoint(endpoint) {
  return endpoint
    .replace(/:id/g, 'sample')
    .replace(/:action/g, 'test')
}

function extractEndpoints(source) {
  const endpoints = new Set()
  const regex = /endpoint:\s*'([^']+)'/g
  let match
  while ((match = regex.exec(source))) {
    if (match[1].startsWith('/api/')) endpoints.add(match[1])
  }
  return Array.from(endpoints).sort()
}

if (!fs.existsSync(contractPath)) {
  console.error(JSON.stringify({ ok: false, error: 'button_contract_route_missing', path: contractPath }, null, 2))
  process.exit(1)
}

const endpoints = extractEndpoints(fs.readFileSync(contractPath, 'utf8'))
const failures = []
const results = []

for (const endpoint of endpoints) {
  if (allowedMissing.has(endpoint)) {
    results.push({ endpoint, skipped: true, reason: 'allowed_missing' })
    continue
  }

  const url = `${baseUrl}${normalizeEndpoint(endpoint)}`
  let status = 0
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    status = response.status
  } catch (error) {
    failures.push({
      endpoint,
      url,
      error: error instanceof Error ? error.message.slice(0, 200) : 'request_failed',
    })
    continue
  }

  results.push({ endpoint, url, status })
  if (status === 404) failures.push({ endpoint, url, status, error: 'route_not_found' })
  if (status >= 500) failures.push({ endpoint, url, status, error: 'route_server_error' })
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, base_url: baseUrl, failures, results }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  endpoints_checked: results.filter((result) => !result.skipped).length,
  skipped: results.filter((result) => result.skipped).length,
  accepted_statuses: '401/403/405 are acceptable for auth-gated or POST-only routes; 404/5xx are failures.',
  results,
}, null, 2))
