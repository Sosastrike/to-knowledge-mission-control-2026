import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { paperclipLiveStatus } from '@/lib/paperclip-live-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const status = await paperclipLiveStatus('agents')
  return readOnly({
    ...status,
    route: 'bridge.paperclip.agents',
    mode: 'paperclip_agents_read_only',
    resource_note: 'Read-only Paperclip agent/workforce inventory. Task execution remains Bridge-gated.',
  })
}
