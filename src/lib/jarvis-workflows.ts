import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { recordJarvisAudit } from '@/lib/jarvis-audit'
import { activeJarvisBridgeSession } from '@/lib/jarvis-bridge-session'

export type JarvisWorkflow = {
  id: string
  label: string
  protected_actions: string[]
  status: 'ready_internal_only' | 'bridge_gated' | 'credential_gated'
  exact_blocker: string | null
}

export type JarvisWorkflowRun = {
  id: string
  workflow_id: string
  at: string
  actor: string
  mode: 'preflight' | 'queued_internal_record' | 'executed_internal_health_snapshot'
  status: 'recorded' | 'blocked'
  exact_blocker: string | null
  audit_hash: string | null
  rollback_id?: string | null
  summary?: Record<string, unknown>
}

const storePath = join(config.dataDir, 'jarvis-workflow-runs.json')

export const JARVIS_WORKFLOWS: JarvisWorkflow[] = [
  { id: 'daily_health', label: 'Daily health', protected_actions: [], status: 'ready_internal_only', exact_blocker: null },
  { id: 'agent_readiness', label: 'Agent readiness', protected_actions: [], status: 'ready_internal_only', exact_blocker: null },
  { id: 'paperclip_eco_status', label: 'Paperclip ECO status', protected_actions: [], status: 'ready_internal_only', exact_blocker: null },
  { id: 'buildwiki_sync', label: 'Build-Wiki sync', protected_actions: ['buildwiki_run_now'], status: 'bridge_gated', exact_blocker: 'buildwiki_run_now_requires_exact_scope_approval' },
  { id: 'provider_mcp_repair', label: 'Provider and MCP repair', protected_actions: ['provider_execution', 'mcp_tool_execution'], status: 'bridge_gated', exact_blocker: 'provider_mcp_execution_requires_adapter_proof' },
  { id: 'delivery_readiness', label: 'Delivery readiness', protected_actions: ['connector_send_upload'], status: 'credential_gated', exact_blocker: 'delivery_credentials_required' },
  { id: 'scheduled_jobs', label: 'Scheduled jobs', protected_actions: ['webhook_or_scheduler_mutation'], status: 'bridge_gated', exact_blocker: 'scheduled_job_adapter_not_proven' },
  { id: 'owner_commands', label: 'Owner commands', protected_actions: ['exact_scope_external_action'], status: 'bridge_gated', exact_blocker: 'owner_command_scope_required' },
]

function readRuns(): JarvisWorkflowRun[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRuns(rows: JarvisWorkflowRun[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

export function listJarvisWorkflowRuns(limit = 25) {
  return readRuns().slice(0, limit)
}

export function preflightJarvisWorkflow(id: string) {
  const workflow = JARVIS_WORKFLOWS.find((item) => item.id === id) || null
  if (!workflow) return { ok: false, exact_blocker: 'workflow_not_found', workflow_id: id }
  return {
    ok: true,
    workflow,
    execution_enabled: false,
    protected_actions_blocked: workflow.protected_actions,
    exact_blocker: workflow.exact_blocker,
  }
}

export function queueJarvisWorkflowRecord(id: string, actor: string) {
  const session = activeJarvisBridgeSession()
  const workflow = JARVIS_WORKFLOWS.find((item) => item.id === id) || null
  if (!workflow) return { ok: false as const, status: 404, exact_blocker: 'workflow_not_found' }
  if (!session) return { ok: false as const, status: 423, exact_blocker: 'bridge_session_required' }
  const audit = recordJarvisAudit({
    actor,
    event: 'jarvis_workflow_recorded',
    target: id,
    classification: 'DIRECT_INTERNAL_WRITE',
    detail: { session_id: session.id, protected_actions: workflow.protected_actions },
  })
  const run: JarvisWorkflowRun = {
    id: `jwf_${randomUUID()}`,
    workflow_id: id,
    at: new Date().toISOString(),
    actor,
    mode: 'queued_internal_record',
    status: 'recorded',
    exact_blocker: workflow.exact_blocker,
    audit_hash: audit.hash,
  }
  writeRuns([run, ...readRuns()])
  return { ok: true as const, run, audit, workflow }
}

export function recordJarvisWorkflowExecution(input: {
  workflow_id: 'daily_health'
  actor: string
  summary: Record<string, unknown>
  audit_hash?: string | null
  rollback_id?: string | null
}) {
  const run: JarvisWorkflowRun = {
    id: `jwf_${randomUUID()}`,
    workflow_id: input.workflow_id,
    at: new Date().toISOString(),
    actor: input.actor,
    mode: 'executed_internal_health_snapshot',
    status: 'recorded',
    exact_blocker: null,
    audit_hash: input.audit_hash || null,
    rollback_id: input.rollback_id || null,
    summary: {
      ...input.summary,
      credential_values_exposed: false,
      external_execution_performed: false,
    },
  }
  writeRuns([run, ...readRuns()])
  return run
}

export function annotateJarvisWorkflowRunProof(input: {
  run_id: string
  audit_hash: string
  rollback_id: string
}) {
  const rows = readRuns()
  const updated = rows.map((run) => run.id === input.run_id
    ? { ...run, audit_hash: input.audit_hash, rollback_id: input.rollback_id }
    : run)
  writeRuns(updated)
  return updated.find((run) => run.id === input.run_id) || null
}
