import { NextRequest } from 'next/server'
import { enableGatewayBridgeRuntime } from '@/lib/gateway-bridge-runtime'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'mission_control_owner_operator')
  if (auth) return auth
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const actor = typeof body.actor === 'string' ? body.actor : 'owner'
  return readOnly({ action: 'gateway_bridge_runtime_enabled', bridge_runtime: enableGatewayBridgeRuntime(undefined, actor) })
}
