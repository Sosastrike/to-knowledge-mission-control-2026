import { NextRequest, NextResponse } from 'next/server'

import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import {
  buildIdentityFinalCertificationReadiness,
  readIdentityProjectTaskLinks,
  runIdentityFinalCertificationDryRun,
} from '@/lib/identity-verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly(buildIdentityFinalCertificationReadiness({ taskLinks: readIdentityProjectTaskLinks(1) }))
}

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  return NextResponse.json({
    ...runIdentityFinalCertificationDryRun({ taskLinks: readIdentityProjectTaskLinks(1) }),
    state: 'OWNER_GATED',
    blocker_class: 'OWNER_GATED',
    execution_enabled: false,
    writes_enabled: true,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    credential_values_exposed: false,
  }, { status: 423 })
}
