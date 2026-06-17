import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import { jarvisAuditSummary } from '@/lib/jarvis-audit'
import { jarvisBridgeSessionStatus } from '@/lib/jarvis-bridge-session'
import { jarvisExecutionRouterStatus } from '@/lib/jarvis-execution-router'
import { JARVIS_HARD_STOP_REASONS } from '@/lib/jarvis-owner-operator-policy'
import { JARVIS_SCHEDULER_RUN_ADAPTER_ID } from '@/lib/jarvis-scheduler-run-adapter'
import { JARVIS_WORKFLOW_RUN_ADAPTER_ID } from '@/lib/jarvis-workflow-run-adapter'
import { JARVIS_REPORT_CREATE_ADAPTER_ID } from '@/lib/jarvis-report-create-adapter'
import { JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID } from '@/lib/jarvis-agentmail-draft-adapter'
import { JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID } from '@/lib/jarvis-webhook-local-ping-adapter'
import { JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID } from '@/lib/jarvis-ollama-local-model-adapter'
import { JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID } from '@/lib/jarvis-buildwiki-result-ingest-adapter'
import { JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID } from '@/lib/jarvis-obsidian-structured-project-note-adapter'
import { JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID } from '@/lib/jarvis-mempalace-categorized-memory-adapter'
import { JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID } from '@/lib/jarvis-developer-workflow-adapter'
import { JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID } from '@/lib/jarvis-full-go-workflow-adapter'
import { JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID } from '@/lib/jarvis-telegram-delivery-adapter'
import { MODEL_CATALOG } from '@/lib/models'
import { buildPaperclipGatewayInventory } from '@/lib/paperclip-gateway-inventory'
import { TOKEN_GOVERNOR_POLICY } from '@/lib/token-governor-policy'
import { currentMissionControlServiceOwnership } from '@/lib/mission-control-service-ownership'

export type JarvisFullGoSystemStatus =
  | 'certified'
  | 'adapter_ready_needs_proof'
  | 'credential_required'
  | 'bridge_gated'
  | 'designer_gated'
  | 'blocked'
  | 'planned'

export type JarvisFullGoSystem = {
  id: string
  label: string
  owner: 'Codex/Corex' | 'CloudCode' | 'Jarvis' | 'Owner'
  day_range: string
  adapter_id: string | null
  route: string | null
  current_status: JarvisFullGoSystemStatus
  exact_blocker: string | null
  next_action: string
  writes_enabled: boolean
  execution_enabled: boolean
  rollback_required: boolean
}

export type JarvisFullGoChecklistItem = {
  id: string
  label: string
  required: true
  acceptance: string
}

export type JarvisFullGoCredentialPlan = {
  id: string
  credential_names: string[]
  approved_scope_names?: string[]
  target_runtime: 'mission_control'
  owner_hard_stop: true
  value_required: boolean
  injection_status: 'present_by_name' | 'prepared_not_injected' | 'not_ready'
  runtime_presence_by_name: Record<string, 'present' | 'missing' | 'not_applicable'>
  exact_adapter_after_injection?: string
  exact_action_after_injection?: string
  required_bridge_session_scope?: string
  broad_execution_remains_blocked?: true
  verification: string[]
  restart_required: boolean
  no_secret_output: true
}

export type JarvisN8nAccountReadiness = {
  route: string
  endpoint: string
  day: 16
  status: 'credential_required' | 'ready_for_workflow_list' | 'service_down'
  n8n_base_url: 'present' | 'missing'
  n8n_api_key: 'present' | 'missing'
  base_url_value_exposed: false
  api_key_value_exposed: false
  configured_base_reachable: boolean
  configured_base_http_status: number | null
  local_default_probe_reachable: boolean
  local_default_probe_http_status: number | null
  exact_blocker: string | null
  next_action: string
  credential_values_exposed: false
  no_secrets_exposed: true
}

export type JarvisZapierReadiness = {
  route: string
  endpoint: string
  day: 26
  status: 'visible_credential_gated' | 'not_registered' | 'configured_but_bridge_gated'
  visible_in_gateway: boolean
  credential_names: Record<string, 'present' | 'missing'>
  credential_values_exposed: false
  execution_enabled: false
  writes_enabled: false
  exact_blockers: string[]
  allowed_next_action: string
  forbidden_actions: string[]
  no_secrets_exposed: true
}

export type JarvisProviderModelReadiness = {
  route: string
  endpoint: string
  day_range: '34-42'
  status: 'ollama_local_certified_external_providers_gated' | 'blocked_until_token_governor_proven'
  model_count: number
  providers: Array<{
    provider: string
    model_count: number
    credential_names: Record<string, 'present' | 'missing' | 'not_required'>
    execution_enabled: boolean
    exact_blocker: string | null
  }>
  token_governor: typeof TOKEN_GOVERNOR_POLICY
  execution_enabled: boolean
  writes_enabled: false
  credential_values_exposed: false
  no_secrets_exposed: true
}

type ProofCounts = {
  mcp_readonly_status_probe?: number
  mcp_memory_write_probe?: number
  paperclip_eco_task_dry_run?: number
  paperclip_gateway_inventory?: number
  paperclip_eco_task_write?: number
  n8n_workflow_list?: number
  buildwiki_run_now?: number
  buildwiki_result_ingest?: number
  obsidian_write?: number
  obsidian_structured_project_note_write?: number
  mempalace_write?: number
  mempalace_categorized_memory_write?: number
  scheduler_run_now?: number
  jarvis_workflow_run?: number
  agent_zero_report_create?: number
  agentmail_draft_create?: number
  webhook_local_ping?: number
  gateway_ollama_local_model_execute?: number
  jarvis_developer_workflow?: number
  jarvis_full_go_workflow?: number
  telegram_exact_send?: number
  pi_recommendation_recorded?: number
}

const routeExecute = '/api/bridge/agent-zero/execute'

const laneOwners = [
  {
    lane: 'Mission Control / Gateway / AgentHub / Jarvis source',
    owner: 'Codex/Corex',
    responsibility: 'Source-backed routes, adapters, policy, button contracts, provider/model routing, n8n/Zapier/Paperclip/Build-Wiki adapters.',
  },
  {
    lane: 'Runtime services and loopback helpers',
    owner: 'CloudCode',
    responsibility: 'Agent Zero container support, local Whisper, Telegram/Jarvis runtime support, loopback services, diagnostics only when requested.',
  },
  {
    lane: 'Operating authority',
    owner: 'Jarvis',
    responsibility: 'Execute certified adapters, create internal Mission Control records, coordinate PI/Paperclip/Gateway once each adapter is ready.',
  },
]

