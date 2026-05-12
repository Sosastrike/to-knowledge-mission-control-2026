import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  buildCloudCodeAgentHealth,
  selectCloudCodeAgentHealth,
  selectCloudCodeAgentHealthRows,
} from '@/lib/gateway-cloudcode-integration'
import { attachOpenClawGatewayRuntimeToHealthPayload, buildAgentHubAgentHealthPayload } from '@/lib/gateway-agent-hub'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'
import { getOpenClawGatewayRuntimeStatus, isOpenClawGatewayNodeId } from '@/lib/openclaw-gateway-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const registry = await loadGatewayRegistry()
  const payload = buildAgentHubAgentHealthPayload(registry, id)
  if (!payload) {
    return NextResponse.json({
      ok: false,
      error: 'agent_hub_agent_not_found',
      agent_id: id,
      execution_enabled: false,
      writes_enabled: false,
    }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const runtimePayload = isOpenClawGatewayNodeId(id)
    ? attachOpenClawGatewayRuntimeToHealthPayload(
      payload,
      await getOpenClawGatewayRuntimeStatus({ generatedAt: payload.generated_at }),
    )
    : payload

  const cloudCodeHealth = buildCloudCodeAgentHealth({
    execution_enabled: false,
    agents: [{
      id: runtimePayload.agent_id,
      name: runtimePayload.agent_id,
      connected: runtimePayload.connected,
      configured: runtimePayload.configured,
      blocked_reason: runtimePayload.blocker,
      live_interface_proven: runtimePayload.live_interface_proven,
      called_true_proven: runtimePayload.called_true_proven,
      last_success: runtimePayload.last_success,
      owner_status: runtimePayload.owner_status,
    }],
  } as any)

  return NextResponse.json({
    ...runtimePayload,
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['buildAgentHealth'],
    },
    cloudcode_agent_health: selectCloudCodeAgentHealth(runtimePayload.agent_id, cloudCodeHealth),
    cloudcode_agent_health_rows: selectCloudCodeAgentHealthRows(runtimePayload.agent_id, cloudCodeHealth),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
