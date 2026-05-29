import { type NextRequest, NextResponse } from 'next/server'

import {
  buildNuclearGatewayTaskDispatchAdapterStatus,
  buildNuclearGatewayTaskDispatchPreview,
} from '@/lib/nuclear-gateway-task-dispatch-adapter'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function statusForPreview(result: ReturnType<typeof buildNuclearGatewayTaskDispatchPreview>) {
  if (result.ok) return 200
  if (result.exact_blocker === 'openclaw_cannot_be_task_dispatch_conversation_owner') return 403
  if (result.exact_blocker === 'target_agent_direct_line_not_registered') return 404
  return 400
}

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly(buildNuclearGatewayTaskDispatchAdapterStatus())
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

  const result = buildNuclearGatewayTaskDispatchPreview(input)
  return NextResponse.json(result, { status: statusForPreview(result) })
}
