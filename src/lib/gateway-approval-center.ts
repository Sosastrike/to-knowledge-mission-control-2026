export type GatewayApprovalCenterState =
  | 'standing_scope_active'
  | 'approval_needed'
  | 'approval_pending'
  | 'approved'
  | 'expired'
  | 'revoked'
  | 'blocked_by_policy'
  | 'read_only_active'
  | 'not_configured'

export type GatewayApprovalCenterItem = {
  id: string
  component: string
  node_id: string
  domain: 'agentmail' | 'zapier' | 'brain' | 'runtime' | 'storage' | 'reports' | 'webhooks' | 'events' | 'connector'
  state: GatewayApprovalCenterState
  label: string
  exact_reason: string
  next_action: string
  standing_scope_id: string | null
  approval_required: boolean
  write_enabled: boolean
  execute_enabled: boolean
  emergency_stop_available: boolean
}

export type GatewayApprovalCenterPayload = {
  ok: true
  source: 'gateway_approval_center'
  generated_at: string
  summary: {
    total: number
    pending: number
    standing_scope_active: number
    approval_needed: number
    blocked_by_policy: number
    read_only_active: number
    not_configured: number
  }
  items: GatewayApprovalCenterItem[]
  grouped: Record<GatewayApprovalCenterState, GatewayApprovalCenterItem[]>
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

function item(input: GatewayApprovalCenterItem): GatewayApprovalCenterItem {
  return input
}

export function buildGatewayApprovalCenter(generatedAt = new Date().toISOString()): GatewayApprovalCenterPayload {
  const items = [
    item({
      id: 'approval.agentmail.per_send',
      component: 'AgentMail',
      node_id: 'int.agentmail',
      domain: 'agentmail',
      state: 'standing_scope_active',
      label: 'Approval-gated send ready',
      exact_reason: 'agentmail_setup_ready_no_pending_send_request',
      next_action: 'Create a specific send request when mail needs to be sent; approval is per message.',
      standing_scope_id: 'agentmail.dispatch_runtime.always_on',
      approval_required: false,
      write_enabled: true,
      execute_enabled: true,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.zapier.discovery',
      component: 'Zapier',
      node_id: 'int.zapier',
      domain: 'zapier',
      state: 'standing_scope_active',
      label: 'Discovery/readiness scope active',
      exact_reason: 'zapier_discovery_ready_writes_guarded',
      next_action: 'Use read-only discovery now; create an exact standing execution scope before any Zapier write.',
      standing_scope_id: 'zapier.scope.discovery_and_status',
      approval_required: false,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.opencloud.runtime_execution',
      component: 'OpenCloud / OCTM',
      node_id: 'oc.parent',
      domain: 'runtime',
      state: 'approval_needed',
      label: 'Runtime execution guarded',
      exact_reason: 'opencloud_workers_runtime_ready_execution_guarded',
      next_action: 'Approve an exact worker action and scope before mutating OpenCloud/OCTM runtime state.',
      standing_scope_id: 'scope.opencloud.docs_farmer.run_now',
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.obsidian.write_scope',
      component: 'Obsidian Vault',
      node_id: 'brain.obsidian',
      domain: 'brain',
      state: 'approval_needed',
      label: 'Knowledge writes guarded',
      exact_reason: 'obsidian_reads_ready_writes_guarded',
      next_action: 'Use read-only vault access now; approve an exact write scope before Obsidian mutations.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.mempalace.memory_write',
      component: 'Palacio / MemPalace',
      node_id: 'brain.mempalace',
      domain: 'brain',
      state: 'approval_needed',
      label: 'Memory writes guarded',
      exact_reason: 'mempalace_writes_bridge_gated',
      next_action: 'Use read-only memory now; approve an exact memory write scope before writes.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.graphify.graph_write',
      component: 'Graphify / Graffiti',
      node_id: 'brain.graphify',
      domain: 'brain',
      state: 'approval_needed',
      label: 'Graph mutations guarded',
      exact_reason: 'graphify_reads_ready_writes_guarded',
      next_action: 'Use graph read/preview now; approve an exact graph mutation scope before writes.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.brain_sync.write_scope',
      component: 'Brain Sync',
      node_id: 'brain.sync',
      domain: 'brain',
      state: 'approval_needed',
      label: 'Sync writes guarded',
      exact_reason: 'brain_sync_runtime_ready_writes_guarded',
      next_action: 'Approve a sync write scope only after the diff and rollback target are known.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.gbrain.tool_map',
      component: 'GBrain',
      node_id: 'brain.gbrain',
      domain: 'brain',
      state: 'read_only_active',
      label: 'Tool-map/readiness visible',
      exact_reason: 'gbrain_inventory_only_no_tool_invocation',
      next_action: 'Keep GBrain in inventory/readiness mode until a specific write or tool invocation is approved.',
      standing_scope_id: null,
      approval_required: false,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.buildwiki.run_now',
      component: 'Build-Wiki',
      node_id: 'brain.buildwiki',
      domain: 'runtime',
      state: 'approval_needed',
      label: 'Run Now scoped and guarded',
      exact_reason: 'buildwiki_run_now_scope_guarded',
      next_action: 'Approve only the opencloud-docs-farmer.service Run Now scope before execution.',
      standing_scope_id: 'scope.opencloud.docs_farmer.run_now',
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.heygen.generation_scope',
      component: 'HeyGen',
      node_id: 'int.heygen',
      domain: 'connector',
      state: 'approval_needed',
      label: 'Generation guarded',
      exact_reason: 'heygen_generation_requires_owner_approval',
      next_action: 'Approve an exact HeyGen generation scope before any generation/write.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.google_drive.upload_scope',
      component: 'Google Drive',
      node_id: 'int.gdrive',
      domain: 'storage',
      state: 'approval_needed',
      label: 'Uploads guarded',
      exact_reason: 'google_drive_upload_requires_owner_approval',
      next_action: 'Approve an exact file upload/write scope before Drive mutations.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.onedrive.upload_scope',
      component: 'OneDrive',
      node_id: 'int.onedrive',
      domain: 'storage',
      state: 'approval_needed',
      label: 'Uploads guarded',
      exact_reason: 'onedrive_upload_requires_owner_approval',
      next_action: 'Approve an exact file upload/write scope before OneDrive mutations.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.reports.delivery_scope',
      component: 'Reports',
      node_id: 'int.reports',
      domain: 'reports',
      state: 'read_only_active',
      label: 'Preview ready, delivery guarded',
      exact_reason: 'report_preview_ready_delivery_not_enabled',
      next_action: 'Preview reports now; approve delivery only for an exact recipient and report.',
      standing_scope_id: null,
      approval_required: false,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.webhooks.signed_delivery',
      component: 'Webhooks',
      node_id: 'int.webhooks_out',
      domain: 'webhooks',
      state: 'approval_needed',
      label: 'Signed outbound delivery guarded',
      exact_reason: 'outbound_webhook_dispatch_requires_owner_approval',
      next_action: 'Approve a signed destination and payload schema before outbound webhook delivery.',
      standing_scope_id: null,
      approval_required: true,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
    item({
      id: 'approval.events.runtime_heartbeat',
      component: 'Events',
      node_id: 'input.event',
      domain: 'events',
      state: 'read_only_active',
      label: 'Event bus ready, no recent events',
      exact_reason: 'event_bus_ready_no_recent_events',
      next_action: 'Wait for a runtime event or verify event stream heartbeat.',
      standing_scope_id: null,
      approval_required: false,
      write_enabled: false,
      execute_enabled: false,
      emergency_stop_available: true,
    }),
  ]

  const grouped = items.reduce<Record<GatewayApprovalCenterState, GatewayApprovalCenterItem[]>>((acc, row) => {
    acc[row.state].push(row)
    return acc
  }, {
    standing_scope_active: [],
    approval_needed: [],
    approval_pending: [],
    approved: [],
    expired: [],
    revoked: [],
    blocked_by_policy: [],
    read_only_active: [],
    not_configured: [],
  })

  return {
    ok: true,
    source: 'gateway_approval_center',
    generated_at: generatedAt,
    summary: {
      total: items.length,
      pending: grouped.approval_pending.length,
      standing_scope_active: grouped.standing_scope_active.length,
      approval_needed: grouped.approval_needed.length,
      blocked_by_policy: grouped.blocked_by_policy.length,
      read_only_active: grouped.read_only_active.length,
      not_configured: grouped.not_configured.length,
    },
    items,
    grouped,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}
