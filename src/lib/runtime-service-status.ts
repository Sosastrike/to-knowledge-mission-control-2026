import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

export type RuntimeState = 'READY' | 'READ_ONLY' | 'SERVICE_DOWN' | 'BLOCKED' | 'UNKNOWN'

export type ServiceSpec = {
  id: string
  label: string
  unit_candidates: string[]
  binary_candidates?: string[]
  required_unit?: string
  readiness_endpoint: string
  read_probe_endpoint: string
  owner_action_type: 'service_install' | 'runtime_proof' | 'owner_approval' | 'jarvis_delegation'
  next_action: string
}

export const RUNTIME_SERVICE_SPECS: ServiceSpec[] = [
  {
    id: 'hermes',
    label: 'Ron Weasley — Nuclear Dispatcher',
    unit_candidates: [],
    binary_candidates: ['/home/tony/mission-control/src/app/api/bridge/hermes/full-access/status/route.ts'],
    readiness_endpoint: '/api/bridge/hermes/full-access/status',
    read_probe_endpoint: '/api/bridge/hermes/system-command-registry',
    owner_action_type: 'jarvis_delegation',
    next_action: 'Ron Weasley is source-backed in Mission Control with a direct Gateway line. Use Jarvis-signed exact-scope delegation before write or execute actions.',
  },
  {
    id: 'paperclip',
    label: 'Paperclip sandbox',
    unit_candidates: ['paperclip.service', 'paperclip-sandbox.service', 'paperclip-workforce.service'],
    readiness_endpoint: '/api/paperclip/status',
    read_probe_endpoint: '/api/paperclip/status',
    owner_action_type: 'service_install',
    next_action: 'Resolve Paperclip sandbox unit, then expose Workforce Control Plane proof without direct protected execution.',
  },
  {
    id: 'openclaw_plus',
    label: 'OpenClaw+',
    unit_candidates: ['openclaw-gateway.service', 'openclaw-plus.service', 'openclaw.service'],
    binary_candidates: ['/home/tony/.openclaw/bin/openclaw', '/home/tony/bin/openclaw', '/usr/local/bin/openclaw'],
    readiness_endpoint: '/api/openclaw-plus/status',
    read_probe_endpoint: '/api/openclaw-plus/status',
    owner_action_type: 'runtime_proof',
    next_action: 'Resolve OpenClaw+ doctor/runtime path. Use OpenClaw+ naming and keep execution Bridge-gated.',
  },
  {
    id: 'spaceagent_playwright',
    label: 'SpaceAgent Playwright MCP',
    unit_candidates: ['spaceagent-playwright.service', 'playwright-mcp.service'],
    readiness_endpoint: '/api/bridge/spaceagent/status',
    read_probe_endpoint: '/api/bridge/spaceagent/status',
    owner_action_type: 'runtime_proof',
    next_action: 'Resolve Playwright MCP service path, then prove read-only browser evidence before any protected action.',
  },
  {
    id: 'buildwiki_farmer',
    label: 'Build-Wiki Farmer Fork 1',
    unit_candidates: ['opencloud-docs-farmer.service'],
    required_unit: 'opencloud-docs-farmer.service',
    readiness_endpoint: '/api/bridge/runtime-services',
    read_probe_endpoint: '/api/bridge/brain-sync/build-wiki/run-now',
    owner_action_type: 'owner_approval',
    next_action: 'Run Now may only request Bridge approval for systemctl --user start opencloud-docs-farmer.service.',
  },
]

export const RUNTIME_ROLLBACK_COMMANDS = {
  agent_zero: 'disable protected Agent Zero request runner; keep /api/agent-zero/request OWNER_GATED',
  hermes: 'archive the exact Ron Weasley delegation packet; keep /api/bridge/hermes/execute gated by Jarvis delegation',
  paperclip: 'disable Paperclip protected runner; keep sandbox status read-only',
  openclaw_plus: 'disable OpenClaw+ protected runner; keep doctor/runtime route read-only',
  spaceagent: 'disable SpaceAgent protected runner; keep browser evidence route read-only',
  buildwiki_farmer: 'disable Build-Wiki Run Now dispatch and keep opencloud-docs-farmer.service approval-gated',
} as const

