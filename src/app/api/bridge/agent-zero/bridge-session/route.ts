import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { ownerApprovalRequired } from '@/lib/designer-module-api'
import { getAgentZeroApiKeyState, probeAgentZeroRuntime } from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SESSION_CONTRACT = {
  agent_id: 'agent_zero',
  mode: 'bridge_session_execution_contract',
  status: 'owner_approval_required',
  execution_enabled: false,
  writes_enabled: false,
  broad_execution_enabled: false,
  docker_socket_enabled: false,
  root_system_access_enabled: false,
  allowed_after_approval: [
    'read_only.ecosystem_context',
    'review.recommendation',
    'buildwiki.run_now via existing scoped adapter only',
  ],
  blocked_without_separate_scope: [
    'zapier.write',
    'heygen.generate',
    'google_drive.upload',
    'onedrive.upload',
    'smb.mount',
    'external_farmer.run',
    'memory.write',
    'docker.config',
    'systemctl.arbitrary',
    'repo.push',
  ],
  required_controls: [
    'single owner approval',
    'explicit scope',
    'TTL',
    'audit log',
    'adapter allowlist',
    'no secrets in prompts, UI, logs, or reports',
  ],
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtimeStatus, apiKey] = await Promise.all([
    probeAgentZeroRuntime(),
    Promise.resolve(getAgentZeroApiKeyState()),
  ])

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    agent_zero_api_key_configured: apiKey.present,
    runtime: {
      reachable: runtimeStatus.reachable,
      health_ok: runtimeStatus.health_ok,
      http_status: runtimeStatus.http_status,
      version: runtimeStatus.version,
    },
    ...SESSION_CONTRACT,
    next_action: 'POSTing here will not execute anything. It returns the owner-approval requirement until a scoped Bridge Session persistence/audit implementation is activated.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  return ownerApprovalRequired({
    ...SESSION_CONTRACT,
    requested_scope: typeof body?.scope === 'string' ? body.scope.slice(0, 160) : null,
    requested_duration_minutes: Number.isFinite(Number(body?.duration_minutes))
      ? Math.max(1, Math.min(240, Math.floor(Number(body.duration_minutes))))
      : null,
    reason: 'agent_zero_bridge_session_execution_requires_separate_owner_approval_and_scoped_adapter',
    http_status_when_blocked: 423,
    approval_request_created: false,
    agent_zero_called: false,
    request_dispatched: false,
    next_action: 'Create a scoped, auditable Bridge Session implementation before enabling Agent Zero execution. Keep using read-only test-chat for ecosystem visibility.',
  })
}
