import type {
  BridgeStatus,
  BuildWikiFarmerStatus,
  CanonicalStatus,
  ClassifiedError,
  ComponentStatus,
  GatewayStatusSnapshot,
} from './types.js'
import { normalizeStatusLabel, rollupStatuses } from './label-map.js'
import { redactString } from './redact.js'

// Loose shape for raw input — anything Codex (or the existing /api/gateway/status
// route) hands us. Every field is optional; we never trust raw input to be complete.
export interface RawStatusInput {
  generated_at?: string | null
  execution_enabled?: boolean | null
  writes_enabled?: boolean | null
  external_writes_enabled?: boolean | null
  safety?: { status?: string; mode?: string } | null
  agents?: ReadonlyArray<RawComponent> | null
  providers?: ReadonlyArray<RawComponent> | null
  tools?: ReadonlyArray<RawComponent> | null
  connectors?: ReadonlyArray<RawComponent> | null
  bridge?: RawBridge | null
  buildwiki_farmer?: RawBuildWiki | null
  blockers?: ReadonlyArray<RawBlocker> | null
}

export interface RawComponent {
  id?: string
  label?: string
  status?: string
  state?: string
  ui_contract?: { status_card_state?: string }
  reachable?: boolean
  configured?: boolean
  credential_configured?: boolean
  credentials_present_by_name?: Record<string, boolean>
  service_running?: boolean
  last_seen?: string | null
  last_seen_at?: string | null
  blocker?: string | null
  next_action?: string | null
  proof_available?: boolean
  execution_enabled?: boolean
  writes_enabled?: boolean
}

export interface RawBridge {
  status?: string
  approval_persistence_ready?: boolean
  audit_chain_ready?: boolean
  runner_available?: boolean
  blocker?: string | null
  next_action?: string | null
}

export interface RawBuildWiki {
  status?: string
  ui_state?: string | null
  service_running?: boolean | null
  timer_active?: boolean | null
  approval_state?: string | null
  last_run_finished_at?: string | null
  last_run_exit_code?: number | null
  blocker?: string | null
  next_action?: string | null
}

export interface RawBlocker {
  kind?: string
  owner_message?: string
  technical_detail?: string
  next_action?: string
  codex_can_fix?: boolean
  owner_action_required?: boolean
}

interface NormalizeOptions {
  // When true, force any LIVE/READY component status down to READ_ONLY when
  // execution_enabled is false. Default true — we never want owner-facing UI
  // to render LIVE when execution is globally disabled.
  enforceExecutionGate?: boolean
}

const DEFAULT_OPTS: Required<NormalizeOptions> = {
  enforceExecutionGate: true,
}

function clampString(s: unknown, max = 280): string {
  if (s == null) return ''
  const v = String(s)
  return redactString(v).slice(0, max)
}

function nullableString(s: unknown, max = 280): string | null {
  const v = clampString(s, max)
  return v ? v : null
}

function applyExecutionGate(status: CanonicalStatus, executionEnabled: boolean): CanonicalStatus {
  if (executionEnabled) return status
  if (status === 'LIVE' || status === 'READY') return 'READ_ONLY'
  return status
}

function normalizeComponent(raw: RawComponent | undefined, executionEnabled: boolean, opts: Required<NormalizeOptions>): ComponentStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const id = clampString(raw.id, 80)
  if (!id) return null
  const rawLabel = raw.status ?? raw.state ?? raw.ui_contract?.status_card_state
  let status = normalizeStatusLabel(rawLabel)

  // Promote BLOCKED if credential map indicates missing creds and status would otherwise pass.
  if (status === 'UNKNOWN' && raw.credentials_present_by_name) {
    const hasMissing = Object.values(raw.credentials_present_by_name).some((v) => v === false)
    if (hasMissing) status = 'CREDENTIAL_GATED'
  }

  if (raw.reachable === false && (status === 'LIVE' || status === 'READY')) {
    status = 'SERVICE_DOWN'
  }
  if (raw.configured === false && status !== 'DISABLED' && status !== 'SERVICE_DOWN') {
    status = 'CREDENTIAL_GATED'
  }
  if (raw.service_running === false && status === 'LIVE') {
    status = 'SERVICE_DOWN'
  }

  if (opts.enforceExecutionGate) {
    status = applyExecutionGate(status, executionEnabled)
  }

  return {
    id,
    label: clampString(raw.label || id, 120) || id,
    status,
    blocker: nullableString(raw.blocker, 240),
    next_action: nullableString(raw.next_action, 240),
    reachable: typeof raw.reachable === 'boolean' ? raw.reachable : undefined,
    configured: typeof raw.configured === 'boolean' ? raw.configured : undefined,
    credential_configured: typeof raw.credential_configured === 'boolean' ? raw.credential_configured : undefined,
    service_running: typeof raw.service_running === 'boolean' ? raw.service_running : undefined,
    last_seen: nullableString(raw.last_seen ?? raw.last_seen_at, 80),
    proof_available: typeof raw.proof_available === 'boolean' ? raw.proof_available : undefined,
  }
}

