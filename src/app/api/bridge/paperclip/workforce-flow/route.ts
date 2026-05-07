import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildPaperclipGatewayWorkforceFlowPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'paperclip_gateway_workforce_flow_route_read_only',
    generated_at: new Date().toISOString(),
    route: ['owner', 'gateway', 'pi', 'agent_zero', 'paperclip', 'worker', 'gateway', 'agent_zero', 'owner'],
    phases: [271, 272, 273, 274, 275, 276, 277, 278, 279, 280],
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    paperclip_issues_endpoint: '/api/bridge/paperclip/issues',
    paperclip_workforce_flow_endpoint: '/api/bridge/paperclip/workforce-flow',
    bridge_session_required_for_writes: true,
    write_adapter_configured: false,
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let parsed: Record<string, unknown> = {}
  try {
    const body = await request.json()
    parsed = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    parsed = {}
  }

  const payload = await buildPaperclipGatewayWorkforceFlowPayload({
    ownerRequest: typeof parsed.owner_request === 'string'
      ? parsed.owner_request
      : (typeof parsed.ownerRequest === 'string' ? parsed.ownerRequest : null),
    assignee: typeof parsed.assignee === 'string' ? parsed.assignee : null,
    workerResult: typeof parsed.worker_result === 'string'
      ? parsed.worker_result
      : (typeof parsed.workerResult === 'string' ? parsed.workerResult : null),
    generatedAt: new Date().toISOString(),
    bridgeSessionActive: false,
  })

  return NextResponse.json(payload, {
    status: payload.policy_result === 'requires_session' ? 409 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
