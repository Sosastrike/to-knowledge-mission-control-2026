#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.join(root, 'src/app/api/bridge/button-contracts/route.ts')
const allowedStates = new Set([
  'LIVE',
  'READ_ONLY',
  'BACKEND_REQUIRED',
  'CREDENTIAL_REQUIRED',
  'OWNER_APPROVAL_REQUIRED',
  'DISABLED',
])
const allowedMissing = new Set([
  '/api/notifications/stream',
])

const source = fs.readFileSync(file, 'utf8')
const failures = []
const stateCounts = Object.fromEntries([...allowedStates].map((state) => [state, 0]))

function routeExists(endpoint) {
  const normalized = endpoint.replace(/:\w+/g, '[id]')
  const exact = path.join(root, 'src/app', normalized, 'route.ts')
  if (fs.existsSync(exact)) return path.relative(root, exact)

  const parts = normalized.split('/').filter(Boolean)
  for (let i = parts.length; i >= 2; i -= 1) {
    const base = path.join(root, 'src/app', ...parts.slice(0, i))
    for (const suffix of ['[[...path]]/route.ts', '[...path]/route.ts']) {
      const candidate = path.join(base, suffix)
      if (fs.existsSync(candidate)) return path.relative(root, candidate)
    }
  }

  return null
}

for (const match of source.matchAll(/state: '([^']+)'/g)) {
  const state = match[1]
  if (!allowedStates.has(state)) failures.push(`unknown button state ${state}`)
  stateCounts[state] = (stateCounts[state] || 0) + 1
}

const endpoints = [...source.matchAll(/endpoint: '([^']+)'/g)]
  .map((match) => match[1])
  .filter((endpoint) => endpoint.startsWith('/api/'))

const missing = []
const resolved = {}
for (const endpoint of [...new Set(endpoints)]) {
  const route = routeExists(endpoint)
  if (!route && !allowedMissing.has(endpoint)) missing.push(endpoint)
  resolved[endpoint] = route || '(allowed missing/not implemented)'
}

if (missing.length) failures.push(`missing route files: ${missing.join(', ')}`)

for (const needle of [
  'blocked_http_status',
  'execution_enabled',
  'protected_execution_enabled: false',
  'fake_success_allowed: false',
  'should_render_as_disabled',
  'no_fake_success: true',
]) {
  if (!source.includes(needle)) failures.push(`button runtime contract missing ${needle}`)
}

const result = {
  ok: failures.length === 0,
  allowed_states: [...allowedStates],
  state_counts: stateCounts,
  api_endpoints: [...new Set(endpoints)].length,
  missing_route_files: missing,
  allowed_missing: [...allowedMissing],
  resolved_routes: resolved,
}

if (failures.length) {
  console.error(JSON.stringify({ ...result, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(result, null, 2))
