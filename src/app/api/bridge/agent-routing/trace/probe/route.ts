import { NextRequest, NextResponse } from 'next/server'

import { buildAgentLineTraceRecord } from '@/lib/agent-line-trace'
import { authRequiredOrAgentScope } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequiredOrAgentScope(request, 'operator', ['ron.task_event_write'])
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

  const record = buildAgentLineTraceRecord(input)
  return NextResponse.json({
    ok: record.status === 'PASS',
    route: 'bridge.agent-routing.trace.probe',
    record,
    trace: record,
    credential_values_exposed: false,
    raw_message_body_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
  }, { status: record.status === 'PASS' ? 200 : 409 })
}
