import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { paperclipLiveStatus } from '@/lib/paperclip-live-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const status = await paperclipLiveStatus('companies')
  return readOnly({
    ...status,
    route: 'bridge.paperclip.companies',
    mode: 'paperclip_companies_read_only',
    resource_note: 'Read-only Paperclip company inventory. Mission Control never stores Paperclip cookies or passwords.',
  })
}
