import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CLAUDECLAW_ENV_PATH =
  process.env.CLAUDECLAW_ENV_PATH ||
  '/home/tony/claudeclaw/.env'
const CLAUDECLAW_BRIDGE_PROVIDERS_URL =
  process.env.CLAUDECLAW_BRIDGE_PROVIDERS_URL ||
  'http://127.0.0.1:3000/api/bridge/providers'

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

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const token = readDashboardToken()
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'claudeclaw_dashboard_token_missing',
        providers: [],
        summary: { total: 0, by_state: {} },
      },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const upstream = new URL(CLAUDECLAW_BRIDGE_PROVIDERS_URL)
  upstream.searchParams.set('token', token)
  if (searchParams.get('force') === '1') upstream.searchParams.set('force', '1')

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const text = await response.text()
    const contentType = response.headers.get('content-type') || ''
    let payload: unknown = text

    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { ok: false, error: 'invalid_upstream_json' }
      }
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    logger.warn('bridge providers proxy failed')
    return NextResponse.json(
      {
        ok: false,
        error: 'claudeclaw_bridge_providers_unreachable',
        providers: [],
        summary: { total: 0, by_state: {} },
      },
      { status: 502 },
    )
  }
}
