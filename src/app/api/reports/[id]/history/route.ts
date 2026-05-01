import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getExecutiveReport, listExecutiveReportHistory } from '@/lib/executive-reports'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  try {
    const db = getDatabase()
    const report = getExecutiveReport(db, id, auth.user.workspace_id)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    const limit = Number(new URL(request.url).searchParams.get('limit') || 50)
    return NextResponse.json({
      ok: true,
      report_id: id,
      history: listExecutiveReportHistory(db, id, auth.user.workspace_id, limit),
      execution_enabled: false,
      next_action: 'History fills when report generation runners are enabled through the canonical approval system.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error, id }, 'GET /api/reports/[id]/history failed')
    return NextResponse.json({ error: 'Failed to load report history' }, { status: 500 })
  }
}
