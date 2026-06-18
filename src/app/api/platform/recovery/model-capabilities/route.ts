import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildModelCapabilityRegistry } from '@/lib/agent-platform-recovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(buildModelCapabilityRegistry(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
