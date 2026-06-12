import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { buildTelegramJarvisRouteStatus } from '@/lib/gateway-telegram-jarvis-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  return NextResponse.json(
    {
      ok: true,
      ...buildTelegramJarvisRouteStatus(),
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
      external_writes_executed: false,
      agentmail_email_sent: false,
      zapier_write_executed: false,
      broad_connector_execution_enabled: false,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
