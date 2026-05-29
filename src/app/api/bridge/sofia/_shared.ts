import { NextRequest, NextResponse } from 'next/server'

import {
  SOFIA_CONCURRENCE_SCOPES,
  SOFIA_DRAFT_SCOPES,
  SOFIA_READ_SCOPES,
  requireSofiaRouteAuth,
} from '@/lib/sofia-access-policy'

type Builder = () => Record<string, unknown>
type Writer = (input: Record<string, unknown>) => {
  ok: boolean
  exact_blocker?: string
  [key: string]: unknown
}

export function sofiaRead(request: NextRequest, builder: Builder) {
  const auth = requireSofiaRouteAuth(request, { agent_scopes: SOFIA_READ_SCOPES })
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    token_source: auth.token_source,
    master_api_key_used: auth.master_api_key_used,
    ...builder(),
  })
}

function statusForSofiaWrite(result: ReturnType<Writer>) {
  if (result.ok) return 200
  if (result.exact_blocker === 'invalid_payload') return 400
  if (result.exact_blocker === 'owner_hard_stop_required') return 403
  return 423
}

export async function sofiaWrite(request: NextRequest, writer: Writer, concurrence = false) {
  const auth = requireSofiaRouteAuth(request, {
    minimum_human_role: 'operator',
    agent_scopes: concurrence ? SOFIA_CONCURRENCE_SCOPES : SOFIA_DRAFT_SCOPES,
  })
  if (!auth.ok) return auth.response

  const parsed = await request.json().catch(() => ({}))
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
  const result = writer(input)

  return NextResponse.json({ token_source: auth.token_source, master_api_key_used: auth.master_api_key_used, ...result }, { status: statusForSofiaWrite(result) })
}