function normalizeComponentList(
  raws: ReadonlyArray<RawComponent> | null | undefined,
  executionEnabled: boolean,
  opts: Required<NormalizeOptions>,
): ComponentStatus[] {
  if (!raws || !Array.isArray(raws)) return []
  return raws
    .map((raw) => normalizeComponent(raw, executionEnabled, opts))
    .filter((c): c is ComponentStatus => c !== null)
}

function normalizeBridge(raw: RawBridge | null | undefined, executionEnabled: boolean): BridgeStatus {
  const approvalReady = Boolean(raw?.approval_persistence_ready)
  const auditReady = Boolean(raw?.audit_chain_ready)
  const runnerReady = Boolean(raw?.runner_available)

  let status: CanonicalStatus = normalizeStatusLabel(raw?.status)
  if (status === 'UNKNOWN') {
    if (!approvalReady || !auditReady) status = 'BLOCKED'
    else if (!runnerReady) status = 'OWNER_GATED'
    else status = executionEnabled ? 'READY' : 'READ_ONLY'
  } else if (!executionEnabled && (status === 'LIVE' || status === 'READY')) {
    status = 'READ_ONLY'
  }

  return {
    status,
    approval_persistence_ready: approvalReady,
    audit_chain_ready: auditReady,
    runner_available: runnerReady,
    blocker: nullableString(raw?.blocker, 240),
    next_action: nullableString(raw?.next_action, 240),
  }
}

function normalizeBuildWiki(raw: RawBuildWiki | null | undefined, executionEnabled: boolean): BuildWikiFarmerStatus {
  let status: CanonicalStatus = normalizeStatusLabel(raw?.status ?? raw?.ui_state)
  if (status === 'UNKNOWN') {
    if (raw?.service_running === false) status = 'SERVICE_DOWN'
    else if (raw?.approval_state === 'pending') status = 'OWNER_GATED'
    else status = executionEnabled ? 'READY' : 'READ_ONLY'
  } else if (!executionEnabled && (status === 'LIVE' || status === 'READY')) {
    status = 'READ_ONLY'
  }

  return {
    status,
    service_name: 'opencloud-docs-farmer.service',
    service_running: typeof raw?.service_running === 'boolean' ? raw.service_running : null,
    timer_active: typeof raw?.timer_active === 'boolean' ? raw.timer_active : null,
    approval_state: nullableString(raw?.approval_state, 80),
    ui_state: nullableString(raw?.ui_state, 80),
    last_run_finished_at: nullableString(raw?.last_run_finished_at, 80),
    last_run_exit_code: typeof raw?.last_run_exit_code === 'number' ? raw.last_run_exit_code : null,
    blocker: nullableString(raw?.blocker, 240),
    next_action: nullableString(raw?.next_action, 240),
    run_now_requires_owner_approval: true,
  }
}

function classifyBlocker(raw: RawBlocker | undefined): ClassifiedError | null {
  if (!raw || typeof raw !== 'object') return null
  const kindNormalised = String(raw.kind || 'UNKNOWN').toUpperCase()
  return {
    kind: (kindNormalised as ClassifiedError['kind']),
    owner_message: clampString(raw.owner_message, 200) || 'Action required.',
    technical_detail: clampString(raw.technical_detail, 240) || 'No detail provided.',
    next_action: clampString(raw.next_action, 240) || 'Wait for owner action.',
    codex_can_fix: Boolean(raw.codex_can_fix),
    owner_action_required: Boolean(raw.owner_action_required),
  }
}

