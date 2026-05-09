// Canonical owner-facing status vocabulary.
// The Mission Control / Gateway UI must NEVER render anything outside this set.
// If a status cannot be classified, surface UNKNOWN rather than improvising.
export const CANONICAL_STATUSES = [
  'LIVE',
  'READY',
  'READ_ONLY',
  'DEGRADED',
  'OWNER_GATED',
  'CREDENTIAL_GATED',
  'SERVICE_DOWN',
  'BLOCKED',
  'DISABLED',
  'UNKNOWN',
] as const

export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number]

export const CANONICAL_STATUS_SET: ReadonlySet<CanonicalStatus> = new Set(CANONICAL_STATUSES)

export function isCanonicalStatus(value: unknown): value is CanonicalStatus {
  return typeof value === 'string' && CANONICAL_STATUS_SET.has(value as CanonicalStatus)
}

// Canonical error / blocker categories — for owner-facing UI to render the right CTA.
export const CANONICAL_ERROR_KINDS = [
  'OWNER_GATED',
  'CREDENTIAL_GATED',
  'SERVICE_DOWN',
  'BACKEND_MISSING',
  'ROUTE_MISSING',
  'AUTH_REQUIRED',
  'EXECUTION_DISABLED',
  'WRITE_DISABLED',
  'EXTERNAL_WRITE_DISABLED',
  'UNKNOWN',
] as const

export type CanonicalErrorKind = (typeof CANONICAL_ERROR_KINDS)[number]

export interface ClassifiedError {
  kind: CanonicalErrorKind
  owner_message: string
  technical_detail: string
  next_action: string
  codex_can_fix: boolean
  owner_action_required: boolean
}

// Component (agent / provider / tool / connector) status row.
export interface ComponentStatus {
  id: string
  label: string
  status: CanonicalStatus
  blocker: string | null
  next_action: string | null
  reachable?: boolean
  configured?: boolean
  credential_configured?: boolean
  service_running?: boolean | null
  last_seen?: string | null
  proof_available?: boolean
}

// Bridge sub-status (approval persistence, audit chain, runner availability).
export interface BridgeStatus {
  status: CanonicalStatus
  approval_persistence_ready: boolean
  audit_chain_ready: boolean
  runner_available: boolean
  blocker: string | null
  next_action: string | null
}

// Build-Wiki / OpenCloud-Docs Farmer status (read-only view).
export interface BuildWikiFarmerStatus {
  status: CanonicalStatus
  service_name: 'opencloud-docs-farmer.service'
  service_running: boolean | null
  timer_active: boolean | null
  approval_state: string | null
  ui_state: string | null
  last_run_finished_at: string | null
  last_run_exit_code: number | null
  blocker: string | null
  next_action: string | null
  run_now_requires_owner_approval: true
}

// Top-level Mission Control / Gateway snapshot — the contract Codex consumes.
export interface GatewayStatusSnapshot {
  overall_status: CanonicalStatus
  generated_at: string
  execution_enabled: boolean
  writes_enabled: boolean
  external_writes_enabled: boolean
  safety_status: CanonicalStatus
  agents: ComponentStatus[]
  providers: ComponentStatus[]
  tools: ComponentStatus[]
  connectors: ComponentStatus[]
  bridge: BridgeStatus
  buildwiki_farmer: BuildWikiFarmerStatus
  blockers: ClassifiedError[]
  next_actions: string[]
}

// Route metadata — shape consumed by the navigation/breadcrumb layer.
export interface RouteMetadata {
  route: string
  label: string
  parent_route: string | null
  breadcrumb_label: string
  safe_back_target: string
  mission_control_home_target: string
  owner_auth_required: boolean
}

// Route-smoke probe row.
export interface RouteSmokeResult {
  path: string
  expected_auth: 'public' | 'viewer' | 'operator' | 'owner'
  actual_http_status: number | null
  redirect_target: string | null
  status_label: CanonicalStatus
  failure_reason: string | null
  last_checked_at: string
}

export interface RouteSmokeReport {
  generated_at: string
  base_origin_redacted: string
  routes: RouteSmokeResult[]
  summary: {
    total: number
    by_status: Record<CanonicalStatus, number>
  }
}
