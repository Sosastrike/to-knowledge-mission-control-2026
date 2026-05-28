import { type NextRequest } from 'next/server'

import { buildNuclearGatewayToolMigrationStatus } from '@/lib/nuclear-gateway-tool-migration'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly(buildNuclearGatewayToolMigrationStatus())
}
