import { NextRequest } from 'next/server'

import { buildGatewayAiExtractionProxyAttempt, buildGatewayAiExtractionProxyStatus } from '@/lib/gateway-ai-extraction-proxy'
import { authRequired, ownerGated, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly(buildGatewayAiExtractionProxyStatus())
}

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    body = {}
  }

  return ownerGated(buildGatewayAiExtractionProxyAttempt(body), 423)
}
