import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { calculateTokenCost } from '@/lib/token-pricing'
import { getProviderSubscriptionFlags } from '@/lib/provider-subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AgentCostRow = {
  agent_name: string
  model: string
  input_tokens: number
  output_tokens: number
  request_count: number
  last_active: number | null
}

function clampDays(value: string | null): number {
  const parsed = Number(value || 30)
  if (!Number.isFinite(parsed)) return 30
  return Math.max(1, Math.min(90, Math.floor(parsed)))
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const days = clampDays(searchParams.get('days'))
  const workspaceId = auth.user.workspace_id ?? 1
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400
  const providerSubscriptions = getProviderSubscriptionFlags()

  try {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT
        CASE
          WHEN INSTR(session_id, ':') > 0 THEN SUBSTR(session_id, 1, INSTR(session_id, ':') - 1)
          ELSE session_id
        END AS agent_name,
        model,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        COUNT(*) AS request_count,
        MAX(created_at) AS last_active
      FROM token_usage
      WHERE workspace_id = ?
        AND created_at >= ?
      GROUP BY agent_name, model
      ORDER BY (SUM(input_tokens) + SUM(output_tokens)) DESC
      LIMIT 50
    `).all(workspaceId, cutoff) as AgentCostRow[]

    const agentMap = new Map<string, {
      agent: string
      total_tokens: number
      estimated_cost: number
      request_count: number
      last_active: string | null
      models: Array<{
        model: string
        input_tokens: number
        output_tokens: number
        total_tokens: number
        request_count: number
        estimated_cost: number
      }>
    }>()

    for (const row of rows) {
      const inputTokens = Number(row.input_tokens || 0)
      const outputTokens = Number(row.output_tokens || 0)
      const totalTokens = inputTokens + outputTokens
      const estimatedCost = calculateTokenCost(row.model, inputTokens, outputTokens, { providerSubscriptions })
      const agentName = row.agent_name || 'unknown'
      const current = agentMap.get(agentName) || {
        agent: agentName,
        total_tokens: 0,
        estimated_cost: 0,
        request_count: 0,
        last_active: null,
        models: [],
      }

      current.total_tokens += totalTokens
      current.estimated_cost += estimatedCost
      current.request_count += Number(row.request_count || 0)
      const lastActive = row.last_active ? new Date(row.last_active * 1000).toISOString() : null
      if (lastActive && (!current.last_active || lastActive > current.last_active)) {
        current.last_active = lastActive
      }
      current.models.push({
        model: row.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        request_count: Number(row.request_count || 0),
        estimated_cost: estimatedCost,
      })
      agentMap.set(agentName, current)
    }

    const agents = Array.from(agentMap.values())
      .sort((a, b) => b.total_tokens - a.total_tokens)
      .slice(0, 12)
    const totalTokens = agents.reduce((sum, agent) => sum + agent.total_tokens, 0)
    const totalCost = agents.reduce((sum, agent) => sum + agent.estimated_cost, 0)
    const totalRequests = agents.reduce((sum, agent) => sum + agent.request_count, 0)

    return NextResponse.json({
      ok: true,
      mode: 'bridge_cost_rate_read_only',
      generated_at: new Date().toISOString(),
      no_execution_enabled: true,
      no_budget_enforcement_enabled: true,
      no_provider_routing_changes_enabled: true,
      workspace_id: workspaceId,
      window_days: days,
      summary: {
        total_tokens: totalTokens,
        estimated_cost: totalCost,
        request_count: totalRequests,
        agent_count: agents.length,
      },
      agents,
      governance: {
        current_state: 'read_only_visibility',
        expensive_job_threshold: 'owner approval required before long-running or high-cost jobs',
        route_changes: 'model/provider routing changes remain protected',
        fallback_policy: 'Claude CLI primary; OpenRouter locked fallback; Ollama emergency local backup',
        approval_required_for: [
          'provider routing changes',
          'large batch jobs',
          'external connector execution',
          'new paid provider setup',
          'budget/rate-limit enforcement changes',
        ],
      },
      rate_limits: {
        enforcement_state: 'existing app rate limiters only',
        bridge_specific_limits: 'planned',
        agent_loop_detection: 'planned',
        no_autonomous_expensive_loops: true,
      },
      next_action: 'Wire approval/audit persistence before enforcing budgets or allowing expensive protected execution.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      mode: 'bridge_cost_rate_read_only',
      generated_at: new Date().toISOString(),
      no_execution_enabled: true,
      state: 'BACKEND_REQUIRED',
      error: error instanceof Error ? error.message.slice(0, 200) : 'cost visibility unavailable',
      next_action: 'Verify token_usage storage before enabling cost governance dashboards.',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
}
