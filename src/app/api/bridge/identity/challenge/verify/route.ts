import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { identityChallengeVerify } from '@/lib/identity-verification'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  return NextResponse.json(identityChallengeVerify(await request.json().catch(() => ({}))), { headers: { 'Cache-Control': 'no-store' } })
}
