export const TOKEN_GOVERNOR_REQUIRED_PROVIDER_PATHS = [
  { id: 'agent_zero', label: 'Agent Zero (Jarvis)', endpoint: '/api/agent-zero/request', state: 'OWNER_GATED' },
  { id: 'pi', label: 'Pi', endpoint: '/api/bridge/pi/status', state: 'JARVIS_GATED_FULL_ACCESS' },
  { id: 'hermes', label: 'Ron Weasley — Nuclear Dispatcher', endpoint: '/api/bridge/hermes/full-access/status', state: 'JARVIS_DELEGATED' },
  { id: 'paperclip', label: 'Paperclip', endpoint: '/api/paperclip/status', state: 'READ_ONLY' },
  { id: 'openclaw_plus', label: 'OpenClaw+', endpoint: '/api/openclaw-plus/status', state: 'SERVICE_DOWN' },
  { id: 'spaceagent', label: 'SpaceAgent', endpoint: '/api/bridge/spaceagent/status', state: 'JARVIS_GATED_DIRECT_LINE' },
] as const

export const TOKEN_GOVERNOR_POLICY = {
  state: 'BLOCKED',
  blocker_class: 'BLOCKED',
  required_before_provider_execution: true,
  token_governor_required: true,
  execution_enabled: false,
  writes_enabled: false,
  protected_execution_enabled: false,
  fake_success_allowed: false,
  provider_execution_paths: TOKEN_GOVERNOR_REQUIRED_PROVIDER_PATHS.map((path) => ({
    ...path,
    token_governor_required: true,
    execution_enabled: false,
    protected_execution_enabled: false,
  })),
  blocker: 'Token Governor runtime enforcement is not yet proven across provider execution paths; keep provider execution blocked.',
  next_action: 'Wire and prove Token Governor enforcement before any provider execution path can leave OWNER_GATED/SERVICE_DOWN/BLOCKED.',
} as const