const universalAdapterChecklist: JarvisFullGoChecklistItem[] = [
  {
    id: 'route',
    label: 'Route',
    required: true,
    acceptance: 'Adapter has one canonical Mission Control route and no hidden production-only endpoint.',
  },
  {
    id: 'scope',
    label: 'Exact scope',
    required: true,
    acceptance: 'Adapter rejects broad scope and accepts only the named connector/system/action target.',
  },
  {
    id: 'input_schema',
    label: 'Input schema',
    required: true,
    acceptance: 'Adapter validates input shape before any execution or write attempt.',
  },
  {
    id: 'credential_policy',
    label: 'Credential policy',
    required: true,
    acceptance: 'Credential names may be reported; values are brokered and never returned, logged, or stored in reports.',
  },
  {
    id: 'bridge_session',
    label: 'Bridge Session',
    required: true,
    acceptance: 'Protected execution requires active Jarvis Bridge Session with the exact adapter scope.',
  },
  {
    id: 'audit',
    label: 'Audit',
    required: true,
    acceptance: 'Every execution/write records a redacted hash-chained Jarvis audit entry.',
  },
  {
    id: 'rollback',
    label: 'Rollback',
    required: true,
    acceptance: 'Every mutation has a rollback record or an explicit no-state/compensating rollback explanation.',
  },
  {
    id: 'proof',
    label: 'Execution proof',
    required: true,
    acceptance: 'GREEN requires a real exact-scope execution or write proof, not visibility-only status.',
  },
  {
    id: 'failure_mode',
    label: 'Failure mode',
    required: true,
    acceptance: 'Blocked paths return exact blockers such as credential_required, adapter_missing, bridge_session_required, or rollback_missing.',
  },
  {
    id: 'secret_redaction',
    label: 'Secret redaction',
    required: true,
    acceptance: 'Responses, UI, logs, markdown, and reports do not expose tokens, cookies, passwords, auth files, or .env values.',
  },
]

function certified(count: unknown) {
  return typeof count === 'number' && count > 0
}

function approximateJarvisFullGoPercent(systems: JarvisFullGoSystem[]) {
  const weights: Record<JarvisFullGoSystemStatus, number> = {
    certified: 1,
    adapter_ready_needs_proof: 0.72,
    credential_required: 0.52,
    bridge_gated: 0.45,
    designer_gated: 0.7,
    blocked: 0.12,
    planned: 0.24,
  }
  const weighted = systems.reduce((sum, item) => sum + weights[item.current_status], 0)
  return Math.min(95, Math.max(65, Math.round((weighted / Math.max(1, systems.length)) * 100)))
}

function jarvisFullGoProgramStatus(systems: JarvisFullGoSystem[]) {
  return systems.every((item) => item.current_status === 'certified')
    ? 'FULL_GO'
    : 'ADVANCED_PARTIAL_GO'
}

function envNamePresence(name: string): 'present' | 'missing' {
  return (process.env[name] || '').trim() ? 'present' : 'missing'
}

function configuredN8nBaseUrl() {
  return (process.env.N8N_BASE_URL || '').trim().replace(/\/+$/, '')
}

async function probeHttpStatus(url: string) {
  if (!url) return { reachable: false, status: null as number | null }
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    return { reachable: response.ok, status: response.status }
  } catch {
    return { reachable: false, status: null as number | null }
  }
}

function system(input: JarvisFullGoSystem): JarvisFullGoSystem {
  return input
}

