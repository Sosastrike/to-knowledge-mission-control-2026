import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { paperclipLiveStatus } from '@/lib/paperclip-live-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const status = await paperclipLiveStatus('status')
  return readOnly({
    ...status,
    route: 'bridge.paperclip.status',
    resource_note: 'Paperclip health and owner-accessible company status. No writes are performed.',
  })
}
