import type { ZapierToolBridgePayload, ZapierToolRecord } from './zapier-tool-bridge'

export const ZAPIER_CREDENTIAL_NAMES = [
  'ZAPIER_MCP_URL',
  'ZAPIER_MCP_SERVER',
  'ZAPIER_ACCESS_TOKEN',
  'ZAPIER_API_KEY',
] as const

export type ZapierCredentialName = typeof ZAPIER_CREDENTIAL_NAMES[number]
export type ZapierCredentialPresence = Record<ZapierCredentialName, boolean>

export type ZapierConnectionState =
  | 'LIVE'
  | 'READ_ONLY'
  | 'BACKEND_REQUIRED'
  | 'CREDENTIAL_REQUIRED'
  | 'OWNER_APPROVAL_REQUIRED'
  | 'LOCKED'

export type ZapierConnectionDetail = {
  id: string
  label: string
  state: ZapierConnectionState
  summary: string
  detail: string
  endpoint: string
  source: ZapierToolBridgePayload['source'] | 'approved_action_library' | 'mission_control'
  credential_names: string[]
  credential_present_by_name_only?: ZapierCredentialPresence
  tools_total?: number
  read_tools?: number
  write_gated_tools?: number
  unknown_tools?: number
  provider_categories?: string[]
  exact_tool_name?: string | null
  required_fields?: string[] | null
  approved_actions_total?: number
  certified_actions_total?: number
  prepared_actions_total?: number
  writes_enabled: boolean
  execution_enabled: boolean
  approval_required: boolean
  blocker: string | null
  next_action: string
}

export type ZapierConnectionDetails = {
  ok: true
  status: 'connected' | 'degraded' | 'not_configured'
  credential_names_checked: ZapierCredentialName[]
  credential_present_by_name_only: ZapierCredentialPresence
  credentials_present_count: number
  secret_values_exposed: false
  session_id_value_exposed: false
  summary: {
    tools_total: number
    read_tools: number
    write_gated_tools: number
    unknown_tools: number
    approved_actions_total: number
    certified_actions_total: number
    prepared_actions_total: number
    mcp_reachable: boolean
    source: ZapierToolBridgePayload['source']
    blocked_writes_24h: number
    allowed_reads_24h: number
    writes_enabled: false
    broad_execution_enabled: false
  }
  connections: ZapierConnectionDetail[]
  tools_preview: Array<Pick<ZapierToolRecord, 'tool_name' | 'category' | 'write_classification' | 'approval_required' | 'source' | 'required_fields'>>
  guardrails: string[]
  last_checked_at: string
  blocker: string | null
  next_action: string
}

type ApprovedActionLibrary = {
  actions: unknown[]
  certified_actions: string[]
  prepared_actions: string[]
  execution_enabled?: boolean
  writes_enabled?: boolean
  external_writes_enabled?: boolean
  broad_execution_enabled?: boolean
  no_zapier_writes_by_default?: boolean
}

export function zapierCredentialPresenceFromEnv(
  env: Record<string, string | undefined> = process.env,
): ZapierCredentialPresence {
  return Object.fromEntries(
    ZAPIER_CREDENTIAL_NAMES.map((name) => [name, Boolean((env[name] || '').trim())]),
  ) as ZapierCredentialPresence
}

function countByKind(tools: ZapierToolRecord[]) {
  return tools.reduce(
    (counts, tool) => {
      if (tool.write_classification === 'read') counts.read_tools += 1
      else if (tool.write_classification === 'write') counts.write_gated_tools += 1
      else counts.unknown_tools += 1
      return counts
    },
    { read_tools: 0, write_gated_tools: 0, unknown_tools: 0 },
  )
}

