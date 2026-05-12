import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GateState = 'OWNER_APPROVAL_REQUIRED' | 'CREDENTIAL_REQUIRED' | 'BACKEND_REQUIRED' | 'READ_ONLY'

type OwnerGate = {
  id: string
  title: string
  category: string
  state: GateState
  priority: number
  approval_required: boolean
  credential_names: string[]
  execution_enabled: false
  writes_enabled: false
  affected_endpoints: string[]
  current_safe_behavior: string
  blocker: string
  next_action: string
}

function hasEnv(name: string): boolean {
  return Boolean((process.env[name] || '').trim())
}

function anyEnv(names: string[]): boolean {
  return names.some((name) => hasEnv(name))
}

function credentialState(names: string[]): GateState {
  return anyEnv(names) ? 'OWNER_APPROVAL_REQUIRED' : 'CREDENTIAL_REQUIRED'
}

function buildGates(): OwnerGate[] {
  const firecrawlNames = ['FIRECRAWL_API_KEY']
  const zapierNames = ['ZAPIER_MCP_URL', 'ZAPIER_MCP_SERVER', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY']
  const n8nNames = ['N8N_BASE_URL', 'N8N_API_KEY']
  const microsoftNames = ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET']

  return [
    {
      id: 'approval_audit_migration',
      title: 'Approval/audit production migration',
      category: 'approval_persistence',
      state: 'OWNER_APPROVAL_REQUIRED',
      priority: 1,
      approval_required: true,
      credential_names: [],
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/bridge/approval-readiness', '/api/bridge/approval-requests'],
      current_safe_behavior: 'Read-only readiness and HTTP 423 protected-action responses only.',
      blocker: 'Production approval/audit tables are not applied.',
      next_action: 'Owner must approve: Approve Bridge Approval/Audit Production Migration.',
    },
    {
      id: 'persistent_approval_queue',
      title: 'Persistent approval queue',
      category: 'approval_persistence',
      state: 'BACKEND_REQUIRED',
      priority: 2,
      approval_required: true,
      credential_names: [],
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/bridge/approval-requests', '/api/bridge/approval-requests/:id/approve', '/api/bridge/approval-requests/:id/deny'],
      current_safe_behavior: 'Queue status is visible; approve/deny remain locked until tables exist.',
      blocker: 'Depends on owner-approved approval/audit migration.',
      next_action: 'Apply migration only after owner approval, then keep execution runners disabled until separately approved.',
    },
    {
      id: 'telegram_one_click_approval',
      title: 'Telegram one-click approval callback',
      category: 'owner_approval_flow',
      state: 'BACKEND_REQUIRED',
      priority: 3,
      approval_required: true,
      credential_names: [],
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/bridge/telegram-approval-preview'],
      current_safe_behavior: 'Preview copy/buttons only. No Telegram send, callback, persistence, or approval creation.',
      blocker: 'Requires approval persistence and callback/audit wiring.',
      next_action: 'Build callback only after approval queue persistence is live.',
    },
    {
      id: 'connector_execution_runners',
      title: 'Connector execution runners',
      category: 'connector_execution',
      state: 'OWNER_APPROVAL_REQUIRED',
      priority: 4,
      approval_required: true,
      credential_names: [],
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/bridge/connector-readiness', '/api/zapier/request-write-approval', '/api/viral-crawl/video/request-run'],
      current_safe_behavior: 'Connector readiness/status only. Mutating actions return locked states.',
      blocker: 'Approval/audit persistence and scoped execution policy must exist first.',
      next_action: 'After migration, enable only scoped runners explicitly approved by owner.',
    },
    {
      id: 'firecrawl_mission_control_setup',
      title: 'FireCrawl Mission Control setup',
      category: 'credential_and_package',
      state: credentialState(firecrawlNames),
      priority: 5,
      approval_required: true,
      credential_names: firecrawlNames,
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/firecrawl/status', '/api/bridge/connector-readiness'],
      current_safe_behavior: 'Mission Control reports credential/package mismatch; no crawl jobs run.',
      blocker: hasEnv('FIRECRAWL_API_KEY') ? 'SDK/job runner still locked.' : 'Mission Control service environment lacks FIRECRAWL_API_KEY.',
      next_action: 'Use approved credential sync path and install SDK only after owner approval.',
    },
    {
      id: 'zapier_mcp_setup_and_writes',
      title: 'Zapier MCP setup and write unlock',
      category: 'connector_execution',
      state: credentialState(zapierNames),
      priority: 6,
      approval_required: true,
      credential_names: zapierNames,
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/zapier/status', '/api/zapier/tools', '/api/zapier/request-write-approval'],
      current_safe_behavior: 'Tool inventory only when configured. No tool invocation and no writes.',
      blocker: anyEnv(zapierNames) ? 'Write approval persistence not applied.' : 'Zapier MCP transport/token missing by name.',
      next_action: 'Configure through approved secret path, then require owner approval for scoped writes.',
    },
    {
      id: 'n8n_setup_and_workflow_execution',
      title: 'n8n setup and workflow execution',
      category: 'connector_execution',
      state: credentialState(n8nNames),
      priority: 7,
      approval_required: true,
      credential_names: n8nNames,
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/n8n/status', '/api/bridge/connector-readiness'],
      current_safe_behavior: 'Status/readiness only. No workflow execution.',
      blocker: anyEnv(n8nNames) ? 'Read-only passthrough/execution runner not enabled.' : 'n8n base URL/API key missing by name.',
      next_action: 'Configure credentials through approved path, then add read-only workflow list before execution.',
    },
    {
      id: 'microsoft_365_secret_path',
      title: 'Microsoft 365 production OAuth secret path',
      category: 'auth_sso',
      state: credentialState(microsoftNames),
      priority: 8,
      approval_required: true,
      credential_names: microsoftNames,
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: ['/api/auth/azure-ad/status', '/api/auth/azure-ad', '/api/auth/callback/azure-ad'],
      current_safe_behavior: 'Microsoft 365 button can remain visible; real OAuth depends on secure env/secret setup.',
      blocker: anyEnv(microsoftNames) ? 'Production callback verification remains required.' : 'Azure AD/NextAuth secret variables missing by name.',
      next_action: 'Owner provides client secret only through approved secret path; do not paste secrets into chat.',
    },
    {
      id: 'cleanup_quarantine',
      title: 'Cleanup quarantine/delete pass',
      category: 'cleanup',
      state: 'OWNER_APPROVAL_REQUIRED',
      priority: 9,
      approval_required: true,
      credential_names: [],
      execution_enabled: false,
      writes_enabled: false,
      affected_endpoints: [],
      current_safe_behavior: 'Inventory only. No delete and no quarantine.',
      blocker: 'Owner approval required before moving or deleting untracked artifacts.',
      next_action: 'Approve a quarantine batch after reviewing runtime/system-cleanup-inventory-report.md.',
    },
  ]
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const gates = buildGates()
  const byState = gates.reduce((acc, gate) => {
    acc[gate.state] = (acc[gate.state] || 0) + 1
    return acc
  }, {} as Record<GateState, number>)

  return NextResponse.json({
    ok: true,
    mode: 'bridge_owner_gates_read_only',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    no_secret_values_exposed: true,
    production_db_migration_applied: false,
    gates,
    summary: {
      total: gates.length,
      by_state: byState,
      owner_approval_required: gates.filter((gate) => gate.approval_required).length,
      credential_related: gates.filter((gate) => gate.credential_names.length > 0).length,
      execution_enabled: 0,
      writes_enabled: 0,
    },
    canonical_next_step: 'Apply owner-approved approval/audit persistence before enabling approvals, Telegram callbacks, or connector execution.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
