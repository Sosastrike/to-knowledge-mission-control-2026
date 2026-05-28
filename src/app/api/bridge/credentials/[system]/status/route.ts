import { NextRequest, NextResponse } from 'next/server'

import { buildCredentialBrokerSystemStatus } from '@/lib/credential-broker'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ system: string }> },
) {
  const unauthorized = authRequired(request, 'viewer')
  if (unauthorized) return unauthorized
  const params = await context.params
  const status = buildCredentialBrokerSystemStatus(params.system)
  if (!status) {
    return NextResponse.json({
      ok: false,
      exact_blocker: 'credential_system_not_registered',
      values_exposed: false,
      no_secrets_exposed: true,
      project_continues: true,
    }, { status: 404 })
  }
  return readOnly(status)
}
