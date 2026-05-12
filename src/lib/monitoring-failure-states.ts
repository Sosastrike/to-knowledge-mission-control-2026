import {
  OWNER_FACING_STATUS_STATES,
  describeOwnerFacingStatus,
  ownerSafeStatusText,
  type OwnerFacingStatus,
  type OwnerFacingStatusDescriptor,
} from './owner-status'
import { buildRuntimeHealthPayload } from './runtime-health'
import {
  TOOL_ERROR_KINDS,
  classifyToolError,
  type ClassifiedToolError,
  type ToolErrorClassifierInput,
  type ToolErrorKind,
} from './tool-error-classifier'

export const MONITORING_FAILURE_STATE_KINDS = TOOL_ERROR_KINDS

type RuntimeHealthLike = {
  ok: boolean
  status: string
  checked_at?: string
  source_commit?: string
  source_branch?: string
  blockers?: readonly string[]
  deployment?: {
    rollback_command?: string
  }
}

export type MonitoringSurfaceCategory =
  | 'runtime'
  | 'agent'
  | 'connector'
  | 'approval'
  | 'tool'
  | 'security'

export type MonitoringFailureStateCatalogEntry = {
  kind: ToolErrorKind
  owner_status: OwnerFacingStatus
  owner_message: string
  next_action: string
  codex_can_fix: boolean
  owner_action_required: boolean
}

export type MonitoringFailureSurface = {
  id: string
  label: string
  category: MonitoringSurfaceCategory
  route: string
  owner_status: OwnerFacingStatusDescriptor
  failure_state: ClassifiedToolError | null
  rollback_command: string | null
}

export type MonitoringFailureStatePayload = {
  ok: boolean
  mode: 'monitoring_failure_states'
  checked_at: string
  source_commit: string
  source_branch: string
  allowed_owner_statuses: readonly OwnerFacingStatus[]
  allowed_failure_states: readonly ToolErrorKind[]
  no_fake_live_status: true
  no_external_writes_executed: true
  runtime: {
    status: string
    ok: boolean
    blockers: string[]
  }
  summary: {
    surfaces_checked: number
    owner_status_counts: Record<OwnerFacingStatus, number>
    failure_state_counts: Record<ToolErrorKind, number>
  }
  failure_state_catalog: MonitoringFailureStateCatalogEntry[]
  surfaces: MonitoringFailureSurface[]
}

const DEFAULT_ROLLBACK = 'git revert <monitoring-failure-states-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh'

const FAILURE_STATE_SIGNALS: Record<ToolErrorKind, ToolErrorClassifierInput> = {
  OWNER_GATED: {
    message: 'owner approval required',
    context: { requires_owner_approval: true },
  },
  CREDENTIAL_GATED: {
    message: 'required credential missing',
    context: { has_credential: false },
  },
  SERVICE_DOWN: {
    http_status: 503,
    message: 'service not running',
  },
  BACKEND_MISSING: {
    message: 'backend adapter missing',
    context: { has_backend: false },
  },
  ROUTE_MISSING: {
    http_status: 404,
    message: 'HTTP 404 route missing',
  },
  AUTH_REQUIRED: {
    http_status: 401,
    message: 'authentication required',
  },
  EXECUTION_DISABLED: {
    message: 'execution disabled',
    context: { execution_enabled: false },
  },
  WRITE_DISABLED: {
    message: 'writes disabled in read-only mode',
    context: { writes_enabled: false },
  },
  EXTERNAL_WRITE_DISABLED: {
    message: 'external write disabled by safety policy',
    context: { external_writes_enabled: false },
  },
  UNKNOWN: {
    message: 'unclassified monitoring signal',
  },
}

