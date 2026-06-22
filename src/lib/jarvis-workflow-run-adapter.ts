import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import {
  JARVIS_WORKFLOWS,
  recordJarvisWorkflowExecution,
  type JarvisWorkflowRun,
} from '@/lib/jarvis-workflows'
import { JARVIS_ACTOR_ID } from '@/lib/jarvis-owner-operator-policy'

export const JARVIS_WORKFLOW_RUN_ADAPTER_ID = 'jarvis_workflow_run'
export const JARVIS_WORKFLOW_RUN_ACTION = 'jarvis.workflow.run'
export const JARVIS_WORKFLOW_RUN_SESSION_SCOPE = 'jarvis_workflow_daily_health_run'
export const JARVIS_WORKFLOW_RUN_WORKFLOW_ID = 'daily_health'

type JarvisWorkflowRunInput = {
  action?: string
  scope?: Record<string, unknown>
  actor?: string
}

type RouterStatusLike = {
  proof_counts?: Record<string, unknown>
  blocked_adapters?: readonly unknown[]
}

type MatrixLike = {
  summary?: {
    total?: number
    executable?: number
    blocked?: number
    execution_allowed?: number
    blocked_or_gated?: number
  }
}

type WorkflowRunRecordInput = {
  workflow_id: typeof JARVIS_WORKFLOW_RUN_WORKFLOW_ID
  actor: string
  summary: Record<string, unknown>
  audit_hash?: string | null
  rollback_id?: string | null
}

type WorkflowRunRecord = Partial<JarvisWorkflowRun> & {
  id: string
  workflow_id: string
}

type JarvisWorkflowRunDeps = {
  getExecutionRouterStatus?: () => RouterStatusLike
  getReadinessMatrix?: () => MatrixLike
  getWorkflowRegistry?: () => unknown[]
  recordWorkflowExecution?: (input: WorkflowRunRecordInput) => WorkflowRunRecord
}

export type JarvisWorkflowRunAdapterResult = {
  ok: boolean
  adapter_id: typeof JARVIS_WORKFLOW_RUN_ADAPTER_ID
  action: string
  workflow_id: typeof JARVIS_WORKFLOW_RUN_WORKFLOW_ID | null
  workflow_executed: boolean
  internal_record_written: boolean
  run_id: string | null
  summary: Record<string, unknown>
  credential_values_exposed: false
  external_writes_enabled: false
  provider_execution_called: false
  mcp_tool_invocation_called: false
  paperclip_write_called: false
  zapier_execution_called: false
  n8n_workflow_activation_called: false
  delivery_send_or_upload_called: false
  raw_paths_exposed: false
  exact_blocker: string | null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function certifiedAdapterCount(proofCounts: Record<string, unknown>) {
  return Object.values(proofCounts).filter((value) => numberValue(value) > 0).length
}

function normalizeActor(actor: unknown) {
  return typeof actor === 'string' && actor.trim() ? actor.trim().slice(0, 120) : JARVIS_ACTOR_ID
}

function defaultRecordWorkflowExecution(input: WorkflowRunRecordInput) {
  return recordJarvisWorkflowExecution(input)
}

export function executeJarvisWorkflowRun(
  input: JarvisWorkflowRunInput,
  deps: JarvisWorkflowRunDeps = {},
): JarvisWorkflowRunAdapterResult {
  const action = typeof input.action === 'string' ? input.action.trim() : ''
  const scope = input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope) ? input.scope : {}
  const exactScope = (
    action === JARVIS_WORKFLOW_RUN_ACTION &&
    scope.system === 'mission_control' &&
    scope.operation === 'run_internal_health_snapshot' &&
    scope.workflow_id === JARVIS_WORKFLOW_RUN_WORKFLOW_ID
  )

  if (!exactScope) {
    return {
      ok: false,
      adapter_id: JARVIS_WORKFLOW_RUN_ADAPTER_ID,
      action: action || 'unknown',
      workflow_id: null,
      workflow_executed: false,
      internal_record_written: false,
      run_id: null,
      summary: {},
      credential_values_exposed: false,
      external_writes_enabled: false,
      provider_execution_called: false,
      mcp_tool_invocation_called: false,
      paperclip_write_called: false,
      zapier_execution_called: false,
      n8n_workflow_activation_called: false,
      delivery_send_or_upload_called: false,
      raw_paths_exposed: false,
      exact_blocker: 'exact_scope_required_jarvis_daily_health_workflow',
    }
  }

  const routerStatus = deps.getExecutionRouterStatus?.() || { proof_counts: {}, blocked_adapters: [] }
  const matrix = deps.getReadinessMatrix?.() || buildExecutionReadinessMatrix()
  const workflowRegistry = deps.getWorkflowRegistry?.() || JARVIS_WORKFLOWS
  const proofCounts = routerStatus.proof_counts || {}
  const blockedAdapters = Array.isArray(routerStatus.blocked_adapters) ? routerStatus.blocked_adapters.length : 0
  const readinessSummary = (matrix.summary || {}) as Record<string, unknown>
  const workflowCount = Array.isArray(workflowRegistry) ? workflowRegistry.length : 0
  const gatedWorkflowCount = Array.isArray(workflowRegistry)
    ? workflowRegistry.filter((workflow) => {
      const status = workflow && typeof workflow === 'object' ? (workflow as { status?: unknown }).status : null
      return status === 'bridge_gated' || status === 'credential_gated'
    }).length
    : 0
  const actor = normalizeActor(input.actor)
  const summary = {
    workflow_id: JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
    readiness_total: numberValue(readinessSummary.total),
    readiness_executable: numberValue(readinessSummary.executable ?? readinessSummary.execution_allowed),
    readiness_blocked: numberValue(readinessSummary.blocked ?? readinessSummary.blocked_or_gated),
    certified_adapter_count: certifiedAdapterCount(proofCounts),
    blocked_adapter_count: blockedAdapters,
    workflow_registry_count: workflowCount,
    gated_workflow_count: gatedWorkflowCount,
    credential_values_exposed: false,
    external_execution_performed: false,
  }
  const recordWorkflowExecution = deps.recordWorkflowExecution || defaultRecordWorkflowExecution
  const run = recordWorkflowExecution({
    workflow_id: JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
    actor,
    summary,
    audit_hash: null,
    rollback_id: null,
  })

  return {
    ok: true,
    adapter_id: JARVIS_WORKFLOW_RUN_ADAPTER_ID,
    action: JARVIS_WORKFLOW_RUN_ACTION,
    workflow_id: JARVIS_WORKFLOW_RUN_WORKFLOW_ID,
    workflow_executed: true,
    internal_record_written: true,
    run_id: run.id,
    summary,
    credential_values_exposed: false,
    external_writes_enabled: false,
    provider_execution_called: false,
    mcp_tool_invocation_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    delivery_send_or_upload_called: false,
    raw_paths_exposed: false,
    exact_blocker: null,
  }
}
