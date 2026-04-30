import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  hasEnv,
  ownerApprovalRequired,
  pingUrl,
  routePath,
} from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function n8nBase() {
  return (process.env.N8N_BASE_URL || '').replace(/\/+$/, '')
}

async function statusPayload() {
  const base = n8nBase()
  const installed = base.length > 0
  const api = installed ? await pingUrl(`${base}/healthz`) : { reachable: false, error: 'no_url' }
  const apiKeyPresent = hasEnv('N8N_API_KEY')
  const status = !installed ? 'not_installed' : !apiKeyPresent ? 'credential_required' : api.reachable ? 'live' : 'degraded'
  return {
    ok: true,
    status,
    installed,
    service: installed ? (api.reachable ? 'up' : 'down') : 'not_installed',
    ui_url: installed ? base : null,
    api,
    api_key_present: apiKeyPresent,
    workflows_count: null,
    active: null,
    failed_24h: null,
    credentials_configured: null,
    webhook_status: null,
    last_execution: null,
    assigned_agents: ['Tony', 'Agent 0', 'Builder', 'Operator'],
    credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'],
  }
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (!path || path === 'status') return NextResponse.json(await statusPayload())
  if (path === 'workflows') {
    if (!n8nBase()) return backendRequired({ missing: 'N8N_BASE_URL' })
    if (!hasEnv('N8N_API_KEY')) return backendRequired({ missing: 'N8N_API_KEY' })
    return backendRequired({ note: 'n8n workflow REST passthrough not implemented.' })
  }
  if (path === 'executions') {
    if (!n8nBase()) return backendRequired({ missing: 'N8N_BASE_URL' })
    return backendRequired({ note: 'n8n execution REST passthrough not implemented.' })
  }
  if (path === 'webhooks') {
    if (!n8nBase()) return backendRequired({ missing: 'N8N_BASE_URL' })
    return backendRequired({ note: 'n8n webhook list passthrough not implemented.' })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  const path = routePath((await params).path)
  if (path === 'test') {
    const base = n8nBase()
    if (!base) return backendRequired({ missing: 'N8N_BASE_URL' })
    const result = await pingUrl(`${base}/healthz`)
    return NextResponse.json({ ok: result.reachable, ...result })
  }

  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'workflows' && parts[1] && ['activate', 'deactivate', 'execute'].includes(parts[2] || '')) {
    return ownerApprovalRequired({
      workflow_id: parts[1],
      action: parts[2],
      next_action: 'Owner approval plus n8n REST passthrough required.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
