export const NUCLEAR_GATEWAY_TOOL_MIGRATION_PHASE = 'phase_6_mcp_tool_migration' as const

export const NUCLEAR_GATEWAY_TOOL_CLASSIFICATIONS = [
  'READ_ONLY',
  'WRITE_GATED',
  'CREDENTIAL_REQUIRED',
  'PERMISSION_REQUIRED',
  'UNSAFE_DISABLED',
] as const

export type NuclearGatewayToolClassification = typeof NUCLEAR_GATEWAY_TOOL_CLASSIFICATIONS[number]

export type NuclearGatewayToolMigrationEntry = {
  id: string
  label: string
  source_dependency: string
  current_openclaw_role: string
  migration_target: string
  gateway_registry_target: string
  classification: NuclearGatewayToolClassification
  direct_line_required: boolean
  bridge_session_required: boolean
  jarvis_concurrence_required: boolean
  credential_names_checked: string[]
  credential_values_exposed: false
  secret_values_inspected: false
  writes_enabled: boolean
  execution_enabled: boolean
  openclaw_allowed_role: 'supporting_tool_only' | 'not_allowed'
  openclaw_as_broker_allowed: false
  openclaw_as_conversation_owner_allowed: false
  rollback_note: string
  blocker: string | null
}

type EntryInput = Omit<
  NuclearGatewayToolMigrationEntry,
  | 'credential_values_exposed'
  | 'secret_values_inspected'
  | 'openclaw_as_broker_allowed'
  | 'openclaw_as_conversation_owner_allowed'
>

function entry(input: EntryInput): NuclearGatewayToolMigrationEntry {
  return {
    ...input,
    credential_values_exposed: false,
    secret_values_inspected: false,
    openclaw_as_broker_allowed: false,
    openclaw_as_conversation_owner_allowed: false,
  }
}

