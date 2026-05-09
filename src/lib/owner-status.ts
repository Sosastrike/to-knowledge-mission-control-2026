export const OWNER_FACING_STATUS_STATES = [
  'LIVE',
  'READY',
  'OWNER_GATED',
  'CREDENTIAL_GATED',
  'SERVICE_DOWN',
  'BLOCKED',
  'DISABLED',
] as const

export type OwnerFacingStatus = (typeof OWNER_FACING_STATUS_STATES)[number]

export type OwnerFacingBlockerClass =
  | 'NONE'
  | 'OWNER_GATED'
  | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN'
  | 'BLOCKED'
  | 'DISABLED'

export type OwnerFacingStatusTone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

export type OwnerFacingStatusInput = {
  rawStatus?: string | null
  blockers?: readonly (string | null | undefined)[]
  summary?: string | null
  connected?: boolean | null
  configured?: boolean | null
  readEnabled?: boolean
  writeEnabled?: boolean
  executionEnabled?: boolean
  requiresBridgeSession?: boolean
  requiresOwnerApproval?: boolean
  credentialNames?: readonly string[]
  preferReadyWhenReadable?: boolean
}

export type OwnerFacingStatusDescriptor = {
  status: OwnerFacingStatus
  label: OwnerFacingStatus
  summary: string
  reason: string | null
  blocker_class: OwnerFacingBlockerClass
  tone: OwnerFacingStatusTone
  can_read: boolean
  can_write: boolean
  can_execute: boolean
  bridge_session_required: boolean
}

const CREDENTIAL_BLOCKER_RE = /(credential|api[_-]?key|token|oauth|auth[_-]?missing|login_required|missing[_-]?auth|provider[_-]?auth|bot[_-]?token|service_account)/i
const SERVICE_BLOCKER_RE = /(service[_-]?down|not[_-]running|not[_-]reachable|runtime[_-]?not[_-]?reachable|backend[_-]?required|backend[_-]?missing|cli[_-]?missing|not[_-]?installed|binary[_-]?missing|path[_-]?failure|connection[_-]?failed|adapter[_-]?missing|runner[_-]?missing)/i
const OWNER_GATED_RE = /(owner[_-]?gated|owner[_-]?approval|approval[_-]?required|bridge[_-]?session|session[_-]?required|approval[_-]?pending|scope[_-]?required|ui[_-]?not[_-]?proven|owner[_-]?session|owner[_-]?login|gated)/i
const DISABLED_RE = /(disabled|retired|archived|legacy[_-]?archived|not[_-]?active)/i
const BLOCKED_RE = /(blocked|denied|forbidden|refused|unavailable|unconfigured|failed)/i
const READY_RE = /(ready|read[_-]?only|partial[_-]?go|configured|connected|available|operational|shadow|advisory)/i
const LIVE_RE = /(live|active|execution[_-]?enabled|write[_-]?enabled)/i

