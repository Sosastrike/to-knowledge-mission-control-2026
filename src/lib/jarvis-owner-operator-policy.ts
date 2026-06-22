export const JARVIS_ACTOR_ID = 'agent-zero-jarvis'
export const JARVIS_OWNER_FACING_NAME = 'Agent Zero (Jarvis)'
export const JARVIS_ALIASES = ['Jarvis', 'Javis', 'Jervis', 'Gerbis'] as const

export type JarvisActionClass =
  | 'DIRECT_READ'
  | 'DIRECT_INTERNAL_WRITE'
  | 'BRIDGE_GATED'
  | 'HARD_STOP'
  | 'DISABLED'

export type JarvisPolicyCategory =
  | 'mission_control_read'
  | 'gateway_read'
  | 'internal_state_write'
  | 'approval_request_write'
  | 'provider_execution'
  | 'mcp_tool_execution'
  | 'brain_write'
  | 'paperclip_write'
  | 'buildwiki_dispatch'
  | 'connector_send_upload'
  | 'webhook_or_scheduler_mutation'
  | 'credential_or_secret'
  | 'public_exposure'
  | 'destructive_or_auth'
  | 'unsupported'

export const JARVIS_DIRECT_READ_CATEGORIES: JarvisPolicyCategory[] = [
  'mission_control_read',
  'gateway_read',
]

export const JARVIS_DIRECT_INTERNAL_WRITE_CATEGORIES: JarvisPolicyCategory[] = [
  'internal_state_write',
  'approval_request_write',
]

export const JARVIS_BRIDGE_GATED_CATEGORIES: JarvisPolicyCategory[] = [
  'provider_execution',
  'mcp_tool_execution',
  'brain_write',
  'paperclip_write',
  'buildwiki_dispatch',
  'connector_send_upload',
  'webhook_or_scheduler_mutation',
]

export const JARVIS_HARD_STOP_CATEGORIES: JarvisPolicyCategory[] = [
  'credential_or_secret',
  'public_exposure',
  'destructive_or_auth',
]

export const JARVIS_DEFAULT_SESSION_SCOPES = [
  'mission_control_internal_write',
  'report_preview',
  'approval_request_create',
  'pi_recommendation_persist',
  'readiness_metadata_write',
  'dashboard_metadata_write',
  'mission_control_internal_reports',
  'readiness_matrix_annotations',
  'internal_tasks_and_work_items',
  'audit_summaries',
  'workflow_records',
  'dashboard_metadata',
  'runbooks',
  'rollback_notes',
  'pi_recommendation_persistence',
  'approval_request_creation',
  'mcp_readonly_status_probe',
  'mcp_memory_write_probe',
  'buildwiki_run_now_dispatch',
  'buildwiki_result_ingest',
  'obsidian_write',
  'obsidian_structured_project_note_write',
  'mempalace_write',
  'mempalace_categorized_memory_write',
  'paperclip_eco_issue_comment_write',
  'paperclip_company_team_bootstrap',
  'scheduler_run_now_auto_backup',
  'jarvis_workflow_daily_health_run',
  'agent_zero_report_create',
  'agentmail_draft_create',
  'webhook_local_ping',
  'provider_model_execution',
  'gateway_ollama_local_model_execute',
  'jarvis_developer_workflow_create_change_request',
  'jarvis_full_go_company_workflow_run',
  'telegram_owner_message_send',
] as const

export const JARVIS_HARD_STOP_REASONS = [
  'sudo_or_password_required',
  'env_edit_or_credential_injection_required',
  'raw_secret_or_auth_file_exposure',
  'public_exposure_dns_caddy_tailscale_firewall_change',
  'destructive_delete_or_data_loss_risk',
  'spending_above_cap',
  'disable_auth_audit_or_rollback',
  'outside_mission_control_gateway_jarvis_scope',
] as const

export function jarvisOwnerOperatorPolicy() {
  return {
    actor_id: JARVIS_ACTOR_ID,
    owner_facing_name: JARVIS_OWNER_FACING_NAME,
    aliases: JARVIS_ALIASES,
    direct_read_categories: JARVIS_DIRECT_READ_CATEGORIES,
    direct_internal_write_categories: JARVIS_DIRECT_INTERNAL_WRITE_CATEGORIES,
    bridge_gated_categories: JARVIS_BRIDGE_GATED_CATEGORIES,
    hard_stop_categories: JARVIS_HARD_STOP_CATEGORIES,
    default_session_scopes: JARVIS_DEFAULT_SESSION_SCOPES,
    hard_stop_reasons: JARVIS_HARD_STOP_REASONS,
    raw_secret_access_allowed: false,
    env_mutation_allowed: false,
    public_exposure_mutation_allowed: false,
    destructive_delete_allowed: false,
    auth_weakening_allowed: false,
    audit_removal_allowed: false,
    rollback_removal_allowed: false,
  }
}
