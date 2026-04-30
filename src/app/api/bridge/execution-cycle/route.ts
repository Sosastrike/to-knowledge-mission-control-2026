import { NextRequest, NextResponse } from 'next/server'
import { authJson } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cycleSteps = [
  {
    id: 'receive_owner_goal',
    order: 1,
    title: 'Receive owner goal',
    requirement: 'Understand the objective, restate it plainly, and identify the expected outcome.',
    current_state: 'DOCUMENTED',
  },
  {
    id: 'bridge_mode_preflight',
    order: 2,
    title: 'Bridge Mode preflight',
    requirement: 'Query Bridge Mode for tools, skills, models, integrations, MCPs, approval gates, restrictions, missing credentials, locks, fallback routes, and best route.',
    current_state: 'LIVE_READ_ONLY',
    endpoint: '/api/bridge/preflight',
  },
  {
    id: 'build_roadmap',
    order: 3,
    title: 'Build roadmap',
    requirement: 'Produce phases, tasks, responsible agents, tools/models, timeline, risks, deliverables, approval gates, and rollback/fallback plan.',
    current_state: 'TEMPLATE_READY',
    template_doc: 'docs/AGENT_EXECUTION_TEMPLATES.md',
  },
  {
    id: 'validate_10_checks',
    order: 4,
    title: 'Validate with 10 checks',
    requirement: 'Check credentials, tools, approvals, duplicates, security, cost/rate limits, rollback, production impact, owner action, and autonomous readiness.',
    current_state: 'TEMPLATE_READY',
  },
  {
    id: 'executive_report',
    order: 5,
    title: 'Executive report',
    requirement: 'Return a plain-language owner summary and a detailed technical report/PDF package.',
    current_state: 'PREVIEW_ONLY',
    endpoint: '/api/bridge/executive-report-preview',
  },
  {
    id: 'telegram_approval_request',
    order: 6,
    title: 'Telegram approval request',
    requirement: 'Send one-click approve/deny request with plain summary and report link when approval is required.',
    current_state: 'PREVIEW_ONLY_BACKEND_REQUIRED',
    endpoint: '/api/bridge/telegram-approval-preview',
  },
  {
    id: 'autonomous_execution_after_approval',
    order: 7,
    title: 'Autonomous execution after approval',
    requirement: 'Execute autonomously after approval and stop only for true blockers.',
    current_state: 'LOCKED',
  },
  {
    id: 'progress_reporting',
    order: 8,
    title: 'Progress reporting',
    requirement: 'Report completed, failed, changed, next, percent, blockers, secret safety, and rollback status.',
    current_state: 'DOCUMENTED',
  },
  {
    id: 'final_report',
    order: 9,
    title: 'Final report',
    requirement: 'Produce plain summary, technical report, PDF/report artifact, actions, tests, files, risks, and next actions.',
    current_state: 'DOCUMENTED',
  },
]

const validationChecks = [
  'missing credentials',
  'missing tools',
  'missing approvals',
  'duplicate paths',
  'security risks',
  'cost/rate-limit risks',
  'rollback plan',
  'production impact',
  'owner action required',
  'autonomous readiness after approval',
]

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'agent_execution_cycle_read_only_contract',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    no_memory_writes_enabled: true,
    no_governance_writes_enabled: true,
    no_fake_approval_requests: true,
    persistence: 'not_connected',
    approval_request_created: false,
    canonical_docs: {
      cycle: 'docs/MISSION_CONTROL_AGENT_EXECUTION_CYCLE.md',
      bridge_preflight_policy: 'docs/BRIDGE_MODE_PREFLIGHT_POLICY.md',
      templates: 'docs/AGENT_EXECUTION_TEMPLATES.md',
      approval_api_contracts: 'docs/BRIDGE_APPROVAL_API_CONTRACTS.md',
    },
    required_cycle: cycleSteps,
    validation_checks_required: validationChecks,
    current_backend_contracts: {
      preflight: '/api/bridge/preflight',
      capability_matrix: '/api/bridge/capability-matrix',
      connector_readiness: '/api/bridge/connector-readiness',
      owner_gates: '/api/bridge/owner-gates',
      approval_readiness: '/api/bridge/approval-readiness',
      approval_queue: '/api/bridge/approval-requests',
      executive_report_preview: '/api/bridge/executive-report-preview',
      telegram_approval_preview: '/api/bridge/telegram-approval-preview',
      button_contracts: '/api/bridge/button-contracts',
      costs: '/api/bridge/costs',
    },
    enforcement_state: {
      bridge_preflight_live: true,
      agent_runtime_hook_required: true,
      audit_persistence_required: true,
      telegram_approval_callback_required: true,
      protected_execution_enabled: false,
      fail_safe_if_bridge_unavailable: true,
    },
    next_safe_batch: [
      'Surface this read-only contract in Bridge Mode UI.',
      'Add runtime preflight hook after audit persistence is approved.',
      'Connect Telegram approval requests only after approval/audit tables are owner-approved and applied.',
      'Keep protected execution disabled until scoped runners and rollback paths are approved.',
    ],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
