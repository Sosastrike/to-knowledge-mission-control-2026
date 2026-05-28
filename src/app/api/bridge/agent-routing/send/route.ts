import { NextRequest, NextResponse } from 'next/server'

import { routeAgentMessage } from '@/lib/agent-routing-lines'
import { authRequired } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function statusFor(result: ReturnType<typeof routeAgentMessage>) {
  if (result.ok) return 200
  if (result.exact_blocker === 'agent_direct_line_missing_visible_ticket_required') return 404
  if (result.exact_blocker === 'opencloud_is_supporting_runtime_not_commander') return 403
  if (result.exact_blocker === 'opencloud_hidden_intermediary_forbidden') return 403
  if (result.exact_blocker === 'hidden_intermediary_forbidden') return 403
  return 423
}

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  let input: Record<string, unknown>
  try {
    const parsed = await request.json()
    input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    input = {}
  }

  const result = routeAgentMessage(input)
  return NextResponse.json(result, { status: statusFor(result) })
}
