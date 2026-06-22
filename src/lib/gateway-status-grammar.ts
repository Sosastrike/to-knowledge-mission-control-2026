import type { GatewayNodeKind, GatewayStatus } from './gateway-model'

export const GATEWAY_PUBLIC_COLOR_TOKENS = [
  'green',
  'yellow',
  'blue',
  'red',
  'gray',
  'purple',
  'orange',
] as const

export type GatewayPublicColorToken = (typeof GATEWAY_PUBLIC_COLOR_TOKENS)[number]

type GatewayPublicColorInput = {
  id?: string | null
  kind?: GatewayNodeKind | string | null
  status?: GatewayStatus | string | null
  blocked_reason?: string | null
  status_details?: Record<string, unknown> | null
}

function boolish(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes' || value === 'present'
}

function normalized(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function gatewayPublicColorForNode(input: GatewayPublicColorInput): GatewayPublicColorToken {
  const id = normalized(input.id)
  const kind = normalized(input.kind)
  const status = normalized(input.status)
  const blockedReason = normalized(input.blocked_reason)
  const details = input.status_details || {}

  if (/fork2|fork_2|smb/.test(blockedReason)) return 'red'
  if ((id.includes('nvidia') || blockedReason.includes('nvidia')) && /not_configured|not_visible|missing_credential|credential/.test(blockedReason)) return 'gray'

  if (id === 'hermes' || id === 'ron-weasley' || id === 'ron_weasley' || kind === 'nuclear_dispatcher') {
    const hermesCalled = boolish(details.hermes_called) || boolish(details.runtime_proof_present)
    const heartbeat = boolish(details.live_chat_heartbeat) || boolish(details.live_chat_heartbeat_proof)
    const proxyProof = boolish(details.mission_control_proxy_proof) || boolish(details.authenticated_proxy_send_receive_proof)
    if (hermesCalled && heartbeat && proxyProof && ['connected', 'write_enabled', 'execution_enabled'].includes(status)) return 'green'
    if (status === 'missing' || status === 'legacy_archived') return 'gray'
    if (status === 'blocked') return 'red'
    return 'yellow'
  }

  if (kind === 'runtime_engine' || kind === 'buildwiki_farmer' || /openclaw|opencloud|buildwiki|farmer/.test(id)) return 'orange'

  if (status === 'blocked') return 'red'
  if (status === 'missing' || status === 'legacy_archived') return 'gray'
  if (status === 'degraded') return 'yellow'
  if (status === 'read_only') return 'blue'
  if (status === 'connected' || status === 'write_enabled' || status === 'execution_enabled') return 'green'

  return 'gray'
}
