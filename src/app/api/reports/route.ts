import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase, db_helpers } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'
import {
  buildTonyReportCreationContract,
  createExecutiveReport,
  executiveReportsSummary,
  listExecutiveReports,
  reviewExecutiveReportsPlan,
} from '@/lib/executive-reports'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const includeDisabled = searchParams.get('include_disabled') === '1' || searchParams.get('include_disabled') === 'true'
    const limit = Number(searchParams.get('limit') || 100)
    const offset = Number(searchParams.get('offset') || 0)
    const result = listExecutiveReports(db, auth.user.workspace_id, { includeDisabled, limit, offset })
    return NextResponse.json({
      ok: true,
      mode: 'executive_reports_scheduled_reports',
      generated_at: new Date().toISOString(),
      reports: result.reports,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      summary: executiveReportsSummary(result.reports),
      plan_review: reviewExecutiveReportsPlan(),
      safety: {
        execution_enabled: false,
        report_delivery_enabled: false,
        mempalace_writes_enabled: false,
        external_connector_writes_enabled: false,
        zapier_writes_enabled: false,
        approval_system: 'canonical Tony Telegram approvals for protected execution only',
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/reports failed')
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const db = getDatabase()
    const body = await request.json().catch(() => ({}))
    const actor = auth.user.display_name || auth.user.username || 'Mission Control'
    const report = createExecutiveReport(db, auth.user.workspace_id, auth.user.tenant_id, body, actor)
    if (!report) return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })

    db_helpers.logActivity(
      'scheduled_report_created',
      'scheduled_report',
      0,
      actor,
      `Created scheduled report ${report.name}`,
      { report_id: report.id, report_type: report.report_type, assigned_agent: report.assigned_agent },
      auth.user.workspace_id,
    )

    return NextResponse.json({
      ok: true,
      report,
      tony_contract: buildTonyReportCreationContract(body),
      execution_enabled: false,
      next_action: 'Report definition saved. Generation/delivery runners stay locked until separately approved.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/reports failed')
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}
