import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildPaperclipPiDispatcherRecommendationPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'paperclip_pi_dispatcher_recommendations_route_read_only',
    generated_at: new Date().toISOString(),
    pi_can_see_paperclip_task_queue: true,
    paperclip_status_endpoint: '/api/bridge/paperclip/status',
    paperclip_task_queue_endpoint: '/api/bridge/paperclip/issues',
    paperclip_tasks_endpoint: '/api/bridge/paperclip/tasks',
    paperclip_dispatcher_recommendations_endpoint: '/api/bridge/paperclip/dispatcher-recommendations',
    selected_route: ['pi', 'gateway', 'agent_zero', 'paperclip'],
    can_recommend_agent_assignment: true,
    can_recommend_budget_route: true,
    can_recommend_model_provider_route: true,
    can_recommend_mini_agent_creation: true,
    pi_can_execute: false,
    output_is_advisory_until_proven: true,
    paperclip_recording: 'blocked_until_bridge_session_and_write_adapter',
    agent_zero_final_decision_required: true,
    gateway_logs_final_route_decision: true,
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

  const payload = await buildPaperclipPiDispatcherRecommendationPayload({
    ownerRequest: typeof parsed.owner_request === 'string'
      ? parsed.owner_request
      : (typeof parsed.ownerRequest === 'string' ? parsed.ownerRequest : null),
    generatedAt: new Date().toISOString(),
  })

  return NextResponse.json(payload, {
    status: payload.recommendation.policy_result === 'requires_session' ? 409 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
