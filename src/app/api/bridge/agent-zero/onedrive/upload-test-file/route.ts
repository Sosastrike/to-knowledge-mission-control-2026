import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { uploadAgentZeroOneDriveTestFile } from '@/lib/agent-zero-onedrive-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await uploadAgentZeroOneDriveTestFile({
    folder: typeof body.folder === 'string' ? body.folder : null,
    bridgeSessionId: typeof body.bridge_session_id === 'string' ? body.bridge_session_id : null,
  })
  return NextResponse.json(result, { status: 423, headers: { 'Cache-Control': 'no-store' } })
}