function buildSystems(proofCounts: ProofCounts): JarvisFullGoSystem[] {
  return [
    system({
      id: 'mcp_readonly_status_probe',
      label: 'MCP read-only status probe',
      owner: 'Codex/Corex',
      day_range: 'completed',
      adapter_id: 'mcp_readonly_status_probe',
      route: routeExecute,
      current_status: certified(proofCounts.mcp_readonly_status_probe) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.mcp_readonly_status_probe) ? null : 'execution_proof_missing',
      next_action: certified(proofCounts.mcp_readonly_status_probe)
        ? 'Keep available as certified exact-scope read-only MCP execution.'
        : 'Run the exact mcp.status_probe adapter through Jarvis Bridge Session.',
      writes_enabled: false,
      execution_enabled: certified(proofCounts.mcp_readonly_status_probe),
      rollback_required: true,
    }),
    system({
      id: 'paperclip_eco_task_dry_run',
      label: 'Paperclip ECO task dry-run',
      owner: 'Codex/Corex',
      day_range: 'completed',
      adapter_id: 'paperclip_eco_task_dry_run',
      route: routeExecute,
      current_status: certified(proofCounts.paperclip_eco_task_dry_run) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.paperclip_eco_task_dry_run) ? null : 'dry_run_proof_missing',
      next_action: certified(proofCounts.paperclip_eco_task_dry_run)
        ? 'Keep dry-run available; do not treat as real Paperclip write.'
        : 'Run the ECO dry-run adapter with no external Paperclip mutation.',
      writes_enabled: false,
      execution_enabled: certified(proofCounts.paperclip_eco_task_dry_run),
      rollback_required: true,
    }),
    system({
      id: 'buildwiki_run_now_dispatch',
      label: 'Build-Wiki dispatch to opencloud-docs-farmer.service',
      owner: 'Codex/Corex',
      day_range: '48-52',
      adapter_id: 'buildwiki_run_now',
      route: routeExecute,
      current_status: certified(proofCounts.buildwiki_run_now) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.buildwiki_run_now) ? null : 'dispatch_proof_missing',
      next_action: certified(proofCounts.buildwiki_run_now)
        ? 'Add result ingestion and workflow integration without broadening the systemd target.'
        : 'Execute one bounded dispatch only for opencloud-docs-farmer.service with audit and rollback.',
      writes_enabled: false,
      execution_enabled: certified(proofCounts.buildwiki_run_now),
      rollback_required: true,
    }),
    system({
      id: 'buildwiki_result_ingest',
      label: 'Build-Wiki result ingestion',
      owner: 'Codex/Corex',
      day_range: '51-52',
      adapter_id: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.buildwiki_result_ingest) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.buildwiki_result_ingest) ? null : 'buildwiki_result_ingest_proof_missing',
      next_action: certified(proofCounts.buildwiki_result_ingest)
        ? 'Keep ingestion scoped to redacted opencloud-docs-farmer.service status/audit metadata.'
        : 'Ingest the scoped Build-Wiki dispatch result into an internal Jarvis record with audit and rollback.',
      writes_enabled: certified(proofCounts.buildwiki_result_ingest),
      execution_enabled: certified(proofCounts.buildwiki_result_ingest),
      rollback_required: true,
    }),
    system({
      id: 'obsidian_structured_write',
      label: 'Obsidian structured project note writes',
      owner: 'Codex/Corex',
      day_range: '53-55',
      adapter_id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.obsidian_structured_project_note_write) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.obsidian_structured_project_note_write) ? null : 'obsidian_structured_project_note_write_proof_missing',
      next_action: certified(proofCounts.obsidian_structured_project_note_write)
        ? 'Keep structured project note writes limited to the Jarvis Full GO folder and rollback exact created notes only.'
        : 'Prove one structured Obsidian project note write through the exact-scope adapter.',
      writes_enabled: certified(proofCounts.obsidian_structured_project_note_write),
      execution_enabled: certified(proofCounts.obsidian_structured_project_note_write),
      rollback_required: true,
    }),
    system({
      id: 'mempalace_structured_write',
      label: 'MemPalace structured memory writes',
      owner: 'Codex/Corex',
      day_range: '56-58',
      adapter_id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.mempalace_categorized_memory_write) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.mempalace_categorized_memory_write) ? null : 'mempalace_categorized_memory_write_proof_missing',
      next_action: certified(proofCounts.mempalace_categorized_memory_write)
        ? 'Keep categorized memory writes scoped to task_result safe summaries with exact rollback.'
        : 'Prove one categorized MemPalace task-result memory write through exact-scope adapter.',
      writes_enabled: certified(proofCounts.mempalace_categorized_memory_write),
      execution_enabled: certified(proofCounts.mempalace_categorized_memory_write),
      rollback_required: true,
    }),
    system({
      id: 'paperclip_eco_real_write',
      label: 'Paperclip ECO real issue-comment write',
      owner: 'Codex/Corex',
      day_range: '6-15',
      adapter_id: 'paperclip_eco_task_write',
      route: routeExecute,
      current_status: certified(proofCounts.paperclip_eco_task_write) ? 'certified' : 'credential_required',
      exact_blocker: certified(proofCounts.paperclip_eco_task_write) ? null : 'paperclip_write_credential_required_or_target_required',
      next_action: certified(proofCounts.paperclip_eco_task_write)
        ? 'Keep limited to ECO issue-comment writes; expand only with exact rollback proof.'
        : 'Prepare Paperclip API key injection path, then prove one bounded ECO comment write without TOK.',
      writes_enabled: certified(proofCounts.paperclip_eco_task_write),
      execution_enabled: certified(proofCounts.paperclip_eco_task_write),
      rollback_required: true,
    }),
    system({
      id: 'paperclip_gateway_context',
      label: 'Paperclip Gateway inventory and agent context',
      owner: 'Codex/Corex',
      day_range: '11-14',
      adapter_id: 'paperclip_gateway_inventory',
      route: '/api/bridge/paperclip/gateway-inventory',
      current_status: certified(proofCounts.paperclip_gateway_inventory) ? 'certified' : 'bridge_gated',
      exact_blocker: certified(proofCounts.paperclip_gateway_inventory) ? null : 'paperclip_agents_need_context_verification',
      next_action: certified(proofCounts.paperclip_gateway_inventory)
        ? 'Keep Paperclip ECO Gateway inventory visible read-only; all action requests remain WRITES_BRIDGE_GATED until their own adapter proof exists.'
        : 'Verify CEO/CMO/CTO and ECO agents consume Gateway inventory and answer Zapier/n8n visibility correctly.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: false,
    }),
    system({
      id: 'n8n_workflow_list',
      label: 'n8n workflow readiness/list',
      owner: 'Codex/Corex',
      day_range: '16-25',
      adapter_id: 'n8n_workflow_list',
      route: routeExecute,
      current_status: certified(proofCounts.n8n_workflow_list) ? 'certified' : 'credential_required',
      exact_blocker: certified(proofCounts.n8n_workflow_list) ? null : 'n8n_base_url_and_api_key_required',
      next_action: certified(proofCounts.n8n_workflow_list)
        ? 'Add workflow metadata inspection and activation policy.'
        : 'Prepare N8N_BASE_URL/N8N_API_KEY injection path; stop for owner credential input.',
      writes_enabled: false,
      execution_enabled: certified(proofCounts.n8n_workflow_list),
      rollback_required: true,
    }),
    system({
      id: 'zapier_exact_action',
      label: 'Zapier exact safe action',
      owner: 'Codex/Corex',
      day_range: '26-33',
      adapter_id: 'zapier_exact_action_execute',
      route: routeExecute,
      current_status: 'credential_required',
      exact_blocker: 'zapier_credential_broker_and_exact_action_missing',
      next_action: 'Inventory Zapier readiness, select one safe action, then build exact-scope adapter with no broad execution.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: true,
    }),
    system({
      id: 'gateway_local_model_execution',
      label: 'Gateway local Ollama model execution',
      owner: 'Codex/Corex',
      day_range: '34-42',
      adapter_id: JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.gateway_ollama_local_model_execute) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.gateway_ollama_local_model_execute) ? null : 'ollama_local_model_execution_proof_missing',
      next_action: certified(proofCounts.gateway_ollama_local_model_execute)
        ? 'Keep paid/external provider execution gated until each provider has brokered credentials and cost-cap proof.'
        : 'Execute one local Ollama qwen2.5:0.5b call through Jarvis Gateway execution router with zero provider cost.',
      writes_enabled: false,
      execution_enabled: certified(proofCounts.gateway_ollama_local_model_execute),
      rollback_required: true,
    }),
    system({
      id: 'mcp_write_capable_tool',
      label: 'MCP memory write-capable tool',
      owner: 'Codex/Corex',
      day_range: '43-47',
      adapter_id: 'mcp_memory_write_probe',
      route: routeExecute,
      current_status: certified(proofCounts.mcp_memory_write_probe) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.mcp_memory_write_probe) ? null : 'mcp_memory_write_probe_proof_missing',
      next_action: certified(proofCounts.mcp_memory_write_probe)
        ? 'Keep MCP execution limited to the memory create/delete proof adapter; do not enable arbitrary MCP tools.'
        : 'Execute one memory MCP create-and-delete proof through Jarvis Bridge Session.',
      writes_enabled: certified(proofCounts.mcp_memory_write_probe),
      execution_enabled: certified(proofCounts.mcp_memory_write_probe),
      rollback_required: true,
    }),
    system({
      id: 'agentmail_delivery',
      label: 'AgentMail draft/send',
      owner: 'Codex/Corex',
      day_range: '59-61',
      adapter_id: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.agentmail_draft_create) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.agentmail_draft_create) ? null : 'agentmail_draft_create_proof_missing',
      next_action: certified(proofCounts.agentmail_draft_create)
        ? 'AgentMail draft is certified; send remains credential and allow-list gated.'
        : 'Start with exact-scope draft adapter; send only after credential and target approval.',
      writes_enabled: certified(proofCounts.agentmail_draft_create),
      execution_enabled: certified(proofCounts.agentmail_draft_create),
      rollback_required: true,
    }),
    system({
      id: 'telegram_delivery',
      label: 'Telegram exact owner allowlist send',
      owner: 'Codex/Corex',
      day_range: '62-64',
      adapter_id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.telegram_exact_send) ? 'certified' : 'planned',
      exact_blocker: certified(proofCounts.telegram_exact_send) ? null : 'telegram_delivery_adapter_not_built',
      next_action: certified(proofCounts.telegram_exact_send)
        ? 'Jarvis can send one exact owner-chat Telegram message through the brokered adapter; broad Telegram sends and attachments remain gated.'
        : 'Separate Jarvis Telegram from Paperclip Concierge, then add allowlisted exact send adapter.',
      writes_enabled: certified(proofCounts.telegram_exact_send),
      execution_enabled: certified(proofCounts.telegram_exact_send),
      rollback_required: true,
    }),
    system({
      id: 'drive_onedrive_uploads',
      label: 'Drive and OneDrive list/upload',
      owner: 'Codex/Corex',
      day_range: '65-69',
      adapter_id: 'drive_onedrive_exact_upload',
      route: routeExecute,
      current_status: 'credential_required',
      exact_blocker: 'approved_folder_and_credential_scopes_missing',
      next_action: 'Inventory credentials and allowed folders, then prove list before upload.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: true,
    }),
    system({
      id: 'webhook_local_ping',
      label: 'Webhook local ping exact execution',
      owner: 'Codex/Corex',
      day_range: '70-72',
      adapter_id: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.webhook_local_ping) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.webhook_local_ping) ? null : 'webhook_local_ping_proof_missing',
      next_action: certified(proofCounts.webhook_local_ping)
        ? 'Keep public/external webhook execution disabled until an exact endpoint registry exists.'
        : 'Execute one local/internal webhook ping through Jarvis Bridge Session; do not create public webhooks.',
      writes_enabled: certified(proofCounts.webhook_local_ping),
      execution_enabled: certified(proofCounts.webhook_local_ping),
      rollback_required: true,
    }),
    system({
      id: 'scheduled_jobs',
      label: 'Scheduled jobs exact run-now',
      owner: 'Codex/Corex',
      day_range: '73-75',
      adapter_id: JARVIS_SCHEDULER_RUN_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.scheduler_run_now) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.scheduler_run_now) ? null : 'scheduler_auto_backup_run_now_proof_missing',
      next_action: certified(proofCounts.scheduler_run_now)
        ? 'Keep scheduler execution limited to auto_backup run-now; do not enable cleanup, webhook retry, or arbitrary scheduled jobs.'
        : 'Execute one exact auto_backup run-now through Jarvis Bridge Session with audit and rollback.',
      writes_enabled: certified(proofCounts.scheduler_run_now),
      execution_enabled: certified(proofCounts.scheduler_run_now),
      rollback_required: true,
    }),
    system({
      id: 'jarvis_daily_health_workflow',
      label: 'Jarvis daily health internal workflow',
      owner: 'Codex/Corex',
      day_range: '76-85',
      adapter_id: JARVIS_WORKFLOW_RUN_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.jarvis_workflow_run) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.jarvis_workflow_run) ? null : 'jarvis_daily_health_workflow_proof_missing',
      next_action: certified(proofCounts.jarvis_workflow_run)
        ? 'Keep workflow execution limited to daily_health internal snapshot until each external workflow step has its own adapter proof.'
        : 'Execute one exact daily_health internal workflow through Jarvis Bridge Session with audit and rollback.',
      writes_enabled: certified(proofCounts.jarvis_workflow_run),
      execution_enabled: certified(proofCounts.jarvis_workflow_run),
      rollback_required: true,
    }),
    system({
      id: 'agent_zero_internal_report_create',
      label: 'Agent Zero internal Mission Control report create',
      owner: 'Codex/Corex',
      day_range: '76-85',
      adapter_id: JARVIS_REPORT_CREATE_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.agent_zero_report_create) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.agent_zero_report_create) ? null : 'agent_zero_report_create_proof_missing',
      next_action: certified(proofCounts.agent_zero_report_create)
        ? 'Keep report creation internal to Mission Control; external delivery still requires separate exact delivery adapters.'
        : 'Execute one internal Agent Zero report create through Jarvis Bridge Session with audit and rollback.',
      writes_enabled: certified(proofCounts.agent_zero_report_create),
      execution_enabled: certified(proofCounts.agent_zero_report_create),
      rollback_required: true,
    }),
    system({
      id: 'mission_control_button_contract_cleanup',
      label: 'Mission Control button contract cleanup',
      owner: 'Codex/Corex',
      day_range: '76-80',
      adapter_id: null,
      route: '/api/bridge/button-contracts',
      current_status: 'certified',
      exact_blocker: null,
      next_action: 'Keep button contracts source-backed: every visible action must resolve to a real route, a disabled reason, or a Bridge-gated contract.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: false,
    }),
    system({
      id: 'openclaw_canonical_integration',
      label: 'OpenClock/OpenCloud/OpenClaw canonical integration',
      owner: 'Codex/Corex',
      day_range: '81-85',
      adapter_id: 'openclaw_canonical_read_adapter',
      route: '/api/bridge/agent-zero/full-go/openclaw-canonical-integration',
      current_status: 'certified',
      exact_blocker: null,
      next_action: 'Canonical runtime name is OpenClaw+; keep OpenCloud scoped to Build-Wiki and add write/request adapters only after exact proof.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: true,
    }),
    system({
      id: 'paperclip_concierge',
      label: 'Paperclip Concierge ECO CEO text and voice',
      owner: 'Codex/Corex',
      day_range: '86-93',
      adapter_id: 'paperclip_concierge',
      route: '/api/bridge/paperclip/concierge/answer',
      current_status: 'designer_gated',
      exact_blocker: 'mic_button_requires_dag_designer_approval_and_secure_context',
      next_action: 'Keep backend read-only; UI mic button waits for designer/DAG approval and HTTPS/localhost secure context.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: false,
    }),
    system({
      id: 'pi_dispatcher_execution_integration',
      label: 'Pi full-access Gateway recommendation to Jarvis execution',
      owner: 'Codex/Corex',
      day_range: '94',
      adapter_id: 'pi_recommendation_audit',
      route: '/api/bridge/pi/recommend',
      current_status: certified(proofCounts.pi_recommendation_recorded) ? 'certified' : 'bridge_gated',
      exact_blocker: certified(proofCounts.pi_recommendation_recorded) ? null : 'pi_recommendation_audit_proof_missing',
      next_action: certified(proofCounts.pi_recommendation_recorded)
        ? 'Keep Pi on the direct Gateway pipeline; Jarvis remains final authority for production-impacting execution.'
        : 'Record one Pi recommendation audit under active Jarvis Bridge Session; require Jarvis concurrence before production-impacting execution.',
      writes_enabled: false,
      execution_enabled: false,
      rollback_required: false,
    }),
    system({
      id: 'jarvis_self_modification_workflow',
      label: 'Jarvis controlled source modification workflow',
      owner: 'Codex/Corex',
      day_range: '95',
      adapter_id: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.jarvis_developer_workflow) ? 'certified' : 'adapter_ready_needs_proof',
      exact_blocker: certified(proofCounts.jarvis_developer_workflow) ? null : 'jarvis_developer_workflow_proof_missing',
      next_action: certified(proofCounts.jarvis_developer_workflow)
        ? 'Jarvis can create controlled Mission Control source-change request records with audit and rollback. Actual source edits, build, and deploy remain inside the developer workflow guardrails.'
        : 'Execute one controlled developer-workflow change request through the Jarvis execution router; do not modify source, credentials, or public exposure from the adapter.',
      writes_enabled: certified(proofCounts.jarvis_developer_workflow),
      execution_enabled: certified(proofCounts.jarvis_developer_workflow),
      rollback_required: true,
    }),
    system({
      id: 'end_to_end_company_workflow',
      label: 'End-to-end company workflow',
      owner: 'Jarvis',
      day_range: '96-100',
      adapter_id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
      route: routeExecute,
      current_status: certified(proofCounts.jarvis_full_go_workflow) ? 'certified' : 'planned',
      exact_blocker: certified(proofCounts.jarvis_full_go_workflow) ? null : 'dependent_adapters_not_certified',
      next_action: certified(proofCounts.jarvis_full_go_workflow)
        ? 'Jarvis can run a bounded ECO Full GO workflow across certified Mission Control adapters; credential-gated external systems stay listed separately.'
        : 'Run the bounded ECO Full GO workflow after the required certified adapter proofs exist.',
      writes_enabled: certified(proofCounts.jarvis_full_go_workflow),
      execution_enabled: certified(proofCounts.jarvis_full_go_workflow),
      rollback_required: true,
    }),
  ]
}

