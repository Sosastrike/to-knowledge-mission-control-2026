import { getZapierToolBridge, type ZapierToolBridgePayload } from '@/lib/zapier-tool-bridge'

export const JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID = 'zapier_exact_action_execute'
export const JARVIS_ZAPIER_EXACT_ACTION = 'zapier.connection_probe'
export const JARVIS_ZAPIER_EXACT_ACTION_SESSION_SCOPE = 'zapier_exact_action_connection_probe'

export const JARVIS_ZAPIER_CREDENTIAL_NAMES = [
  'ZAPIER_MCP_URL',
  'ZAPIER_MCP_SERVER',
  'ZAPIER_ACCESS_TOKEN',
  'ZAPIER_API_KEY',
] as const

type ZapierProbeRequest = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
  actor?: string
}

type ZapierProbeDeps = {
  env?: Record<string, string | undefined>
  getZapierToolBridge?: (query?: string | null) => Promise<ZapierToolBridgePayload>
}

export type JarvisZapierExactActionResult = {
  ok: boolean
  adapter_id: typeof JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID
  action: string
  scope: Record<string, unknown>
  connection_probe_ran: boolean
  credential_names_checked: string[]
  credential_values_exposed: false
  execution_enabled: boolean
  writes_enabled: false
  external_state_changed: false
  no_zapier_writes: true
  broad_execution_enabled: false
  connected: boolean
  mcp_reachable: boolean
  tools_total: number
  source: string | null
  sources_checked: string[]
  exact_blocker: string | null
}

function normalizeScope(scope: unknown) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) ? scope as Record<string, unknown> : {}
}

function envValuePresent(env: Record<string, string | undefined>, name: string) {
  return Boolean((env[name] || '').trim())
}

function block(action: string, scope: Record<string, unknown>, exactBlocker: string): JarvisZapierExactActionResult {
  return {
    ok: false,
    adapter_id: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID,
    action: action || 'unknown',
    scope,
    connection_probe_ran: false,
    credential_names_checked: [...JARVIS_ZAPIER_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_state_changed: false,
    no_zapier_writes: true,
    broad_execution_enabled: false,
    connected: false,
    mcp_reachable: false,
    tools_total: 0,
    source: null,
    sources_checked: [],
    exact_blocker: exactBlocker,
  }
}

export async function executeJarvisZapierExactAction(
  request: ZapierProbeRequest,
  deps: ZapierProbeDeps = {},
): Promise<JarvisZapierExactActionResult> {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = normalizeScope(request.scope)
  if (
    action !== JARVIS_ZAPIER_EXACT_ACTION ||
    scope.connector !== 'zapier' ||
    scope.operation !== 'connection_probe'
  ) {
    return block(action, scope, 'exact_scope_required_zapier_connection_probe')
  }

  const env = deps.env || process.env
  const credentialNamePresent = JARVIS_ZAPIER_CREDENTIAL_NAMES.some((name) => envValuePresent(env, name))
  if (!credentialNamePresent) {
    return block(action, scope, 'zapier_credential_required')
  }

  const bridge = await (deps.getZapierToolBridge || getZapierToolBridge)('zapier')

  return {
    ok: true,
    adapter_id: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID,
    action: JARVIS_ZAPIER_EXACT_ACTION,
    scope,
    connection_probe_ran: true,
    credential_names_checked: [...JARVIS_ZAPIER_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: true,
    writes_enabled: false,
    external_state_changed: false,
    no_zapier_writes: true,
    broad_execution_enabled: false,
    connected: Boolean(bridge.connected),
    mcp_reachable: Boolean(bridge.mcp_reachable),
    tools_total: Number.isFinite(bridge.tools_total) ? bridge.tools_total : 0,
    source: bridge.source || null,
    sources_checked: Array.isArray(bridge.sources_checked) ? bridge.sources_checked.slice(0, 20) : [],
    exact_blocker: null,
  }
}
