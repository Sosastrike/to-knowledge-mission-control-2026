import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase, db_helpers } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'
import { deleteExecutiveReport, getExecutiveReport, updateExecutiveReport } from '@/lib/executive-reports'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  try {
    const report = getExecutiveReport(getDatabase(), id, auth.user.workspace_id)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error, id }, 'GET /api/reports/[id] failed')
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const report = updateExecutiveReport(getDatabase(), id, auth.user.workspace_id, body)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    db_helpers.logActivity(
      'scheduled_report_updated',
      'scheduled_report',
      0,
      auth.user.display_name || auth.user.username || 'Mission Control',
      `Updated scheduled report ${report.name}`,
      { report_id: report.id, report_type: report.report_type, enabled: report.enabled },
      auth.user.workspace_id,
    )

    return NextResponse.json({ ok: true, report, execution_enabled: false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error, id }, 'PATCH /api/reports/[id] failed')
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  const { id } = await params
  try {
    const deleted = deleteExecutiveReport(getDatabase(), id, auth.user.workspace_id)
    if (!deleted) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    db_helpers.logActivity(
      'scheduled_report_deleted',
      'scheduled_report',
      0,
      auth.user.display_name || auth.user.username || 'Mission Control',
      `Deleted scheduled report ${id}`,
      { report_id: id, soft_delete: true },
      auth.user.workspace_id,
    )

    return NextResponse.json({ ok: true, deleted: true, soft_delete: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error, id }, 'DELETE /api/reports/[id] failed')
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
