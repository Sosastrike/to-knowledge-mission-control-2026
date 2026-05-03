import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemAgentRecord } from '@/lib/agent-zero-bridge'
import { readLatestAgentZeroBridgeSession } from '@/lib/agent-zero-bridge-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const agentZero = await buildAgentZeroEcosystemAgentRecord({
    verifyChat: true,
    chatTimeoutMs: 12000,
  })
  const detail = agentZero.detail
  const bridgeSessionRead = readLatestAgentZeroBridgeSession({
    workspaceId: auth.user.workspace_id || 1,
    tenantId: auth.user.tenant_id || 1,
    sync: true,
  })
  const bridgeSession = bridgeSessionRead.session

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_ecosystem_agent_status_read_only',
    generated_at: agentZero.last_checked_at,
    agent: {
      id: agentZero.id,
      name: agentZero.name,
      status: agentZero.status,
      role: 'reviewer / supervisor',
      mode: agentZero.mode,
      health_url: agentZero.health_url,
      chat_route: agentZero.chat_route,
      capabilities_source: agentZero.capabilities_source,
      allowed_behavior: ['observe', 'recommend', 'review'],
      disallowed_behavior: ['execute protected actions', 'change Docker/config', 'change permissions', 'bypass Tony approval'],
      execution_permission: bridgeSession.execution_enabled ? 'scoped_bridge_session' : 'observe_recommend_review_only',
      execution_enabled: bridgeSession.execution_enabled,
      execution_disabled_until: bridgeSession.execution_enabled ? null : 'single owner-approved Bridge Session with audit-backed scoped runner',
      owner_approval_required_for_execution: !bridgeSession.execution_enabled,
      bridge_session_required: !bridgeSession.execution_enabled,
    },
    tailnet: {
      endpoint: detail.endpoint,
      reachable: agentZero.health_status === 'healthy',
      http_status: detail.health_http_status,
      latency_ms: detail.health_latency_ms,
      error: agentZero.status === 'offline' ? detail.error : null,
    },
    runtime: {
      base_url: detail.endpoint.replace(/\/+$/, ''),
      health_endpoint: detail.health_endpoint,
      chat_endpoint: detail.chat_endpoint,
      version: detail.version,
      commit_hash: detail.commit_hash,
      health_ok: agentZero.health_status === 'healthy',
    },
    mission_control_connector: {
      status: agentZero.status === 'connected'
        ? 'connected_read_only'
        : agentZero.status === 'degraded'
          ? 'degraded_read_only'
          : 'offline',
      can_see_mission_control: agentZero.status === 'connected',
      agent_zero_api_key_configured: detail.api_key_configured,
      auth_status: agentZero.auth_status,
      health_status: agentZero.health_status,
      chat_status: agentZero.chat_status,
      agent_zero_called: agentZero.agent_zero_called,
      context_mode: 'read_only_bridge_context',
      test_chat_endpoint: detail.test_chat_endpoint,
      ecosystem_context_endpoint: detail.ecosystem_context_endpoint,
      bridge_session_endpoint: detail.bridge_session_endpoint,
      bridge_session_execution_enabled: bridgeSession.execution_enabled,
      bridge_session: bridgeSession,
      blocker: bridgeSession.execution_enabled ? null : (detail.blocker || bridgeSession.blocked_reason),
    },
    provider_registry: {
      state: agentZero.state,
      category: agentZero.category,
      last_checked_at: agentZero.last_checked_at,
      health_status: agentZero.health_status,
      auth_status: agentZero.auth_status,
      chat_status: agentZero.chat_status,
      execution_enabled: bridgeSession.execution_enabled,
      bridge_session_required: !bridgeSession.execution_enabled,
      notes: detail.notes,
      error: detail.error,
      blocker: detail.blocker,
      next_action: agentZero.next_action,
    },
    safety: {
      docker_changes_enabled: false,
      config_changes_enabled: false,
      execution_permissions_changed: false,
      protected_actions_created: false,
      writes_enabled: false,
      mission_control_auth_weakened: false,
      agent_zero_execution_enabled: bridgeSession.execution_enabled,
      bridge_session_audit_required: true,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
