import { NextRequest, NextResponse } from 'next/server'

import { resolveAgentRoutingLine } from '@/lib/agent-routing-lines'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ agent_id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const { agent_id } = await params
  const line = resolveAgentRoutingLine(agent_id)
  if (!line) {
    return NextResponse.json({
      ok: false,
      route: 'bridge.agent-routing.lines.detail',
      exact_blocker: 'agent_direct_line_missing',
      agent_id,
      credential_values_exposed: false,
    }, { status: 404 })
  }

  return readOnly({
    route: 'bridge.agent-routing.lines.detail',
    line,
    credential_values_exposed: false,
  })
}
