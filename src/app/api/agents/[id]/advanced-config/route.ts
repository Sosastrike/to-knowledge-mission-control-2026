// @ts-nocheck
// Phase-1 design artifact. Types to be refined in Phase 2 UI integration.
// Tracked in: /home/tony/.openclaw/docs/mc-agent0-absorption-plan.md
/**
 * GET /api/agents/[id]/advanced-config
 * PUT /api/agents/[id]/advanced-config
 *
 * Path (post-deploy): /home/tony/mission-control/src/app/api/agents/[id]/advanced-config/route.ts
 *
 * Phase 1 of the Agent-0 → Mission Control absorption plan.
 * - GET: returns the advanced_v1 config for the agent (or SAFE_DEFAULT if none)
 * - PUT: validates body against AgentAdvancedConfigV1 and merges into agent.config JSON
 *
 * Auth: GET requires 'viewer'. PUT requires 'operator'. Certain fields require 'owner'.
 * Storage: nested under agents.config.advanced_v1 — no DB migration needed.
 *
 * See /home/tony/.openclaw/docs/mc-agent0-absorption-plan.md for the full plan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  extractAdvancedConfig,
} from '@/lib/agent-advanced-config'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function resolveAgent(id: string, workspaceId: number) {
  const db = getDatabase()
  if (isNaN(Number(id))) {
    return db.prepare('SELECT id, name, config FROM agents WHERE name = ? AND workspace_id = ?').get(id, workspaceId) as any
  }
  return db.prepare('SELECT id, name, config FROM agents WHERE id = ? AND workspace_id = ?').get(Number(id), workspaceId) as any
}

// ────────────────────────────────────────────────────────────
// GET /api/agents/[id]/advanced-config
// ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const workspaceId = auth.user.workspace_id ?? 1
    const agent = resolveAgent(id, workspaceId)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const advanced = extractAdvancedConfig(agent.config)
    return NextResponse.json({
      agent_id: agent.id,
      agent_name: agent.name,
      advanced_config: advanced,
      is_default: !agent.config || !JSON.parse(agent.config || '{}').advanced_v1,
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/agents/[id]/advanced-config error')
    return NextResponse.json({ error: 'Failed to fetch advanced config' }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────
// PUT /api/agents/[id]/advanced-config
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  return NextResponse.json(
    {
      ok: false,
      agent_id: id,
      owner_approval_required: true,
      approval_state: 'required',
      http_status_when_blocked: 423,
      execution_enabled: false,
      approval_request_created: false,
      accepted_for_execution: false,
      reason: 'advanced_agent_config_writes_locked',
      next_action: 'Agent advanced config writes require owner-approved approval/audit persistence before changing agent behavior.',
    },
    { status: 423 },
  )
}