function run(command: string, args: string[], timeout = 2500): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      })
    })
  })
}

async function showUserUnit(unit: string) {
  const result = await run('systemctl', ['--user', 'show', unit, '--property=LoadState,ActiveState,SubState,FragmentPath', '--no-pager'])
  const fields = Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.split('='))
      .filter((parts) => parts.length === 2 && parts[0])
      .map(([key, value]) => [key, value]),
  )
  return {
    unit,
    command_ok: result.ok,
    load_state: fields.LoadState || 'unknown',
    active_state: fields.ActiveState || 'unknown',
    sub_state: fields.SubState || 'unknown',
    fragment_present: Boolean(fields.FragmentPath),
  }
}

function classifyUnit(unit: Awaited<ReturnType<typeof showUserUnit>> | null, hasBinary: boolean, spec: ServiceSpec): RuntimeState {
  if (!unit && hasBinary) return 'READ_ONLY'
  if (!unit) return 'BLOCKED'
  if (unit.load_state === 'not-found') return spec.required_unit ? 'SERVICE_DOWN' : 'BLOCKED'
  if (unit.active_state === 'active') return 'READ_ONLY'
  if (unit.active_state === 'inactive' || unit.active_state === 'failed') return 'SERVICE_DOWN'
  return 'UNKNOWN'
}

function installReadiness(unit: Awaited<ReturnType<typeof showUserUnit>> | null, hasBinary: boolean, spec: ServiceSpec, state: RuntimeState) {
  const serviceReachabilityBlockerClass = state === 'READ_ONLY' ? 'NONE' : state
  return {
    state,
    blocker_class: serviceReachabilityBlockerClass,
    service_reachability_blocker_class: serviceReachabilityBlockerClass,
    promotion_blocker_class: 'OWNER_GATED',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    no_go_claim: true,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    read_only_probe_command: 'systemctl --user show <unit> --property=LoadState,ActiveState,SubState,FragmentPath --no-pager',
    readiness_endpoint: spec.readiness_endpoint,
    read_probe_endpoint: spec.read_probe_endpoint,
    owner_action_type: spec.owner_action_type,
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: RUNTIME_ROLLBACK_COMMANDS[spec.id as keyof typeof RUNTIME_ROLLBACK_COMMANDS] || 'keep runtime install proof read-only and disable protected runner',
    probe_scope: 'read_only_user_unit_metadata',
    service_control_enabled: false,
    no_start_stop_restart: true,
    unit_candidates: spec.unit_candidates,
    selected_unit: unit?.unit || null,
    unit_load_state: unit?.load_state || 'unknown',
    unit_active_state: unit?.active_state || 'unknown',
    fragment_present: unit?.fragment_present || false,
    binary_present: hasBinary,
    required_unit: spec.required_unit || null,
    next_action: spec.next_action,
  }
}

export async function inspectRuntimeService(spec: ServiceSpec) {
  const unitResults = await Promise.all(spec.unit_candidates.map((unit) => showUserUnit(unit)))
  const selectedUnit =
    unitResults.find((unit) => unit.load_state !== 'not-found') ||
    unitResults.find((unit) => unit.unit === spec.required_unit) ||
    null
  const binary_present = (spec.binary_candidates || []).some((candidate) => existsSync(candidate))
  const state = classifyUnit(selectedUnit, binary_present, spec)
  const service_reachability_blocker_class = state === 'READ_ONLY' ? 'NONE' : state
  return {
    id: spec.id,
    label: spec.label,
    state,
    blocker_class: service_reachability_blocker_class,
    service_reachability_blocker_class,
    promotion_blocker_class: 'OWNER_GATED',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    go_claim_allowed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    no_go_claim: true,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    selected_unit: selectedUnit?.unit || null,
    unit_candidates: spec.unit_candidates,
    unit_status: selectedUnit,
    binary_present,
    required_unit: spec.required_unit || null,
    install_readiness: installReadiness(selectedUnit, binary_present, spec, state),
    service_control_enabled: false,
    no_start_stop_restart: true,
    read_only_probe_command: 'systemctl --user show',
    readiness_endpoint: spec.readiness_endpoint,
    read_probe_endpoint: spec.read_probe_endpoint,
    owner_action_type: spec.owner_action_type,
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: RUNTIME_ROLLBACK_COMMANDS[spec.id as keyof typeof RUNTIME_ROLLBACK_COMMANDS] || 'keep runtime proof route read-only and disable protected runner',
    promotion_requirements: [
      'runtime service reachable or exact blocker',
      'provider connectivity read-only proof',
      'Bridge-gated protected execution path',
      'audit trail',
      'rollback proof',
      'owner proof where required',
    ],
    next_action: spec.next_action,
  }
}