function topCategories(tools: ZapierToolRecord[]): string[] {
  const counts = new Map<string, number>()
  for (const tool of tools) {
    const category = tool.category || 'unknown'
    counts.set(category, (counts.get(category) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([category]) => category)
}

function credentialCount(credentials: ZapierCredentialPresence): number {
  return Object.values(credentials).filter(Boolean).length
}

function hasTransport(credentials: ZapierCredentialPresence): boolean {
  return credentials.ZAPIER_MCP_URL || credentials.ZAPIER_MCP_SERVER
}

function hasToken(credentials: ZapierCredentialPresence): boolean {
  return credentials.ZAPIER_ACCESS_TOKEN || credentials.ZAPIER_API_KEY
}

export function buildZapierConnectionDetails(input: {
  bridge: ZapierToolBridgePayload
  approvedActionLibrary: ApprovedActionLibrary
  credentialPresence: ZapierCredentialPresence
  auditCounts?: {
    blocked_writes_24h?: number
    allowed_reads_24h?: number
  }
}): ZapierConnectionDetails {
  const { bridge, approvedActionLibrary, credentialPresence } = input
  const counts = countByKind(bridge.tools)
  const credentialsPresentCount = credentialCount(credentialPresence)
  const transportPresent = hasTransport(credentialPresence)
  const tokenPresent = hasToken(credentialPresence)
  const approvedActionsTotal = approvedActionLibrary.actions.length
  const certifiedActionsTotal = approvedActionLibrary.certified_actions.length
  const preparedActionsTotal = approvedActionLibrary.prepared_actions.length
  const hasInventory = bridge.connected && bridge.tools_total > 0
  const status = hasInventory || bridge.mcp_reachable
    ? 'connected'
    : credentialsPresentCount > 0
      ? 'degraded'
      : 'not_configured'
  const missingCredentialNames = ZAPIER_CREDENTIAL_NAMES.filter((name) => !credentialPresence[name])
  const inventoryState: ZapierConnectionState = hasInventory
    ? 'READ_ONLY'
    : credentialsPresentCount > 0
      ? 'CREDENTIAL_REQUIRED'
      : 'CREDENTIAL_REQUIRED'
  const transportState: ZapierConnectionState = bridge.mcp_reachable
    ? 'LIVE'
    : transportPresent && tokenPresent
      ? 'BACKEND_REQUIRED'
      : 'CREDENTIAL_REQUIRED'
  const heygenState: ZapierConnectionState = bridge.heygen_found ? 'READ_ONLY' : 'CREDENTIAL_REQUIRED'

  return {
    ok: true,
    status,
    credential_names_checked: [...ZAPIER_CREDENTIAL_NAMES],
    credential_present_by_name_only: { ...credentialPresence },
    credentials_present_count: credentialsPresentCount,
    secret_values_exposed: false,
    session_id_value_exposed: false,
    summary: {
      tools_total: bridge.tools_total,
      read_tools: counts.read_tools,
      write_gated_tools: counts.write_gated_tools,
      unknown_tools: counts.unknown_tools,
      approved_actions_total: approvedActionsTotal,
      certified_actions_total: certifiedActionsTotal,
      prepared_actions_total: preparedActionsTotal,
      mcp_reachable: bridge.mcp_reachable,
      source: bridge.source,
      blocked_writes_24h: input.auditCounts?.blocked_writes_24h || 0,
      allowed_reads_24h: input.auditCounts?.allowed_reads_24h || 0,
      writes_enabled: false,
      broad_execution_enabled: false,
    },
    connections: [
      {
        id: 'zapier_mcp_transport',
        label: 'Zapier MCP transport',
        state: transportState,
        summary: bridge.mcp_reachable
          ? 'Live MCP tool-list transport is reachable.'
          : transportPresent
            ? 'MCP transport is configured by name, but live reachability is not proven.'
            : 'MCP transport credential name is missing.',
        detail: `Credential names checked: ${ZAPIER_CREDENTIAL_NAMES.join(', ')}. Present count: ${credentialsPresentCount}. Values are never exposed.`,
        endpoint: '/api/bridge/zapier/status',
        source: bridge.source,
        credential_names: [...ZAPIER_CREDENTIAL_NAMES],
        credential_present_by_name_only: { ...credentialPresence },
        writes_enabled: false,
        execution_enabled: false,
        approval_required: false,
        blocker: transportState === 'CREDENTIAL_REQUIRED'
          ? `missing_by_name:${missingCredentialNames.join(',') || 'unknown'}`
          : bridge.mcp_reachable ? null : 'zapier_mcp_reachability_not_proven',
        next_action: bridge.mcp_reachable ? 'Use read-only inventory. Keep writes locked.' : bridge.next_action,
      },
      {
        id: 'zapier_tool_inventory',
        label: 'Zapier tool inventory',
        state: inventoryState,
        summary: hasInventory
          ? `${bridge.tools_total} tools visible from ${bridge.source}.`
          : 'Tool inventory is not visible yet.',
        detail: `Read tools: ${counts.read_tools}. Write-gated tools: ${counts.write_gated_tools}. Unknown tools: ${counts.unknown_tools}. No tool is invoked from inventory.`,
        endpoint: '/api/bridge/zapier/tools',
        source: bridge.source,
        credential_names: [...ZAPIER_CREDENTIAL_NAMES],
        tools_total: bridge.tools_total,
        read_tools: counts.read_tools,
        write_gated_tools: counts.write_gated_tools,
        unknown_tools: counts.unknown_tools,
        provider_categories: topCategories(bridge.tools),
        writes_enabled: false,
        execution_enabled: false,
        approval_required: false,
        blocker: hasInventory ? null : bridge.blocker || 'zapier_tool_inventory_not_visible',
        next_action: hasInventory ? 'Use tool inventory for planning only.' : bridge.next_action,
      },
      {
        id: 'zapier_heygen',
        label: 'HeyGen via Zapier',
        state: heygenState,
        summary: bridge.heygen_found
          ? 'HeyGen tools are visible through Zapier.'
          : 'HeyGen is not visible in Zapier inventory.',
        detail: bridge.heygen_found
          ? `Exact tool: ${bridge.exact_heygen_tool_name}. Required fields are names only.`
          : 'Connect HeyGen inside Zapier or resync the Zapier MCP tool list before planning HeyGen actions.',
        endpoint: '/api/bridge/zapier/tools/search?q=heygen',
        source: bridge.source,
        credential_names: [...ZAPIER_CREDENTIAL_NAMES],
        exact_tool_name: bridge.exact_heygen_tool_name,
        required_fields: bridge.required_fields,
        writes_enabled: false,
        execution_enabled: false,
        approval_required: true,
        blocker: bridge.heygen_found ? null : 'zapier_heygen_tool_not_visible',
        next_action: bridge.heygen_found
          ? 'Use HeyGen schema for planning only; execution remains owner-gated.'
          : 'Owner connects HeyGen in Zapier, then rerun tool discovery.',
      },
      {
        id: 'zapier_approved_actions',
        label: 'Certified exact-scope actions',
        state: 'READ_ONLY',
        summary: `${certifiedActionsTotal} certified action and ${preparedActionsTotal} prepared internal/metadata actions are registered.`,
        detail: 'Approved action records are exact-scope only. Broad Zapier execution remains disabled.',
        endpoint: '/api/bridge/zapier/approved-actions',
        source: 'approved_action_library',
        credential_names: [],
        approved_actions_total: approvedActionsTotal,
        certified_actions_total: certifiedActionsTotal,
        prepared_actions_total: preparedActionsTotal,
        writes_enabled: false,
        execution_enabled: Boolean(approvedActionLibrary.execution_enabled),
        approval_required: true,
        blocker: null,
        next_action: 'Jarvis executes only certified exact-scope actions through /api/bridge/agent-zero/execute.',
      },
      {
        id: 'zapier_write_approval',
        label: 'Write approval gate',
        state: 'OWNER_APPROVAL_REQUIRED',
        summary: 'Write-classified Zapier actions are locked.',
        detail: 'Create, update, delete, send, post, upload, run, and arbitrary execution require owner approval, audit, and exact scope.',
        endpoint: '/api/zapier/request-write-approval',
        source: 'mission_control',
        credential_names: [...ZAPIER_CREDENTIAL_NAMES],
        writes_enabled: false,
        execution_enabled: false,
        approval_required: true,
        blocker: 'zapier_write_approval_required',
        next_action: 'Request a per-job owner approval only after exact scope exists.',
      },
    ],
    tools_preview: bridge.tools.slice(0, 20).map((tool) => ({
      tool_name: tool.tool_name,
      category: tool.category,
      write_classification: tool.write_classification,
      approval_required: tool.approval_required,
      source: tool.source,
      required_fields: tool.required_fields,
    })),
    guardrails: [
      'No Zapier credential values, tokens, cookies, or session ids are returned.',
      'Tool inventory is read-only and never invokes a Zapier tool.',
      'Writes require owner approval, audit, rollback/no-state proof, and exact scope.',
      'Broad Zapier execution remains disabled.',
    ],
    last_checked_at: bridge.last_checked_at,
    blocker: status === 'connected' ? null : bridge.blocker || 'zapier_connection_details_incomplete',
    next_action: status === 'connected' ? 'Inspect connection rows before requesting any scoped write.' : bridge.next_action,
  }
}
