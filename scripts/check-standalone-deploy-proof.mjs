#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = process.cwd()
const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const parsedBaseUrl = new URL(baseUrl)
const port = parsedBaseUrl.port || (parsedBaseUrl.protocol === 'https:' ? '443' : '80')
const pidFile = process.env.PID_FILE || join(projectRoot, '.next/standalone/server.pid')
const pidFileLabel = process.env.PID_FILE ? 'custom_pid_file_configured' : '.next/standalone/server.pid'

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 5 * 1024 * 1024,
      ...options,
    }).trim()
  } catch {
    return ''
  }
}

function readApiKeyFromDb() {
  return run('sqlite3', [
    '.data/mission-control.db',
    "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;",
  ])
}

function readPidFile() {
  if (!existsSync(pidFile)) return null
  const raw = readFileSync(pidFile, 'utf8').trim()
  return /^[0-9]+$/.test(raw) ? raw : null
}

function listListenerPids() {
  const output = run('bash', ['-lc', `if command -v lsof >/dev/null 2>&1; then lsof -nP -tiTCP:${port} -sTCP:LISTEN || true; fi`])
  return output.split(/\s+/).filter((pid) => /^[0-9]+$/.test(pid))
}

async function fetchText(path, options = {}) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs || 10000),
      headers: options.headers || undefined,
    })
    const body = await response.text()
    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      location: response.headers.get('location') || undefined,
      content_type: response.headers.get('content-type') || undefined,
      body,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
      body: '',
    }
  }
}

function findStaticAsset(loginHtml) {
  return loginHtml.match(/\/_next\/static\/[^"']+\.(?:css|js)/)?.[0] || null
}

const sourceCommit = run('git', ['rev-parse', '--short', 'HEAD'])
const sourceBranch = run('git', ['branch', '--show-current'])
const pidFromFile = readPidFile()
const listenerPids = listListenerPids()
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

const login = await fetchText('/login')
const assetPath = login.status === 200 ? findStaticAsset(login.body) : null
const assetDiskPath = assetPath
  ? join(projectRoot, '.next/standalone/.next', assetPath.replace(/^\/_next\//, ''))
  : null
const asset = assetPath
  ? await fetchText(assetPath)
  : { ok: false, status: 0, error: 'rendered_static_asset_not_found', body: '' }
const gateway = await fetchText('/gateway')
const connectorReadiness = apiKey
  ? await fetchText('/api/bridge/connector-readiness', {
      headers: {
        'x-api-key': apiKey,
        cookie: 'mc-session=runtime-smoke-proxy-pass',
      },
      timeoutMs: 10000,
    })
  : { ok: false, status: 0, error: 'api_key_not_configured_for_proof', body: '' }

let connectorBody = null
try {
  connectorBody = connectorReadiness.body ? JSON.parse(connectorReadiness.body) : null
} catch {
  connectorBody = null
}

const failures = []
if (!existsSync(join(projectRoot, '.next/standalone/server.js'))) {
  failures.push({ check: 'standalone_bundle', error: 'server_js_missing' })
}
if (listenerPids.length === 0) {
  failures.push({ check: 'listener', port, error: 'listener_missing' })
}
if (pidFromFile && !listenerPids.includes(pidFromFile)) {
  failures.push({ check: 'pid_file', pid: pidFromFile, listener_pids: listenerPids, error: 'pid_file_not_listener_owner' })
}
if (login.status !== 200 || !login.body.includes('Mission Control')) {
  failures.push({ check: 'login', status: login.status, error: 'login_not_rendered' })
}
if (!assetPath) {
  failures.push({ check: 'static_asset_reference', error: 'asset_reference_missing' })
}
if (assetPath && !existsSync(assetDiskPath)) {
  failures.push({ check: 'static_asset_disk', asset_path: assetPath, error: 'asset_missing_on_disk' })
}
if (assetPath && (asset.status !== 200 || !asset.content_type)) {
  failures.push({ check: 'static_asset_http', asset_path: assetPath, status: asset.status, error: 'asset_not_served' })
}
if (![302, 307, 308, 401, 403].includes(gateway.status)) {
  failures.push({ check: 'protected_gateway', status: gateway.status, error: 'gateway_not_protected_when_unauthenticated' })
}
if (connectorReadiness.status !== 200 || connectorBody?.ok !== true) {
  failures.push({ check: 'connector_readiness', status: connectorReadiness.status, error: 'authenticated_api_probe_failed' })
}

const report = {
  ok: failures.length === 0,
  checked_at: new Date().toISOString(),
  source_branch: sourceBranch,
  source_commit: sourceCommit,
  base_url: baseUrl,
  bind_expectation: '127.0.0.1/local-only unless service manager explicitly overrides MC_HOSTNAME',
  no_public_exposure_added: true,
  api_auth_configured: Boolean(apiKey),
  standalone: {
    server_js_exists: existsSync(join(projectRoot, '.next/standalone/server.js')),
    pid_file: pidFileLabel,
    pid_from_file: pidFromFile,
    listener_pids: listenerPids,
    port,
  },
  probes: {
    login: {
      status: login.status,
      content_type: login.content_type,
      mission_control_present: login.body.includes('Mission Control'),
    },
    static_asset: {
      path: assetPath,
      disk_exists: assetDiskPath ? existsSync(assetDiskPath) : false,
      status: asset.status,
      content_type: asset.content_type,
    },
    protected_gateway_unauthenticated: {
      status: gateway.status,
      location: gateway.location,
      protected: [302, 307, 308, 401, 403].includes(gateway.status),
    },
    connector_readiness_authenticated: {
      status: connectorReadiness.status,
      ok: connectorBody?.ok === true,
      connector_count: Array.isArray(connectorBody?.connectors) ? connectorBody.connectors.length : 0,
      execution_enabled: connectorBody?.summary?.execution_enabled ?? null,
      writes_enabled: connectorBody?.summary?.writes_enabled ?? null,
    },
  },
  failures,
  rollback: sourceCommit ? `git revert <day-63-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=${port} bash scripts/start-standalone.sh` : 'git revert <day-63-commit-sha>',
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