const STATIC_SURFACES: Array<{
  id: string
  label: string
  category: MonitoringSurfaceCategory
  route: string
  signal: ToolErrorClassifierInput
  rollback_command?: string
}> = [
  {
    id: 'agent-zero',
    label: 'Agent Zero commander status',
    category: 'agent',
    route: '/api/bridge/agent-zero/status',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
  {
    id: 'hermes',
    label: 'Hermes lieutenant status',
    category: 'agent',
    route: '/api/bridge/hermes/status',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
  {
    id: 'pi',
    label: 'Pi dispatcher advisory status',
    category: 'agent',
    route: '/api/bridge/pi/status',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
  {
    id: 'paperclip',
    label: 'Paperclip Workforce Control Plane',
    category: 'agent',
    route: '/api/bridge/paperclip/status',
    signal: {
      message: 'service not running: paperclip_sandbox_service_not_running',
    },
  },
  {
    id: 'openclaw-plus',
    label: 'OpenClaw+ runtime doctor',
    category: 'agent',
    route: '/api/gateway/agent-hub/status',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
  {
    id: 'spaceagent',
    label: 'SpaceAgent research status',
    category: 'agent',
    route: '/api/gateway/space-agent/browser/status',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
  {
    id: 'bridge-session',
    label: 'Bridge Session approvals',
    category: 'approval',
    route: '/api/bridge/approval-requests',
    signal: FAILURE_STATE_SIGNALS.OWNER_GATED,
  },
  {
    id: 'buildwiki-run-now',
    label: 'Build-Wiki / Farmer Run Now',
    category: 'approval',
    route: '/api/bridge/brain-sync/build-wiki/run-now',
    signal: {
      message: 'owner approval required for buildwiki.run_now',
      context: { requires_owner_approval: true, execution_enabled: false },
    },
  },
  {
    id: 'telegram-delivery',
    label: 'Telegram PDF delivery',
    category: 'connector',
    route: '/api/bridge/agent-zero/telegram/status',
    signal: FAILURE_STATE_SIGNALS.OWNER_GATED,
  },
  {
    id: 'agentmail',
    label: 'AgentMail delivery',
    category: 'connector',
    route: '/api/bridge/agent-zero/agentmail/status',
    signal: {
      message: 'external write disabled until Bridge Session approves AgentMail scope',
      context: { external_writes_enabled: false },
    },
  },
  {
    id: 'google-drive',
    label: 'Google Drive upload',
    category: 'connector',
    route: '/api/bridge/agent-zero/google-drive/status',
    signal: FAILURE_STATE_SIGNALS.CREDENTIAL_GATED,
  },
  {
    id: 'onedrive',
    label: 'OneDrive upload',
    category: 'connector',
    route: '/api/bridge/agent-zero/onedrive/status',
    signal: FAILURE_STATE_SIGNALS.CREDENTIAL_GATED,
  },
  {
    id: 'zapier',
    label: 'Zapier writes',
    category: 'tool',
    route: '/api/bridge/zapier/status',
    signal: FAILURE_STATE_SIGNALS.EXTERNAL_WRITE_DISABLED,
  },
  {
    id: 'heygen',
    label: 'HeyGen generation',
    category: 'tool',
    route: '/api/bridge/heygen/schema-readiness',
    signal: FAILURE_STATE_SIGNALS.EXECUTION_DISABLED,
  },
  {
    id: 'gateway-route-smoke',
    label: 'Gateway Route Smoke',
    category: 'security',
    route: '/api/gateway/route-smoke',
    signal: FAILURE_STATE_SIGNALS.AUTH_REQUIRED,
  },
]

export function mapToolErrorToOwnerStatus(kind: ToolErrorKind, reason?: string): OwnerFacingStatusDescriptor {
  switch (kind) {
    case 'OWNER_GATED':
      return describeOwnerFacingStatus({
        rawStatus: 'owner_gated',
        blockers: [reason || 'owner_approval_required'],
        requiresOwnerApproval: true,
        requiresBridgeSession: true,
      })
    case 'AUTH_REQUIRED':
      return describeOwnerFacingStatus({
        rawStatus: 'owner_gated',
        blockers: [reason || 'auth_required'],
        requiresOwnerApproval: true,
      })
    case 'CREDENTIAL_GATED':
      return describeOwnerFacingStatus({
        rawStatus: 'credential_required',
        blockers: [reason || 'credential_required'],
        credentialNames: ['approved credential'],
      })
    case 'SERVICE_DOWN':
      return describeOwnerFacingStatus({
        rawStatus: 'service_down',
        blockers: [reason || 'service_down'],
      })
    case 'EXECUTION_DISABLED':
    case 'WRITE_DISABLED':
    case 'EXTERNAL_WRITE_DISABLED':
      return describeOwnerFacingStatus({
        rawStatus: 'disabled',
        blockers: [reason || kind.toLowerCase()],
      })
    case 'BACKEND_MISSING':
    case 'ROUTE_MISSING':
    case 'UNKNOWN':
      return describeOwnerFacingStatus({
        rawStatus: 'blocked',
        blockers: [reason || defaultBlockedReason(kind)],
      })
  }
}

function defaultBlockedReason(kind: ToolErrorKind): string {
  switch (kind) {
    case 'BACKEND_MISSING':
      return 'backend wiring not ready'
    case 'ROUTE_MISSING':
      return 'route not wired'
    case 'UNKNOWN':
      return 'unclassified blocker'
    default:
      return kind.toLowerCase()
  }
}

function sanitizeBlockers(blockers: readonly string[] | undefined) {
  return Array.from(new Set((blockers || [])
    .map((blocker) => ownerSafeStatusText(blocker))
    .filter((blocker): blocker is string => Boolean(blocker))))
}

function buildCatalog(): MonitoringFailureStateCatalogEntry[] {
  return TOOL_ERROR_KINDS.map((kind) => {
    const classified = classifyToolError(FAILURE_STATE_SIGNALS[kind])
    const ownerStatus = mapToolErrorToOwnerStatus(classified.kind, classified.owner_message)

    return {
      kind: classified.kind,
      owner_status: ownerStatus.status,
      owner_message: classified.owner_message,
      next_action: classified.next_action,
      codex_can_fix: classified.codex_can_fix,
      owner_action_required: classified.owner_action_required,
    }
  })
}

function buildRuntimeSurface(runtimeHealth: RuntimeHealthLike): MonitoringFailureSurface {
  const blockers = sanitizeBlockers(runtimeHealth.blockers)
  const rollbackCommand = runtimeHealth.deployment?.rollback_command || DEFAULT_ROLLBACK

  if (runtimeHealth.status === 'LIVE') {
    return {
      id: 'mission-control-runtime',
      label: 'Mission Control runtime',
      category: 'runtime',
      route: '/api/runtime/health',
      owner_status: describeOwnerFacingStatus({
        rawStatus: 'live',
        connected: true,
        readEnabled: true,
        executionEnabled: false,
        writeEnabled: false,
      }),
      failure_state: null,
      rollback_command: rollbackCommand,
    }
  }

  const signal = runtimeHealth.status === 'SERVICE_DOWN'
    ? {
        ...FAILURE_STATE_SIGNALS.SERVICE_DOWN,
        technical_detail: blockers.join('; ') || 'runtime_listener_missing',
      }
    : {
        ...FAILURE_STATE_SIGNALS.BACKEND_MISSING,
        technical_detail: blockers.join('; ') || 'runtime bundle missing',
      }
  const classified = classifyToolError(signal)

  return {
    id: 'mission-control-runtime',
    label: 'Mission Control runtime',
    category: 'runtime',
    route: '/api/runtime/health',
    owner_status: mapToolErrorToOwnerStatus(classified.kind, classified.owner_message),
    failure_state: classified,
    rollback_command: rollbackCommand,
  }
}

function buildStaticSurface(surface: (typeof STATIC_SURFACES)[number]): MonitoringFailureSurface {
  const classified = classifyToolError(surface.signal)

  return {
    id: surface.id,
    label: surface.label,
    category: surface.category,
    route: surface.route,
    owner_status: mapToolErrorToOwnerStatus(classified.kind, classified.owner_message),
    failure_state: classified,
    rollback_command: surface.rollback_command || null,
  }
}

function emptyOwnerStatusCounts(): Record<OwnerFacingStatus, number> {
  return OWNER_FACING_STATUS_STATES.reduce((counts, status) => {
    counts[status] = 0
    return counts
  }, {} as Record<OwnerFacingStatus, number>)
}

function emptyFailureStateCounts(): Record<ToolErrorKind, number> {
  return TOOL_ERROR_KINDS.reduce((counts, kind) => {
    counts[kind] = 0
    return counts
  }, {} as Record<ToolErrorKind, number>)
}

function summarizeSurfaces(surfaces: MonitoringFailureSurface[]) {
  const ownerStatusCounts = emptyOwnerStatusCounts()
  const failureStateCounts = emptyFailureStateCounts()

  for (const surface of surfaces) {
    ownerStatusCounts[surface.owner_status.status] += 1
    if (surface.failure_state) failureStateCounts[surface.failure_state.kind] += 1
  }

  return {
    surfaces_checked: surfaces.length,
    owner_status_counts: ownerStatusCounts,
    failure_state_counts: failureStateCounts,
  }
}

export function buildMonitoringFailureStatePayload(options: {
  checkedAt?: string
  runtimeHealth?: RuntimeHealthLike
} = {}): MonitoringFailureStatePayload {
  const runtimeHealth = options.runtimeHealth || buildRuntimeHealthPayload()
  const checkedAt = options.checkedAt || new Date().toISOString()
  const blockers = sanitizeBlockers(runtimeHealth.blockers)
  const surfaces = [
    buildRuntimeSurface({ ...runtimeHealth, blockers }),
    ...STATIC_SURFACES.map(buildStaticSurface),
  ]

  return {
    ok: true,
    mode: 'monitoring_failure_states',
    checked_at: checkedAt,
    source_commit: runtimeHealth.source_commit || 'unknown',
    source_branch: runtimeHealth.source_branch || 'unknown',
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    allowed_failure_states: MONITORING_FAILURE_STATE_KINDS,
    no_fake_live_status: true,
    no_external_writes_executed: true,
    runtime: {
      status: runtimeHealth.status,
      ok: Boolean(runtimeHealth.ok),
      blockers,
    },
    summary: summarizeSurfaces(surfaces),
    failure_state_catalog: buildCatalog(),
    surfaces,
  }
}
