import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { describeOwnerFacingStatus, OWNER_FACING_STATUS_STATES } from '@/lib/owner-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ButtonState =
  | 'LIVE'
  | 'READ_ONLY'
  | 'BACKEND_REQUIRED'
  | 'CREDENTIAL_REQUIRED'
  | 'OWNER_APPROVAL_REQUIRED'
  | 'DISABLED'

type ButtonContract = {
  route: string
  label: string
  endpoint: string | null
  method: 'GET' | 'POST' | 'PUT' | 'LOCAL' | 'EXTERNAL'
  state: ButtonState
  credential_names: string[]
  approval_required: boolean
  audit_required: boolean
  owner: 'Cloud Code' | 'Codex' | 'Cloud Code + Codex'
  note: string
}

function blockedHttpStatus(button: ButtonContract): number | null {
  if (button.state === 'OWNER_APPROVAL_REQUIRED') return 423
  if (button.state === 'CREDENTIAL_REQUIRED') {
    // Read-only status/list endpoints may return HTTP 200 with a
    // CREDENTIAL_REQUIRED state so the UI can show the blocker clearly.
    // Mutating actions still block at HTTP 503 until credentials exist.
    return button.method === 'GET' ? null : 503
  }
  if (button.state === 'BACKEND_REQUIRED') return 503
  if (button.state === 'DISABLED') return 410
  return null
}

function canExecuteNow(button: ButtonContract): boolean {
  if (button.method === 'GET' && button.state === 'READ_ONLY') return true
  if ((button.method === 'LOCAL' || button.method === 'EXTERNAL') && button.state === 'LIVE') return true
  return false
}

function buttonWithRuntimeContract(button: ButtonContract) {
  const blocked_status = blockedHttpStatus(button)
  const execution_enabled = canExecuteNow(button)
  const credential_readonly_status =
    button.method === 'GET' && button.state === 'CREDENTIAL_REQUIRED'
  const owner_status = describeOwnerFacingStatus({
    rawStatus: button.state.toLowerCase(),
    blockers: button.note ? [button.note] : [],
    credentialNames: button.credential_names,
    readEnabled: button.method === 'GET' || button.method === 'LOCAL',
    writeEnabled: false,
    executionEnabled: execution_enabled,
    requiresBridgeSession: button.approval_required,
    requiresOwnerApproval: button.state === 'OWNER_APPROVAL_REQUIRED',
  })
  return {
    ...button,
    current_backend_state: button.state,
    owner_status,
    blocked_http_status: blocked_status,
    execution_enabled,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    should_render_as_disabled:
      button.state === 'BACKEND_REQUIRED' ||
      button.state === 'CREDENTIAL_REQUIRED' ||
      button.state === 'OWNER_APPROVAL_REQUIRED' ||
      button.state === 'DISABLED',
    safe_ui_behavior: blocked_status
      ? `Show ${button.state}; do not fake success. If submitted, backend should return HTTP ${blocked_status}.`
      : credential_readonly_status
        ? 'Show CREDENTIAL_REQUIRED from the read-only endpoint; do not execute or request secrets outside the approved credential path.'
        : execution_enabled
        ? 'Allowed within current state.'
        : 'Render as informational/read-only until a concrete backend state exists.',
  }
}

