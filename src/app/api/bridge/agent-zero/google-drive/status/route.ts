import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getAgentZeroGoogleDriveDeliveryStatus } from '@/lib/agent-zero-google-drive-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = await getAgentZeroGoogleDriveDeliveryStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
