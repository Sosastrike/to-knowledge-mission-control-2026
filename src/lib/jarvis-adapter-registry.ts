import { classifyJarvisAction } from '@/lib/jarvis-action-classifier'
import { JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID } from '@/lib/jarvis-mcp-memory-write-adapter'
import { JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID } from '@/lib/jarvis-buildwiki-result-ingest-adapter'
import { JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID } from '@/lib/jarvis-obsidian-structured-project-note-adapter'
import { JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID } from '@/lib/jarvis-mempalace-categorized-memory-adapter'
import { JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID } from '@/lib/jarvis-developer-workflow-adapter'
import { JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID } from '@/lib/jarvis-full-go-workflow-adapter'
import { JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID } from '@/lib/jarvis-telegram-delivery-adapter'
import { JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID } from '@/lib/jarvis-zapier-exact-action-adapter'
import { JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID } from '@/lib/jarvis-drive-onedrive-exact-adapter'
import { PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID } from '@/lib/paperclip-company-bootstrap-adapter'
import { PUBLIC_WEBPAGE_READ_ADAPTER_ID, YOUTUBE_TRANSCRIPT_ADAPTER_ID } from '@/lib/public-research'

export type JarvisAdapterStatus = {
  id: string
  label: string
  category: string
  status: 'executable' | 'ready_read_only' | 'bridge_gated' | 'credential_gated' | 'adapter_missing' | 'service_down'
  dry_run_supported: boolean
  execute_supported: boolean
  exact_blocker: string | null
  rollback_command: string
}

