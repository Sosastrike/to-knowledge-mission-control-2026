import { type NextRequest } from 'next/server'

import { buildCredentialBrokerStatus } from '@/lib/credential-broker'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const unauthorized = authRequired(request, 'viewer')
  if (unauthorized) return unauthorized
  return readOnly(buildCredentialBrokerStatus())
}
