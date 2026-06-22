import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export const JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID = 'jarvis_developer_workflow'
export const JARVIS_DEVELOPER_WORKFLOW_ACTION = 'jarvis.developer_workflow.create_change_request'
export const JARVIS_DEVELOPER_WORKFLOW_SESSION_SCOPE = 'jarvis_developer_workflow_create_change_request'

type DeveloperWorkflowInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type DeveloperWorkflowRecord = {
  id: string
  at: string
  title: string
  summary: string
  requested_files: string[]
  validation_plan: string[]
  rollback_plan: string
  actor: 'agent-zero-jarvis'
  status: 'change_request_recorded'
  source_modified: false
  build_invoked: false
  deploy_invoked: false
  public_exposure_changed: false
  credential_values_exposed: false
  raw_paths_exposed: false
}

type DeveloperWorkflowDeps = {
  writeRecord?: (record: DeveloperWorkflowRecord) => DeveloperWorkflowRecord
}

export type DeveloperWorkflowResult = {
  ok: boolean
  adapter_id: typeof JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID
  action: string
  change_request_created: boolean
  change_request_id: string | null
  title: string | null
  requested_files: string[]
  validation_plan: string[]
  rollback_plan: string | null
  source_modified: false
  build_invoked: false
  deploy_invoked: false
  external_writes_enabled: false
  public_exposure_changed: false
  credential_values_exposed: false
  raw_paths_exposed: false
  exact_blocker: string | null
}

const storePath = join(config.dataDir, 'jarvis-developer-workflows.json')

function readRecords(): DeveloperWorkflowRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecords(rows: DeveloperWorkflowRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function defaultWriteRecord(record: DeveloperWorkflowRecord) {
  writeRecords([record, ...readRecords()])
  return record
}

function cleanText(value: unknown, fallback: string, max = 1000) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function forbiddenText(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('.env')) return 'env_edit_or_credential_injection_required'
  if (lower.includes('secret') || lower.includes('token') || lower.includes('cookie') || lower.includes('password') || lower.includes('auth_file')) {
    return 'raw_secret_or_auth_file_exposure'
  }
  if (lower.includes('dns') || lower.includes('caddy') || lower.includes('tailscale') || lower.includes('firewall') || lower.includes('public_exposure')) {
    return 'public_exposure_dns_caddy_tailscale_firewall_change'
  }
  if (lower.includes('delete')) return 'destructive_delete_or_data_loss_risk'
  if (lower.includes('disable_auth') || lower.includes('disable_audit') || lower.includes('disable_rollback')) {
    return 'disable_auth_audit_or_rollback'
  }
  if (lower.includes('spend_above_cap')) return 'spending_above_cap'
  if (lower.includes('broad_connector_execution')) return 'outside_mission_control_gateway_jarvis_scope'
  return null
}

function safeFile(value: unknown) {
  if (typeof value !== 'string') return null
  const file = value.trim().replaceAll('\\', '/')
  if (!file || file.startsWith('/') || file.includes('..') || file.length > 220) return null
  if (forbiddenText(file)) return null
  return file
}

function stringArray(value: unknown, fallback: string[], maxItems: number, maxChars: number) {
  const raw = Array.isArray(value) ? value : []
  const cleaned = raw
    .map((item) => cleanText(item, '', maxChars))
    .filter(Boolean)
    .filter((item) => !forbiddenText(item))
    .slice(0, maxItems)
  return cleaned.length ? cleaned : fallback
}

function blockResult(action: string, blocker: string): DeveloperWorkflowResult {
  return {
    ok: false,
    adapter_id: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
    action: action || 'unknown',
    change_request_created: false,
    change_request_id: null,
    title: null,
    requested_files: [],
    validation_plan: [],
    rollback_plan: null,
    source_modified: false,
    build_invoked: false,
    deploy_invoked: false,
    external_writes_enabled: false,
    public_exposure_changed: false,
    credential_values_exposed: false,
    raw_paths_exposed: false,
    exact_blocker: blocker,
  }
}

export function executeJarvisDeveloperWorkflowChangeRequest(
  request: DeveloperWorkflowInput,
  deps: DeveloperWorkflowDeps = {},
): DeveloperWorkflowResult {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_DEVELOPER_WORKFLOW_ACTION ||
    scope.system !== 'mission_control' ||
    scope.operation !== 'create_source_change_request' ||
    scope.target !== 'source_controlled_surface'
  ) {
    return blockResult(action, 'exact_scope_required_jarvis_developer_workflow')
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const title = cleanText(input.title, 'Jarvis Mission Control change request', 180)
  const summary = cleanText(input.summary, 'Controlled Mission Control source-change request. No source file is modified by this adapter.', 1600)
  const textBlocker = forbiddenText(`${title}\n${summary}`)
  if (textBlocker) return blockResult(action, textBlocker)

  const requestedFiles = Array.isArray(input.files)
    ? input.files.map(safeFile).filter((file): file is string => Boolean(file)).slice(0, 12)
    : []
  if (!requestedFiles.length) {
    return blockResult(action, 'safe_source_file_required')
  }

  const validationPlan = stringArray(input.validation_plan, ['typecheck', 'build', 'route smoke'], 12, 160)
  const rollbackPlan = cleanText(input.rollback_plan, 'Remove only this developer workflow record. No source change was applied by the adapter.', 800)
  const rollbackBlocker = forbiddenText(rollbackPlan)
  if (rollbackBlocker) return blockResult(action, rollbackBlocker)

  const record: DeveloperWorkflowRecord = {
    id: `jdw_${randomUUID()}`,
    at: new Date().toISOString(),
    title,
    summary,
    requested_files: requestedFiles,
    validation_plan: validationPlan,
    rollback_plan: rollbackPlan,
    actor: 'agent-zero-jarvis',
    status: 'change_request_recorded',
    source_modified: false,
    build_invoked: false,
    deploy_invoked: false,
    public_exposure_changed: false,
    credential_values_exposed: false,
    raw_paths_exposed: false,
  }
  const written = (deps.writeRecord || defaultWriteRecord)(record)

  return {
    ok: true,
    adapter_id: JARVIS_DEVELOPER_WORKFLOW_ADAPTER_ID,
    action: JARVIS_DEVELOPER_WORKFLOW_ACTION,
    change_request_created: true,
    change_request_id: written.id,
    title: written.title,
    requested_files: written.requested_files,
    validation_plan: written.validation_plan,
    rollback_plan: written.rollback_plan,
    source_modified: false,
    build_invoked: false,
    deploy_invoked: false,
    external_writes_enabled: false,
    public_exposure_changed: false,
    credential_values_exposed: false,
    raw_paths_exposed: false,
    exact_blocker: null,
  }
}
