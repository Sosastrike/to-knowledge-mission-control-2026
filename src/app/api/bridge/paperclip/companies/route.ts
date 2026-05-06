import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listPaperclipCompanies } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const payload = await listPaperclipCompanies({ generatedAt: new Date().toISOString() })
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
