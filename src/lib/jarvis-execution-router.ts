import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { createApprovalRequest, resolveApprovalRequest } from '@/lib/approval-requests'
import {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_RUN_NOW_ACTION,
  BUILDWIKI_TARGET_SERVICE,
  dispatchBuildwikiRunNow,
  getBuildwikiStatus,
  recordBuildwikiAudit,
} from '@/lib/buildwiki-runner'
import { createAgentZeroObsidianNote } from '@/lib/agent-zero-obsidian-adapter'
import { rememberAgentZeroOwnerPreference } from '@/lib/agent-zero-mempalace-adapter'
import { config } from '@/lib/config'
import { listJarvisAudit, recordJarvisAudit } from '@/lib/jarvis-audit'
import { activeJarvisBridgeSession } from '@/lib/jarvis-bridge-session'
import {
  executeJarvisMcpMemoryWriteProbe,
  JARVIS_MCP_MEMORY_OPERATION,
  JARVIS_MCP_MEMORY_SERVER_ID,
  JARVIS_MCP_MEMORY_TARGET,
  JARVIS_MCP_MEMORY_WRITE_ACTION,
  JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
} from '@/lib/jarvis-mcp-memory-write-adapter'
import { JARVIS_ACTOR_ID } from '@/lib/jarvis-owner-operator-policy'
import {
  PAPERCLIP_ECO_COMMENT_ACTION,
  executePaperclipEcoIssueCommentWrite,
} from '@/lib/paperclip-eco-write-adapter'
import {
  executePaperclipCompanyTeamBootstrap,
  PAPERCLIP_COMPANY_BOOTSTRAP_ACTION,
  PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
  PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION,
  PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE,
  PAPERCLIP_COMPANY_BOOTSTRAP_SESSION_SCOPE,
  PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION,
} from '@/lib/paperclip-company-bootstrap-adapter'
import {
  executeJarvisSchedulerRunNow,
  JARVIS_SCHEDULER_RUN_ACTION,
  JARVIS_SCHEDULER_RUN_ADAPTER_ID,
  JARVIS_SCHEDULER_RUN_SESSION_SCOPE,
  JARVIS_SCHEDULER_RUN_TASK_ID,
} from '@/lib/jarvis-scheduler-run-adapter'
import {
  executeJarvisWorkflowRun,
  JARVIS_WORKFLOW_RUN_ACTION,
  JARVIS_WORKFLOW_RUN_ADAPTER_ID,
  JARVIS_WORKFLOW_RUN_SESSION_SCOPE,
  JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
} from '@/lib/jarvis-workflow-run-adapter'
import { annotateJarvisWorkflowRunProof } from '@/lib/jarvis-workflows'
import {
  executeJarvisReportCreate,
  JARVIS_REPORT_CREATE_ACTION,
  JARVIS_REPORT_CREATE_ADAPTER_ID,
  JARVIS_REPORT_CREATE_SESSION_SCOPE,
} from '@/lib/jarvis-report-create-adapter'
import {
  executeJarvisAgentMailDraftCreate,
  JARVIS_AGENTMAIL_DRAFT_ACTION,
  JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
  JARVIS_AGENTMAIL_DRAFT_SESSION_SCOPE,
} from '@/lib/jarvis-agentmail-draft-adapter'
import {
  executeJarvisWebhookLocalPing,
  JARVIS_WEBHOOK_LOCAL_PING_ACTION,
  JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
  JARVIS_WEBHOOK_LOCAL_PING_SESSION_SCOPE,
} from '@/lib/jarvis-webhook-local-ping-adapter'
import {
  executeJarvisOllamaLocalModel,
  JARVIS_OLLAMA_LOCAL_MODEL_ACTION,
  JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
  JARVIS_OLLAMA_LOCAL_MODEL_NAME,
  JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE,
} from '@/lib/jarvis-ollama-local-model-adapter'
import {
  executeJarvisProviderModelExecution,
  JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
  JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
  JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE,
  providerModelExactScope,
} from '@/lib/jarvis-provider-model-execution-adapter'
import { readJarvisLegacyProofCounts } from '@/lib/jarvis-legacy-proof-evidence'
import {
  executeJarvisBuildwikiResultIngest,
  JARVIS_BUILDWIKI_RESULT_INGEST_ACTION,
  JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
  JARVIS_BUILDWIKI_RESULT_INGEST_SESSION_SCOPE,
} from '@/lib/jarvis-buildwiki-result-ingest-adapter'
import {
  executeJarvisObsidianStructuredProjectNote,
  JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
  JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
  JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_SESSION_SCOPE,
} from '@/lib/jarvis-obsidian-structured-project-note-adapter'
import {
  executeJarvisMemPalaceCategorizedMemory,
  JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
  JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
  JARVIS_MEMPALACE_CATEGORIZED_MEMORY_SESSION_SCOPE,
} from '@/lib/jarvis-mempalace-categorized-memory-adapter'
import {
  executeJarvisDeveloperWorkflowChangeRequest,
  JARVIS_DEVELOPER_WORKFLOW_ACTION,
  JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
  JARVIS_DEVELOPER_WORKFLOW_SESSION_SCOPE,
} from '@/lib/jarvis-developer-workflow-adapter'
import {
  executeJarvisFullGoWorkflow,
  JARVIS_FULL_GO_WORKFLOW_ACTION,
  JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
  JARVIS_FULL_GO_WORKFLOW_ID,
  JARVIS_FULL_GO_WORKFLOW_SESSION_SCOPE,
} from '@/lib/jarvis-full-go-workflow-adapter'
import {
  executeJarvisTelegramOwnerMessageSend,
  JARVIS_TELEGRAM_DELIVERY_ACTION,
  JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
  JARVIS_TELEGRAM_DELIVERY_SESSION_SCOPE,
} from '@/lib/jarvis-telegram-delivery-adapter'
import {
  executeJarvisZapierExactAction,
  JARVIS_ZAPIER_EXACT_ACTION,
  JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID,
  JARVIS_ZAPIER_EXACT_ACTION_SESSION_SCOPE,
} from '@/lib/jarvis-zapier-exact-action-adapter'
import {
  executeJarvisDriveOneDriveExactAction,
  JARVIS_DRIVE_ONEDRIVE_FOLDER_LIST_ACTION,
  JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION,
  JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
  JARVIS_DRIVE_ONEDRIVE_UPLOAD_SESSION_SCOPE,
} from '@/lib/jarvis-drive-onedrive-exact-adapter'
import { ensureAgentRoutingVisibleTask } from '@/lib/agent-routing-lines'
import {
  PUBLIC_WEBPAGE_READ_ACTION,
  PUBLIC_WEBPAGE_READ_ADAPTER_ID,
  YOUTUBE_TRANSCRIPT_ACTION,
  YOUTUBE_TRANSCRIPT_ADAPTER_ID,
  readPublicWebpage,
  readYouTubeTranscript,
} from '@/lib/public-research'

export type JarvisExecutionInput = {
  adapter_id?: string
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
  idempotency_key?: string
  actor?: string
}

export type JarvisExecutionRollback = {
  id: string
  at: string
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  idempotency_key: string | null
  audit_hash: string
  external_state_changed: boolean
  internal_state_changed: boolean
  rollback_command: string
}

type PaperclipEcoDryRun = {
  id: string
  at: string
  company_scope: 'ECO'
  operation: 'task_dry_run'
  title: string
  description: string
  assignee: string | null
  issue_key: string | null
  status: 'dry_run_recorded'
  external_write_called: false
  paperclip_task_created: false
  bridge_required_for_real_write: true
  audit_hash: string
}

type PaperclipEcoIssueCommentWriteProof = {
  id: string
  at: string
  operation: 'issue_comment_create'
  action: 'paperclip.eco_issue_comment.create'
  company_scope: 'ECO'
  issue_identifier: string | null
  issue_id: string | null
  comment_id: string | null
  comment_created: boolean
  issue_modified: boolean
  rollback_strategy: 'delete_if_queued_else_compensating_comment' | 'none'
  exact_blocker: string | null
  credential_values_exposed: false
  raw_comment_body_returned: false
  tok_touched: false
  audit_hash: string
}

type N8nWorkflowListProbe = {
  id: string
  at: string
  operation: 'workflow_list_readiness'
  base_url_present: boolean
  api_key_present: boolean
  base_reachable: boolean
  base_status: number | null
  workflow_list_attempted: boolean
  workflow_count: number | null
  workflow_activation_enabled: false
  workflow_execution_enabled: false
  public_webhook_created: false
  credential_values_exposed: false
  exact_blocker: string | null
  audit_hash: string
}

type ObsidianWriteProof = {
  id: string
  at: string
  operation: 'create_note' | 'structured_project_note_create'
  action: 'obsidian.note.create' | 'obsidian.note.structured_project_create'
  relative_path: string | null
  title: string
  created: boolean
  credential_values_exposed: false
  direct_filesystem_exposed: false
  raw_content_returned: false
  rollback_available: boolean
  exact_blocker: string | null
  audit_hash: string
}

type MemPalaceWriteProof = {
  id: string
  at: string
  operation: 'remember_owner_preference' | 'categorized_memory_write'
  action: 'mempalace.memory.remember_owner_preference' | 'mempalace.memory.categorized_summary_write'
  memory_id: string | null
  memory_key: string | null
  created: boolean
  credential_values_exposed: false
  raw_records_returned: false
  direct_filesystem_exposed: false
  rollback_available: boolean
  exact_blocker: string | null
  audit_hash: string
}

type McpMemoryWriteProof = {
  id: string
  at: string
  operation: 'create_and_delete_test_entity'
  action: 'mcp.memory.write_probe'
  server_id: 'memory'
  entity_name: string | null
  create_succeeded: boolean
  rollback_succeeded: boolean
  final_entity_present: boolean
  credential_values_exposed: false
  raw_tool_output_returned: false
  proof_graph_path_exposed: false
  exact_blocker: string | null
  audit_hash: string
}

export type JarvisExecutionResult = {
  ok: boolean
  route: 'bridge.agent-zero.execute'
  mode: string
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  execution_enabled: boolean
  writes_enabled: boolean
  external_writes_enabled: boolean
  credential_values_exposed: false
  hard_stop_enforced: true
  audit_record_written: boolean
  audit_hash: string | null
  rollback_id: string | null
  rollback_command: string | null
  exact_blocker: string | null
  result?: Record<string, unknown>
}

const rollbackPath = join(config.dataDir, 'jarvis-execution-rollbacks.json')
const paperclipDryRunPath = join(config.dataDir, 'paperclip-eco-dry-run-writes.json')
const paperclipIssueCommentWriteProofPath = join(config.dataDir, 'paperclip-eco-issue-comment-write-proofs.json')
const n8nProbePath = join(config.dataDir, 'n8n-workflow-list-proofs.json')
const obsidianWriteProofPath = join(config.dataDir, 'obsidian-write-proofs.json')
const mempalaceWriteProofPath = join(config.dataDir, 'mempalace-write-proofs.json')
const mcpMemoryWriteProofPath = join(config.dataDir, 'mcp-memory-write-proofs.json')

const blockedAdapters = [
  { id: 'zapier_exact_action', exact_blocker: 'zapier_credential_required' },
  { id: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID, exact_blocker: 'zapier_credential_required' },
  { id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID, exact_blocker: 'approved_folder_and_credential_scopes_missing' },
  { id: 'delivery_connectors', exact_blocker: 'delivery_adapter_not_proven' },
] as const

