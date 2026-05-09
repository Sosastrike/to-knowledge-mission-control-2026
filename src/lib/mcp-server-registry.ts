import {
  describeOwnerFacingStatus,
  OWNER_FACING_STATUS_STATES,
  ownerSafeStatusText,
  type OwnerFacingBlockerClass,
  type OwnerFacingStatus,
  type OwnerFacingStatusDescriptor,
} from './owner-status'

export type McpServerRegistryInput = {
  name: string
  transport: string
  status: string
  source: string
  auth?: string
  tool_count?: number | null
  last_tested?: string | null
  error?: string | null
  visible_to?: { owner: boolean; sub_agents: boolean }
}

export type McpDiscoverySummary = {
  cli_ok: boolean
  cli_stdout_length: number
  cli_stderr_length: number
  cli_error: string | null
  fallback_used: boolean
  config_servers_found: number
} | null

export type McpServerRegistryRecord = McpServerRegistryInput & {
  id: string
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
  owner_status: OwnerFacingStatusDescriptor
  read_enabled: boolean
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  approval_required_for_writes: true
  tools_endpoint: string
  resources_endpoint: string
  capabilities: string[]
}

export type McpServerRegistryPayload = {
  mode: 'mcp_server_registry'
  generated_at: string
  ok: boolean
  canonical_status: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
  allowed_owner_statuses: typeof OWNER_FACING_STATUS_STATES
  summary: {
    total: number
    healthy: number
    degraded: number
    failed: number
    unknown: number
  }
  owner_status_summary: Record<OwnerFacingStatus, number>
  servers: McpServerRegistryRecord[]
  discovery: McpDiscoverySummary
  execution_enabled: false
  writes_enabled: false
  no_tool_invocation: true
}

function normalizeId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-')
}

function rawHealthBucket(status: string): keyof McpServerRegistryPayload['summary'] {
  const normalized = status.toLowerCase()
  if (normalized === 'connected' || normalized === 'ok') return 'healthy'
  if (normalized === 'degraded' || normalized === 'needs_auth') return 'degraded'
  if (normalized === 'failed') return 'failed'
  return 'unknown'
}

function blockerForServer(server: McpServerRegistryInput): string | null {
  const status = server.status.toLowerCase()
  if (server.error) return ownerSafeStatusText(server.error)
  if (status === 'needs_auth') return 'mcp_auth_missing'
  if (status === 'failed') return 'mcp_server_connection_failed'
  if (status === 'unknown') return 'mcp_server_configured_health_unknown'
  return null
}

export function buildMcpServerRegistryRecord(server: McpServerRegistryInput): McpServerRegistryRecord {
  const id = normalizeId(server.name)
  const blocker = blockerForServer(server)
  const readEnabled = ['connected', 'ok', 'unknown'].includes(server.status.toLowerCase())
  const owner_status = describeOwnerFacingStatus({
    rawStatus: server.status === 'unknown'
      ? 'configured'
      : server.status === 'needs_auth'
        ? 'credential_required'
        : server.status,
    blockers: blocker ? [blocker] : [],
    connected: ['connected', 'ok'].includes(server.status.toLowerCase()),
    configured: true,
    readEnabled,
    writeEnabled: false,
    executionEnabled: false,
    requiresBridgeSession: true,
    requiresOwnerApproval: false,
    preferReadyWhenReadable: true,
  })

  return {
    ...server,
    id,
    error: ownerSafeStatusText(server.error) || null,
    canonical_status: owner_status.status,
    blocker_class: owner_status.blocker_class,
    blocker,
    owner_status,
    read_enabled: owner_status.can_read,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    approval_required_for_writes: true,
    tools_endpoint: `/api/mcp/servers/${encodeURIComponent(id)}/tools`,
    resources_endpoint: `/api/mcp/servers/${encodeURIComponent(id)}/resources`,
    capabilities: [
      'server_inventory',
      'read_only_tool_schema_discovery',
      'owner_approval_required_for_config_changes',
      'bridge_session_required_for_tool_execution',
    ],
  }
}

function topLevelBlocker(servers: McpServerRegistryRecord[], discovery: McpDiscoverySummary): string | null {
  if (servers.length) return servers.find((server) => server.blocker)?.blocker || null
  const discoveryError = ownerSafeStatusText(discovery?.cli_error)
  if (discoveryError) return `claude_mcp_discovery_unavailable: ${discoveryError}`
  return 'no_mcp_servers_detected'
}

export function buildMcpServerRegistryPayload(input: {
  servers: McpServerRegistryInput[]
  discovery: McpDiscoverySummary
  generatedAt?: string
}): McpServerRegistryPayload {
  const servers = input.servers.map(buildMcpServerRegistryRecord)
  const summary = servers.reduce(
    (acc, server) => {
      acc.total += 1
      acc[rawHealthBucket(server.status)] += 1
      return acc
    },
    { total: 0, healthy: 0, degraded: 0, failed: 0, unknown: 0 },
  )
  const blocker = topLevelBlocker(servers, input.discovery)
  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: servers.length ? 'read_only' : 'service_down',
    blockers: blocker ? [blocker] : [],
    configured: servers.length > 0,
    readEnabled: servers.length > 0,
    writeEnabled: false,
    executionEnabled: false,
    requiresBridgeSession: true,
    preferReadyWhenReadable: true,
  })
  const owner_status_summary = Object.fromEntries(
    OWNER_FACING_STATUS_STATES.map((status) => [
      status,
      servers.filter((server) => server.canonical_status === status).length,
    ]),
  ) as Record<OwnerFacingStatus, number>

  return {
    mode: 'mcp_server_registry',
    generated_at: input.generatedAt || new Date().toISOString(),
    ok: true,
    canonical_status: ownerStatus.status,
    blocker_class: ownerStatus.blocker_class,
    blocker,
    allowed_owner_statuses: OWNER_FACING_STATUS_STATES,
    summary,
    owner_status_summary,
    servers,
    discovery: input.discovery
      ? {
        ...input.discovery,
        cli_error: ownerSafeStatusText(input.discovery.cli_error),
      }
      : null,
    execution_enabled: false,
    writes_enabled: false,
    no_tool_invocation: true,
  }
}
