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

export type GatewayStandingScopeProposalStatus = 'preview_only' | 'already_active_read_only'

export type GatewayStandingScopeProposal = {
  scope_id: string
  name: string
  status: GatewayStandingScopeProposalStatus
  components: string[]
  owner_review_state: 'needs_owner_review' | 'already_active_read_only'
  allowed_operations: string[]
  blocked_operations: string[]
  max_operations_per_hour: number | null
  max_operations_per_day: number | null
  audit_required: true
  emergency_stop_available: true
  requires_owner_approval: boolean
  write_enabled: false
  execute_enabled: false
  external_writes_enabled: false
  broad_connector_execution_enabled: false
  next_action: string
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
  standing_scope_proposals: GatewayStandingScopeProposal[]
  standing_scope_proposal_summary: {
    total: number
    preview_only: number
    already_active_read_only: number
    write_scopes_activation_enabled: false
    execute_scopes_activation_enabled: false
  }
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  external_writes_executed: false
  broad_connector_execution_enabled: false
}

function item(input: GatewayApprovalCenterItem): GatewayApprovalCenterItem {
  return input
}

function proposal(input: GatewayStandingScopeProposal): GatewayStandingScopeProposal {
  return input
}

export function buildGatewayApprovalCenter(generatedAt = new Date().toISOString()): GatewayApprovalCenterPayload {
  const standingScopeProposals = [
    proposal({
      scope_id: 'scope.knowledge.read.preview',
      name: 'Knowledge Read Scope',
      status: 'preview_only',
      components: ['Obsidian Vault', 'Palacio / MemPalace', 'Graphify / Graffiti', 'GBrain'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['read', 'list', 'search', 'preview'],
      blocked_operations: ['write', 'delete', 'tool_invocation', 'secret_bearing_note_access'],
      max_operations_per_hour: 120,
      max_operations_per_day: 1000,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Owner can approve this read-only standing scope if continuous knowledge discovery should be formalized.',
    }),
    proposal({
      scope_id: 'scope.knowledge.write.preview',
      name: 'Knowledge Write Scope',
      status: 'preview_only',
      components: ['Obsidian Vault', 'Palacio / MemPalace', 'Graphify / Graffiti', 'Brain Sync'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['exact_owner_approved_note_update', 'exact_owner_approved_memory_write', 'exact_owner_approved_graph_mutation'],
      blocked_operations: ['broad_file_deletion', 'secret_bearing_notes', 'unbounded_directory_writes', 'unreviewed_sync'],
      max_operations_per_hour: 12,
      max_operations_per_day: 60,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Review exact write operations, rollback target, and limits before activation.',
    }),
    proposal({
      scope_id: 'scope.buildwiki.run_now.preview',
      name: 'Build-Wiki Run Scope',
      status: 'preview_only',
      components: ['Build-Wiki', 'OpenCloud / OCTM'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['buildwiki.run_now', 'opencloud-docs-farmer.service'],
      blocked_operations: ['smb_mount', 'external_farmers', 'gmail_farmer', 'slack_farmer', 'youtube_farmer', 'web_farmer'],
      max_operations_per_hour: 2,
      max_operations_per_day: 8,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Approve only the exact Run Now service scope when a Build-Wiki run is needed.',
    }),
    proposal({
      scope_id: 'zapier.scope.discovery_and_status',
      name: 'Zapier Discovery Scope',
      status: 'already_active_read_only',
      components: ['Zapier'],
      owner_review_state: 'already_active_read_only',
      allowed_operations: ['list_tools', 'list_zaps', 'inspect_readiness', 'read_metadata', 'check_enabled_disabled_status'],
      blocked_operations: ['zap_creation', 'zap_execution', 'social_posting', 'webhook_write', 'external_write'],
      max_operations_per_hour: 120,
      max_operations_per_day: 1000,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: false,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Use discovery/readiness now; create a separate exact execution scope before any Zapier write.',
    }),
    proposal({
      scope_id: 'scope.zapier.exact_action.preview',
      name: 'Zapier Exact Action Scope',
      status: 'preview_only',
      components: ['Zapier'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['named_zap_id_only', 'named_app_only', 'named_payload_schema_only'],
      blocked_operations: ['arbitrary_zap_creation', 'broad_execution', 'live_social_posting_without_explicit_approval'],
      max_operations_per_hour: 6,
      max_operations_per_day: 24,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Name the exact Zap IDs, apps, destinations, schemas, limits, and expiry before activation.',
    }),
    proposal({
      scope_id: 'scope.reports.delivery.preview',
      name: 'Report Delivery Scope',
      status: 'preview_only',
      components: ['Reports'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['exact_report_delivery', 'owner_approved_destination_only'],
      blocked_operations: ['unbounded_recipient_delivery', 'unspecified_channel_delivery', 'secret_bearing_report_delivery'],
      max_operations_per_hour: 6,
      max_operations_per_day: 24,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Approve exact report destination and delivery channel before enabling dispatch.',
    }),
    proposal({
      scope_id: 'scope.drive.upload.preview',
      name: 'Drive Upload Scope',
      status: 'preview_only',
      components: ['Google Drive', 'OneDrive'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['upload_to_owner_approved_folder', 'metadata_update_for_uploaded_artifact'],
      blocked_operations: ['broad_write', 'delete', 'secret_file_upload', 'unbounded_folder_access'],
      max_operations_per_hour: 12,
      max_operations_per_day: 60,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Approve exact folders and file classes before uploads are enabled.',
    }),
    proposal({
      scope_id: 'scope.gbrain.invocation.preview',
      name: 'GBrain Invocation Scope',
      status: 'preview_only',
      components: ['GBrain'],
      owner_review_state: 'needs_owner_review',
      allowed_operations: ['exact_allowed_tool', 'exact_allowed_action'],
      blocked_operations: ['broad_tool_invocation', 'unreviewed_mutation', 'credential_access'],
      max_operations_per_hour: 10,
      max_operations_per_day: 40,
      audit_required: true,
      emergency_stop_available: true,
      requires_owner_approval: true,
      write_enabled: false,
      execute_enabled: false,
      external_writes_enabled: false,
      broad_connector_execution_enabled: false,
      next_action: 'Approve exact GBrain tools/actions before invocation is enabled.',
    }),
  ]

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
    standing_scope_proposals: standingScopeProposals,
    standing_scope_proposal_summary: {
      total: standingScopeProposals.length,
      preview_only: standingScopeProposals.filter((row) => row.status === 'preview_only').length,
      already_active_read_only: standingScopeProposals.filter((row) => row.status === 'already_active_read_only').length,
      write_scopes_activation_enabled: false,
      execute_scopes_activation_enabled: false,
    },
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    external_writes_executed: false,
    broad_connector_execution_enabled: false,
  }
}
