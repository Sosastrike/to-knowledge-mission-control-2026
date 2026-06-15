import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { JARVIS_ACTOR_ID } from '@/lib/jarvis-owner-operator-policy'

export const JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID = 'jarvis_full_go_workflow'
export const JARVIS_FULL_GO_WORKFLOW_ACTION = 'jarvis.full_go.workflow.run'
export const JARVIS_FULL_GO_WORKFLOW_SESSION_SCOPE = 'jarvis_full_go_company_workflow_run'
export const JARVIS_FULL_GO_WORKFLOW_ID = 'full_go_company_status'

type FullGoWorkflowInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
  actor?: string
}

type RouterStatusLike = {
  proof_counts?: Record<string, unknown>
}

type FullGoWorkflowDeps = {
  getExecutionRouterStatus?: () => RouterStatusLike
  writeRun?: (record: FullGoWorkflowRecord) => FullGoWorkflowRecord
}

type FullGoWorkflowRecord = {
  id: string
  at: string
  workflow_id: typeof JARVIS_FULL_GO_WORKFLOW_ID
  company_scope: 'ECO'
  actor: string
  certified_inputs: string[]
  selected_route: 'jarvis_exact_scope_adapters'
  systems_touched: string[]
  external_writes_enabled: false
  provider_execution_called: false
  connector_send_or_upload_called: false
  paperclip_write_called: false
  zapier_execution_called: false
  n8n_workflow_activation_called: false
  credential_values_exposed: false
  rollback_required: true
}

export type FullGoWorkflowResult = {
  ok: boolean
  adapter_id: typeof JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID
  action: string
  workflow_id: typeof JARVIS_FULL_GO_WORKFLOW_ID | null
  workflow_executed: boolean
  internal_record_written: boolean
  run_id: string | null
  company_scope: 'ECO' | null
  certified_inputs: string[]
  missing_required_inputs: string[]
  systems_touched: string[]
  external_writes_enabled: false
  provider_execution_called: false
  connector_send_or_upload_called: false
  paperclip_write_called: false
  zapier_execution_called: false
  n8n_workflow_activation_called: false
  credential_values_exposed: false
  exact_blocker: string | null
}

const storePath = join(config.dataDir, 'jarvis-full-go-workflow-runs.json')

function readRuns(): FullGoWorkflowRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRuns(rows: FullGoWorkflowRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function defaultWriteRun(record: FullGoWorkflowRecord) {
  writeRuns([record, ...readRuns()])
  return record
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function hasAny(proofCounts: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => count(proofCounts[key]) > 0)
}

function blockResult(action: string, blocker: string, missing: string[] = []): FullGoWorkflowResult {
  return {
    ok: false,
    adapter_id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
    action: action || 'unknown',
    workflow_id: null,
    workflow_executed: false,
    internal_record_written: false,
    run_id: null,
    company_scope: null,
    certified_inputs: [],
    missing_required_inputs: missing,
    systems_touched: [],
    external_writes_enabled: false,
    provider_execution_called: false,
    connector_send_or_upload_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    credential_values_exposed: false,
    exact_blocker: blocker,
  }
}

export function executeJarvisFullGoWorkflow(
  request: FullGoWorkflowInput,
  deps: FullGoWorkflowDeps = {},
): FullGoWorkflowResult {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_FULL_GO_WORKFLOW_ACTION ||
    scope.system !== 'mission_control' ||
    scope.operation !== 'run_end_to_end_company_workflow' ||
    scope.workflow_id !== JARVIS_FULL_GO_WORKFLOW_ID ||
    scope.company !== 'ECO'
  ) {
    return blockResult(action, 'exact_scope_required_jarvis_full_go_company_workflow')
  }

  const proofCounts = deps.getExecutionRouterStatus?.().proof_counts || {}
  const requiredGroups = [
    { id: 'mcp_read_visibility', keys: ['mcp_readonly_status_probe'] },
    { id: 'gateway_model_execution', keys: ['gateway_ollama_local_model_execute'] },
    { id: 'buildwiki_execution', keys: ['buildwiki_run_now', 'buildwiki_result_ingest'] },
    { id: 'obsidian_write', keys: ['obsidian_write', 'obsidian_structured_project_note_write'] },
    { id: 'mempalace_write', keys: ['mempalace_write', 'mempalace_categorized_memory_write'] },
    { id: 'paperclip_gateway_context', keys: ['paperclip_gateway_inventory'] },
    { id: 'developer_workflow', keys: ['jarvis_developer_workflow'] },
  ]
  const missing = requiredGroups.filter((group) => !hasAny(proofCounts, group.keys)).map((group) => group.id)
  if (missing.length) {
    return blockResult(action, 'dependent_certified_adapter_proof_missing', missing)
  }

  const certifiedInputs = requiredGroups.flatMap((group) => group.keys.filter((key) => count(proofCounts[key]) > 0))
  const actor = typeof request.actor === 'string' && request.actor.trim() ? request.actor.trim().slice(0, 120) : JARVIS_ACTOR_ID
  const record: FullGoWorkflowRecord = {
    id: `jfgw_${randomUUID()}`,
    at: new Date().toISOString(),
    workflow_id: JARVIS_FULL_GO_WORKFLOW_ID,
    company_scope: 'ECO',
    actor,
    certified_inputs: certifiedInputs,
    selected_route: 'jarvis_exact_scope_adapters',
    systems_touched: ['mission_control', 'gateway', 'paperclip_eco_context', 'buildwiki', 'obsidian', 'mempalace'],
    external_writes_enabled: false,
    provider_execution_called: false,
    connector_send_or_upload_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    credential_values_exposed: false,
    rollback_required: true,
  }
  const written = (deps.writeRun || defaultWriteRun)(record)

  return {
    ok: true,
    adapter_id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
    action: JARVIS_FULL_GO_WORKFLOW_ACTION,
    workflow_id: JARVIS_FULL_GO_WORKFLOW_ID,
    workflow_executed: true,
    internal_record_written: true,
    run_id: written.id,
    company_scope: 'ECO',
    certified_inputs: written.certified_inputs,
    missing_required_inputs: [],
    systems_touched: written.systems_touched,
    external_writes_enabled: false,
    provider_execution_called: false,
    connector_send_or_upload_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    credential_values_exposed: false,
    exact_blocker: null,
  }
}