export const NUCLEAR_GATEWAY_TOOL_MIGRATION_ENTRIES: NuclearGatewayToolMigrationEntry[] = [
  entry({
    id: 'openclaw.sessions.read',
    label: 'OpenClaw session transcript read compatibility',
    source_dependency: 'src/app/api/sessions/* and src/app/api/sessions/transcript/* call OpenClaw session stores or gateway RPCs',
    current_openclaw_role: 'legacy_session_store_and_rpc_source',
    migration_target: 'Nuclear Gateway session/transcript registry with direct agent line ownership',
    gateway_registry_target: 'mcp_gateway.sessions.read',
    classification: 'READ_ONLY',
    direct_line_required: true,
    bridge_session_required: false,
    jarvis_concurrence_required: false,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'supporting_tool_only',
    rollback_note: 'Keep legacy session read routes available; remove this registry entry if the direct-line transcript reader is reverted.',
    blocker: null,
  }),
  entry({
    id: 'openclaw.sessions.send',
    label: 'OpenClaw session send/control compatibility',
    source_dependency: 'src/app/api/sessions/[id]/control and chat forwarding can call OpenClaw sessions_send',
    current_openclaw_role: 'legacy_message_transport',
    migration_target: 'POST /api/bridge/agent-routing/send with canonical message envelope',
    gateway_registry_target: 'direct_agent_line.send',
    classification: 'WRITE_GATED',
    direct_line_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'not_allowed',
    rollback_note: 'Revert direct-line send route only; do not re-enable OpenClaw hidden transport.',
    blocker: 'direct_line_envelope_required_before_any_send',
  }),
  entry({
    id: 'openclaw.skills.inventory',
    label: 'OpenClaw skill directory inventory',
    source_dependency: 'src/app/api/skills/* reads OpenClaw and ClaudeClaw skill roots',
    current_openclaw_role: 'legacy_skill_source',
    migration_target: 'Gateway skill registry and Ron skill foundry read-only inventory',
    gateway_registry_target: 'gateway_tools.skills.inventory',
    classification: 'READ_ONLY',
    direct_line_required: true,
    bridge_session_required: false,
    jarvis_concurrence_required: false,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'supporting_tool_only',
    rollback_note: 'Restore previous skill source visibility only; no skill activation is part of this migration entry.',
    blocker: null,
  }),
  entry({
    id: 'openclaw.skills.activate',
    label: 'OpenClaw skill activation or install',
    source_dependency: 'skills registry targets include openclaw/workspace install surfaces',
    current_openclaw_role: 'legacy_skill_activation_target',
    migration_target: 'Jarvis-approved exact-scope skill activation adapter',
    gateway_registry_target: 'certified_adapter.skill.activation',
    classification: 'WRITE_GATED',
    direct_line_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'supporting_tool_only',
    rollback_note: 'Keep activation disabled; revert only the exact adapter if later implemented.',
    blocker: 'jarvis_concurrence_and_exact_scope_adapter_required',
  }),
  entry({
    id: 'openclaw.cron.inventory',
    label: 'OpenClaw cron job inventory',
    source_dependency: 'src/app/api/cron/route.ts reads OpenClaw cron jobs and runs',
    current_openclaw_role: 'legacy_scheduler_state_source',
    migration_target: 'Mission Control Scheduler direct line and Gateway schedule registry',
    gateway_registry_target: 'scheduler.status.read',
    classification: 'READ_ONLY',
    direct_line_required: true,
    bridge_session_required: false,
    jarvis_concurrence_required: false,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'supporting_tool_only',
    rollback_note: 'Read-only registry entry can be removed without touching cron state.',
    blocker: null,
  }),
  entry({
    id: 'openclaw.cron.run',
    label: 'OpenClaw cron run/update/delete actions',
    source_dependency: 'src/app/api/cron/route.ts can trigger OpenClaw CLI cron operations',
    current_openclaw_role: 'legacy_scheduler_executor',
    migration_target: 'Scheduler exact-scope adapter with audit and rollback',
    gateway_registry_target: 'certified_adapter.scheduler.run_now',
    classification: 'WRITE_GATED',
    direct_line_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'not_allowed',
    rollback_note: 'Keep OpenClaw cron execution disabled until Scheduler adapter proof exists.',
    blocker: 'exact_scope_scheduler_adapter_required',
  }),
  entry({
    id: 'openclaw.gateway.health',
    label: 'OpenClaw gateway health/version diagnostics',
    source_dependency: 'src/app/api/gateways/*, src/app/api/status, src/app/api/diagnostics, and /api/openclaw/*',
    current_openclaw_role: 'legacy_runtime_diagnostics_source',
    migration_target: 'Nuclear Gateway runtime status with OpenClaw marked supporting runtime only',
    gateway_registry_target: 'runtime.openclaw.status.read',
    classification: 'READ_ONLY',
    direct_line_required: true,
    bridge_session_required: false,
    jarvis_concurrence_required: false,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'supporting_tool_only',
    rollback_note: 'Remove Nuclear Gateway status wrapper if needed; do not stop OpenClaw before Phase 10.',
    blocker: null,
  }),
  entry({
    id: 'openclaw.gateway.update_doctor',
    label: 'OpenClaw update and doctor repair routes',
    source_dependency: 'src/app/api/openclaw/update and src/app/api/openclaw/doctor',
    current_openclaw_role: 'legacy_runtime_repair_surface',
    migration_target: 'Disabled unsafe repair until exact Phase 10 cutover path exists',
    gateway_registry_target: 'unsafe_disabled.openclaw.repair',
    classification: 'UNSAFE_DISABLED',
    direct_line_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'not_allowed',
    rollback_note: 'No runtime change made; leave existing route auth in place but do not invoke repair/update actions.',
    blocker: 'owner_directive_do_not_repair_openclaw',
  }),
  entry({
    id: 'openclaw.integrations.credentials',
    label: 'OpenClaw integration credential names',
    source_dependency: 'src/app/api/integrations/route.ts references OpenClaw vault item names and env var names',
    current_openclaw_role: 'legacy_credential_name_catalog',
    migration_target: 'Nuclear Gateway Credential Broker name-only registry',
    gateway_registry_target: 'credential_broker.status',
    classification: 'CREDENTIAL_REQUIRED',
    direct_line_required: true,
    bridge_session_required: false,
    jarvis_concurrence_required: false,
    credential_names_checked: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'TELEGRAM_BOT_TOKEN', 'GITHUB_TOKEN', 'OPENCLAW_GATEWAY_TOKEN'],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'not_allowed',
    rollback_note: 'Retain name-only broker entries; never print values or move secrets through chat.',
    blocker: 'credential_values_must_remain_brokered_by_nuclear_gateway',
  }),
  entry({
    id: 'openclaw.backup.create',
    label: 'OpenClaw backup create action',
    source_dependency: 'src/app/api/backup/route.ts can call openclaw backup create',
    current_openclaw_role: 'legacy_backup_executor',
    migration_target: 'Backup governance adapter with exact artifact scope',
    gateway_registry_target: 'certified_adapter.backup.create',
    classification: 'PERMISSION_REQUIRED',
    direct_line_required: true,
    bridge_session_required: true,
    jarvis_concurrence_required: true,
    credential_names_checked: [],
    writes_enabled: false,
    execution_enabled: false,
    openclaw_allowed_role: 'not_allowed',
    rollback_note: 'Do not delete backup artifacts without exact rollback proof and owner approval.',
    blocker: 'production_backup_action_requires_explicit_owner_scope',
  }),
]

export function buildNuclearGatewayToolMigrationStatus() {
  const entries = NUCLEAR_GATEWAY_TOOL_MIGRATION_ENTRIES.map((item) => ({ ...item, credential_names_checked: [...item.credential_names_checked] }))
  const classificationCounts = Object.fromEntries(
    NUCLEAR_GATEWAY_TOOL_CLASSIFICATIONS.map((classification) => [
      classification,
      entries.filter((item) => item.classification === classification).length,
    ]),
  ) as Record<NuclearGatewayToolClassification, number>

  return {
    ok: true,
    route: 'bridge.nuclear-gateway.tool-migration',
    phase: NUCLEAR_GATEWAY_TOOL_MIGRATION_PHASE,
    status: 'PHASE_6_TOOL_MCP_MIGRATION_MAP_READY',
    architecture: 'owner -> mission-control -> nuclear-gateway -> direct-agent-line -> certified-adapter-or-mcp-api-tool',
    openclaw_command_authority_removed: true,
    openclaw_default_gateway_allowed: false,
    openclaw_credential_broker_allowed: false,
    openclaw_hidden_intermediary_allowed: false,
    openclaw_tool_broker_of_record: false,
    gateway_tool_broker_of_record: true,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    external_writes_enabled: false,
    entries_count: entries.length,
    classification_counts: classificationCounts,
    entries,
    next_safe_lane: 'Wire selected READ_ONLY and WRITE_GATED entries into Gateway UI/tool registry proof, then continue Agent Hub graph cleanup.',
  }
}
