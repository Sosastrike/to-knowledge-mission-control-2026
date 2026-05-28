import { NextRequest } from 'next/server'

import { buildAgentLineTraceLive } from '@/lib/agent-line-trace'
import { authRequiredOrAgentScope, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequiredOrAgentScope(request, 'viewer', ['ron.read', 'ron.gateway_read'])
  if (auth) return auth

  const url = new URL(request.url)
  return readOnly(buildAgentLineTraceLive({
    agent: url.searchParams.get('agent'),
    nonce: url.searchParams.get('nonce'),
  }))
}