export async function inspectRuntimeServices() {
  return Promise.all(RUNTIME_SERVICE_SPECS.map(inspectRuntimeService))
}

export function buildFarmerFork1Readiness(service: Awaited<ReturnType<typeof inspectRuntimeService>> | null | undefined) {
  return {
    state: service?.state || 'BLOCKED',
    blocker_class: service?.blocker_class || 'BLOCKED',
    service_reachability_blocker_class: service?.service_reachability_blocker_class || 'BLOCKED',
    promotion_blocker_class: 'OWNER_GATED',
    promotion_blocked: true,
    promotion_requirements_complete: false,
    go_claim_allowed: false,
    no_go_claim: true,
    no_fake_button: true,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    fake_success_allowed: false,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    fork_scope: 'Fork 1 only',
    allowed_service: 'opencloud-docs-farmer.service',
    allowed_dispatch_command: 'systemctl --user start opencloud-docs-farmer.service',
    run_now_approval_request: {
      action: 'buildwiki.run_now',
      state: 'OWNER_GATED',
      must_create_approval_request: true,
      executes_immediately: false,
      bridge_lifecycle_blocker: 'OWNER_GATED',
      reason: 'Run Now cannot dispatch until the Bridge approval lifecycle is live and owner-approved.',
    },
    dispatch_guard: {
      state: 'OWNER_GATED',
      approved_only: true,
      exact_command_only: 'systemctl --user start opencloud-docs-farmer.service',
      broad_service_control_enabled: false,
      fake_done_allowed: false,
    },
    ui_state_machine: ['Request run', 'Approval pending', 'Run dispatched', 'Completed/Failed'],
    timer_status: {
      state: 'BLOCKED',
      blocker_class: 'BLOCKED',
      reason: 'Farmer timer metadata is not wired in this repo slice; do not claim timer GO.',
    },
    audit_state: 'OWNER_GATED',
    rollback_state: 'OWNER_GATED',
    rollback_command: RUNTIME_ROLLBACK_COMMANDS.buildwiki_farmer,
    forbidden_actions: [
      'pause_sync',
      'resume_sync',
      'add_source',
      'smb_farmer',
      'fork_2',
      'gmail_farmer',
      'slack_farmer',
      'youtube_farmer',
      'web_farmer',
      'external_farmers',
    ],
    safety_invariants: {
      no_smb: true,
      no_fork_2: true,
      no_external_farmers: true,
      no_env_changes: true,
      no_unapproved_writes: true,
    },
    promotion_requirements: [
      'Fork 1 only confirmed',
      'Run Now creates buildwiki.run_now approval request',
      'Run Now does not execute before owner approval',
      'approved dispatch runs only systemctl --user start opencloud-docs-farmer.service',
      'UI state machine reaches Completed/Failed truthfully',
      'farmer service and timer status are observable',
      'audit trail exists',
      'rollback/disable path is documented and proven',
    ],
  }
}

export function runtimeServiceSpec(id: string) {
  return RUNTIME_SERVICE_SPECS.find((spec) => spec.id === id)
}
