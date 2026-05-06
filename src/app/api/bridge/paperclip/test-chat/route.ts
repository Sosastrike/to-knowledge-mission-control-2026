import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildPaperclipTestTaskPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  try {
    const parsed = await request.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      message = typeof (parsed as Record<string, unknown>).message === 'string'
        ? ((parsed as Record<string, unknown>).message as string).trim()
        : ''
    }
  } catch {
    message = ''
  }

  if (!message) {
    return NextResponse.json({
      ok: false,
      error: 'message_required',
      execution_enabled: false,
      writes_enabled: false,
      protected_actions_enabled: false,
      no_secrets_exposed: true,
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const payload = await buildPaperclipTestTaskPayload({ message, generatedAt: new Date().toISOString() })
  return NextResponse.json(payload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