export function buildJarvisFullGoSystemsForProofCounts(proofCounts: ProofCounts) {
  return buildSystems(proofCounts)
}

export function buildJarvisFullGoDashboard() {
  const executionRouter = jarvisExecutionRouterStatus()
  const proofCounts = (executionRouter.proof_counts || {}) as ProofCounts
  const systems = buildSystems(proofCounts)
  const matrix = buildExecutionReadinessMatrix()
  const bridge = jarvisBridgeSessionStatus()
  const audit = jarvisAuditSummary()
  const certifiedSystems = systems.filter((item) => item.current_status === 'certified')
  const gatedSystems = systems.filter((item) => item.current_status !== 'certified')
  const credentialsMissing = systems.filter((item) => item.current_status === 'credential_required')
  const adapterReadyNeedsProof = systems.filter((item) => item.current_status === 'adapter_ready_needs_proof')

  const approximatePercent = approximateJarvisFullGoPercent(systems)
  const programStatus = jarvisFullGoProgramStatus(systems)

  return {
    route: 'bridge.agent-zero.full-go.dashboard',
    endpoint: '/api/bridge/agent-zero/full-go/dashboard',
    project_name: 'Jarvis Full Execution - 100-Day Plan to Mission Control Full GO',
    day: 1,
    day_focus: 'Establish Full GO command center',
    current_status: programStatus,
    approximate_percent_complete: approximatePercent,
    dashboard_active: true,
    owner_directive: 'Jarvis / Agent Zero must become the full owner-authorized Mission Control operator through exact-scope adapters, credential brokering, audit, rollback, and no secret exposure.',
    lane_owners: laneOwners,
    systems,
    summary: {
      total_systems: systems.length,
      certified_systems: certifiedSystems.length,
      gated_systems: gatedSystems.length,
      credentials_missing: credentialsMissing.length,
      adapter_ready_needs_proof: adapterReadyNeedsProof.length,
      writes_enabled_systems: systems.filter((item) => item.writes_enabled).length,
      execution_enabled_systems: systems.filter((item) => item.execution_enabled).length,
      rollback_required_systems: systems.filter((item) => item.rollback_required).length,
    },
    certified_adapters: certifiedSystems.map((item) => ({
      id: item.id,
      adapter_id: item.adapter_id,
      route: item.route,
      next_action: item.next_action,
    })),
    remaining_gated_systems: gatedSystems.map((item) => ({
      id: item.id,
      status: item.current_status,
      exact_blocker: item.exact_blocker,
      next_action: item.next_action,
    })),
    credentials_missing_by_name_only: credentialsMissing.map((item) => item.id),
    adapter_owner_assignments: systems.map((item) => ({
      system_id: item.id,
      owner: item.owner,
      day_range: item.day_range,
      adapter_id: item.adapter_id,
    })),
    bridge_session: {
      state: bridge.state,
      active_session_id: bridge.active_session_id,
      allowed_scopes: bridge.allowed_scopes,
      exact_blocker: bridge.exact_blocker,
      credential_values_exposed: bridge.credential_values_exposed,
    },
    execution_router: {
      route: executionRouter.route,
      execution_enabled: executionRouter.execution_enabled,
      external_writes_enabled: executionRouter.external_writes_enabled,
      proof_counts: executionRouter.proof_counts,
      credential_values_exposed: executionRouter.credential_values_exposed,
    },
    readiness_matrix_summary: matrix.summary,
    audit_summary: audit,
    hard_stops: JARVIS_HARD_STOP_REASONS,
    service_contract: {
      fake_success_allowed: false,
      raw_secrets_allowed: false,
      env_values_returned: false,
      broad_connector_execution_allowed: false,
      production_static_patch_allowed: false,
    },
    mission_control_service_ownership: currentMissionControlServiceOwnership(),
    today_result: 'Jarvis Full GO command center exists with blockers, owners, certified adapters, and remaining systems tracked.',
    next_day: {
      day: 2,
      focus: 'Normalize Jarvis capability state',
      required_result: 'Jarvis status and certification routes show the honest current capability map.',
    },
    adapter_checklist_endpoint: '/api/bridge/agent-zero/full-go/adapter-checklist',
    backlog_endpoint: '/api/bridge/agent-zero/full-go/backlog',
    readiness_endpoint: '/api/bridge/agent-zero/full-go/readiness',
    credential_plan_endpoint: '/api/bridge/agent-zero/full-go/credential-plan',
    credential_values_exposed: false,
    no_secrets_exposed: true,
    generated_at: new Date().toISOString(),
  }
}