export function describeOwnerFacingStatus(input: OwnerFacingStatusInput): OwnerFacingStatusDescriptor {
  const rawStatus = normalizeStatusText(input.rawStatus)
  const blockers = normalizeBlockers(input.blockers)
  const firstBlocker = blockers[0] || null
  const reasonSource = firstBlocker || input.summary || null
  const credentialNames = input.credentialNames || []
  const hasCredentialNames = credentialNames.length > 0
  const blockerText = [rawStatus, ...blockers].filter(Boolean).join(' ')
  const requiresOwnerApproval = Boolean(input.requiresOwnerApproval)
  const requiresBridgeSession = Boolean(input.requiresBridgeSession)
  const executionEnabled = Boolean(input.executionEnabled)
  const writeEnabled = Boolean(input.writeEnabled)
  const readEnabled = Boolean(input.readEnabled || input.connected || executionEnabled || writeEnabled)

  let status: OwnerFacingStatus
  if (DISABLED_RE.test(blockerText)) {
    status = 'DISABLED'
  } else if (input.preferReadyWhenReadable && readEnabled && READY_RE.test(rawStatus)) {
    status = 'READY'
  } else if (hasCredentialNames && (rawStatus === 'credential_required' || CREDENTIAL_BLOCKER_RE.test(blockerText))) {
    status = 'CREDENTIAL_GATED'
  } else if (CREDENTIAL_BLOCKER_RE.test(blockerText)) {
    status = 'CREDENTIAL_GATED'
  } else if (requiresOwnerApproval) {
    status = 'OWNER_GATED'
  } else if (SERVICE_BLOCKER_RE.test(blockerText)) {
    status = 'SERVICE_DOWN'
  } else if (OWNER_GATED_RE.test(blockerText)) {
    status = 'OWNER_GATED'
  } else if (rawStatus === 'blocked' || BLOCKED_RE.test(blockerText)) {
    status = 'BLOCKED'
  } else if (executionEnabled || writeEnabled || LIVE_RE.test(rawStatus)) {
    status = 'LIVE'
  } else if (READY_RE.test(rawStatus) || input.connected || input.configured || readEnabled) {
    status = 'READY'
  } else {
    status = 'BLOCKED'
  }

  return {
    status,
    label: status,
    summary: ownerStatusSummary(status),
    reason: ownerSafeStatusText(reasonSource),
    blocker_class: blockerClassForStatus(status),
    tone: toneForStatus(status),
    can_read: readEnabled && status !== 'DISABLED',
    can_write: writeEnabled && status === 'LIVE',
    can_execute: executionEnabled && status === 'LIVE',
    bridge_session_required: requiresBridgeSession || requiresOwnerApproval,
  }
}

export function ownerStatusSummary(status: OwnerFacingStatus): string {
  switch (status) {
    case 'LIVE':
      return 'Live in the current runtime.'
    case 'READY':
      return 'Visible and usable for safe read-only or advisory work; protected execution is still gated.'
    case 'OWNER_GATED':
      return 'Waiting on owner approval, owner session, or Bridge Session scope before protected action.'
    case 'CREDENTIAL_GATED':
      return 'Waiting on an approved credential or OAuth/session setup; no secret value is exposed.'
    case 'SERVICE_DOWN':
      return 'Required runtime service, backend, adapter, or CLI is not reachable from Mission Control.'
    case 'BLOCKED':
      return 'Blocked by a current policy, runtime, or proof requirement.'
    case 'DISABLED':
      return 'Disabled in the active Mission Control runtime.'
  }
}

export function toneForStatus(status: OwnerFacingStatus): OwnerFacingStatusTone {
  switch (status) {
    case 'LIVE':
      return 'green'
    case 'READY':
      return 'blue'
    case 'OWNER_GATED':
    case 'CREDENTIAL_GATED':
      return 'yellow'
    case 'SERVICE_DOWN':
    case 'BLOCKED':
      return 'red'
    case 'DISABLED':
      return 'gray'
  }
}

export function blockerClassForStatus(status: OwnerFacingStatus): OwnerFacingBlockerClass {
  switch (status) {
    case 'LIVE':
    case 'READY':
      return 'NONE'
    case 'OWNER_GATED':
      return 'OWNER_GATED'
    case 'CREDENTIAL_GATED':
      return 'CREDENTIAL_GATED'
    case 'SERVICE_DOWN':
      return 'SERVICE_DOWN'
    case 'BLOCKED':
      return 'BLOCKED'
    case 'DISABLED':
      return 'DISABLED'
  }
}

export function ownerSafeStatusText(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .replace(/\/Users\/[^/]+[^\s,;)]+/g, '[redacted-path]')
    .replace(/\/home\/[^/]+[^\s,;)]+/g, '[redacted-path]')
    .replace(/\/a0\/(?:usr|tmp|var)[^\s,;)]+/gi, '[redacted-path]')
    .replace(/auth\.json/gi, '[redacted-auth-file]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9]{12,}/gi, '[redacted-secret]')
}

function normalizeStatusText(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeBlockers(values: readonly (string | null | undefined)[] | undefined): string[] {
  return Array.from(new Set((values || [])
    .map((value) => ownerSafeStatusText(value))
    .filter((value): value is string => Boolean(value))))
}