function gatherBlockersFromComponents(components: ComponentStatus[][]): ClassifiedError[] {
  const out: ClassifiedError[] = []
  const seen = new Set<string>()
  for (const list of components) {
    for (const comp of list) {
      if (comp.status === 'LIVE' || comp.status === 'READY') continue
      if (!comp.blocker && !comp.next_action) continue
      const key = `${comp.id}|${comp.status}`
      if (seen.has(key)) continue
      seen.add(key)
      const kind: ClassifiedError['kind'] =
        comp.status === 'OWNER_GATED' ? 'OWNER_GATED' :
        comp.status === 'CREDENTIAL_GATED' ? 'CREDENTIAL_GATED' :
        comp.status === 'SERVICE_DOWN' ? 'SERVICE_DOWN' :
        comp.status === 'BLOCKED' ? 'BACKEND_MISSING' :
        comp.status === 'DISABLED' ? 'EXECUTION_DISABLED' :
        'UNKNOWN'
      out.push({
        kind,
        owner_message: comp.blocker || `${comp.label} is ${comp.status}.`,
        technical_detail: comp.blocker || comp.next_action || 'See backend logs.',
        next_action: comp.next_action || 'Awaiting owner action.',
        codex_can_fix: kind === 'BACKEND_MISSING' || kind === 'UNKNOWN',
        owner_action_required: kind === 'OWNER_GATED' || kind === 'CREDENTIAL_GATED',
      })
    }
  }
  return out
}

function deriveSafetyStatus(
  executionEnabled: boolean,
  writesEnabled: boolean,
  externalWritesEnabled: boolean,
): CanonicalStatus {
  if (externalWritesEnabled || writesEnabled) {
    // External writes on without explicit execution → DEGRADED, the safe-mode guard.
    if (!executionEnabled) return 'DEGRADED'
    return 'READY'
  }
  if (executionEnabled) return 'READ_ONLY'
  return 'READ_ONLY'
}

function deriveOverallStatus(
  components: ComponentStatus[][],
  bridge: BridgeStatus,
  buildwiki: BuildWikiFarmerStatus,
): CanonicalStatus {
  const buckets: CanonicalStatus[] = []
  for (const list of components) for (const c of list) buckets.push(c.status)
  buckets.push(bridge.status, buildwiki.status)
  return rollupStatuses(buckets)
}

function deriveNextActions(blockers: ClassifiedError[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of blockers) {
    if (!b.next_action) continue
    if (seen.has(b.next_action)) continue
    seen.add(b.next_action)
    out.push(b.next_action)
    if (out.length >= 8) break
  }
  return out
}

export function normalizeGatewayStatus(
  raw: RawStatusInput | null | undefined,
  options: NormalizeOptions = {},
): GatewayStatusSnapshot {
  const opts = { ...DEFAULT_OPTS, ...options }
  const safe = raw ?? {}

  const executionEnabled = Boolean(safe.execution_enabled)
  const writesEnabled = Boolean(safe.writes_enabled)
  const externalWritesEnabled = Boolean(safe.external_writes_enabled)

  const agents = normalizeComponentList(safe.agents, executionEnabled, opts)
  const providers = normalizeComponentList(safe.providers, executionEnabled, opts)
  const tools = normalizeComponentList(safe.tools, executionEnabled, opts)
  const connectors = normalizeComponentList(safe.connectors, executionEnabled, opts)
  const bridge = normalizeBridge(safe.bridge, executionEnabled)
  const buildwiki = normalizeBuildWiki(safe.buildwiki_farmer, executionEnabled)

  const explicitBlockers = (safe.blockers ?? [])
    .map((b) => classifyBlocker(b))
    .filter((c): c is ClassifiedError => c !== null)
  const inferredBlockers = gatherBlockersFromComponents([agents, providers, tools, connectors])
  const seen = new Set<string>()
  const blockers: ClassifiedError[] = []
  for (const e of [...explicitBlockers, ...inferredBlockers]) {
    const key = `${e.kind}|${e.owner_message}`
    if (seen.has(key)) continue
    seen.add(key)
    blockers.push(e)
  }

  const overall_status = deriveOverallStatus([agents, providers, tools, connectors], bridge, buildwiki)
  const safety_status = deriveSafetyStatus(executionEnabled, writesEnabled, externalWritesEnabled)

  return {
    overall_status,
    generated_at: typeof safe.generated_at === 'string' && safe.generated_at ? safe.generated_at : new Date().toISOString(),
    execution_enabled: executionEnabled,
    writes_enabled: writesEnabled,
    external_writes_enabled: externalWritesEnabled,
    safety_status,
    agents,
    providers,
    tools,
    connectors,
    bridge,
    buildwiki_farmer: buildwiki,
    blockers,
    next_actions: deriveNextActions(blockers),
  }
}
