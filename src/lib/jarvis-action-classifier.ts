import {
  JARVIS_BRIDGE_GATED_CATEGORIES,
  JARVIS_DIRECT_INTERNAL_WRITE_CATEGORIES,
  JARVIS_DIRECT_READ_CATEGORIES,
  JARVIS_HARD_STOP_CATEGORIES,
  type JarvisActionClass,
  type JarvisPolicyCategory,
} from '@/lib/jarvis-owner-operator-policy'

export type JarvisActionInput = {
  action?: string
  category?: string
  route?: string
  target?: string
}

export type JarvisActionClassification = {
  action: string
  category: JarvisPolicyCategory
  classification: JarvisActionClass
  bridge_required: boolean
  hard_stop: boolean
  exact_blocker: string | null
  reason: string
}

const HARD_STOP_PATTERNS = [
  'env',
  'credential',
  'secret',
  'token',
  'password',
  'cookie',
  'auth_file',
  'dns',
  'caddy',
  'tailscale',
  'firewall',
  'public_exposure',
  'sudo',
  'delete',
  'disable_auth',
  'disable_audit',
  'disable_rollback',
  'spend_above_cap',
]

function normalizeCategory(value: unknown): JarvisPolicyCategory {
  const raw = typeof value === 'string' ? value.trim() : ''
  const allowed: JarvisPolicyCategory[] = [
    ...JARVIS_DIRECT_READ_CATEGORIES,
    ...JARVIS_DIRECT_INTERNAL_WRITE_CATEGORIES,
    ...JARVIS_BRIDGE_GATED_CATEGORIES,
    ...JARVIS_HARD_STOP_CATEGORIES,
    'unsupported',
  ]
  return allowed.includes(raw as JarvisPolicyCategory) ? raw as JarvisPolicyCategory : 'unsupported'
}

function inferCategory(input: JarvisActionInput): JarvisPolicyCategory {
  const joined = [input.action, input.category, input.route, input.target]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (HARD_STOP_PATTERNS.some((pattern) => joined.includes(pattern))) {
    if (joined.includes('dns') || joined.includes('caddy') || joined.includes('tailscale') || joined.includes('firewall') || joined.includes('public_exposure')) return 'public_exposure'
    if (joined.includes('delete') || joined.includes('disable_auth') || joined.includes('disable_audit') || joined.includes('disable_rollback') || joined.includes('sudo')) return 'destructive_or_auth'
    return 'credential_or_secret'
  }

  const category = normalizeCategory(input.category)
  if (category !== 'unsupported') return category

  if (joined.includes('report') || joined.includes('readiness') || joined.includes('dashboard') || joined.includes('runbook') || joined.includes('rollback_note')) return 'internal_state_write'
  if (joined.includes('approval')) return 'approval_request_write'
  if (joined.includes('provider') || joined.includes('model')) return 'provider_execution'
  if (joined.includes('mcp')) return 'mcp_tool_execution'
  if (joined.includes('obsidian') || joined.includes('mempalace') || joined.includes('brain_write')) return 'brain_write'
  if (joined.includes('paperclip') && (joined.includes('task') || joined.includes('comment') || joined.includes('issue'))) return 'paperclip_write'
  if (joined.includes('buildwiki') || joined.includes('build-wiki') || joined.includes('farmer')) return 'buildwiki_dispatch'
  if (joined.includes('send') || joined.includes('upload') || joined.includes('drive') || joined.includes('telegram') || joined.includes('agentmail')) return 'connector_send_upload'
  if (joined.includes('webhook') || joined.includes('schedule') || joined.includes('job')) return 'webhook_or_scheduler_mutation'
  if (joined.includes('read') || joined.includes('status') || joined.includes('health') || joined.includes('list')) return 'mission_control_read'
  return 'unsupported'
}

export function classifyJarvisAction(input: JarvisActionInput = {}): JarvisActionClassification {
  const action = typeof input.action === 'string' && input.action.trim() ? input.action.trim() : 'inspect'
  const category = inferCategory(input)

  if (JARVIS_HARD_STOP_CATEGORIES.includes(category)) {
    return {
      action,
      category,
      classification: 'HARD_STOP',
      bridge_required: false,
      hard_stop: true,
      exact_blocker: 'hard_stop_required',
      reason: 'This action crosses a hard-stop category and must not be automated by Jarvis.',
    }
  }

  if (JARVIS_DIRECT_READ_CATEGORIES.includes(category)) {
    return {
      action,
      category,
      classification: 'DIRECT_READ',
      bridge_required: false,
      hard_stop: false,
      exact_blocker: null,
      reason: 'Read-only Mission Control/Gateway visibility is directly allowed for Jarvis.',
    }
  }

  if (JARVIS_DIRECT_INTERNAL_WRITE_CATEGORIES.includes(category)) {
    return {
      action,
      category,
      classification: 'DIRECT_INTERNAL_WRITE',
      bridge_required: false,
      hard_stop: false,
      exact_blocker: null,
      reason: 'Internal Mission Control state writes are allowed only inside the active Jarvis owner-operator session.',
    }
  }

  if (JARVIS_BRIDGE_GATED_CATEGORIES.includes(category)) {
    return {
      action,
      category,
      classification: 'BRIDGE_GATED',
      bridge_required: true,
      hard_stop: false,
      exact_blocker: 'bridge_session_required',
      reason: 'This protected action requires exact scope, Bridge Session, adapter proof, audit, and rollback.',
    }
  }

  return {
    action,
    category,
    classification: 'DISABLED',
    bridge_required: false,
    hard_stop: false,
    exact_blocker: 'unsupported_action',
    reason: 'No Jarvis authority mapping exists for this action yet.',
  }
}
