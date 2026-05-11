import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildRuntimeHealthPayload } from '@/lib/runtime-health'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const port = new URL(request.url).port || process.env.PORT || '3337'
  return NextResponse.json(buildRuntimeHealthPayload({ port }))
}
