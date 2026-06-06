import { NextRequest } from 'next/server'

import { createAgentMailSendPreview } from '@/lib/agentmail-local-control'
import { getDatabase } from '@/lib/db'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  return readOnly(createAgentMailSendPreview(getDatabase(), body))
}