const ADAPTERS: JarvisAdapterStatus[] = [
  { id: 'gateway_execution_router', label: 'Jarvis Gateway execution router', category: 'mcp_tool_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'disable /api/bridge/agent-zero/execute and keep all exact-scope adapters blocked' },
  { id: 'mcp_readonly_status_probe', label: 'MCP read-only status probe', category: 'mcp_tool_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'revoke Jarvis Bridge Session and archive the read-only status-probe proof; no external state was changed' },
  { id: PUBLIC_WEBPAGE_READ_ADAPTER_ID, label: 'Public webpage read-only fetch', category: 'public_research_read', status: 'ready_read_only', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'archive the exact visible public-read task and audit record; no external state was changed' },
  { id: YOUTUBE_TRANSCRIPT_ADAPTER_ID, label: 'YouTube transcript read-only fetch', category: 'video_intelligence_read', status: 'ready_read_only', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'archive the exact visible video-transcript task and audit record; no external video, cookie, or audio state was changed' },
  { id: 'paperclip_eco_task_dry_run', label: 'Paperclip ECO task dry-run', category: 'paperclip_write', status: 'executable', dry_run_supported: true, execute_supported: true, exact_blocker: null, rollback_command: 'remove the internal Paperclip ECO dry-run record; no Paperclip external state was changed' },
  { id: 'n8n_workflow_list', label: 'n8n workflow readiness/list', category: 'connector_readiness', status: 'executable', dry_run_supported: true, execute_supported: true, exact_blocker: 'credential_required_if_n8n_api_key_missing', rollback_command: 'remove the internal n8n readiness/list proof; no n8n workflow was activated, executed, or changed' },
  { id: 'buildwiki_run_now', label: 'Build-Wiki Run Now', category: 'buildwiki_dispatch', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'stop opencloud-docs-farmer.service if still active; leave opencloud-docs-farmer.timer unchanged and retain audit trail' },
  { id: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID, label: 'Build-Wiki result ingest', category: 'buildwiki_dispatch', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Build-Wiki result ingestion record; do not stop service, timer, SMB, or external farmers' },
  { id: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID, label: 'MCP memory write probe', category: 'mcp_tool_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact MCP memory proof graph created for this probe; the adapter creates and deletes the ephemeral entity in the same run' },
  { id: 'provider_model_execution', label: 'Provider/model execution', category: 'provider_execution', status: 'bridge_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'token_governor_not_proven', rollback_command: 'keep provider/model execution disabled until Token Governor enforcement is proven' },
  { id: 'gateway_ollama_local_model_execute', label: 'Gateway Ollama local model execute', category: 'provider_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis local Ollama proof record; no provider state was mutated and no paid provider was called' },
  { id: 'paperclip_gateway_inventory', label: 'Paperclip Gateway Visibility Bridge', category: 'gateway_read', status: 'ready_read_only', dry_run_supported: true, execute_supported: false, exact_blocker: null, rollback_command: 'remove /api/bridge/paperclip/gateway-inventory from Paperclip context and keep Paperclip native ECO reads available' },
  { id: 'paperclip_eco_task_write', label: 'Paperclip ECO issue comment write', category: 'paperclip_write', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: 'paperclip_write_credential_required_if_api_key_missing', rollback_command: 'cancel/delete the exact created Paperclip ECO queued comment if Paperclip allows it; otherwise post one compensating ECO comment through the same exact adapter scope' },
  { id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID, label: 'Paperclip Pacman Cybersecurity company/team bootstrap', category: 'paperclip_write', status: 'executable', dry_run_supported: true, execute_supported: true, exact_blocker: 'paperclip_board_admin_credential_required_if_broker_missing', rollback_command: 'archive only the exact created Pacman Cybersecurity company through official Paperclip archive route, cancel/reject exact pending agent hires, and close only exact bootstrap project/issues if Paperclip exposes rollback-safe routes; never edit the Paperclip database or touch TOK' },
  { id: 'obsidian_write', label: 'Obsidian canonical note create', category: 'brain_write', status: 'executable', dry_run_supported: true, execute_supported: true, exact_blocker: null, rollback_command: 'remove the exact created note from the canonical Obsidian vault if rollback is required; keep all other notes unchanged' },
  { id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID, label: 'Obsidian structured project note create', category: 'brain_write', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact created structured project note from the canonical Obsidian vault; keep all other notes unchanged' },
  { id: 'mempalace_write', label: 'MemPalace safe memory summary write', category: 'brain_write', status: 'executable', dry_run_supported: true, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact created MemPalace safe summary row if rollback is required; keep all other memory rows unchanged' },
  { id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID, label: 'MemPalace categorized task-result memory write', category: 'brain_write', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact categorized MemPalace safe summary row if rollback is required; keep all other memory rows unchanged' },
  { id: 'scheduler_run_now', label: 'Scheduler auto-backup run-now', category: 'webhook_or_scheduler_mutation', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact backup artifact ids created by this proof if rollback is required; do not delete production data or unrelated backups' },
  { id: 'jarvis_workflow_run', label: 'Jarvis daily health workflow run', category: 'workflow_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis daily_health workflow run record; no external connector, provider, Paperclip, Zapier, n8n, MCP, or delivery state was changed' },
  { id: 'agent_zero_report_create', label: 'Agent Zero internal report create', category: 'reports_internal_write', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact created Agent Zero report artifact from Mission Control report storage; no external delivery occurred' },
  { id: 'agentmail_draft_create', label: 'AgentMail internal draft create', category: 'connector_send_upload', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact AgentMail draft record; no email was sent and no AgentMail API credential was used' },
  { id: 'agentmail_send', label: 'AgentMail send', category: 'connector_send_upload', status: 'credential_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'agentmail_credential_required', rollback_command: 'revoke AgentMail Bridge approval and disable send runner' },
  { id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID, label: 'Telegram exact owner message send', category: 'connector_send_upload', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis Telegram delivery proof record; optionally use Telegram message removal for that single owner-chat message id if rollback is approved' },
  { id: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID, label: 'Zapier exact safe action execute', category: 'connector_send_upload', status: 'credential_gated', dry_run_supported: true, execute_supported: true, exact_blocker: 'zapier_credential_required', rollback_command: 'keep Zapier execution disabled until brokered credentials and one exact safe action are approved; no Zapier state was changed' },
  { id: 'zapier_heygen', label: 'Zapier/HeyGen', category: 'connector_send_upload', status: 'credential_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'credential_and_owner_approval_required', rollback_command: 'revoke connector approval and keep Zapier/HeyGen writes disabled' },
  { id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID, label: 'Google Drive exact folder list/upload', category: 'connector_send_upload', status: 'credential_gated', dry_run_supported: true, execute_supported: true, exact_blocker: 'approved_folder_and_credential_scopes_missing', rollback_command: 'keep Google Drive execution disabled until brokered credentials and approved folder scope exist; delete only the exact uploaded test file after upload proof; OneDrive is unavailable for this gate' },
  { id: 'drive_onedrive_upload', label: 'Drive/OneDrive upload', category: 'connector_send_upload', status: 'credential_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'oauth_target_folder_required', rollback_command: 'disable scoped upload runner and keep reports local' },
  { id: 'reports_delivery', label: 'Reports delivery', category: 'connector_send_upload', status: 'bridge_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'delivery_adapter_not_proven', rollback_command: 'keep report delivery disabled and preserve preview-only reports' },
  { id: 'webhook_local_ping', label: 'Webhook local ping', category: 'webhook_or_scheduler_mutation', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis local webhook ping record; no external endpoint was called and no public webhook was created' },
  { id: 'webhook_scheduled_jobs', label: 'Webhooks and scheduled jobs', category: 'webhook_or_scheduler_mutation', status: 'bridge_gated', dry_run_supported: true, execute_supported: false, exact_blocker: 'exact_scope_schedule_adapter_not_proven', rollback_command: 'disable scheduled job runner and keep schedule registry read-only' },
  { id: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID, label: 'Jarvis controlled developer workflow change request', category: 'internal_state_write', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis developer workflow record; no source files, builds, or deployments are changed by this adapter' },
  { id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID, label: 'Jarvis Full GO company workflow', category: 'workflow_execution', status: 'executable', dry_run_supported: false, execute_supported: true, exact_blocker: null, rollback_command: 'remove only the exact Jarvis Full GO company workflow run record; no external connector, Paperclip write, Zapier, n8n, or delivery state was changed' },
]

export function listJarvisAdapters() {
  return ADAPTERS.map((adapter) => ({
    ...adapter,
    classification: classifyJarvisAction({
      action: adapter.id,
      category: adapter.category,
      target: adapter.label,
    }),
    credential_values_exposed: false,
    execution_enabled: adapter.id === 'mcp_readonly_status_probe' || adapter.id === PUBLIC_WEBPAGE_READ_ADAPTER_ID || adapter.id === YOUTUBE_TRANSCRIPT_ADAPTER_ID || adapter.id === JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID || adapter.id === 'paperclip_eco_task_dry_run' || adapter.id === 'paperclip_eco_task_write' || adapter.id === PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID || adapter.id === 'n8n_workflow_list' || adapter.id === 'buildwiki_run_now' || adapter.id === JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID || adapter.id === 'obsidian_write' || adapter.id === JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID || adapter.id === 'mempalace_write' || adapter.id === JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID || adapter.id === 'scheduler_run_now' || adapter.id === 'jarvis_workflow_run' || adapter.id === 'agent_zero_report_create' || adapter.id === 'agentmail_draft_create' || adapter.id === 'webhook_local_ping' || adapter.id === 'gateway_ollama_local_model_execute' || adapter.id === JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID || adapter.id === JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID || adapter.id === JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
  }))
}

export function dryRunJarvisAdapter(adapterId: string, input: Record<string, unknown> = {}) {
  const adapter = ADAPTERS.find((item) => item.id === adapterId) || null
  if (!adapter) {
    return { ok: false, exact_blocker: 'adapter_missing', adapter_id: adapterId }
  }
  return {
    ok: true,
    mode: 'dry_run_only',
    adapter,
    input_shape_keys: Object.keys(input).sort(),
    execution_enabled: false,
    writes_enabled: false,
    exact_blocker: adapter.exact_blocker,
  }
}
