import { NextRequest } from 'next/server'

import { approveAgentMailSendRequest } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'mission_control_owner_operator')
  if (auth) return auth

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = typeof body.send_request_id === 'string' ? body.send_request_id : typeof body.id === 'string' ? body.id : ''
  return readOnly(approveAgentMailSendRequest(getDatabase(), id, { actor: 'owner' }))
}
