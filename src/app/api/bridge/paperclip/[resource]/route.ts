import { NextRequest } from 'next/server'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { paperclipLiveStatus } from '@/lib/paperclip-live-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowed = new Set(['status', 'companies', 'agents', 'issues'])

const resourceNotes: Record<string, string> = {
  status: 'Paperclip health and owner-accessible company status. No writes are performed.',
  companies: 'Read-only Paperclip company inventory. Mission Control never stores Paperclip cookies or passwords.',
  agents: 'Read-only Paperclip agent/workforce inventory. Task execution remains Bridge-gated.',
  issues: 'Read-only Paperclip issue/task queue. Creating or changing tasks remains Bridge-gated.',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const { resource } = await params
  if (!allowed.has(resource)) {
    return readOnly({
      route: `bridge.paperclip.${resource}`,
      blocker_class: 'BLOCKED',
      state: 'BLOCKED',
      reason: 'Unknown Paperclip bridge resource.',
      execution_enabled: false,
      writes_enabled: false,
      protected_execution_enabled: false,
      credential_values_exposed: false,
    })
  }

  const status = await paperclipLiveStatus(resource)
  return readOnly({
    ...status,
    route: `bridge.paperclip.${resource}`,
    resource_note: resourceNotes[resource],
  })
}
