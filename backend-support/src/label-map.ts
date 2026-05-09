import type { CanonicalStatus } from './types.js'

// Map of legacy / vendor-specific labels (from existing Mission Control / connector code)
// onto the canonical owner-facing vocabulary. New label aliases get added here, not in callers.
const RAW_LABEL_TO_CANONICAL: Record<string, CanonicalStatus> = {
  // Identity mappings
  LIVE: 'LIVE',
  READY: 'READY',
  READ_ONLY: 'READ_ONLY',
  DEGRADED: 'DEGRADED',
  OWNER_GATED: 'OWNER_GATED',
  CREDENTIAL_GATED: 'CREDENTIAL_GATED',
  SERVICE_DOWN: 'SERVICE_DOWN',
  BLOCKED: 'BLOCKED',
  DISABLED: 'DISABLED',
  UNKNOWN: 'UNKNOWN',

  // Connector-readiness vocabulary (existing /api/bridge/connector-readiness route)
  BACKEND_REQUIRED: 'BLOCKED',
  CREDENTIAL_REQUIRED: 'CREDENTIAL_GATED',
  OWNER_APPROVAL_REQUIRED: 'OWNER_GATED',

  // BuildWiki run-now ui_state strings (read-only telegram approval flow)
  idle: 'READY',
  pending_approval: 'OWNER_GATED',
  approved: 'READY',
  denied: 'BLOCKED',
  expired: 'BLOCKED',
  running: 'LIVE',
  completed: 'READY',
  failed: 'DEGRADED',

  // Common operational labels seen across probes
  ok: 'LIVE',
  healthy: 'LIVE',
  unhealthy: 'DEGRADED',
  down: 'SERVICE_DOWN',
  offline: 'SERVICE_DOWN',
  unreachable: 'SERVICE_DOWN',
  not_configured: 'CREDENTIAL_GATED',
  missing_credential: 'CREDENTIAL_GATED',
  missing_credentials: 'CREDENTIAL_GATED',
  awaiting_owner: 'OWNER_GATED',
  approval_pending: 'OWNER_GATED',
  read_only: 'READ_ONLY',
  readonly: 'READ_ONLY',
  read: 'READ_ONLY',
  disabled: 'DISABLED',
  blocked: 'BLOCKED',
  service_missing: 'BLOCKED',
  backend_missing: 'BLOCKED',
}

// Convert any raw status string into a canonical status. Case-insensitive on input.
// Anything we don't recognise becomes UNKNOWN — never make up a status.
export function normalizeStatusLabel(raw: unknown): CanonicalStatus {
  if (raw == null) return 'UNKNOWN'
  const key = String(raw).trim()
  if (!key) return 'UNKNOWN'
  if (RAW_LABEL_TO_CANONICAL[key]) return RAW_LABEL_TO_CANONICAL[key]
  const upper = key.toUpperCase()
  if (RAW_LABEL_TO_CANONICAL[upper]) return RAW_LABEL_TO_CANONICAL[upper]
  const lower = key.toLowerCase()
  if (RAW_LABEL_TO_CANONICAL[lower]) return RAW_LABEL_TO_CANONICAL[lower]
  return 'UNKNOWN'
}

// Worst-case rollup over a set of canonical labels.
// Severity (lowest-good → highest-bad):
//   LIVE > READY > READ_ONLY > OWNER_GATED > CREDENTIAL_GATED > BLOCKED > DEGRADED > SERVICE_DOWN > DISABLED > UNKNOWN
// "Worst" returned for the rollup; UNKNOWN only wins if everything is unknown.
const STATUS_SEVERITY: Record<CanonicalStatus, number> = {
  LIVE: 0,
  READY: 1,
  READ_ONLY: 2,
  OWNER_GATED: 3,
  CREDENTIAL_GATED: 4,
  BLOCKED: 5,
  DEGRADED: 6,
  SERVICE_DOWN: 7,
  DISABLED: 8,
  UNKNOWN: 9,
}

export function rollupStatuses(statuses: ReadonlyArray<CanonicalStatus>): CanonicalStatus {
  if (statuses.length === 0) return 'UNKNOWN'
  const nonUnknown = statuses.filter((s) => s !== 'UNKNOWN')
  if (nonUnknown.length === 0) return 'UNKNOWN'
  let worst: CanonicalStatus = nonUnknown[0]
  for (const s of nonUnknown) {
    if (STATUS_SEVERITY[s] > STATUS_SEVERITY[worst]) worst = s
  }
  // Promote a worst-of READ_ONLY/READY combo to DEGRADED only if explicit blockers existed.
  // This function only computes the worst — overall_status enrichment lives in the normalizer.
  return worst
}