export function buildJarvisFullGoAdapterChecklist() {
  return {
    route: 'bridge.agent-zero.full-go.adapter-checklist',
    endpoint: '/api/bridge/agent-zero/full-go/adapter-checklist',
    status: 'READY',
    day: 3,
    checklist_version: 'full-go-adapter-contract-v1',
    applies_to: 'all Jarvis exact-scope execution adapters',
    required_items: universalAdapterChecklist,
    required_output_fields: [
      'exact_action_name',
      'exact_route',
      'exact_scope',
      'input_schema',
      'credential_policy',
      'bridge_session_behavior',
      'audit_behavior',
      'rollback_behavior',
      'route_smoke',
      'production_build_restart_result',
      'new_jarvis_capability',
      'remaining_gated_systems',
      'no_secret_proof',
      'env_diff_check',
    ],
    fake_success_allowed: false,
    broad_connector_execution_allowed: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisFullGoBacklog() {
  const dashboard = buildJarvisFullGoDashboard()
  const remaining = dashboard.systems.filter((item) => item.current_status !== 'certified')
  return {
    route: 'bridge.agent-zero.full-go.backlog',
    endpoint: '/api/bridge/agent-zero/full-go/backlog',
    status: 'ACTIVE',
    day: 4,
    current_program_status: dashboard.current_status,
    total_remaining: remaining.length,
    backlog: remaining.map((item) => ({
      id: item.id,
      label: item.label,
      owner: item.owner,
      day_range: item.day_range,
      adapter_id: item.adapter_id,
      route: item.route,
      current_status: item.current_status,
      exact_blocker: item.exact_blocker,
      next_action: item.next_action,
      rollback_required: item.rollback_required,
    })),
    grouped_counts: {
      credential_required: remaining.filter((item) => item.current_status === 'credential_required').length,
      blocked: remaining.filter((item) => item.current_status === 'blocked').length,
      bridge_gated: remaining.filter((item) => item.current_status === 'bridge_gated').length,
      designer_gated: remaining.filter((item) => item.current_status === 'designer_gated').length,
      planned: remaining.filter((item) => item.current_status === 'planned').length,
      adapter_ready_needs_proof: remaining.filter((item) => item.current_status === 'adapter_ready_needs_proof').length,
    },
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisFullGoReadiness() {
  const dashboard = buildJarvisFullGoDashboard()
  const systems = dashboard.systems
  const adaptersLive = systems.filter((item) => item.current_status === 'certified')
  const adaptersReady = systems.filter((item) => item.current_status === 'adapter_ready_needs_proof')
  const blockers = systems.filter((item) => item.current_status !== 'certified')
  const credentialsMissing = systems.filter((item) => item.current_status === 'credential_required')
  const ownerRequestedLanes = systems.map((item) => ({
    id: item.id,
    label: item.label,
    live_status: item.current_status,
    rollout_state: item.current_status === 'certified' ? 'certified_exact_scope_only' : item.current_status,
    execution_enabled: item.execution_enabled,
    writes_enabled: item.writes_enabled,
    exact_blocker: item.exact_blocker,
    remaining_scope_note: item.next_action,
  }))
  const remainingFullGoGates = blockers.map((item) => ({
    id: item.id,
    status: item.current_status,
    exact_blocker: item.exact_blocker,
    next_action: item.next_action,
  }))

  return {
    route: 'bridge.agent-zero.full-go.readiness',
    endpoint: '/api/bridge/agent-zero/full-go/readiness',
    status: dashboard.current_status,
    day: 5,
    approximate_percent_complete: dashboard.approximate_percent_complete,
    computed_adapter_percent_complete: Math.round((adaptersLive.length / systems.length) * 100),
    adapters_live: adaptersLive.map((item) => item.id),
    adapters_ready_needing_proof: adaptersReady.map((item) => item.id),
    blockers: blockers.map((item) => ({
      id: item.id,
      status: item.current_status,
      exact_blocker: item.exact_blocker,
      next_action: item.next_action,
    })),
    credentials_missing_by_name_only: credentialsMissing.map((item) => item.id),
    hard_stops: dashboard.hard_stops,
    next_required_owner_actions: credentialsMissing.map((item) => ({
      system_id: item.id,
      blocker: item.exact_blocker,
      owner_action_type: 'credential_injection_or_account_connection',
      value_exposed: false,
    })),
    reconciliation_packet: {
      owner_requested_lanes: ownerRequestedLanes,
      openclaw_identity_boundary: {
        is_jarvis: false,
        role: 'supporting_runtime_tool_layer_only',
      },
      canonical_execution_route: routeExecute,
    },
    remaining_full_go_gates: remainingFullGoGates,
    no_go_claim: blockers.length > 0,
    full_go_allowed: blockers.length === 0,
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisFullGoCredentialPlan(): { route: string; endpoint: string; status: string; day: number; plans: JarvisFullGoCredentialPlan[]; hard_stop_required_before_injection: true; credential_values_exposed: false; no_secrets_exposed: true } {
  const paperclipPresence = envNamePresence('PAPERCLIP_API_KEY')
  const n8nBasePresence = envNamePresence('N8N_BASE_URL')
  const n8nKeyPresence = envNamePresence('N8N_API_KEY')
  return {
    route: 'bridge.agent-zero.full-go.credential-plan',
    endpoint: '/api/bridge/agent-zero/full-go/credential-plan',
    status: 'PREPARED_VALUES_NOT_INJECTED',
    day: 6,
    plans: [
      {
        id: 'paperclip_api_key',
        credential_names: ['PAPERCLIP_API_KEY'],
        target_runtime: 'mission_control',
        owner_hard_stop: true,
        value_required: paperclipPresence === 'missing',
        injection_status: paperclipPresence === 'present' ? 'present_by_name' : 'prepared_not_injected',
        runtime_presence_by_name: {
          PAPERCLIP_API_KEY: paperclipPresence,
        },
        verification: [
          'Confirm Mission Control runtime secret load path.',
          'Inject value only through approved owner credential step.',
          'Restart mission-control.service.',
          'Verify PAPERCLIP_API_KEY presence by name only.',
          'Run paperclip_eco_task_write against one existing ECO issue.',
        ],
        restart_required: true,
        no_secret_output: true,
      },
      {
        id: 'n8n_credentials',
        credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'],
        target_runtime: 'mission_control',
        owner_hard_stop: true,
        value_required: n8nBasePresence === 'missing' || n8nKeyPresence === 'missing',
        injection_status: n8nBasePresence === 'present' && n8nKeyPresence === 'present' ? 'present_by_name' : 'prepared_not_injected',
        runtime_presence_by_name: {
          N8N_BASE_URL: n8nBasePresence,
          N8N_API_KEY: n8nKeyPresence,
        },
        verification: [
          'Verify n8n base URL reachability.',
          'Verify N8N_API_KEY presence by name only.',
          'Run n8n_workflow_list read-only adapter.',
          'Do not activate or run workflows.',
        ],
        restart_required: true,
        no_secret_output: true,
      },
      {
        id: 'zapier_credentials',
        credential_names: ['ZAPIER_MCP_URL', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY'],
        target_runtime: 'mission_control',
        owner_hard_stop: true,
        value_required: true,
        injection_status: 'not_ready',
        runtime_presence_by_name: {
          ZAPIER_MCP_URL: envNamePresence('ZAPIER_MCP_URL'),
          ZAPIER_ACCESS_TOKEN: envNamePresence('ZAPIER_ACCESS_TOKEN'),
          ZAPIER_API_KEY: envNamePresence('ZAPIER_API_KEY'),
        },
        exact_adapter_after_injection: 'zapier_exact_action_execute',
        exact_action_after_injection: 'zapier.connection_probe',
        required_bridge_session_scope: 'zapier_exact_action_connection_probe',
        broad_execution_remains_blocked: true,
        verification: [
          'Select one exact safe Zapier action before credential use.',
          'Prepare broker path without broad execution.',
          'Verify credential availability by name only.',
        ],
        restart_required: true,
        no_secret_output: true,
      },
      {
        id: 'drive_onedrive_approved_folder_scope',
        credential_names: ['GOOGLE_DRIVE_ACCESS_TOKEN', 'GOOGLE_DRIVE_APPROVED_FOLDER_ID', 'GOOGLE_DRIVE_APPROVED_FOLDER_NAME'],
        approved_scope_names: ['GOOGLE_DRIVE_APPROVED_FOLDER_ID', 'GOOGLE_DRIVE_APPROVED_FOLDER_NAME'],
        target_runtime: 'mission_control',
        owner_hard_stop: true,
        value_required: true,
        injection_status: 'not_ready',
        runtime_presence_by_name: {
          GOOGLE_DRIVE_ACCESS_TOKEN: envNamePresence('GOOGLE_DRIVE_ACCESS_TOKEN'),
          GOOGLE_DRIVE_APPROVED_FOLDER_ID: envNamePresence('GOOGLE_DRIVE_APPROVED_FOLDER_ID'),
          GOOGLE_DRIVE_APPROVED_FOLDER_NAME: envNamePresence('GOOGLE_DRIVE_APPROVED_FOLDER_NAME'),
        },
        exact_adapter_after_injection: 'drive_onedrive_exact_upload',
        exact_action_after_injection: 'drive_onedrive.folder_list',
        required_bridge_session_scope: 'drive_onedrive_approved_folder_upload',
        broad_execution_remains_blocked: true,
        verification: [
          'Verify approved folder names by name only.',
          'Run folder list before upload.',
          'Keep upload exact-scope and rollback-recorded.',
        ],
        restart_required: true,
        no_secret_output: true,
      },
    ],
    hard_stop_required_before_injection: true,
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export async function buildJarvisN8nAccountReadiness(): Promise<JarvisN8nAccountReadiness> {
  const basePresence = envNamePresence('N8N_BASE_URL')
  const keyPresence = envNamePresence('N8N_API_KEY')
  const configuredBase = configuredN8nBaseUrl()
  const configuredProbe = configuredBase ? await probeHttpStatus(`${configuredBase}/healthz`) : { reachable: false, status: null }
  const localDefaultProbe = await probeHttpStatus('http://127.0.0.1:5678/healthz')

  const exactBlocker = basePresence === 'missing'
    ? 'n8n_base_url_required'
    : keyPresence === 'missing'
      ? 'n8n_api_key_required'
      : configuredProbe.reachable
        ? null
        : 'n8n_service_down_or_unreachable'

  return {
    route: 'bridge.agent-zero.full-go.n8n-readiness',
    endpoint: '/api/bridge/agent-zero/full-go/n8n-readiness',
    day: 16,
    status: exactBlocker === null ? 'ready_for_workflow_list' : exactBlocker === 'n8n_service_down_or_unreachable' ? 'service_down' : 'credential_required',
    n8n_base_url: basePresence,
    n8n_api_key: keyPresence,
    base_url_value_exposed: false,
    api_key_value_exposed: false,
    configured_base_reachable: configuredProbe.reachable,
    configured_base_http_status: configuredProbe.status,
    local_default_probe_reachable: localDefaultProbe.reachable,
    local_default_probe_http_status: localDefaultProbe.status,
    exact_blocker: exactBlocker,
    next_action: exactBlocker === null
      ? 'Run n8n_workflow_list through /api/bridge/agent-zero/execute; do not activate or execute workflows.'
      : exactBlocker === 'n8n_base_url_required' || exactBlocker === 'n8n_api_key_required'
        ? 'Stop for owner-approved credential injection of N8N_BASE_URL/N8N_API_KEY; do not modify .env automatically.'
        : 'Repair n8n service reachability before workflow listing.',
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisZapierReadiness(): JarvisZapierReadiness {
  const inventory = buildPaperclipGatewayInventory()
  const credentialNames = {
    ZAPIER_API_KEY: envNamePresence('ZAPIER_API_KEY'),
    ZAPIER_NLA_API_KEY: envNamePresence('ZAPIER_NLA_API_KEY'),
    ZAPIER_MCP_URL: envNamePresence('ZAPIER_MCP_URL'),
  }
  const credentialPresent = Object.values(credentialNames).some((value) => value === 'present')
  const visible = Boolean(inventory.zapier.visible)
  return {
    route: 'bridge.agent-zero.full-go.zapier-readiness',
    endpoint: '/api/bridge/agent-zero/full-go/zapier-readiness',
    day: 26,
    status: visible
      ? credentialPresent
        ? 'configured_but_bridge_gated'
        : 'visible_credential_gated'
      : 'not_registered',
    visible_in_gateway: visible,
    credential_names: credentialNames,
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    exact_blockers: visible
      ? credentialPresent
        ? ['bridge_session_required', 'exact_action_not_selected', 'zapier_execution_adapter_not_certified']
        : ['credential_required', 'adapter_missing', 'bridge_session_required']
      : ['not_registered_in_gateway'],
    allowed_next_action: visible
      ? 'Select one safe exact Zapier action, then build zapier_exact_action_execute with dry-run/validation before any external execution.'
      : 'Register Zapier in Gateway inventory before selecting an exact action.',
    forbidden_actions: [
      'broad Zapier execution',
      'Instagram/social posting without exact scope',
      'Zap creation',
      'credential printing',
      'workflow activation outside exact adapter',
    ],
    no_secrets_exposed: true,
  }
}

export function buildJarvisProviderModelReadiness(): JarvisProviderModelReadiness {
  const executionRouter = jarvisExecutionRouterStatus()
  const proofCounts = (executionRouter.proof_counts || {}) as ProofCounts
  const ollamaCertified = certified(proofCounts.gateway_ollama_local_model_execute)
  const providerNames = Array.from(new Set([...MODEL_CATALOG.map((model) => model.provider), 'openrouter'])).sort()
  const credentialNameMap: Record<string, Record<string, 'present' | 'missing' | 'not_required'>> = {
    anthropic: { ANTHROPIC_API_KEY: envNamePresence('ANTHROPIC_API_KEY'), CLAUDE_API_KEY: envNamePresence('CLAUDE_API_KEY') },
    openai: { OPENAI_API_KEY: envNamePresence('OPENAI_API_KEY'), API_KEY_OPENAI: envNamePresence('API_KEY_OPENAI') },
    google: {
      GOOGLE_API_KEY: envNamePresence('GOOGLE_API_KEY'),
      GEMINI_API_KEY: envNamePresence('GEMINI_API_KEY'),
      GOOGLE_GENERATIVE_AI_API_KEY: envNamePresence('GOOGLE_GENERATIVE_AI_API_KEY'),
    },
    openrouter: { OPENROUTER_API_KEY: envNamePresence('OPENROUTER_API_KEY') },
    ollama: {
      local_service: 'not_required',
      OLLAMA_HOST: envNamePresence('OLLAMA_HOST'),
      OLLAMA_BASE_URL: envNamePresence('OLLAMA_BASE_URL'),
    },
    nvidia: { NVIDIA_API_KEY: envNamePresence('NVIDIA_API_KEY') },
    groq: { GROQ_API_KEY: envNamePresence('GROQ_API_KEY') },
    xai: { XAI_API_KEY: envNamePresence('XAI_API_KEY') },
    moonshot: { MOONSHOT_API_KEY: envNamePresence('MOONSHOT_API_KEY') },
    venice: { VENICE_API_KEY: envNamePresence('VENICE_API_KEY') },
    minimax: { MINIMAX_API_KEY: envNamePresence('MINIMAX_API_KEY') },
  }

  return {
    route: 'bridge.agent-zero.full-go.provider-model-readiness',
    endpoint: '/api/bridge/agent-zero/full-go/provider-model-readiness',
    day_range: '34-42',
    status: ollamaCertified ? 'ollama_local_certified_external_providers_gated' : 'blocked_until_token_governor_proven',
    model_count: MODEL_CATALOG.length,
    providers: providerNames.map((provider) => ({
      provider,
      model_count: MODEL_CATALOG.filter((model) => model.provider === provider).length,
      credential_names: credentialNameMap[provider] || {},
      execution_enabled: provider === 'ollama' && ollamaCertified,
      exact_blocker: provider === 'ollama'
        ? ollamaCertified ? null : 'local_model_service_health_not_proven'
        : 'external_provider_credentials_and_cost_governor_proof_required',
    })),
    token_governor: TOKEN_GOVERNOR_POLICY,
    execution_enabled: ollamaCertified,
    writes_enabled: false,
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisFullGoOperationalCertification() {
  const dashboard = buildJarvisFullGoDashboard()
  const readiness = buildJarvisFullGoReadiness()
  const systemsJarvisCanExecuteNow = dashboard.systems.filter((item) => item.current_status === 'certified' && item.execution_enabled)
  const ownerHardStopBlockers = readiness.remaining_full_go_gates.filter((item) => item.status === 'credential_required' || item.status === 'blocked')

  return {
    route: 'bridge.agent-zero.full-go.operational-certification',
    endpoint: '/api/bridge/agent-zero/full-go/operational-certification',
    status: dashboard.current_status,
    current_percent_complete: readiness.computed_adapter_percent_complete,
    jarvis_ready_to_operate: systemsJarvisCanExecuteNow.length > 0,
    strict_day_100_full_go: readiness.full_go_allowed,
    systems_jarvis_can_execute_now: systemsJarvisCanExecuteNow,
    owner_hard_stop_blockers: ownerHardStopBlockers,
    protected_boundaries: {
      raw_secrets_exposed: false,
      credential_values_exposed: false,
      public_exposure_created: false,
      broad_connector_execution_allowed: false,
      rollback_required_for_mutations: true,
    },
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildJarvisFullGoCapabilityState() {
  const dashboard = buildJarvisFullGoDashboard()
  return {
    route: dashboard.route,
    endpoint: dashboard.endpoint,
    current_status: dashboard.current_status,
    approximate_percent_complete: dashboard.approximate_percent_complete,
    summary: dashboard.summary,
    certified_adapters: dashboard.certified_adapters,
    remaining_gated_systems: dashboard.remaining_gated_systems,
    credentials_missing_by_name_only: dashboard.credentials_missing_by_name_only,
    hard_stops: dashboard.hard_stops,
    no_secrets_exposed: dashboard.no_secrets_exposed,
    credential_values_exposed: dashboard.credential_values_exposed,
  }
}
