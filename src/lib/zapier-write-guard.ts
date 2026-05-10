export const ZAPIER_WRITE_VERBS = [
  'create',
  'update',
  'delete',
  'send',
  'post',
  'upload',
  'run',
  'execute',
  'generate',
  'publish',
] as const

export function isZapierWriteTool(tool: string): boolean {
  const normalized = tool.trim().toLowerCase()
  if (!normalized) return false
  return ZAPIER_WRITE_VERBS.some((verb) => normalized.startsWith(verb) || normalized.includes(`_${verb}_`))
}

export function zapierNoWriteGuard(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_writes: true,
    approval_request_created: false,
    required_scope: 'zapier.write',
    blocker: 'owner_approval_required',
    blocked_action: 'zapier.write',
    next_action: 'Create an exact-scope Bridge Session approval request before any Zapier write can be dispatched.',
    ...extra,
  }
}

export function zapierBackendLocked(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    bridge_session_required: true,
    approval_required_for_writes: true,
    approval_request_created: false,
    blocker: 'zapier_write_runner_not_configured',
    ...extra,
  }
}