function readRollbacks(): JarvisExecutionRollback[] {
  try {
    const parsed = JSON.parse(readFileSync(rollbackPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRollbacks(rows: JarvisExecutionRollback[]) {
  mkdirSync(dirname(rollbackPath), { recursive: true })
  writeFileSync(rollbackPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readPaperclipDryRuns(): PaperclipEcoDryRun[] {
  try {
    const parsed = JSON.parse(readFileSync(paperclipDryRunPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePaperclipDryRuns(rows: PaperclipEcoDryRun[]) {
  mkdirSync(dirname(paperclipDryRunPath), { recursive: true })
  writeFileSync(paperclipDryRunPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readPaperclipIssueCommentWriteProofs(): PaperclipEcoIssueCommentWriteProof[] {
  try {
    const parsed = JSON.parse(readFileSync(paperclipIssueCommentWriteProofPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePaperclipIssueCommentWriteProofs(rows: PaperclipEcoIssueCommentWriteProof[]) {
  mkdirSync(dirname(paperclipIssueCommentWriteProofPath), { recursive: true })
  writeFileSync(paperclipIssueCommentWriteProofPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readN8nProbes(): N8nWorkflowListProbe[] {
  try {
    const parsed = JSON.parse(readFileSync(n8nProbePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeN8nProbes(rows: N8nWorkflowListProbe[]) {
  mkdirSync(dirname(n8nProbePath), { recursive: true })
  writeFileSync(n8nProbePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readObsidianWriteProofs(): ObsidianWriteProof[] {
  try {
    const parsed = JSON.parse(readFileSync(obsidianWriteProofPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeObsidianWriteProofs(rows: ObsidianWriteProof[]) {
  mkdirSync(dirname(obsidianWriteProofPath), { recursive: true })
  writeFileSync(obsidianWriteProofPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readMemPalaceWriteProofs(): MemPalaceWriteProof[] {
  try {
    const parsed = JSON.parse(readFileSync(mempalaceWriteProofPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeMemPalaceWriteProofs(rows: MemPalaceWriteProof[]) {
  mkdirSync(dirname(mempalaceWriteProofPath), { recursive: true })
  writeFileSync(mempalaceWriteProofPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function readMcpMemoryWriteProofs(): McpMemoryWriteProof[] {
  try {
    const parsed = JSON.parse(readFileSync(mcpMemoryWriteProofPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeMcpMemoryWriteProofs(rows: McpMemoryWriteProof[]) {
  mkdirSync(dirname(mcpMemoryWriteProofPath), { recursive: true })
  writeFileSync(mcpMemoryWriteProofPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function envPresent(name: string) {
  return Boolean((process.env[name] || '').trim())
}

function n8nBaseUrl() {
  return (process.env.N8N_BASE_URL || '').replace(/\/+$/, '')
}

async function probeN8nBase(baseUrl: string) {
  if (!baseUrl) return { reachable: false, status: null as number | null, error: 'N8N_BASE_URL_missing' }
  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return { reachable: response.ok, status: response.status, error: null as string | null }
  } catch (error) {
    return {
      reachable: false,
      status: null as number | null,
      error: error instanceof Error ? error.message : 'n8n_health_probe_failed',
    }
  }
}

function sanitizeWorkflow(raw: unknown) {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    id: typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : null,
    name: typeof row.name === 'string' ? row.name.slice(0, 160) : null,
    active: typeof row.active === 'boolean' ? row.active : null,
  }
}

async function listN8nWorkflows(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: 'GET',
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        workflows: [] as ReturnType<typeof sanitizeWorkflow>[],
        exact_blocker: response.status === 401 || response.status === 403 ? 'credential_required' : 'n8n_workflow_list_unavailable',
      }
    }
    const parsed = await response.json().catch(() => null)
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown> | null)?.data)
        ? (parsed as { data: unknown[] }).data
        : []
    return {
      ok: true,
      status: response.status,
      workflows: rows.map(sanitizeWorkflow).slice(0, 100),
      exact_blocker: null,
    }
  } catch {
    return {
      ok: false,
      status: null as number | null,
      workflows: [] as ReturnType<typeof sanitizeWorkflow>[],
      exact_blocker: 'n8n_workflow_list_unavailable',
    }
  }
}

function safeString(value: unknown) {
  return JSON.stringify(value || {}).toLowerCase()
}

function hardStopReason(input: JarvisExecutionInput) {
  const scope = normalizeScope(input.scope)
  const exactMcpMemoryWriteProbe = (
    input.adapter_id === JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID &&
    input.action === JARVIS_MCP_MEMORY_WRITE_ACTION &&
    scope.server_id === JARVIS_MCP_MEMORY_SERVER_ID &&
    scope.operation === JARVIS_MCP_MEMORY_OPERATION &&
    scope.target === JARVIS_MCP_MEMORY_TARGET
  )
  const exactOllamaLocalModelExecution = (
    input.adapter_id === JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID &&
    input.action === JARVIS_OLLAMA_LOCAL_MODEL_ACTION &&
    scope.provider === 'ollama' &&
    scope.operation === 'local_generate' &&
    scope.model === JARVIS_OLLAMA_LOCAL_MODEL_NAME
  )
  const exactProviderModelExecution = (
    input.adapter_id === JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID &&
    input.action === JARVIS_PROVIDER_MODEL_EXECUTION_ACTION &&
    scope.operation === 'chat_completion' &&
    typeof scope.provider === 'string' &&
    typeof scope.model === 'string' &&
    typeof scope.exact_scope === 'string'
  )
  const exactDriveApprovedFolderUpload = (
    input.adapter_id === JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID &&
    input.action === JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION &&
    scope.connector === 'drive_onedrive' &&
    scope.operation === 'approved_folder_upload' &&
    scope.target === 'single_test_file'
  )
  const joined = [
    input.adapter_id,
    input.action,
    input.idempotency_key,
    safeString(input.scope),
    safeString(input.input),
  ].filter(Boolean).join(' ')

  const patterns = [
    { pattern: '.env', reason: 'env_edit_or_credential_injection_required' },
    { pattern: 'secret', reason: 'raw_secret_or_auth_file_exposure' },
    { pattern: 'token', reason: 'raw_secret_or_auth_file_exposure' },
    { pattern: 'cookie', reason: 'raw_secret_or_auth_file_exposure' },
    { pattern: 'password', reason: 'raw_secret_or_auth_file_exposure' },
    { pattern: 'auth_file', reason: 'raw_secret_or_auth_file_exposure' },
    { pattern: 'dns', reason: 'public_exposure_dns_caddy_tailscale_firewall_change' },
    { pattern: 'caddy', reason: 'public_exposure_dns_caddy_tailscale_firewall_change' },
    { pattern: 'tailscale', reason: 'public_exposure_dns_caddy_tailscale_firewall_change' },
    { pattern: 'firewall', reason: 'public_exposure_dns_caddy_tailscale_firewall_change' },
    { pattern: 'public_exposure', reason: 'public_exposure_dns_caddy_tailscale_firewall_change' },
    { pattern: 'delete', reason: 'destructive_delete_or_data_loss_risk' },
    { pattern: 'disable_auth', reason: 'disable_auth_audit_or_rollback' },
    { pattern: 'disable_audit', reason: 'disable_auth_audit_or_rollback' },
    { pattern: 'disable_rollback', reason: 'disable_auth_audit_or_rollback' },
    { pattern: 'spend_above_cap', reason: 'spending_above_cap' },
    { pattern: 'broad_connector_execution', reason: 'outside_mission_control_gateway_jarvis_scope' },
  ]
	  return patterns.find((item) => {
	    if (exactMcpMemoryWriteProbe && item.pattern === 'delete') return false
	    if (exactDriveApprovedFolderUpload && item.pattern === 'delete') return false
	    if (exactOllamaLocalModelExecution && item.pattern === 'token') return false
	    if (exactProviderModelExecution && item.pattern === 'token') return false
	    return joined.includes(item.pattern)
	  })?.reason || null
}

function normalizeScope(scope: JarvisExecutionInput['scope']) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) ? scope : {}
}

function blockedResult(input: {
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  mode: string
  exact_blocker: string
}): JarvisExecutionResult {
  return {
    ok: false,
    route: 'bridge.agent-zero.execute',
    mode: input.mode,
    adapter_id: input.adapter_id,
    action: input.action,
    scope: input.scope,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    hard_stop_enforced: true,
    audit_record_written: false,
    audit_hash: null,
    rollback_id: null,
    rollback_command: null,
    exact_blocker: input.exact_blocker,
  }
}

function recordRollback(input: {
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  idempotency_key: string | null
  audit_hash: string
  internal_state_changed?: boolean
  external_state_changed?: boolean
  rollback_command?: string
}) {
  const row: JarvisExecutionRollback = {
    id: `jer_${randomUUID()}`,
    at: new Date().toISOString(),
    adapter_id: input.adapter_id,
    action: input.action,
    scope: input.scope,
    idempotency_key: input.idempotency_key,
    audit_hash: input.audit_hash,
    external_state_changed: Boolean(input.external_state_changed),
    internal_state_changed: Boolean(input.internal_state_changed),
    rollback_command: input.rollback_command || 'No external state was changed by mcp_readonly_status_probe; revoke the Jarvis Bridge Session or archive this proof record if certification is withdrawn.',
  }
  writeRollbacks([row, ...readRollbacks()])
  return row
}

export function listJarvisExecutionRollbacks(limit = 20) {
  return readRollbacks().slice(0, limit)
}

export function jarvisExecutionRouterStatus() {
  const rollbacks = listJarvisExecutionRollbacks(500)
  const auditRows = listJarvisAudit(500)
  const legacyProofCounts = readJarvisLegacyProofCounts()
  const mcpProbeProofs = rollbacks.filter((row) => row.adapter_id === 'mcp_readonly_status_probe')
  const publicWebpageReadProofs = rollbacks.filter((row) => row.adapter_id === PUBLIC_WEBPAGE_READ_ADAPTER_ID)
  const youtubeTranscriptProofs = rollbacks.filter((row) => row.adapter_id === YOUTUBE_TRANSCRIPT_ADAPTER_ID)
  const paperclipDryRunProofs = rollbacks.filter((row) => row.adapter_id === 'paperclip_eco_task_dry_run')
  const paperclipIssueCommentWriteProofs = rollbacks.filter((row) => row.adapter_id === 'paperclip_eco_task_write')
  const paperclipCompanyBootstrapProofs = rollbacks.filter((row) => row.adapter_id === PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID)
  const n8nWorkflowListProofs = rollbacks.filter((row) => row.adapter_id === 'n8n_workflow_list')
  const buildwikiDispatchProofs = rollbacks.filter((row) => row.adapter_id === 'buildwiki_run_now')
  const buildwikiResultIngestProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID)
  const obsidianWriteProofs = rollbacks.filter((row) => row.adapter_id === 'obsidian_write')
  const obsidianStructuredProjectNoteProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID)
  const mempalaceWriteProofs = rollbacks.filter((row) => row.adapter_id === 'mempalace_write')
  const mempalaceCategorizedMemoryProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID)
  const mcpMemoryWriteProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID)
  const schedulerRunNowProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_SCHEDULER_RUN_ADAPTER_ID)
  const jarvisWorkflowRunProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_WORKFLOW_RUN_ADAPTER_ID)
  const agentZeroReportCreateProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_REPORT_CREATE_ADAPTER_ID)
  const agentMailDraftCreateProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID)
  const webhookLocalPingProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID)
  const ollamaLocalModelProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID)
  const providerModelExecutionProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID)
  const developerWorkflowProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID)
  const fullGoWorkflowProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID)
  const telegramDeliveryProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID)
  const zapierExactActionProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID)
  const driveOneDriveExactUploadProofs = rollbacks.filter((row) => row.adapter_id === JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID && row.external_state_changed)
  const piRecommendationProofs = auditRows.filter((row) => row.event === 'pi_recommendation_recorded')
  const mcpProbeProofCount = Math.max(mcpProbeProofs.length, legacyProofCounts.mcp_readonly_status_probe)
  const paperclipDryRunProofCount = Math.max(paperclipDryRunProofs.length, legacyProofCounts.paperclip_eco_task_dry_run)
  const paperclipGatewayInventoryProofCount = legacyProofCounts.paperclip_gateway_inventory
  const n8nWorkflowListProofCount = Math.max(n8nWorkflowListProofs.length, legacyProofCounts.n8n_workflow_list)
  const buildwikiDispatchProofCount = Math.max(buildwikiDispatchProofs.length, legacyProofCounts.buildwiki_run_now)
  return {
    route: 'bridge.agent-zero.execute',
    mode: 'jarvis_exact_scope_execution_router',
    execution_enabled: true,
    external_writes_enabled: Boolean(paperclipIssueCommentWriteProofs.length || obsidianWriteProofs.length || mempalaceWriteProofs.length),
    credential_values_exposed: false,
    hard_stop_enforced: true,
    certified_first_action: {
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
    },
    certified_actions: [
      {
        adapter_id: 'mcp_readonly_status_probe',
        action: 'mcp.status_probe',
        scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      },
      {
        adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
        action: PUBLIC_WEBPAGE_READ_ACTION,
        scope: { connector: 'web', operation: 'public_read_only', method: 'GET' },
        bridge_session_required: false,
        cookies_allowed: false,
        auth_headers_allowed: false,
        writes_enabled: false,
        forms_allowed: false,
        private_or_paywalled_scraping_allowed: false,
        rollback_required: true,
      },
      {
        adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
        action: YOUTUBE_TRANSCRIPT_ACTION,
        scope: { connector: 'youtube', operation: 'public_transcript_read_only', method: 'GET' },
        bridge_session_required: false,
        cookies_allowed: false,
        private_video_bypass_allowed: false,
        audio_download_enabled: false,
        no_hallucination_guardrail: true,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
        action: JARVIS_MCP_MEMORY_WRITE_ACTION,
        scope: {
          server_id: JARVIS_MCP_MEMORY_SERVER_ID,
          operation: JARVIS_MCP_MEMORY_OPERATION,
          target: JARVIS_MCP_MEMORY_TARGET,
        },
        exact_scope_session_required: 'mcp_memory_write_probe',
        tool_package: '@modelcontextprotocol/server-memory@2026.1.26',
        writes_rolled_back_in_same_run: true,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: 'paperclip_eco_task_dry_run',
        action: 'paperclip.eco_task_dry_run',
        scope: { company: 'ECO', operation: 'task_dry_run' },
      },
      {
        adapter_id: 'paperclip_eco_task_write',
        action: PAPERCLIP_ECO_COMMENT_ACTION,
        scope: { company: 'ECO', operation: 'issue_comment_create', target: 'existing_issue' },
        exact_scope_session_required: 'paperclip_eco_issue_comment_write',
        write_path: 'Paperclip bearer API POST /api/issues/{ECO-*}/comments',
        tok_allowed: false,
        task_creation_enabled: false,
        rollback_required: true,
      },
      {
        adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
        action: PAPERCLIP_COMPANY_BOOTSTRAP_ACTION,
        scope: PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE,
        paired_status_action: PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION,
        paired_request_action: PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION,
        exact_scope_session_required: PAPERCLIP_COMPANY_BOOTSTRAP_SESSION_SCOPE,
        write_path: 'Paperclip board/admin API: /api/companies, /api/companies/{id}/agent-hires, /api/companies/{id}/projects, /api/companies/{id}/issues',
        first_allowed_company: 'Pacman Cybersecurity',
        broad_company_creation_enabled: false,
        tok_allowed: false,
        direct_database_edit_allowed: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: 'n8n_workflow_list',
        action: 'n8n.workflow_list',
        scope: { connector: 'n8n', operation: 'workflow_list_readiness' },
        exact_blocker_if_missing_credentials: 'n8n_credentials_required_for_workflow_list',
        workflow_activation_enabled: false,
        workflow_execution_enabled: false,
        public_webhook_creation_enabled: false,
      },
      {
        adapter_id: 'buildwiki_run_now',
        action: 'buildwiki.run_now_dispatch',
        scope: {
          connector: 'buildwiki',
          operation: 'dispatch',
          target: BUILDWIKI_TARGET_SERVICE,
          fork_scope: 'Fork 1 only',
        },
        exact_scope_session_required: 'buildwiki_run_now_dispatch',
        allowed_systemd_unit: BUILDWIKI_TARGET_SERVICE,
        smb_allowed: false,
        external_farmers_allowed: false,
        other_systemd_units_allowed: false,
      },
      {
        adapter_id: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
        action: JARVIS_BUILDWIKI_RESULT_INGEST_ACTION,
        scope: {
          connector: BUILDWIKI_CONNECTOR,
          operation: 'result_ingest',
          target: BUILDWIKI_TARGET_SERVICE,
        },
        exact_scope_session_required: JARVIS_BUILDWIKI_RESULT_INGEST_SESSION_SCOPE,
        allowed_systemd_unit: BUILDWIKI_TARGET_SERVICE,
        raw_logs_returned: false,
        smb_allowed: false,
        external_farmers_allowed: false,
        other_systemd_units_allowed: false,
        rollback_required: true,
      },
      {
        adapter_id: 'obsidian_write',
        action: 'obsidian.note.create',
        scope: {
          system: 'obsidian',
          operation: 'create_note',
          vault: 'canonical',
        },
        exact_scope_session_required: 'obsidian_write',
        raw_filesystem_paths_exposed: false,
        raw_content_returned: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
        action: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
        scope: {
          system: 'obsidian',
          operation: 'structured_project_note_create',
          vault: 'canonical',
          folder: 'jarvis_full_go',
        },
        exact_scope_session_required: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_SESSION_SCOPE,
        controlled_folder: 'Agent Zero/Jarvis Full GO/Structured Project Notes',
        caller_path_allowed: false,
        raw_filesystem_paths_exposed: false,
        raw_content_returned: false,
        rollback_required: true,
      },
      {
        adapter_id: 'mempalace_write',
        action: 'mempalace.memory.remember_owner_preference',
        scope: {
          system: 'mempalace',
          operation: 'remember_owner_preference',
          vault: 'safe_memory_summary',
        },
        exact_scope_session_required: 'mempalace_write',
        raw_private_dump_enabled: false,
        raw_records_returned: false,
        overwrite_performed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
        action: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
        scope: {
          system: 'mempalace',
          operation: 'categorized_memory_write',
          vault: 'safe_memory_summary',
          category: 'task_result',
        },
        exact_scope_session_required: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_SESSION_SCOPE,
        category: 'task_result',
        raw_private_dump_enabled: false,
        raw_records_returned: false,
        overwrite_performed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_SCHEDULER_RUN_ADAPTER_ID,
        action: JARVIS_SCHEDULER_RUN_ACTION,
        scope: {
          system: 'scheduler',
          operation: 'run_now',
          task_id: JARVIS_SCHEDULER_RUN_TASK_ID,
        },
        exact_scope_session_required: JARVIS_SCHEDULER_RUN_SESSION_SCOPE,
        allowed_scheduler_task: JARVIS_SCHEDULER_RUN_TASK_ID,
        external_connectors_allowed: false,
        provider_execution_allowed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_WORKFLOW_RUN_ADAPTER_ID,
        action: JARVIS_WORKFLOW_RUN_ACTION,
        scope: {
          system: 'mission_control',
          operation: 'run_internal_health_snapshot',
          workflow_id: JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
        },
        exact_scope_session_required: JARVIS_WORKFLOW_RUN_SESSION_SCOPE,
        allowed_workflow: JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
        external_connectors_allowed: false,
        provider_execution_allowed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_REPORT_CREATE_ADAPTER_ID,
        action: JARVIS_REPORT_CREATE_ACTION,
        scope: {
          system: 'mission_control',
          operation: 'create_report',
          target: 'internal_report',
        },
        exact_scope_session_required: JARVIS_REPORT_CREATE_SESSION_SCOPE,
        external_delivery_allowed: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
        action: JARVIS_AGENTMAIL_DRAFT_ACTION,
        scope: {
          system: 'agentmail',
          operation: 'create_draft',
          target: 'internal_draft',
        },
        exact_scope_session_required: JARVIS_AGENTMAIL_DRAFT_SESSION_SCOPE,
        external_send_allowed: false,
        raw_recipient_address_allowed: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
        action: JARVIS_WEBHOOK_LOCAL_PING_ACTION,
        scope: {
          system: 'webhook',
          operation: 'invoke_local_test',
          target: 'mission_control_internal_ping',
        },
        exact_scope_session_required: JARVIS_WEBHOOK_LOCAL_PING_SESSION_SCOPE,
        external_endpoint_allowed: false,
        public_webhook_creation_allowed: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
        action: JARVIS_OLLAMA_LOCAL_MODEL_ACTION,
        scope: {
          provider: 'ollama',
          operation: 'local_generate',
          model: JARVIS_OLLAMA_LOCAL_MODEL_NAME,
        },
        exact_scope_session_required: JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE,
        local_only: true,
        estimated_cost_usd: 0,
        token_governor_required: true,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'openrouter|gemini|groq|nvidia|xai_grok',
          operation: 'chat_completion',
          model: 'provider model id',
          exact_scope: providerModelExactScope('groq', 'llama-3.3-70b-versatile'),
        },
        exact_scope_session_required: JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE,
        exact_model_scope_required: providerModelExactScope('groq', 'llama-3.3-70b-versatile'),
        token_governor_required: true,
        cost_governor_required: true,
        credential_values_exposed: false,
        raw_prompt_returned: false,
        raw_endpoint_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
        action: JARVIS_DEVELOPER_WORKFLOW_ACTION,
        scope: {
          system: 'mission_control',
          operation: 'create_source_change_request',
          target: 'source_controlled_surface',
        },
        exact_scope_session_required: JARVIS_DEVELOPER_WORKFLOW_SESSION_SCOPE,
        source_modified_by_adapter: false,
        build_invoked_by_adapter: false,
        deploy_invoked_by_adapter: false,
        public_exposure_changed: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
        action: JARVIS_FULL_GO_WORKFLOW_ACTION,
        scope: {
          system: 'mission_control',
          operation: 'run_end_to_end_company_workflow',
          workflow_id: JARVIS_FULL_GO_WORKFLOW_ID,
          company: 'ECO',
        },
        exact_scope_session_required: JARVIS_FULL_GO_WORKFLOW_SESSION_SCOPE,
        external_writes_enabled: false,
        provider_execution_called: false,
        connector_send_or_upload_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        credential_values_exposed: false,
        rollback_required: true,
      },
      {
        adapter_id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
        action: JARVIS_TELEGRAM_DELIVERY_ACTION,
        scope: {
          system: 'telegram',
          operation: 'send_owner_message',
          target: 'owner_chat',
        },
        exact_scope_session_required: JARVIS_TELEGRAM_DELIVERY_SESSION_SCOPE,
        owner_chat_only: true,
        raw_chat_id_exposed: false,
        credential_values_exposed: false,
        broad_send_allowed: false,
        rollback_required: true,
      },
    ],
    proof_count: mcpProbeProofCount + publicWebpageReadProofs.length + youtubeTranscriptProofs.length + mcpMemoryWriteProofs.length + paperclipDryRunProofCount + paperclipGatewayInventoryProofCount + paperclipIssueCommentWriteProofs.length + paperclipCompanyBootstrapProofs.length + n8nWorkflowListProofCount + buildwikiDispatchProofCount + buildwikiResultIngestProofs.length + obsidianWriteProofs.length + obsidianStructuredProjectNoteProofs.length + mempalaceWriteProofs.length + mempalaceCategorizedMemoryProofs.length + schedulerRunNowProofs.length + jarvisWorkflowRunProofs.length + agentZeroReportCreateProofs.length + agentMailDraftCreateProofs.length + webhookLocalPingProofs.length + ollamaLocalModelProofs.length + providerModelExecutionProofs.length + developerWorkflowProofs.length + fullGoWorkflowProofs.length + telegramDeliveryProofs.length + zapierExactActionProofs.length + driveOneDriveExactUploadProofs.length + piRecommendationProofs.length,
    proof_counts: {
      mcp_readonly_status_probe: mcpProbeProofCount,
      public_webpage_read: publicWebpageReadProofs.length,
      youtube_transcript: youtubeTranscriptProofs.length,
      mcp_memory_write_probe: mcpMemoryWriteProofs.length,
      paperclip_eco_task_dry_run: paperclipDryRunProofCount,
      paperclip_gateway_inventory: paperclipGatewayInventoryProofCount,
      paperclip_eco_task_write: paperclipIssueCommentWriteProofs.length,
      paperclip_company_team_bootstrap: paperclipCompanyBootstrapProofs.length,
      n8n_workflow_list: n8nWorkflowListProofCount,
      buildwiki_run_now: buildwikiDispatchProofCount,
      buildwiki_result_ingest: buildwikiResultIngestProofs.length,
      obsidian_write: obsidianWriteProofs.length,
      obsidian_structured_project_note_write: obsidianStructuredProjectNoteProofs.length,
      mempalace_write: mempalaceWriteProofs.length,
      mempalace_categorized_memory_write: mempalaceCategorizedMemoryProofs.length,
      scheduler_run_now: schedulerRunNowProofs.length,
      jarvis_workflow_run: jarvisWorkflowRunProofs.length,
      agent_zero_report_create: agentZeroReportCreateProofs.length,
      agentmail_draft_create: agentMailDraftCreateProofs.length,
      webhook_local_ping: webhookLocalPingProofs.length,
      gateway_ollama_local_model_execute: ollamaLocalModelProofs.length,
      provider_model_execution: providerModelExecutionProofs.length,
      jarvis_developer_workflow: developerWorkflowProofs.length,
      jarvis_full_go_workflow: fullGoWorkflowProofs.length,
      telegram_exact_send: telegramDeliveryProofs.length,
      zapier_exact_action_execute: zapierExactActionProofs.length,
      drive_onedrive_exact_upload: driveOneDriveExactUploadProofs.length,
      pi_recommendation_recorded: piRecommendationProofs.length,
    },
    rollback_proof_counts: {
      mcp_readonly_status_probe: mcpProbeProofs.length,
      public_webpage_read: publicWebpageReadProofs.length,
      youtube_transcript: youtubeTranscriptProofs.length,
      paperclip_eco_task_dry_run: paperclipDryRunProofs.length,
      n8n_workflow_list: n8nWorkflowListProofs.length,
      buildwiki_run_now: buildwikiDispatchProofs.length,
    },
    legacy_proof_counts: legacyProofCounts,
    latest_rollback_id: rollbacks[0]?.id || null,
    blocked_adapters: zapierExactActionProofs.length || driveOneDriveExactUploadProofs.length
      ? blockedAdapters.filter((adapter) => {
        if (zapierExactActionProofs.length && (adapter.id === 'zapier_exact_action' || adapter.id === JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID)) return false
        if (driveOneDriveExactUploadProofs.length && adapter.id === JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID) return false
        return true
      })
      : blockedAdapters,
  }
}

function sessionHasScope(session: { allowed_scopes: string[] }, scope: string) {
  return session.allowed_scopes.includes(scope)
}

function cleanText(value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw ? raw.slice(0, 500) : fallback
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

async function executeReadOnlyResearchAdapter(input: JarvisExecutionInput, adapterId: string, action: string, scope: Record<string, unknown>): Promise<JarvisExecutionResult | null> {
  const isPublicPage = adapterId === PUBLIC_WEBPAGE_READ_ADAPTER_ID && action === PUBLIC_WEBPAGE_READ_ACTION
  const isYouTube = adapterId === YOUTUBE_TRANSCRIPT_ADAPTER_ID && action === YOUTUBE_TRANSCRIPT_ACTION
  if (!isPublicPage && !isYouTube) return null

  const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
  const sourceUrl = firstString(
    scope.url,
    scope.source_url,
    scope.video_url,
    input.input?.url,
    input.input?.source_url,
    input.input?.video_url,
    input.input?.id,
  )
  const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
    ? input.idempotency_key.trim().slice(0, 180)
    : `jarvis:${isYouTube ? 'youtube-transcript' : 'public-read'}:${randomUUID()}`
  const proof = isYouTube
    ? await readYouTubeTranscript({ id: sourceUrl || scope.video_id || input.input?.video_id, lang: scope.lang || input.input?.lang })
    : await readPublicWebpage({ url: sourceUrl, max_chars: Number(scope.max_chars || input.input?.max_chars || 12000) })
  const proofRecord = proof as Record<string, unknown>
  const exactBlocker = typeof proofRecord.exact_blocker === 'string' ? proofRecord.exact_blocker : null
  const ok = proofRecord.ok === true && !exactBlocker
  const visibleTask = ensureAgentRoutingVisibleTask({
    title: isYouTube ? 'Jarvis Video Intelligence — YouTube Transcript Request' : 'Jarvis Public Read-Only Research Request',
    description: `${isYouTube ? 'YouTube transcript' : 'Public webpage'} request through certified read-only adapter. Source: ${sourceUrl || 'not supplied'}.`,
    assigned_to: 'agent-zero-jarvis',
    blocker: exactBlocker,
    metadata: {
      project: isYouTube ? 'Unlock Full Video Intelligence for Jarvis' : 'Jarvis Public Read-Only Research Access',
      adapter_id: adapterId,
      action,
      url: sourceUrl || null,
      tool_used: adapterId,
      fetch_status: proofRecord.fetch_status || proofRecord.transcript_status || (ok ? 'fetched' : 'blocked'),
      extracted_title: proofRecord.title || null,
      exact_blocker: exactBlocker,
      agent_runtime: 'Agent Zero / Jarvis video intelligence router',
      affected_system: isYouTube ? 'Jarvis Video Intelligence' : 'Jarvis Public Read-Only Research Access',
      blocked_lane: exactBlocker ? (isYouTube ? 'youtube_transcript' : 'public_webpage_read') : null,
      current_phase: exactBlocker ? (isYouTube ? 'YouTube transcript blocked with no hallucination' : 'Public read-only fetch blocked with no hallucination') : (isYouTube ? 'YouTube transcript fetched' : 'Public webpage fetched'),
      progress: exactBlocker ? 75 : 95,
      delivery_state: exactBlocker ? 'VISIBLE_CONTENT_BLOCKER_CREATED' : 'READ_ONLY_CONTENT_FETCHED',
      next_action: exactBlocker
        ? (isYouTube
            ? 'Use captions/transcript if available, or continue only through an approved audio fallback lane; do not use WebFetch or FireCrawl as the primary YouTube path.'
            : 'Use another public source or create a visible blocker; do not request owner approval for normal public read-only pages.')
        : 'Summarize only the fetched source content and keep unrelated task context suppressed.',
      needed_to_unblock: exactBlocker
        ? (isYouTube
            ? 'Public captions/transcript must be available, or an approved audio/Whisper fallback must be explicitly enabled for this video lane.'
            : 'The public page must be reachable without cookies, auth, login, or paywall bypass.')
        : null,
      proof_records: [isYouTube ? '/api/youtube/transcript' : '/api/bridge/agent-zero/execute'],
      continued_work: ['Public read-only routes, tool registration, stale-context suppression, and visible task proof continue without generic owner approval prompts.'],
      next_safe_lane: isYouTube ? 'Continue video intelligence registration and no-hallucination guardrail work.' : 'Continue public-read adapter validation and source-backed answers.',
      hallucinated_content: false,
      unrelated_context_injected: false,
      cookies_used: false,
      auth_headers_used: false,
      credential_values_exposed: false,
    },
  })
  const audit = recordJarvisAudit({
    actor,
    event: ok ? 'jarvis_public_read_adapter_executed' : 'jarvis_public_read_adapter_blocked',
    target: adapterId,
    classification: 'READ_ONLY',
    status: ok ? 'recorded' : 'blocked',
    detail: {
      action,
      scope,
      idempotency_key: idempotencyKey,
      visible_task_id: visibleTask.task_id,
      url: sourceUrl || null,
      exact_blocker: exactBlocker,
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
      external_state_changed: false,
      hallucinated_content: false,
      unrelated_context_injected: false,
      bridge_session_required: false,
    },
  })
  const rollback = recordRollback({
    adapter_id: adapterId,
    action,
    scope,
    idempotency_key: idempotencyKey,
    audit_hash: audit.hash,
    internal_state_changed: true,
    external_state_changed: false,
    rollback_command: `Archive visible task ${visibleTask.task_id} and Jarvis audit ${audit.hash}; no public webpage, YouTube, cookie, credential, audio, or external state was changed.`,
  })

  return {
    ok,
    route: 'bridge.agent-zero.execute',
    mode: ok ? 'public_read_only_adapter_executed' : 'public_read_only_adapter_blocked',
    adapter_id: adapterId,
    action,
    scope,
    execution_enabled: true,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    hard_stop_enforced: true,
    audit_record_written: true,
    audit_hash: audit.hash,
    rollback_id: rollback.id,
    rollback_command: rollback.rollback_command,
    exact_blocker: exactBlocker,
    result: {
      proof,
      visible_task_id: visibleTask.task_id,
      owner_visible_task_route: `/api/tasks/${visibleTask.task_id}`,
      rollback_record_written: true,
      bridge_session_required: false,
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
      external_writes_enabled: false,
      hallucinated_content: false,
      unrelated_context_injected: false,
      no_hallucination_guardrail: exactBlocker ? 'blocker_created_no_content_invented' : 'source_content_available',
    },
  }
}

export async function executeJarvisAdapter(input: JarvisExecutionInput): Promise<JarvisExecutionResult> {
  const adapterId = typeof input.adapter_id === 'string' ? input.adapter_id.trim() : ''
  const action = typeof input.action === 'string' ? input.action.trim() : ''
  const scope = normalizeScope(input.scope)

  const hardStop = hardStopReason(input)
  if (hardStop) {
    return blockedResult({
      adapter_id: adapterId || 'unknown',
      action: action || 'unknown',
      scope,
      mode: 'hard_stop_refused_before_adapter',
      exact_blocker: hardStop,
    })
  }

  const readOnlyResearchResult = await executeReadOnlyResearchAdapter(input, adapterId, action, scope)
  if (readOnlyResearchResult) return readOnlyResearchResult

  const session = activeJarvisBridgeSession()
  if (!session) {
    return blockedResult({
      adapter_id: adapterId || 'unknown',
      action: action || 'unknown',
      scope,
      mode: 'bridge_session_required',
      exact_blocker: 'bridge_session_required',
    })
  }

  if (!['mcp_readonly_status_probe', PUBLIC_WEBPAGE_READ_ADAPTER_ID, YOUTUBE_TRANSCRIPT_ADAPTER_ID, JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID, 'paperclip_eco_task_dry_run', 'paperclip_eco_task_write', PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID, 'n8n_workflow_list', 'buildwiki_run_now', JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID, 'obsidian_write', JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID, 'mempalace_write', JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID, JARVIS_SCHEDULER_RUN_ADAPTER_ID, JARVIS_WORKFLOW_RUN_ADAPTER_ID, JARVIS_REPORT_CREATE_ADAPTER_ID, JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID, JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID, JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID, JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID, JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID, JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID, JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID, JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID, JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID].includes(adapterId)) {
    const knownBlocker = blockedAdapters.find((adapter) => adapter.id === adapterId)?.exact_blocker
    return blockedResult({
      adapter_id: adapterId || 'unknown',
      action: action || 'unknown',
      scope,
      mode: knownBlocker ? 'adapter_registered_but_blocked' : 'adapter_missing',
      exact_blocker: knownBlocker || 'adapter_missing',
    })
  }

  if (adapterId === JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID) {
    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:zapier-connection-probe:${randomUUID()}`
    const probe = await executeJarvisZapierExactAction({ action, scope, input: input.input, actor })
    const sessionScopeBlocker = probe.ok && !sessionHasScope(session, JARVIS_ZAPIER_EXACT_ACTION_SESSION_SCOPE)
      ? `bridge_session_scope_missing_${JARVIS_ZAPIER_EXACT_ACTION_SESSION_SCOPE}`
      : null
    const exactBlocker = sessionScopeBlocker || probe.exact_blocker
    const ok = probe.ok && !sessionScopeBlocker
    const audit = recordJarvisAudit({
      actor,
      event: ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        connection_probe_ran: probe.connection_probe_ran,
        credential_names_checked: probe.credential_names_checked,
        credential_values_exposed: false,
        no_zapier_writes: true,
        broad_execution_enabled: false,
        external_state_changed: false,
        tools_total: probe.tools_total,
        source: probe.source,
        sources_checked: probe.sources_checked,
        exact_blocker: exactBlocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: ok
        ? `Remove only Jarvis Zapier connection-probe proof ${idempotencyKey} from audit/rollback records if rollback is required. No Zapier write or Zap execution occurred.`
        : `No Zapier execution occurred. Archive rollback ${idempotencyKey}; blocker was ${exactBlocker || 'unknown'}.`,
    })

    return {
      ok,
      route: 'bridge.agent-zero.execute',
      mode: ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: ok,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof: { ...probe, exact_blocker: exactBlocker },
        bridge_session_id: session.id,
        rollback_record_written: true,
        credential_values_exposed: false,
        no_zapier_writes: true,
        zapier_execution_called: false,
        broad_execution_enabled: false,
        paperclip_write_called: false,
        n8n_workflow_activation_called: false,
        provider_execution_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID) {
    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:drive-onedrive-exact:${randomUUID()}`
    const driveResult = await executeJarvisDriveOneDriveExactAction({ action, scope, input: input.input, actor })
    const sessionScopeBlocker = driveResult.ok && !sessionHasScope(session, JARVIS_DRIVE_ONEDRIVE_UPLOAD_SESSION_SCOPE)
      ? `bridge_session_scope_missing_${JARVIS_DRIVE_ONEDRIVE_UPLOAD_SESSION_SCOPE}`
      : null
    const exactBlocker = sessionScopeBlocker || driveResult.exact_blocker
    const ok = driveResult.ok && !sessionScopeBlocker
    const audit = recordJarvisAudit({
      actor,
      event: ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        credential_names_checked: driveResult.credential_names_checked,
        credential_values_exposed: false,
        approved_folders: driveResult.approved_folders,
        folder_listed: driveResult.folder_listed,
        upload_planned: driveResult.upload_planned,
        provider: driveResult.provider,
        file_name: driveResult.file_name,
        file_size_bytes: driveResult.file_size_bytes,
        rollback_kind: driveResult.rollback_kind,
        public_sharing_enabled: false,
        broad_access_enabled: false,
        exact_blocker: exactBlocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: ok && driveResult.external_state_changed,
      rollback_command: ok && driveResult.upload_planned && driveResult.rollback_deleted
        ? `Rollback already executed: the exact ${driveResult.provider || 'drive'} proof file ${driveResult.file_name || idempotencyKey} was deleted after upload. Archive rollback ${idempotencyKey}. Do not touch any other Google Drive file or folder.`
        : ok && driveResult.upload_planned
          ? `Delete only the exact ${driveResult.provider || 'drive'} file ${driveResult.file_name || idempotencyKey} created by this proof from the approved folder, then remove rollback ${idempotencyKey}. Do not touch any other Google Drive file or folder.`
        : `No Drive/OneDrive upload occurred. Archive rollback ${idempotencyKey}; blocker was ${exactBlocker || 'unknown'}.`,
    })

    return {
      ok,
      route: 'bridge.agent-zero.execute',
      mode: ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: ok,
      writes_enabled: ok && driveResult.writes_enabled,
      external_writes_enabled: ok && driveResult.external_state_changed,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof: { ...driveResult, exact_blocker: exactBlocker },
        bridge_session_id: session.id,
        rollback_record_written: true,
        credential_values_exposed: false,
        public_sharing_enabled: false,
        broad_access_enabled: false,
        zapier_execution_called: false,
        paperclip_write_called: false,
        n8n_workflow_activation_called: false,
        provider_execution_called: false,
      },
    }
  }

  if (adapterId === JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID) {
    if (
      action !== JARVIS_PROVIDER_MODEL_EXECUTION_ACTION ||
      scope.operation !== 'chat_completion' ||
      typeof scope.provider !== 'string' ||
      typeof scope.model !== 'string' ||
      typeof scope.exact_scope !== 'string'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_provider_model_execution',
      })
    }

    if (!sessionHasScope(session, JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:provider-model:${randomUUID()}`
    const modelRun = await executeJarvisProviderModelExecution({ action, scope, input: input.input, session })
    const audit = recordJarvisAudit({
      actor,
      event: modelRun.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: modelRun.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        provider: modelRun.provider,
        model: modelRun.model,
        prompt_hash: modelRun.prompt_hash,
        estimated_cost_usd: modelRun.estimated_cost_usd,
        session_spend_usd: modelRun.session_spend_usd,
        session_remaining_cap_usd: modelRun.session_remaining_cap_usd,
        token_governor_enforced: modelRun.token_governor_enforced,
        cost_governor_enforced: modelRun.cost_governor_enforced,
        external_provider_called: modelRun.external_provider_called,
        credential_values_exposed: false,
        tokens_exposed: false,
        env_values_exposed: false,
        raw_prompt_returned: false,
        raw_endpoint_exposed: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: modelRun.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: modelRun.ok
        ? `Remove only Jarvis provider model proof ${idempotencyKey} from the Jarvis execution audit/rollback log if rollback is required. Provider credentials were not changed or exposed.`
        : `No provider model proof was created. Archive rollback ${idempotencyKey}; blocker was ${modelRun.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: modelRun.ok,
      route: 'bridge.agent-zero.execute',
      mode: modelRun.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: modelRun.ok,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: modelRun.exact_blocker,
      result: {
        proof: modelRun,
        bridge_session_id: session.id,
        rollback_record_written: true,
        estimated_cost_usd: modelRun.estimated_cost_usd,
        token_governor_enforced: modelRun.token_governor_enforced,
        cost_governor_enforced: modelRun.cost_governor_enforced,
        external_provider_called: modelRun.external_provider_called,
        credential_values_exposed: false,
        tokens_exposed: false,
        env_values_exposed: false,
        raw_prompt_returned: false,
        raw_endpoint_exposed: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID) {
    if (
      action !== JARVIS_OLLAMA_LOCAL_MODEL_ACTION ||
      scope.provider !== 'ollama' ||
      scope.operation !== 'local_generate' ||
      scope.model !== JARVIS_OLLAMA_LOCAL_MODEL_NAME
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_gateway_ollama_local_model',
      })
    }

    if (!sessionHasScope(session, JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:ollama-local-model:${randomUUID()}`
    const modelRun = await executeJarvisOllamaLocalModel({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: modelRun.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: modelRun.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        provider: 'ollama',
        model: modelRun.model,
        prompt_hash: modelRun.prompt_hash,
        estimated_cost_usd: modelRun.estimated_cost_usd,
        token_governor_enforced: modelRun.token_governor_enforced,
        local_model_execution_called: modelRun.local_model_execution_called,
        external_provider_called: false,
        credential_values_exposed: false,
        raw_prompt_returned: false,
        raw_endpoint_exposed: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: modelRun.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: modelRun.ok
        ? `Remove only Jarvis Ollama local model proof ${idempotencyKey} from the Jarvis execution audit/rollback log if rollback is required. No provider state was mutated.`
        : `No Ollama local model proof was created. Archive rollback ${idempotencyKey}; blocker was ${modelRun.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: modelRun.ok,
      route: 'bridge.agent-zero.execute',
      mode: modelRun.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: modelRun.ok,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: modelRun.exact_blocker,
      result: {
        proof: modelRun,
        bridge_session_id: session.id,
        rollback_record_written: true,
        estimated_cost_usd: modelRun.estimated_cost_usd,
        token_governor_enforced: modelRun.token_governor_enforced,
        local_model_execution_called: modelRun.local_model_execution_called,
        external_provider_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID) {
    if (
      action !== JARVIS_DEVELOPER_WORKFLOW_ACTION ||
      scope.system !== 'mission_control' ||
      scope.operation !== 'create_source_change_request' ||
      scope.target !== 'source_controlled_surface'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_jarvis_developer_workflow',
      })
    }

    if (!sessionHasScope(session, JARVIS_DEVELOPER_WORKFLOW_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_DEVELOPER_WORKFLOW_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:developer-workflow:${randomUUID()}`
    const changeRequest = executeJarvisDeveloperWorkflowChangeRequest({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: changeRequest.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: changeRequest.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        change_request_id: changeRequest.change_request_id,
        title: changeRequest.title,
        requested_files: changeRequest.requested_files,
        validation_plan: changeRequest.validation_plan,
        source_modified: false,
        build_invoked: false,
        deploy_invoked: false,
        external_writes_enabled: false,
        public_exposure_changed: false,
        credential_values_exposed: false,
        raw_paths_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: changeRequest.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: changeRequest.ok,
      external_state_changed: false,
      rollback_command: changeRequest.change_request_id
        ? `Remove only Jarvis developer workflow record ${changeRequest.change_request_id} from .data/jarvis-developer-workflows.json if rollback is required. No source file was changed, no build was invoked, and no deployment was invoked by this adapter.`
        : `No Jarvis developer workflow record was created. Archive rollback ${idempotencyKey}; blocker was ${changeRequest.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: changeRequest.ok,
      route: 'bridge.agent-zero.execute',
      mode: changeRequest.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: changeRequest.ok,
      writes_enabled: changeRequest.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: changeRequest.exact_blocker,
      result: {
        proof: changeRequest,
        bridge_session_id: session.id,
        rollback_record_written: true,
        source_modified: false,
        build_invoked: false,
        deploy_invoked: false,
        external_writes_enabled: false,
        public_exposure_changed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID) {
    if (
      action !== JARVIS_FULL_GO_WORKFLOW_ACTION ||
      scope.system !== 'mission_control' ||
      scope.operation !== 'run_end_to_end_company_workflow' ||
      scope.workflow_id !== JARVIS_FULL_GO_WORKFLOW_ID ||
      scope.company !== 'ECO'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_jarvis_full_go_company_workflow',
      })
    }

    if (!sessionHasScope(session, JARVIS_FULL_GO_WORKFLOW_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_FULL_GO_WORKFLOW_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:full-go-workflow:${randomUUID()}`
    const run = executeJarvisFullGoWorkflow({ action, scope, input: input.input, actor }, {
      getExecutionRouterStatus: jarvisExecutionRouterStatus,
    })
    const audit = recordJarvisAudit({
      actor,
      event: run.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: run.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        workflow_id: run.workflow_id,
        workflow_run_id: run.run_id,
        company_scope: run.company_scope,
        certified_inputs: run.certified_inputs,
        missing_required_inputs: run.missing_required_inputs,
        systems_touched: run.systems_touched,
        external_writes_enabled: false,
        provider_execution_called: false,
        connector_send_or_upload_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        credential_values_exposed: false,
        exact_blocker: run.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: run.ok,
      external_state_changed: false,
      rollback_command: run.run_id
        ? `Remove only Jarvis Full GO workflow run ${run.run_id} from .data/jarvis-full-go-workflow-runs.json if rollback is required. No external connector, Paperclip write, Zapier, n8n, or delivery state changed.`
        : `No Jarvis Full GO workflow run was written. Archive rollback ${idempotencyKey}; blocker was ${run.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: run.ok,
      route: 'bridge.agent-zero.execute',
      mode: run.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: run.ok,
      writes_enabled: run.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: run.exact_blocker,
      result: {
        proof: run,
        bridge_session_id: session.id,
        rollback_record_written: true,
        external_writes_enabled: false,
        provider_execution_called: false,
        connector_send_or_upload_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID) {
    if (
      action !== JARVIS_TELEGRAM_DELIVERY_ACTION ||
      scope.system !== 'telegram' ||
      scope.operation !== 'send_owner_message' ||
      scope.target !== 'owner_chat'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_telegram_owner_message_send',
      })
    }

    if (!sessionHasScope(session, JARVIS_TELEGRAM_DELIVERY_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_TELEGRAM_DELIVERY_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:telegram-owner-message:${randomUUID()}`
    const delivery = await executeJarvisTelegramOwnerMessageSend({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: delivery.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: delivery.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        delivery_id: delivery.delivery_id,
        message_id: delivery.message_id,
        message_label: delivery.message_label,
        message_preview: delivery.message_preview,
        external_delivery_performed: delivery.external_delivery_performed,
        credential_values_exposed: false,
        raw_chat_id_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        broad_send_allowed: false,
        exact_blocker: delivery.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: delivery.ok,
      rollback_command: delivery.message_id
        ? `Rollback only Telegram owner-chat message id ${delivery.message_id} if needed, then remove Jarvis delivery record ${delivery.delivery_id} from .data/jarvis-telegram-deliveries.json. Do not touch any other chat or route.`
        : `No Telegram owner message was sent. Archive rollback ${idempotencyKey}; blocker was ${delivery.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: delivery.ok,
      route: 'bridge.agent-zero.execute',
      mode: delivery.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: delivery.ok,
      writes_enabled: delivery.ok,
      external_writes_enabled: delivery.ok,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: delivery.exact_blocker,
      result: {
        proof: delivery,
        bridge_session_id: session.id,
        rollback_record_written: true,
        external_delivery_performed: delivery.external_delivery_performed,
        raw_chat_id_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        broad_send_allowed: false,
      },
    }
  }

  if (adapterId === JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID) {
    if (
      action !== JARVIS_WEBHOOK_LOCAL_PING_ACTION ||
      scope.system !== 'webhook' ||
      scope.operation !== 'invoke_local_test' ||
      scope.target !== 'mission_control_internal_ping'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_webhook_local_ping',
      })
    }

    if (!sessionHasScope(session, JARVIS_WEBHOOK_LOCAL_PING_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_WEBHOOK_LOCAL_PING_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:webhook-local-ping:${randomUUID()}`
    const ping = executeJarvisWebhookLocalPing({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: ping.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: ping.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        ping_id: ping.ping_id,
        label: ping.label,
        external_endpoint_called: false,
        public_webhook_created: false,
        credential_values_exposed: false,
        raw_url_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: ping.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: ping.ok,
      external_state_changed: false,
      rollback_command: ping.ping_id
        ? `Remove only Jarvis local webhook ping ${ping.ping_id} from .data/jarvis-webhook-local-pings.json if rollback is required. No external endpoint was called and no public webhook was created.`
        : `No local webhook ping was created. Archive rollback ${idempotencyKey}; blocker was ${ping.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: ping.ok,
      route: 'bridge.agent-zero.execute',
      mode: ping.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: ping.ok,
      writes_enabled: ping.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: ping.exact_blocker,
      result: {
        proof: ping,
        bridge_session_id: session.id,
        rollback_record_written: true,
        external_endpoint_called: false,
        public_webhook_created: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID) {
    if (
      action !== JARVIS_AGENTMAIL_DRAFT_ACTION ||
      scope.system !== 'agentmail' ||
      scope.operation !== 'create_draft' ||
      scope.target !== 'internal_draft'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_agentmail_internal_draft_create',
      })
    }

    if (!sessionHasScope(session, JARVIS_AGENTMAIL_DRAFT_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_AGENTMAIL_DRAFT_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:agentmail-draft-create:${randomUUID()}`
    const draft = executeJarvisAgentMailDraftCreate({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: draft.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: draft.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        draft_id: draft.draft_id,
        recipient_label: draft.recipient_label,
        subject: draft.subject,
        email_sent: false,
        external_delivery_performed: false,
        credential_values_exposed: false,
        raw_recipient_address_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: draft.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: draft.draft_id
        ? `Remove only AgentMail internal draft ${draft.draft_id} from .data/agentmail-drafts.json if rollback is required. No email was sent.`
        : `No AgentMail draft was created. Archive rollback ${idempotencyKey}; blocker was ${draft.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: draft.ok,
      route: 'bridge.agent-zero.execute',
      mode: draft.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: draft.ok,
      writes_enabled: draft.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: draft.exact_blocker,
      result: {
        proof: draft,
        bridge_session_id: session.id,
        rollback_record_written: true,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_REPORT_CREATE_ADAPTER_ID) {
    if (
      action !== JARVIS_REPORT_CREATE_ACTION ||
      scope.system !== 'mission_control' ||
      scope.operation !== 'create_report' ||
      scope.target !== 'internal_report'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_agent_zero_internal_report_create',
      })
    }

    if (!sessionHasScope(session, JARVIS_REPORT_CREATE_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_REPORT_CREATE_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:agent-zero-report-create:${randomUUID()}`
    const report = await executeJarvisReportCreate({ action, scope, input: input.input })
    const audit = recordJarvisAudit({
      actor,
      event: report.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_REPORT_CREATE_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: report.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        report_id: report.report_id,
        mission_control_url: report.mission_control_url,
        markdown_url: report.markdown_url,
        pdf_url: report.pdf_url,
        attachment_types: report.attachment_types,
        external_delivery_requested: false,
        external_delivery_performed: false,
        credential_values_exposed: false,
        raw_paths_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: report.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: report.report_id
        ? `Remove only Agent Zero report ${report.report_id} from the Mission Control report store if rollback is required. Do not touch external delivery systems.`
        : `No Agent Zero report was created. Archive rollback ${idempotencyKey}; blocker was ${report.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: report.ok,
      route: 'bridge.agent-zero.execute',
      mode: report.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: report.ok,
      writes_enabled: report.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: report.exact_blocker,
      result: {
        proof: report,
        bridge_session_id: session.id,
        rollback_record_written: true,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_WORKFLOW_RUN_ADAPTER_ID) {
    if (
      action !== JARVIS_WORKFLOW_RUN_ACTION ||
      scope.system !== 'mission_control' ||
      scope.operation !== 'run_internal_health_snapshot' ||
      scope.workflow_id !== JARVIS_WORKFLOW_RUN_WORKFLOW_ID
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_jarvis_daily_health_workflow',
      })
    }

    if (!sessionHasScope(session, JARVIS_WORKFLOW_RUN_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_WORKFLOW_RUN_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:daily-health-workflow:${randomUUID()}`
    const run = executeJarvisWorkflowRun({ action, scope, actor }, {
      getExecutionRouterStatus: jarvisExecutionRouterStatus,
    })
    const audit = recordJarvisAudit({
      actor,
      event: run.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_WORKFLOW_RUN_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: run.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        workflow_id: run.workflow_id,
        workflow_run_id: run.run_id,
        internal_record_written: run.internal_record_written,
        summary: run.summary,
        credential_values_exposed: false,
        external_writes_enabled: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        raw_paths_exposed: false,
        exact_blocker: run.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: run.run_id
        ? `Remove only Jarvis workflow run ${run.run_id} from .data/jarvis-workflow-runs.json if rollback is required; no external connector, provider, Paperclip, Zapier, n8n, MCP, or delivery state changed.`
        : `No Jarvis workflow run was written. Archive rollback ${idempotencyKey}; blocker was ${run.exact_blocker || 'unknown'}.`,
    })
    if (run.run_id) {
      annotateJarvisWorkflowRunProof({ run_id: run.run_id, audit_hash: audit.hash, rollback_id: rollback.id })
    }

    return {
      ok: run.ok,
      route: 'bridge.agent-zero.execute',
      mode: run.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: run.ok,
      writes_enabled: run.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: run.exact_blocker,
      result: {
        proof: run,
        bridge_session_id: session.id,
        rollback_record_written: true,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_SCHEDULER_RUN_ADAPTER_ID) {
    if (!sessionHasScope(session, JARVIS_SCHEDULER_RUN_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_SCHEDULER_RUN_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:scheduler-auto-backup:${randomUUID()}`
    const run = await executeJarvisSchedulerRunNow({ action, scope })
    const audit = recordJarvisAudit({
      actor,
      event: run.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_SCHEDULER_RUN_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: run.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        task_id: run.task_id,
        scheduler_task_registered: run.scheduler_task_registered,
        scheduler_task_enabled: run.scheduler_task_enabled,
        scheduler_task_triggered: run.scheduler_task_triggered,
        backup_artifact_ids: run.backup_artifact_ids,
        backup_artifacts_created: run.backup_artifacts_created,
        raw_paths_exposed: false,
        credential_values_exposed: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: run.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: run.ok
        ? `Rollback scheduler auto-backup proof ${idempotencyKey}: remove only backup artifact ids ${run.backup_artifact_ids.join(', ') || 'created during this proof window'} after verifying they belong to this proof. Do not delete production data or unrelated backups.`
        : `No scheduler backup was created. Archive rollback ${idempotencyKey}; blocker was ${run.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: run.ok,
      route: 'bridge.agent-zero.execute',
      mode: run.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: run.ok,
      writes_enabled: run.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: run.exact_blocker,
      result: {
        proof: run,
        bridge_session_id: session.id,
        rollback_record_written: true,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === 'buildwiki_run_now') {
    if (
      action !== 'buildwiki.run_now_dispatch' ||
      scope.connector !== BUILDWIKI_CONNECTOR ||
      scope.operation !== 'dispatch' ||
      scope.target !== BUILDWIKI_TARGET_SERVICE ||
      scope.fork_scope !== 'Fork 1 only'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_buildwiki_opencloud_docs_farmer_service',
      })
    }

    if (!sessionHasScope(session, 'buildwiki_run_now_dispatch')) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_buildwiki_run_now_dispatch',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const beforeStatus = await getBuildwikiStatus()
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:buildwiki-run-now-dispatch:${randomUUID()}`
    const { request: approval } = createApprovalRequest({
      connector: BUILDWIKI_CONNECTOR,
      action: BUILDWIKI_RUN_NOW_ACTION,
      target: BUILDWIKI_TARGET_SERVICE,
      target_key: BUILDWIKI_TARGET_SERVICE,
      risk_level: 'medium',
      requester: actor,
      reason: 'Jarvis exact-scope Build-Wiki dispatch certification for Fork 1 only.',
      protected_category: 'buildwiki_run_now',
      approval_scope: {
        service: BUILDWIKI_TARGET_SERVICE,
        command: 'systemctl --user start opencloud-docs-farmer.service',
        fork_scope: 'Fork 1 only',
        smb_allowed: false,
        external_farmers_allowed: false,
        other_systemd_units_allowed: false,
      },
      idempotency_key: idempotencyKey,
    })
    const approved = approval.approval_state === 'approved'
      ? approval
      : resolveApprovalRequest(
        approval.id,
        'approved',
        actor,
        'Standing owner authorization: approve exact-scope opencloud-docs-farmer.service dispatch only.',
      )
    if (!approved) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'approval_resolution_failed',
        exact_blocker: 'buildwiki_approval_resolution_failed',
      })
    }
    recordBuildwikiAudit({
      event: 'approval_resolved',
      approval_id: approval.id,
      actor,
    })
    const outcome = await dispatchBuildwikiRunNow(approval.id, actor)
    const afterStatus = await getBuildwikiStatus()
    const audit = recordJarvisAudit({
      actor,
      event: 'jarvis_exact_scope_adapter_executed',
      target: 'buildwiki_run_now',
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        approval_id: approval.id,
        allowed_service: BUILDWIKI_TARGET_SERVICE,
        dispatch_ok: outcome.ok,
        exit_code: outcome.exit_code,
        smb_touched: false,
        external_farmers_touched: false,
        other_systemd_units_touched: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        credential_values_exposed: false,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: outcome.ok,
      rollback_command: `If ${BUILDWIKI_TARGET_SERVICE} is still active and rollback is required, run: systemctl --user stop ${BUILDWIKI_TARGET_SERVICE}. Leave ${BUILDWIKI_TARGET_SERVICE.replace('.service', '.timer')} unchanged. Approval id: ${approval.id}.`,
    })

    return {
      ok: outcome.ok,
      route: 'bridge.agent-zero.execute',
      mode: outcome.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_dispatch_failed',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: outcome.ok,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: outcome.ok ? null : 'buildwiki_dispatch_failed',
      result: {
        bridge_session_id: session.id,
        approval_id: approval.id,
        approval_state: approved.approval_state,
        allowed_systemd_unit: BUILDWIKI_TARGET_SERVICE,
        dispatch_outcome: outcome,
        service_before: {
          service_active: beforeStatus.service_active,
          timer_active: beforeStatus.timer_active,
          last_event: beforeStatus.last_event?.event || null,
        },
        service_after: {
          service_active: afterStatus.service_active,
          timer_active: afterStatus.timer_active,
          last_event: afterStatus.last_event?.event || null,
        },
        rollback_record_written: true,
        buildwiki_audit_record_written: true,
        jarvis_audit_record_written: true,
        smb_touched: false,
        external_farmers_touched: false,
        other_systemd_units_touched: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID) {
    if (
      action !== JARVIS_BUILDWIKI_RESULT_INGEST_ACTION ||
      scope.connector !== BUILDWIKI_CONNECTOR ||
      scope.operation !== 'result_ingest' ||
      scope.target !== BUILDWIKI_TARGET_SERVICE
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_buildwiki_result_ingest',
      })
    }

    if (!sessionHasScope(session, JARVIS_BUILDWIKI_RESULT_INGEST_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${JARVIS_BUILDWIKI_RESULT_INGEST_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:buildwiki-result-ingest:${randomUUID()}`
    const ingest = await executeJarvisBuildwikiResultIngest({ action, scope })
    const audit = recordJarvisAudit({
      actor,
      event: ingest.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: ingest.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        ingestion_id: ingest.ingestion_id,
        allowed_service: BUILDWIKI_TARGET_SERVICE,
        latest_event: ingest.latest_event,
        recent_event_count: ingest.recent_event_count,
        smb_touched: false,
        external_farmers_touched: false,
        other_systemd_units_touched: false,
        raw_log_output_returned: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
        credential_values_exposed: false,
        exact_blocker: ingest.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: ingest.ok,
      external_state_changed: false,
      rollback_command: ingest.ingestion_id
        ? `Remove only Build-Wiki result ingestion record ${ingest.ingestion_id} from .data/jarvis-buildwiki-result-ingestions.json if rollback is required. Do not touch ${BUILDWIKI_TARGET_SERVICE} or ${BUILDWIKI_TARGET_SERVICE.replace('.service', '.timer')}.`
        : `No Build-Wiki result ingestion record was created. Archive rollback ${idempotencyKey}; blocker was ${ingest.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: ingest.ok,
      route: 'bridge.agent-zero.execute',
      mode: ingest.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: ingest.ok,
      writes_enabled: ingest.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: ingest.exact_blocker,
      result: {
        proof: ingest,
        bridge_session_id: session.id,
        rollback_record_written: true,
        buildwiki_result_ingested: ingest.ok,
        smb_touched: false,
        external_farmers_touched: false,
        other_systemd_units_touched: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === 'obsidian_write') {
    if (
      action !== 'obsidian.note.create' ||
      scope.system !== 'obsidian' ||
      scope.operation !== 'create_note' ||
      scope.vault !== 'canonical'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_obsidian_canonical_create_note',
      })
    }

    if (!sessionHasScope(session, 'obsidian_write')) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_obsidian_write',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const inputObject = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
    const title = cleanText(inputObject.title, 'Jarvis Obsidian Execution Proof')
    const content = cleanText(inputObject.content, 'Jarvis exact-scope Obsidian write proof. Bridge Session, audit, and rollback were required.')
    const relativePath = typeof inputObject.path === 'string' && inputObject.path.trim()
      ? inputObject.path.trim().slice(0, 240)
      : `Agent Zero/Jarvis Proofs/jarvis-execution-proof-${new Date().toISOString().replace(/[:.]/g, '-')}.md`
    const tags = Array.isArray(inputObject.tags) ? inputObject.tags : ['jarvis', 'exact-scope-proof']
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:obsidian-note-create:${randomUUID()}`
    const write = createAgentZeroObsidianNote({
      path: relativePath,
      title,
      content,
      tags,
    })
    const exactBlocker = write.ok ? null : write.blockers[0] || 'obsidian_note_create_failed'
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: 'obsidian_write',
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        write_ok: write.ok,
        note_relative_path: write.note?.relative_path || null,
        raw_content_returned: false,
        direct_filesystem_exposed: false,
        credential_values_exposed: false,
        exact_blocker: exactBlocker,
      },
    })
    const proof: ObsidianWriteProof = {
      id: `owp_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: 'create_note',
      action: 'obsidian.note.create',
      relative_path: write.note?.relative_path || null,
      title,
      created: write.ok,
      credential_values_exposed: false,
      direct_filesystem_exposed: false,
      raw_content_returned: false,
      rollback_available: write.ok,
      exact_blocker: exactBlocker,
      audit_hash: audit.hash,
    }
    writeObsidianWriteProofs([proof, ...readObsidianWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: write.ok,
      rollback_command: write.ok
        ? `Remove created Obsidian note "${write.note?.relative_path}" from the canonical vault if rollback is required; do not touch other notes. Proof id: ${proof.id}.`
        : `No Obsidian note was created; archive proof ${proof.id} and revoke Jarvis Bridge Session if required.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.ok,
      external_writes_enabled: write.ok,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        obsidian_write_adapter_result: {
          ok: write.ok,
          action: write.action,
          status: write.status,
          note: write.note,
          direct_filesystem_exposed: write.direct_filesystem_exposed,
          raw_content_returned: write.raw_content_returned,
          private_dump_returned: write.private_dump_returned,
          blockers: write.blockers,
        },
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID) {
    if (
      action !== JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION ||
      scope.system !== 'obsidian' ||
      scope.operation !== 'structured_project_note_create' ||
      scope.vault !== 'canonical' ||
      scope.folder !== 'jarvis_full_go'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_obsidian_structured_project_note',
      })
    }

    if (!sessionHasScope(session, JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_obsidian_structured_project_note',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:obsidian-structured-project-note:${randomUUID()}`
    const write = executeJarvisObsidianStructuredProjectNote({ action, scope, input: input.input })
    const exactBlocker = write.ok ? null : write.exact_blocker || 'obsidian_structured_project_note_failed'
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        write_ok: write.ok,
        note_relative_path: write.note_relative_path,
        raw_content_returned: false,
        direct_filesystem_exposed: false,
        credential_values_exposed: false,
        exact_blocker: exactBlocker,
      },
    })
    const proof: ObsidianWriteProof = {
      id: `osp_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: 'structured_project_note_create',
      action: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
      relative_path: write.note_relative_path,
      title: write.title || 'Jarvis Full GO structured project note',
      created: write.ok,
      credential_values_exposed: false,
      direct_filesystem_exposed: false,
      raw_content_returned: false,
      rollback_available: write.ok,
      exact_blocker: exactBlocker,
      audit_hash: audit.hash,
    }
    writeObsidianWriteProofs([proof, ...readObsidianWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: write.ok,
      rollback_command: write.ok
        ? `Remove only the exact structured Obsidian project note "${write.note_relative_path}" from the canonical vault if rollback is required. Proof id: ${proof.id}.`
        : `No structured Obsidian project note was created; archive proof ${proof.id} and revoke Jarvis Bridge Session if required.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.ok,
      external_writes_enabled: write.ok,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        obsidian_structured_project_note_result: write,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === 'mempalace_write') {
    if (
      action !== 'mempalace.memory.remember_owner_preference' ||
      scope.system !== 'mempalace' ||
      scope.operation !== 'remember_owner_preference' ||
      scope.vault !== 'safe_memory_summary'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_mempalace_remember_owner_preference',
      })
    }

    if (!sessionHasScope(session, 'mempalace_write')) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_mempalace_write',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const inputObject = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
    const preference = cleanText(inputObject.preference, 'Jarvis can record safe owner-visible MemPalace summaries through exact-scope Mission Control execution.')
    const scopeLabel = cleanText(inputObject.scope, 'jarvis-execution-proof')
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:mempalace-owner-preference:${randomUUID()}`
    const write = rememberAgentZeroOwnerPreference({
      preference,
      scope: scopeLabel,
      confidence: 0.82,
      tags: ['jarvis', 'mission-control', 'execution-proof'],
    })
    const exactBlocker = write.ok ? null : write.blockers[0] || 'mempalace_memory_write_failed'
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: 'mempalace_write',
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        write_ok: write.ok,
        memory_id: write.memory?.id || null,
        memory_key: write.memory?.memory_key || null,
        raw_records_returned: false,
        raw_private_dump_enabled: false,
        direct_filesystem_exposed: false,
        credential_values_exposed: false,
        overwrite_performed: false,
        exact_blocker: exactBlocker,
      },
    })
    const proof: MemPalaceWriteProof = {
      id: `mwp_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: 'remember_owner_preference',
      action: 'mempalace.memory.remember_owner_preference',
      memory_id: write.memory?.id || null,
      memory_key: write.memory?.memory_key || null,
      created: write.ok,
      credential_values_exposed: false,
      raw_records_returned: false,
      direct_filesystem_exposed: false,
      rollback_available: write.ok,
      exact_blocker: exactBlocker,
      audit_hash: audit.hash,
    }
    writeMemPalaceWriteProofs([proof, ...readMemPalaceWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: write.ok,
      rollback_command: write.ok
        ? `Remove only MemPalace safe summary id "${write.memory?.id}" if rollback is required; leave all other memory rows unchanged. Proof id: ${proof.id}.`
        : `No MemPalace memory summary was created; archive proof ${proof.id} and revoke Jarvis Bridge Session if required.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.ok,
      external_writes_enabled: write.ok,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        mempalace_write_adapter_result: {
          ok: write.ok,
          action: write.action,
          status: write.status,
          memory: write.memory,
          raw_records_returned: write.raw_records_returned,
          raw_private_dump_enabled: write.raw_private_dump_enabled,
          direct_filesystem_exposed: write.direct_filesystem_exposed,
          overwrite_performed: write.overwrite_performed,
          blockers: write.blockers,
        },
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID) {
    if (
      action !== JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION ||
      scope.system !== 'mempalace' ||
      scope.operation !== 'categorized_memory_write' ||
      scope.vault !== 'safe_memory_summary' ||
      scope.category !== 'task_result'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_mempalace_categorized_memory',
      })
    }

    if (!sessionHasScope(session, JARVIS_MEMPALACE_CATEGORIZED_MEMORY_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_mempalace_categorized_memory',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:mempalace-categorized-memory:${randomUUID()}`
    const write = executeJarvisMemPalaceCategorizedMemory({ action, scope, input: input.input })
    const exactBlocker = write.ok ? null : write.exact_blocker || 'mempalace_categorized_memory_write_failed'
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        write_ok: write.ok,
        memory_id: write.memory_id,
        memory_key: write.memory_key,
        task_id: write.task_id,
        raw_records_returned: false,
        raw_private_dump_enabled: false,
        direct_filesystem_exposed: false,
        credential_values_exposed: false,
        overwrite_performed: false,
        exact_blocker: exactBlocker,
      },
    })
    const proof: MemPalaceWriteProof = {
      id: `mcpw_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: 'categorized_memory_write',
      action: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
      memory_id: write.memory_id,
      memory_key: write.memory_key,
      created: write.ok,
      credential_values_exposed: false,
      raw_records_returned: false,
      direct_filesystem_exposed: false,
      rollback_available: write.ok,
      exact_blocker: exactBlocker,
      audit_hash: audit.hash,
    }
    writeMemPalaceWriteProofs([proof, ...readMemPalaceWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: write.ok,
      rollback_command: write.ok
        ? `Remove only MemPalace categorized memory id "${write.memory_id}" if rollback is required; leave all other memory rows unchanged. Proof id: ${proof.id}.`
        : `No MemPalace categorized memory was created; archive proof ${proof.id} and revoke Jarvis Bridge Session if required.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.ok,
      external_writes_enabled: write.ok,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        mempalace_categorized_memory_result: write,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === 'paperclip_eco_task_dry_run') {
    if (action !== 'paperclip.eco_task_dry_run' || scope.company !== 'ECO' || scope.operation !== 'task_dry_run') {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_paperclip_eco_task_dry_run',
      })
    }

    const inputObject = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
    const title = cleanText(inputObject.title, 'Jarvis Paperclip ECO dry-run task')
    const description = cleanText(inputObject.description, 'Dry-run only. No Paperclip task, issue, or comment was created.')
    const assignee = typeof inputObject.assignee === 'string' && inputObject.assignee.trim()
      ? inputObject.assignee.trim().slice(0, 120)
      : null
    const issueKey = typeof inputObject.issue_key === 'string' && inputObject.issue_key.trim()
      ? inputObject.issue_key.trim().slice(0, 120)
      : null
    const audit = recordJarvisAudit({
      actor: typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID,
      event: 'jarvis_exact_scope_adapter_executed',
      target: 'paperclip_eco_task_dry_run',
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: input.idempotency_key || null,
        session_id: session.id,
        company_scope: 'ECO',
        dry_run_only: true,
        paperclip_external_write_called: false,
        paperclip_task_created: false,
        paperclip_comment_created: false,
        paperclip_issue_modified: false,
        tok_touched: false,
      },
    })
    const dryRun: PaperclipEcoDryRun = {
      id: `ped_${randomUUID()}`,
      at: new Date().toISOString(),
      company_scope: 'ECO',
      operation: 'task_dry_run',
      title,
      description,
      assignee,
      issue_key: issueKey,
      status: 'dry_run_recorded',
      external_write_called: false,
      paperclip_task_created: false,
      bridge_required_for_real_write: true,
      audit_hash: audit.hash,
    }
    writePaperclipDryRuns([dryRun, ...readPaperclipDryRuns()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: input.idempotency_key || null,
      audit_hash: audit.hash,
      internal_state_changed: true,
      rollback_command: `Remove dry-run record ${dryRun.id} from .data/paperclip-eco-dry-run-writes.json; no Paperclip external state changed.`,
    })

    return {
      ok: true,
      route: 'bridge.agent-zero.execute',
      mode: 'exact_scope_adapter_executed',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: true,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: null,
      result: {
        dry_run_record: dryRun,
        bridge_session_id: session.id,
        rollback_record_written: true,
        paperclip_external_write_called: false,
        paperclip_task_created: false,
        paperclip_comment_created: false,
        paperclip_issue_modified: false,
        tok_touched: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
        next_required_for_real_write: [
          'Paperclip write adapter proof',
          'exact Paperclip write scope',
          'owner approval',
          'audit trail',
          'rollback path',
        ],
      },
    }
  }

  if (adapterId === 'paperclip_eco_task_write') {
    if (
      action !== PAPERCLIP_ECO_COMMENT_ACTION ||
      scope.company !== 'ECO' ||
      scope.operation !== 'issue_comment_create' ||
      scope.target !== 'existing_issue'
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_paperclip_eco_issue_comment_write',
      })
    }

    if (!sessionHasScope(session, 'paperclip_eco_issue_comment_write')) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_paperclip_eco_issue_comment_write',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:paperclip-eco-comment:${randomUUID()}`
    const previousProof = readPaperclipIssueCommentWriteProofs().find((proof) => proof.comment_created && proof.action === PAPERCLIP_ECO_COMMENT_ACTION && proof.audit_hash && proof.id === idempotencyKey)
    if (previousProof) {
      return {
        ok: true,
        route: 'bridge.agent-zero.execute',
        mode: 'idempotent_replay_no_new_paperclip_write',
        adapter_id: adapterId,
        action,
        scope,
        execution_enabled: true,
        writes_enabled: false,
        external_writes_enabled: false,
        credential_values_exposed: false,
        hard_stop_enforced: true,
        audit_record_written: false,
        audit_hash: previousProof.audit_hash,
        rollback_id: null,
        rollback_command: 'Existing Paperclip ECO comment proof replayed; no new write was performed.',
        exact_blocker: null,
        result: {
          proof: previousProof,
          idempotency_key: idempotencyKey,
          paperclip_external_write_called: false,
          paperclip_comment_created: false,
          idempotent_replay: true,
        },
      }
    }

    const write = await executePaperclipEcoIssueCommentWrite({
      action,
      scope,
      input: input.input,
      idempotency_key: idempotencyKey,
      apiKey: process.env.PAPERCLIP_API_KEY || null,
      apiBaseUrl: process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_BASE_URL || null,
      paperclip_run_id: process.env.PAPERCLIP_RUN_ID || null,
    })
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: 'paperclip_eco_task_write',
      classification: 'BRIDGE_GATED',
      status: write.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        company_scope: 'ECO',
        issue_identifier: write.issue_identifier,
        issue_id: write.issue_id,
        comment_id: write.comment_id,
        issue_status_before: write.issue_status_before,
        issue_status_after: write.issue_status_after,
        paperclip_task_created: false,
        paperclip_comment_created: write.paperclip_comment_created,
        paperclip_issue_modified: write.paperclip_issue_modified,
        tok_touched: false,
        credential_present: Boolean((process.env.PAPERCLIP_API_KEY || '').trim()),
        credential_values_exposed: false,
        raw_comment_body_returned: false,
        exact_blocker: write.exact_blocker,
      },
    })
    const proof: PaperclipEcoIssueCommentWriteProof = {
      id: idempotencyKey,
      at: new Date().toISOString(),
      operation: 'issue_comment_create',
      action: PAPERCLIP_ECO_COMMENT_ACTION,
      company_scope: 'ECO',
      issue_identifier: write.issue_identifier,
      issue_id: write.issue_id,
      comment_id: write.comment_id,
      comment_created: write.paperclip_comment_created,
      issue_modified: write.paperclip_issue_modified,
      rollback_strategy: write.rollback_strategy,
      exact_blocker: write.exact_blocker,
      credential_values_exposed: false,
      raw_comment_body_returned: false,
      tok_touched: false,
      audit_hash: audit.hash,
    }
    writePaperclipIssueCommentWriteProofs([proof, ...readPaperclipIssueCommentWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: write.paperclip_comment_created,
      rollback_command: write.paperclip_comment_created
        ? `Rollback Paperclip ECO comment proof only. First try official Paperclip cancel/delete for queued comment ${write.comment_id} on ${write.issue_identifier}; if not allowed, post one compensating ECO comment through this same adapter and Bridge scope. Do not edit the Paperclip database and do not touch TOK. Proof id: ${proof.id}.`
        : `No Paperclip external write occurred. Archive proof ${proof.id}; blocker was ${write.exact_blocker || 'unknown'}.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.paperclip_comment_created,
      external_writes_enabled: write.paperclip_comment_created,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: write.exact_blocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        paperclip_external_write_called: write.paperclip_comment_created,
        paperclip_task_created: false,
        paperclip_comment_created: write.paperclip_comment_created,
        paperclip_issue_modified: write.paperclip_issue_modified,
        tok_touched: false,
        credential_values_exposed: false,
        raw_comment_body_returned: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID) {
    if (
      ![PAPERCLIP_COMPANY_BOOTSTRAP_ACTION, PAPERCLIP_COMPANY_BOOTSTRAP_STATUS_ACTION, PAPERCLIP_COMPANY_BOOTSTRAP_REQUEST_ACTION].includes(action) ||
      scope.system !== PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.system ||
      scope.operation !== PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.operation ||
      scope.company_name !== PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE.company_name
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_paperclip_company_team_bootstrap',
      })
    }

    if (!sessionHasScope(session, PAPERCLIP_COMPANY_BOOTSTRAP_SESSION_SCOPE)) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: `bridge_session_scope_missing_${PAPERCLIP_COMPANY_BOOTSTRAP_SESSION_SCOPE}`,
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:paperclip-company-bootstrap:${randomUUID()}`
    const bootstrap = await executePaperclipCompanyTeamBootstrap({
      action,
      scope,
      input: input.input,
      idempotency_key: idempotencyKey,
      actor,
      apiBaseUrl: process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_BASE_URL || null,
    })
    const audit = recordJarvisAudit({
      actor,
      event: bootstrap.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: bootstrap.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        native_company_create_api_present: bootstrap.native_company_create_api_present,
        credential_names_checked: bootstrap.credential_names_checked,
        credential_values_exposed: false,
        company_name: 'Pacman Cybersecurity',
        paperclip_external_write_called: bootstrap.paperclip_external_write_called,
        paperclip_company_created_or_found: bootstrap.paperclip_company_created_or_found,
        paperclip_team_seed_attempted: bootstrap.paperclip_team_seed_attempted,
        paperclip_agents_requested: bootstrap.paperclip_agents_requested,
        paperclip_project_created: bootstrap.paperclip_project_created,
        paperclip_issue_created: bootstrap.paperclip_issue_created,
        owner_visible_task_id: bootstrap.owner_visible_task.task_id,
        direct_database_edit_allowed: false,
        paperclip_database_bypass_used: false,
        broad_paperclip_writes_enabled: false,
        tok_touched: false,
        exact_blocker: bootstrap.exact_blocker,
      },
    })
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: bootstrap.paperclip_external_write_called,
      rollback_command: bootstrap.ok
        ? `Rollback only Paperclip Pacman Cybersecurity bootstrap ${idempotencyKey}: ${bootstrap.rollback_steps.join(' ')}`
        : `No Paperclip company/team write completed. Visible task ${bootstrap.owner_visible_task.task_id || 'not-created'} records blocker ${bootstrap.exact_blocker || 'unknown'}. Archive rollback ${idempotencyKey} if certification is withdrawn.`,
    })

    return {
      ok: bootstrap.ok,
      route: 'bridge.agent-zero.execute',
      mode: bootstrap.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: bootstrap.ok,
      writes_enabled: bootstrap.writes_enabled,
      external_writes_enabled: bootstrap.external_writes_enabled,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: bootstrap.exact_blocker,
      result: {
        proof: bootstrap.proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        owner_visible_task: bootstrap.owner_visible_task,
        native_company_create_api_present: bootstrap.native_company_create_api_present,
        credential_names_checked: bootstrap.credential_names_checked,
        credential_values_exposed: false,
        paperclip_external_write_called: bootstrap.paperclip_external_write_called,
        paperclip_company_created_or_found: bootstrap.paperclip_company_created_or_found,
        paperclip_team_seed_attempted: bootstrap.paperclip_team_seed_attempted,
        paperclip_agents_requested: bootstrap.paperclip_agents_requested,
        paperclip_project_created: bootstrap.paperclip_project_created,
        paperclip_issue_created: bootstrap.paperclip_issue_created,
        paperclip_database_bypass_used: false,
        tok_touched: false,
        broad_paperclip_writes_enabled: false,
        provider_execution_called: false,
        mcp_tool_invocation_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === 'n8n_workflow_list') {
    if (action !== 'n8n.workflow_list' || scope.connector !== 'n8n' || scope.operation !== 'workflow_list_readiness') {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_n8n_workflow_list',
      })
    }

    const baseUrl = n8nBaseUrl()
    const baseUrlPresent = Boolean(baseUrl)
    const apiKeyPresent = envPresent('N8N_API_KEY')
    const baseProbe = await probeN8nBase(baseUrl)
    const missingCredentials = [
      baseUrlPresent ? null : 'N8N_BASE_URL',
      apiKeyPresent ? null : 'N8N_API_KEY',
    ].filter(Boolean) as string[]
    const workflowList = missingCredentials.length ? null : await listN8nWorkflows(baseUrl)
    const exactBlocker = missingCredentials.length
      ? 'credential_required'
      : workflowList?.exact_blocker || null
    const audit = recordJarvisAudit({
      actor: typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID,
      event: 'jarvis_exact_scope_adapter_executed',
      target: 'n8n_workflow_list',
      classification: 'BRIDGE_GATED',
      detail: {
        action,
        scope,
        idempotency_key: input.idempotency_key || null,
        session_id: session.id,
        base_url_present: baseUrlPresent,
        api_key_present: apiKeyPresent,
        base_reachable: baseProbe.reachable,
        workflow_list_attempted: Boolean(workflowList),
        workflow_count: workflowList?.workflows.length ?? null,
        workflow_activation_enabled: false,
        workflow_execution_enabled: false,
        public_webhook_created: false,
        credential_values_exposed: false,
        exact_blocker: exactBlocker,
      },
    })
    const probe: N8nWorkflowListProbe = {
      id: `n8p_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: 'workflow_list_readiness',
      base_url_present: baseUrlPresent,
      api_key_present: apiKeyPresent,
      base_reachable: baseProbe.reachable,
      base_status: baseProbe.status,
      workflow_list_attempted: Boolean(workflowList),
      workflow_count: workflowList?.workflows.length ?? null,
      workflow_activation_enabled: false,
      workflow_execution_enabled: false,
      public_webhook_created: false,
      credential_values_exposed: false,
      exact_blocker: exactBlocker,
      audit_hash: audit.hash,
    }
    writeN8nProbes([probe, ...readN8nProbes()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: input.idempotency_key || null,
      audit_hash: audit.hash,
      internal_state_changed: true,
      rollback_command: `Remove n8n readiness/list proof ${probe.id} from .data/n8n-workflow-list-proofs.json; no n8n workflow was activated, executed, or changed.`,
    })

    return {
      ok: !exactBlocker,
      route: 'bridge.agent-zero.execute',
      mode: exactBlocker ? 'exact_scope_adapter_stopped_before_workflow_execution' : 'exact_scope_adapter_executed',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: !exactBlocker,
      writes_enabled: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: exactBlocker,
      result: {
        readiness_record: probe,
        bridge_session_id: session.id,
        rollback_record_written: true,
        env_name_status: {
          N8N_BASE_URL: baseUrlPresent ? 'present' : 'missing',
          N8N_API_KEY: apiKeyPresent ? 'present' : 'missing',
        },
        missing_credentials: missingCredentials,
        n8n_base_reachability: {
          reachable: baseProbe.reachable,
          status: baseProbe.status,
        },
        workflow_list_result: workflowList ? {
          ok: workflowList.ok,
          status: workflowList.status,
          count: workflowList.workflows.length,
          workflows: workflowList.workflows,
        } : null,
        workflow_activation_enabled: false,
        workflow_execution_enabled: false,
        public_webhook_created: false,
        n8n_credentials_values_exposed: false,
        provider_execution_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        mcp_tool_invocation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (adapterId === JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID) {
    if (
      action !== JARVIS_MCP_MEMORY_WRITE_ACTION ||
      scope.server_id !== JARVIS_MCP_MEMORY_SERVER_ID ||
      scope.operation !== JARVIS_MCP_MEMORY_OPERATION ||
      scope.target !== JARVIS_MCP_MEMORY_TARGET
    ) {
      return blockedResult({
        adapter_id: adapterId,
        action: action || 'unknown',
        scope,
        mode: 'scope_mismatch',
        exact_blocker: 'exact_scope_required_mcp_memory_write_probe',
      })
    }

    if (!sessionHasScope(session, 'mcp_memory_write_probe')) {
      return blockedResult({
        adapter_id: adapterId,
        action,
        scope,
        mode: 'bridge_session_scope_missing',
        exact_blocker: 'bridge_session_scope_missing_mcp_memory_write_probe',
      })
    }

    const actor = typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID
    const idempotencyKey = typeof input.idempotency_key === 'string' && input.idempotency_key.trim()
      ? input.idempotency_key.trim().slice(0, 180)
      : `jarvis:mcp-memory-write-probe:${randomUUID()}`
    const write = await executeJarvisMcpMemoryWriteProbe({ idempotencyKey, actor })
    const audit = recordJarvisAudit({
      actor,
      event: write.ok ? 'jarvis_exact_scope_adapter_executed' : 'jarvis_exact_scope_adapter_blocked',
      target: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
      classification: 'BRIDGE_GATED',
      status: write.ok ? 'recorded' : 'blocked',
      detail: {
        action,
        scope,
        idempotency_key: idempotencyKey,
        session_id: session.id,
        server_id: JARVIS_MCP_MEMORY_SERVER_ID,
        mcp_tool_invocation_called: true,
        mcp_write_tool_called: true,
        create_succeeded: write.create_succeeded,
        rollback_succeeded: write.rollback_succeeded,
        final_entity_present: write.final_entity_present,
        proof_graph_path_exposed: false,
        raw_tool_output_returned: false,
        credential_values_exposed: false,
        provider_execution_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
        exact_blocker: write.exact_blocker,
      },
    })
    const proof: McpMemoryWriteProof = {
      id: `mwp_${randomUUID()}`,
      at: new Date().toISOString(),
      operation: JARVIS_MCP_MEMORY_OPERATION,
      action: JARVIS_MCP_MEMORY_WRITE_ACTION,
      server_id: JARVIS_MCP_MEMORY_SERVER_ID,
      entity_name: write.entity_name,
      create_succeeded: write.create_succeeded,
      rollback_succeeded: write.rollback_succeeded,
      final_entity_present: write.final_entity_present,
      credential_values_exposed: false,
      raw_tool_output_returned: false,
      proof_graph_path_exposed: false,
      exact_blocker: write.exact_blocker,
      audit_hash: audit.hash,
    }
    writeMcpMemoryWriteProofs([proof, ...readMcpMemoryWriteProofs()])
    const rollback = recordRollback({
      adapter_id: adapterId,
      action,
      scope,
      idempotency_key: idempotencyKey,
      audit_hash: audit.hash,
      internal_state_changed: true,
      external_state_changed: false,
      rollback_command: write.ok
        ? `MCP memory probe entity ${write.entity_name} was deleted in the same adapter run. If rollback is rechecked, call only delete_entities for that entity in the isolated proof graph; do not invoke any other MCP tool. Proof id: ${proof.id}.`
        : `MCP memory write probe did not complete. Re-run only this exact adapter after checking blocker ${write.exact_blocker || 'unknown'}. Proof id: ${proof.id}.`,
    })

    return {
      ok: write.ok,
      route: 'bridge.agent-zero.execute',
      mode: write.ok ? 'exact_scope_adapter_executed' : 'exact_scope_adapter_blocked',
      adapter_id: adapterId,
      action,
      scope,
      execution_enabled: write.ok,
      writes_enabled: write.ok,
      external_writes_enabled: false,
      credential_values_exposed: false,
      hard_stop_enforced: true,
      audit_record_written: true,
      audit_hash: audit.hash,
      rollback_id: rollback.id,
      rollback_command: rollback.rollback_command,
      exact_blocker: write.exact_blocker,
      result: {
        proof,
        bridge_session_id: session.id,
        rollback_record_written: true,
        mcp_tool_invocation_called: true,
        mcp_write_tool_called: true,
        create_succeeded: write.create_succeeded,
        rollback_succeeded: write.rollback_succeeded,
        final_entity_present: write.final_entity_present,
        proof_graph_path_exposed: false,
        raw_tool_output_returned: false,
        credential_values_exposed: false,
        provider_execution_called: false,
        paperclip_write_called: false,
        zapier_execution_called: false,
        n8n_workflow_activation_called: false,
        buildwiki_dispatch_called: false,
        delivery_send_or_upload_called: false,
      },
    }
  }

  if (action !== 'mcp.status_probe' || scope.server_id !== 'mcp-tools' || scope.operation !== 'status_probe') {
    return blockedResult({
      adapter_id: adapterId,
      action: action || 'unknown',
      scope,
      mode: 'scope_mismatch',
      exact_blocker: 'exact_scope_required_mcp_tools_status_probe',
    })
  }

  const probeResult = {
    server_id: 'mcp-tools',
    operation: 'status_probe',
    state: 'READ_ONLY',
    transport: 'mission_control_status_contract',
    tool_invocation_enabled: false,
    writes_enabled: false,
    external_network_write_enabled: false,
    credential_values_exposed: false,
    servers_observed: [
      { id: 'mcp-tools', state: 'read_only', exact_blocker: null },
      { id: 'zapier-mcp', state: 'configured', exact_blocker: null },
      { id: 'firecrawl-mcp', state: 'credential_gated', exact_blocker: 'firecrawl_credential_required' },
    ],
  }

  const audit = recordJarvisAudit({
    actor: typeof input.actor === 'string' && input.actor.trim() ? input.actor.trim() : JARVIS_ACTOR_ID,
    event: 'jarvis_exact_scope_adapter_executed',
    target: 'mcp_readonly_status_probe',
    classification: 'BRIDGE_GATED',
    detail: {
      action,
      scope,
      idempotency_key: input.idempotency_key || null,
      session_id: session.id,
      writes_enabled: false,
      provider_execution_called: false,
      mcp_tool_invocation_called: false,
      status_probe_only: true,
    },
  })
  const rollback = recordRollback({
    adapter_id: adapterId,
    action,
    scope,
    idempotency_key: input.idempotency_key || null,
    audit_hash: audit.hash,
  })

  return {
    ok: true,
    route: 'bridge.agent-zero.execute',
    mode: 'exact_scope_adapter_executed',
    adapter_id: adapterId,
    action,
    scope,
    execution_enabled: true,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    hard_stop_enforced: true,
    audit_record_written: true,
    audit_hash: audit.hash,
    rollback_id: rollback.id,
    rollback_command: rollback.rollback_command,
    exact_blocker: null,
    result: {
      probe: probeResult,
      bridge_session_id: session.id,
      rollback_record_written: true,
      provider_execution_called: false,
      paperclip_write_called: false,
      zapier_execution_called: false,
      n8n_workflow_activation_called: false,
      buildwiki_dispatch_called: false,
      delivery_send_or_upload_called: false,
    },
  }
}
