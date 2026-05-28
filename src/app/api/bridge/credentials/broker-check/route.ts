import { NextRequest, NextResponse } from 'next/server'

import { runCredentialBrokerCheck } from '@/lib/credential-broker'
import { authRequired } from '@/lib/mission-control-contracts'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const unauthorized = authRequired(request, 'operator')
  if (unauthorized) return unauthorized

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    body = {}
  }

  const result = runCredentialBrokerCheck({
    system: body.system,
    credential_names: body.credential_names,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 404 })
}
