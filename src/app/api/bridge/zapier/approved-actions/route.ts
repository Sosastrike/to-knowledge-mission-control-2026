import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildZapierApprovedActionLibrary } from '@/lib/zapier-approved-action-library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  return NextResponse.json(buildZapierApprovedActionLibrary(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
