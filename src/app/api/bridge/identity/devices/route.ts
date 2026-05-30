import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listIdentityDevices } from '@/lib/identity-verification'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  return NextResponse.json(listIdentityDevices(), { headers: { 'Cache-Control': 'no-store' } })
}
