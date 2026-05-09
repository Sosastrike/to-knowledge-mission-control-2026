import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { calculateTokenCost } from '@/lib/token-pricing'
import { getProviderSubscriptionFlags } from '@/lib/provider-subscriptions'
import {
  evaluateTokenGovernorPreflight,
  sanitizeTokenGovernorText,
  type TokenGovernorPreflightInput,
} from '@/lib/token-governor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TokenUsageCostRow = {
  model: string
  input_tokens: number
  output_tokens: number
  request_count: number
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function estimateCostCents(model: string | null, inputTokens: number, outputTokens: number): number {
  if (!model) return 0
  const dollars = calculateTokenCost(model, inputTokens, outputTokens, {
    providerSubscriptions: getProviderSubscriptionFlags(),
  })
  return Math.max(0, Math.round(dollars * 100))
}

function loadSubjectSpendCents(workspaceId: number, subjectId: string): number {
  try {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT model, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, COUNT(*) AS request_count
      FROM token_usage
      WHERE workspace_id = ?
        AND (
          session_id = ?
          OR session_id LIKE ?
          OR session_id LIKE ?
        )
      GROUP BY model
    `).all(workspaceId, subjectId, `${subjectId}:%`, `${subjectId}-%`) as TokenUsageCostRow[]

    return rows.reduce((sum, row) => {
      return sum + estimateCostCents(row.model, Number(row.input_tokens || 0), Number(row.output_tokens || 0))
    }, 0)
  } catch {
    return 0
  }
}

function loadSummary(workspaceId: number) {
  try {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT
        COUNT(*) AS request_count,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        COUNT(DISTINCT session_id) AS session_count
      FROM token_usage
      WHERE workspace_id = ?
    `).get(workspaceId) as {
      request_count: number
      input_tokens: number | null
      output_tokens: number | null
      session_count: number
    } | undefined

    return {
      request_count: Number(row?.request_count || 0),
      input_tokens: Number(row?.input_tokens || 0),
      output_tokens: Number(row?.output_tokens || 0),
      session_count: Number(row?.session_count || 0),
    }
  } catch {
    return {
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      session_count: 0,
    }
  }
}

function persistAuditEvent(user: string, detail: unknown): boolean {
  try {
    const db = getDatabase()
    db.prepare('INSERT INTO audit_log (action, actor, detail) VALUES (?, ?, ?)').run(
      'token_governor.preflight',
      sanitizeTokenGovernorText(user).slice(0, 80) || 'api',
      JSON.stringify(detail),
    )
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const generatedAt = new Date().toISOString()
  const summary = loadSummary(workspaceId)

  return NextResponse.json({
    ok: true,
    mode: 'gateway_token_governor_status',
    generated_at: generatedAt,
    canonical_status: 'READY',
    blocker_class: 'NONE',
    source: 'token_usage',
    workspace_id: workspaceId,
    enforcement_enabled: true,
    preflight_route: '/api/gateway/token-governor',
    protected_execution_requires_preflight: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    provider_route_changes_enabled: false,
    thresholds: {
      warning_percent: 75,
      hard_stop_percent: 90,
      missing_budget_decision: 'block',
      restricted_model_decision: 'block',
    },
    usage_summary: summary,
    audit: {
      persisted_on_preflight: true,
      event: 'token_governor.preflight',
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
    owner_visible_summary: 'Token Governor preflight is available for budget/model allow, warn, and block decisions. This endpoint does not execute jobs or change provider routes.',
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const workspaceId = auth.user.workspace_id ?? 1
  const subjectId = readString(body.subject_id) || readString(body.subjectId) || 'project_budget'
  const model = readString(body.model)
  const inputTokens = Math.max(0, Math.round(readNumber(body.estimated_input_tokens ?? body.inputTokens) || 0))
  const outputTokens = Math.max(0, Math.round(readNumber(body.estimated_output_tokens ?? body.outputTokens) || 0))
  const projectedFromTokens = estimateCostCents(model, inputTokens, outputTokens)
  const spentCents = readNumber(body.spent_cents ?? body.spentCents) ?? loadSubjectSpendCents(workspaceId, subjectId)
  const projectedCents = readNumber(body.projected_cents ?? body.projectedCents) ?? projectedFromTokens

  const preflightInput: TokenGovernorPreflightInput = {
    scope: readString(body.scope) || 'project',
    subjectId,
    subjectName: readString(body.subject_name) || readString(body.subjectName) || subjectId,
    model,
    spentCents,
    projectedCents,
    budgetCents: readNumber(body.budget_cents ?? body.budgetCents),
    warningPercent: readNumber(body.warning_percent ?? body.warningPercent),
    hardStopPercent: readNumber(body.hard_stop_percent ?? body.hardStopPercent),
    restrictedModels: Array.isArray(body.restricted_models)
      ? body.restricted_models.map((value) => String(value))
      : undefined,
  }
  const result = evaluateTokenGovernorPreflight(preflightInput)
  const auditPersisted = persistAuditEvent(auth.user.username || 'api', {
    ...result.audit_event,
    workspace_id: workspaceId,
  })

  return NextResponse.json({
    ...result,
    workspace_id: workspaceId,
    audit_persisted: auditPersisted,
  }, {
    status: result.decision === 'block' ? 409 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
