import fs from 'node:fs'

const CLAUDECLAW_ENV_PATH =
  process.env.CLAUDECLAW_ENV_PATH ||
  '/home/tony/claudeclaw/.env'

const CLAUDECLAW_BASE_URL =
  process.env.CLAUDECLAW_BASE_URL ||
  'http://127.0.0.1:3000'

function readDashboardToken(): string {
  const envToken = process.env.CLAUDECLAW_DASHBOARD_TOKEN || process.env.DASHBOARD_TOKEN
  if (envToken) return envToken.trim()

  try {
    const text = fs.readFileSync(CLAUDECLAW_ENV_PATH, 'utf8')
    const match = text.match(/^DASHBOARD_TOKEN=(.*)$/m)
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : ''
  } catch {
    return ''
  }
}

function buildClaudeClawUrl(path: string): URL {
  const url = new URL(path, CLAUDECLAW_BASE_URL)
  const token = readDashboardToken()
  if (token) url.searchParams.set('token', token)
  return url
}

export async function fetchClaudeClawJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<{ ok: boolean; status: number; payload: T | Record<string, unknown> }> {
  const url = buildClaudeClawUrl(path)
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let payload: T | Record<string, unknown> = {}
  try {
    payload = text ? JSON.parse(text) as T : {}
  } catch {
    payload = { ok: false, error: 'invalid_upstream_json' }
  }
  return { ok: response.ok, status: response.status, payload }
}

export function hasClaudeClawDashboardToken(): boolean {
  return Boolean(readDashboardToken())
}
