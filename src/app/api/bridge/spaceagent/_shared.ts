import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'

type Builder = () => Record<string, unknown>
type Writer = (input: Record<string, unknown>) => {
  ok: boolean
  exact_blocker?: string
  [key: string]: unknown
}

export function spaceAgentRead(request: NextRequest, builder: Builder) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    ...builder(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

function statusForSpaceAgentWrite(result: ReturnType<Writer>) {
  if (result.ok) return 200
  if (result.exact_blocker === 'invalid_payload') return 400
  if (result.exact_blocker === 'owner_hard_stop_required') return 403
  return 423
}

export async function spaceAgentWrite(request: NextRequest, writer: Writer) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = await request.json().catch(() => ({}))
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
  const result = writer(input)

  return NextResponse.json(result, {
    status: statusForSpaceAgentWrite(result),
    headers: { 'Cache-Control': 'no-store' },
  })
}
