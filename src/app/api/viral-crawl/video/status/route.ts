import { NextRequest, NextResponse } from 'next/server'
import { authJson } from '@/lib/designer-module-api'
import { getViralCrawlVideoStatus } from '@/lib/viral-crawl-status'
import { sanitizeBridgeProviderPayload } from '@/lib/bridge-provider-sanitizer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json(sanitizeBridgeProviderPayload({
    ...getViralCrawlVideoStatus(),
    generated_at: new Date().toISOString(),
  }), { headers: { 'Cache-Control': 'no-store' } })
}