const BUTTONS: ButtonContract[] = [
  { route: 'left-rail', label: 'Mission Control', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'Brain Sync', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'Gateway', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'FireCrawl', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'Zapier', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'n8n', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'MCP Tools', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },
  { route: 'left-rail', label: 'Skills', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Shell navigation.' },

  { route: 'brain-sync', label: 'Notifications', endpoint: '/api/notifications/stream', method: 'GET', state: 'DISABLED', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'No SSE notification stream wired.' },
  { route: 'brain-sync', label: 'Help', endpoint: null, method: 'LOCAL', state: 'DISABLED', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'No help backend wired.' },
  { route: 'brain-sync', label: 'Request Agent Zero', endpoint: '/api/agent-zero/request', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Endpoint not enabled until approval persistence exists.' },
  { route: 'brain-sync', label: 'Rebuild graph', endpoint: '/api/bridge/brain-sync/rebuild', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Graph rebuild is protected.' },
  { route: 'brain-sync', label: 'Expand / Pop out / Close', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Local UI only.' },

  { route: 'brain-sync', label: 'Brain Sync source status', endpoint: '/api/bridge/brain-sync/status', method: 'GET', state: 'CREDENTIAL_REQUIRED', credential_names: ['CLAUDECLAW_DASHBOARD_TOKEN'], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only Agent Zero Brain, MemPalace, Obsidian, Graphify, and Brain Sync visibility requires the ClaudeClaw dashboard token. No memory writes, no protected memory changes, no DB migration.' },
  { route: 'brain-sync', label: 'Build-Wiki / Farmer status', endpoint: '/api/bridge/brain-sync/build-wiki/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Live read-only Build-Wiki/Farmer Sync status: registry, timer, service, vault counts, and controls. No farmer run is triggered.' },
  { route: 'brain-sync', label: 'Build-Wiki latest raw/wiki files', endpoint: '/api/bridge/brain-sync/build-wiki/files', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Lists latest raw/wiki file metadata only. No content write, no deletion, no sync execution.' },
  { route: 'brain-sync', label: 'Build-Wiki read file', endpoint: '/api/bridge/brain-sync/build-wiki/files/:type/:name', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Reads a single allowlisted raw/wiki markdown file with path traversal and secret redaction guards.' },
  { route: 'brain-sync', label: 'Build-Wiki farmer logs', endpoint: '/api/bridge/brain-sync/build-wiki/logs', method: 'GET', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only redacted tail of the Build-Wiki/Farmer docs sync log. Show unavailable if the service has not produced a log yet.' },
  { route: 'brain-sync', label: 'Build-Wiki request run now', endpoint: '/api/bridge/brain-sync/build-wiki/run-now', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Creates a scoped owner approval request. The approval route dispatches only opencloud-docs-farmer.service after owner approval.' },
  { route: 'brain-sync', label: 'Build-Wiki run status', endpoint: '/api/bridge/brain-sync/build-wiki/run-now/:id', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Reads one scoped approval/run state for Build-Wiki run-now.' },

  { route: 'gateway', label: 'Refresh live', endpoint: '/api/bridge/providers', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Live adapter refreshes read-only data.' },
  { route: 'gateway', label: 'Bridge Mode capability matrix', endpoint: '/api/bridge/capability-matrix', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only Bridge Mode MVP: agents, models, tools, skills, MCPs, restrictions, approval gates, and blockers.' },
  { route: 'gateway', label: 'Agent Zero reviewer status', endpoint: '/api/bridge/agent-zero/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Shows Agent Zero as observe/recommend/review supervisor with Tailnet reachability and execution disabled. No Docker/config/permission changes.' },
  { route: 'gateway', label: 'Hermes sandbox specialist status', endpoint: '/api/bridge/hermes/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Shows Hermes as sandbox skill/workflow specialist with installed version, sandbox state, provider limitation, and production bridge disabled. No gateway/public port/legacy memory/credential changes.' },
  { route: 'gateway', label: 'Agent Zero to Hermes handoff', endpoint: '/api/bridge/agent-zero/hermes-handoff', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Agent Zero can ask Hermes for skill designs, workflow plans, automation plans, integration maps, failure analysis, and report outlines. Hermes returns recommendations only; no execution or external writes.' },
  { route: 'gateway', label: 'Harness visibility', endpoint: '/api/bridge/harness/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only Harness status over existing tasks/tickets, activities, agents, and provider registry. No execution routes, protected actions, DB migrations, or routing writes.' },
  { route: 'gateway', label: 'Bridge Mode preflight', endpoint: '/api/bridge/preflight', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Read-only preflight evaluator for the Mission Control Agent Execution Cycle. It selects routes and blockers but does not execute or persist.' },
  { route: 'gateway', label: 'Agent execution cycle contract', endpoint: '/api/bridge/execution-cycle', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only canonical protocol contract for Bridge preflight, roadmap, 10-check validation, executive report, Telegram approval preview, and locked execution.' },
  { route: 'gateway', label: 'Cost/rate governance', endpoint: '/api/bridge/costs', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only token/cost visibility and rate-limit policy. It does not enforce budgets, change provider routes, or enable execution.' },
  { route: 'gateway', label: 'Owner gates / blockers', endpoint: '/api/bridge/owner-gates', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only summary of owner approvals, credential blockers, and backend gates. It never creates approvals or enables execution.' },
  { route: 'gateway', label: 'Approval/audit readiness', endpoint: '/api/bridge/approval-readiness', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only schema/readiness check for approval queue and audit persistence. It never applies migrations or creates approvals.' },
  { route: 'gateway', label: 'Executive report preview', endpoint: '/api/bridge/executive-report-preview', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Generates a plain-language and markdown preview only. No PDF write, Telegram send, approval creation, or execution.' },
  { route: 'gateway', label: 'Telegram approval preview', endpoint: '/api/bridge/telegram-approval-preview', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Shows disabled Agent Zero owner-channel approval copy/buttons only. No send, callback, persistence, approval creation, or execution.' },
  { route: 'auth', label: 'SSO readiness', endpoint: '/api/auth/sso-readiness', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'No-secrets readiness contract for email/password, Google Workspace, Microsoft 365, hidden SAML, and invite-only access. It never starts OAuth or exposes credential values.' },
  { route: 'gateway', label: 'Connector readiness matrix', endpoint: '/api/bridge/connector-readiness', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only readiness for FireCrawl, Zapier, n8n, MCP Tools, and Skills. No connector execution.' },
  { route: 'gateway', label: 'Approval queue', endpoint: '/api/bridge/approval-requests', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only approval queue. Persistence is connected when the owner-approved migration is applied; protected execution remains locked.' },
  { route: 'gateway', label: 'Approve request in web UI', endpoint: '/api/bridge/approval-requests/:id/approve', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Canonical owner decisions are owner-channel approvals through Agent Zero Approve/Deny decisions. Mission Control shows the state but blocks web approval with HTTP 423 to prevent duplicate approval systems.' },
  { route: 'gateway', label: 'Deny request in web UI', endpoint: '/api/bridge/approval-requests/:id/deny', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Canonical owner decisions are owner-channel approvals through Agent Zero Approve/Deny decisions. Mission Control shows the state but blocks web denial with HTTP 423 to prevent duplicate approval systems.' },
  { route: 'gateway', label: 'Add agent', endpoint: '/api/agents', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Production create remains disabled until owner approves scoped execution runners, even when approval/audit persistence exists.' },
  { route: 'gateway', label: 'Promote / Demote / Retire / Connect engine', endpoint: '/api/bridge/approval-requests', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Protected agent changes remain locked.' },
  { route: 'gateway', label: 'Dock Feed/Table toggle', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Local UI only.' },

  { route: 'firecrawl', label: 'Refresh', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Browser reload.' },
  { route: 'firecrawl', label: 'New job / Start job', endpoint: '/api/firecrawl/jobs', method: 'POST', state: 'CREDENTIAL_REQUIRED', credential_names: ['FIRECRAWL_API_KEY'], approval_required: true, audit_required: true, owner: 'Codex', note: 'Credential and job runner/persistence required.' },
  { route: 'firecrawl', label: 'Save draft', endpoint: '/api/firecrawl/drafts', method: 'POST', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'No draft table yet.' },
  { route: 'firecrawl', label: 'Cancel', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Local form reset.' },
  { route: 'viral-crawl', label: 'Video Intelligence status', endpoint: '/api/viral-crawl/video/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Reports wrapper, vendor skill, Obsidian destination, and watch_video skill registry status. Does not execute video jobs.' },
  { route: 'viral-crawl', label: 'Run Watch Video / send to Brain', endpoint: '/api/viral-crawl/video/request-run', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Execution is locked until approval persistence, audit chain, and a safe runner are approved.' },

  { route: 'zapier', label: 'Open Zapier', endpoint: 'https://zapier.com/app/dashboard', method: 'EXTERNAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'External navigation only.' },
  { route: 'zapier', label: 'Zapier Tool Bridge status', endpoint: '/api/bridge/zapier/status', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Canonical read-only Zapier Tool Bridge. Uses live MCP tools/list when available and cached ClaudeClaw snapshot otherwise. No invocation.' },
  { route: 'zapier', label: 'Load tool list', endpoint: '/api/bridge/zapier/tools', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only tools/list only; no Zapier invocation.' },
  { route: 'zapier', label: 'Search HeyGen tools', endpoint: '/api/bridge/zapier/tools/search', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Canonical preflight lookup before asking for video/HeyGen credentials. Use q=heygen. No invocation.' },
  { route: 'zapier', label: 'Request write approval', endpoint: '/api/zapier/request-write-approval', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: ['ZAPIER_MCP_URL'], approval_required: true, audit_required: true, owner: 'Codex', note: 'Writes remain locked.' },
  { route: 'zapier', label: 'Revoke approval', endpoint: '/api/zapier/revoke-write-approval', method: 'POST', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'No persistent approval state exists to revoke until approval/audit persistence is applied.' },

  { route: 'n8n', label: 'Open n8n', endpoint: null, method: 'EXTERNAL', state: 'CREDENTIAL_REQUIRED', credential_names: ['N8N_BASE_URL'], approval_required: false, audit_required: false, owner: 'Codex', note: 'n8n base URL not configured.' },
  { route: 'n8n', label: 'Test connection', endpoint: '/api/n8n/test', method: 'POST', state: 'CREDENTIAL_REQUIRED', credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'], approval_required: false, audit_required: true, owner: 'Codex', note: 'n8n requires approved base URL/API key setup before connectivity tests.' },
  { route: 'n8n', label: 'List workflows / executions / webhooks', endpoint: '/api/n8n/workflows', method: 'GET', state: 'CREDENTIAL_REQUIRED', credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'], approval_required: false, audit_required: true, owner: 'Codex', note: 'Read-only passthrough waits on approved n8n credential setup.' },
  { route: 'n8n', label: 'Activate / Deactivate / Execute workflow', endpoint: '/api/n8n/workflows/:id/:action', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: ['N8N_API_KEY'], approval_required: true, audit_required: true, owner: 'Codex', note: 'Workflow writes locked.' },

  { route: 'mcp-tools', label: 'Refresh MCP list', endpoint: '/api/mcp/servers', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Status only.' },
  { route: 'mcp-tools', label: 'Test server', endpoint: '/api/mcp/servers/:id/test', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Reports known status; does not invoke tools.' },
  { route: 'mcp-tools', label: 'Reauth / Enable / Disable', endpoint: '/api/mcp/servers/:id/:action', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'MCP config changes locked.' },

  { route: 'skills', label: 'Refresh skills', endpoint: '/api/skills', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only registry.' },
  { route: 'skills', label: 'Create / edit / delete skill', endpoint: '/api/skills', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Direct skill filesystem writes are locked; use canonical install request flow.' },
  { route: 'skills', label: 'Tool skill inventory', endpoint: '/api/skills/tool-skills', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only ClaudeClaw agent skill inventory.' },
  { route: 'skills', label: 'Search', endpoint: '/api/skills/finder/search', method: 'POST', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Read-only search index.' },
  { route: 'skills', label: 'Test', endpoint: '/api/skills/:id/test', method: 'POST', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Probe runner missing.' },
  { route: 'skills', label: 'Request install / Enable / Disable', endpoint: '/api/skills/:id/:action', method: 'POST', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Skill mutations locked.' },

  { route: 'schedule', label: 'Refresh schedule', endpoint: '/api/tasks', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Reads task flow only.' },
  { route: 'schedule', label: 'Assign task to agent', endpoint: '/api/tasks/:id', method: 'PUT', state: 'OWNER_APPROVAL_REQUIRED', credential_names: [], approval_required: true, audit_required: true, owner: 'Codex', note: 'Task assignment writes are hidden/disabled until approval persistence and audit trail are live.' },
  { route: 'schedule', label: 'Open full task', endpoint: null, method: 'LOCAL', state: 'LIVE', credential_names: [], approval_required: false, audit_required: false, owner: 'Cloud Code', note: 'Local navigation into the existing task panel route.' },

  { route: 'live-meeting', label: 'Load active meetings', endpoint: '/api/sessions', method: 'GET', state: 'READ_ONLY', credential_names: [], approval_required: false, audit_required: false, owner: 'Codex', note: 'Reads active sessions only.' },
  { route: 'live-meeting', label: 'Start new meeting', endpoint: '/api/sessions', method: 'POST', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Meeting creation backend is not connected from this route yet.' },
  { route: 'live-meeting', label: 'Join meeting', endpoint: '/api/sessions/:id/control', method: 'POST', state: 'BACKEND_REQUIRED', credential_names: [], approval_required: false, audit_required: true, owner: 'Codex', note: 'Live meeting join/control remains locked until the meeting backend is connected.' },
]

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const byState = BUTTONS.reduce((acc, button) => {
    acc[button.state] = (acc[button.state] || 0) + 1
    return acc
  }, {} as Record<ButtonState, number>)

  const byRoute = BUTTONS.reduce((acc, button) => {
    const existing = acc[button.route] || {
      route: button.route,
      total: 0,
      by_state: {} as Record<ButtonState, number>,
      protected_actions: 0,
      audit_required: 0,
      blocked_buttons: 0,
      executable_now: 0,
      missing_backend: 0,
      missing_credentials: 0,
    }
    existing.total += 1
    existing.by_state[button.state] = (existing.by_state[button.state] || 0) + 1
    if (button.approval_required) existing.protected_actions += 1
    if (button.audit_required) existing.audit_required += 1
    if (blockedHttpStatus(button)) existing.blocked_buttons += 1
    if (canExecuteNow(button)) existing.executable_now += 1
    if (button.state === 'BACKEND_REQUIRED') existing.missing_backend += 1
    if (button.state === 'CREDENTIAL_REQUIRED') existing.missing_credentials += 1
    acc[button.route] = existing
    return acc
  }, {} as Record<string, {
    route: string
    total: number
    by_state: Record<ButtonState, number>
    protected_actions: number
    audit_required: number
    blocked_buttons: number
    executable_now: number
    missing_backend: number
    missing_credentials: number
  }>)

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    allowed_states: ['LIVE', 'READ_ONLY', 'BACKEND_REQUIRED', 'CREDENTIAL_REQUIRED', 'OWNER_APPROVAL_REQUIRED', 'DISABLED'],
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    no_fake_success: true,
    protected_execution_enabled: false,
    buttons: BUTTONS.map(buttonWithRuntimeContract),
    route_summary: Object.values(byRoute).sort((a, b) => a.route.localeCompare(b.route)),
    summary: {
      total: BUTTONS.length,
      by_state: byState,
      protected_actions: BUTTONS.filter((button) => button.approval_required).length,
      audit_required: BUTTONS.filter((button) => button.audit_required).length,
      blocked_buttons: BUTTONS.filter((button) => blockedHttpStatus(button)).length,
      executable_now: BUTTONS.filter(canExecuteNow).length,
    },
  })
}
