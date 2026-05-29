import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { buildPaperclipWorkspaceTruthPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const payload = await buildPaperclipWorkspaceTruthPayload({ generatedAt: new Date().toISOString() })
  return readOnly({
    ...payload,
    resource_note: 'Read-only Paperclip workspace truth across loopback, Tailnet, and configured HTTPS origins. No writes or credentials are exposed.',
  })
}
