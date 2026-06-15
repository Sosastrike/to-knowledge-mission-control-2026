import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { getSchedulerStatus, triggerTask } from '@/lib/scheduler'

export const JARVIS_SCHEDULER_RUN_ADAPTER_ID = 'scheduler_run_now'
export const JARVIS_SCHEDULER_RUN_ACTION = 'scheduler.run_now'
export const JARVIS_SCHEDULER_RUN_SESSION_SCOPE = 'scheduler_run_now_auto_backup'
export const JARVIS_SCHEDULER_RUN_TASK_ID = 'auto_backup'

type SchedulerTask = {
  id: string
  name?: string
  enabled?: boolean
  running?: boolean
  lastRun?: number | null
  nextRun?: number
}

type SchedulerStatus = SchedulerTask[] | { tasks?: SchedulerTask[] }

export type JarvisSchedulerRunInput = {
  action: string
  scope: Record<string, unknown>
}

export type JarvisSchedulerRunResult = {
  ok: boolean
  adapter_id: typeof JARVIS_SCHEDULER_RUN_ADAPTER_ID
  action: string
  scope: Record<string, unknown>
  task_id: typeof JARVIS_SCHEDULER_RUN_TASK_ID | null
  scheduler_task_registered: boolean
  scheduler_task_enabled: boolean | null
  scheduler_task_triggered: boolean
  trigger_ok: boolean
  message: string
  backup_artifact_ids: string[]
  backup_artifacts_created: number
  credential_values_exposed: false
  external_writes_enabled: false
  provider_execution_called: false
  paperclip_write_called: false
  zapier_execution_called: false
  n8n_workflow_activation_called: false
  delivery_send_or_upload_called: false
  raw_paths_exposed: false
  exact_blocker: string | null
}

export type JarvisSchedulerRunDeps = {
  getSchedulerStatus: () => SchedulerStatus
  triggerTask: (taskId: string) => Promise<{ ok: boolean; message: string }>
  listBackupArtifacts: () => string[]
}

function normalizeTasks(status: SchedulerStatus): SchedulerTask[] {
  if (Array.isArray(status)) return status
  return Array.isArray(status.tasks) ? status.tasks : []
}

function safeMessage(value: unknown) {
  const raw = typeof value === 'string' ? value : ''
  return raw
    .replace(/\/(?:[^\s'"`]+\/)+[^\s'"`]+/g, '[redacted_path]')
    .replace(/[A-Za-z]:\\(?:[^\s'"`]+\\)+[^\s'"`]+/g, '[redacted_path]')
    .slice(0, 220)
}

export function listSchedulerBackupArtifacts(): string[] {
  const backupDir = join(dirname(config.dbPath), 'backups')
  try {
    return readdirSync(backupDir)
      .filter((name) => name.startsWith('mc-backup-') && name.endsWith('.db'))
      .map((name) => ({
        name: basename(name),
        mtime: statSync(join(backupDir, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .map((row) => row.name)
  } catch {
    return []
  }
}

function result(input: Partial<JarvisSchedulerRunResult> & Pick<JarvisSchedulerRunResult, 'ok' | 'exact_blocker'>): JarvisSchedulerRunResult {
  return {
    adapter_id: JARVIS_SCHEDULER_RUN_ADAPTER_ID,
    action: input.action || JARVIS_SCHEDULER_RUN_ACTION,
    scope: input.scope || {},
    task_id: input.task_id === JARVIS_SCHEDULER_RUN_TASK_ID ? JARVIS_SCHEDULER_RUN_TASK_ID : null,
    scheduler_task_registered: Boolean(input.scheduler_task_registered),
    scheduler_task_enabled: typeof input.scheduler_task_enabled === 'boolean' ? input.scheduler_task_enabled : null,
    scheduler_task_triggered: Boolean(input.scheduler_task_triggered),
    trigger_ok: Boolean(input.trigger_ok),
    message: input.message || '',
    backup_artifact_ids: input.backup_artifact_ids || [],
    backup_artifacts_created: input.backup_artifacts_created || 0,
    credential_values_exposed: false,
    external_writes_enabled: false,
    provider_execution_called: false,
    paperclip_write_called: false,
    zapier_execution_called: false,
    n8n_workflow_activation_called: false,
    delivery_send_or_upload_called: false,
    raw_paths_exposed: false,
    ok: input.ok,
    exact_blocker: input.exact_blocker,
  }
}

export async function executeJarvisSchedulerRunNow(
  input: JarvisSchedulerRunInput,
  deps: JarvisSchedulerRunDeps = {
    getSchedulerStatus,
    triggerTask,
    listBackupArtifacts: listSchedulerBackupArtifacts,
  },
): Promise<JarvisSchedulerRunResult> {
  const scope = input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope) ? input.scope : {}
  if (
    input.action !== JARVIS_SCHEDULER_RUN_ACTION ||
    scope.system !== 'scheduler' ||
    scope.operation !== 'run_now' ||
    scope.task_id !== JARVIS_SCHEDULER_RUN_TASK_ID
  ) {
    return result({
      ok: false,
      action: input.action,
      scope,
      exact_blocker: 'exact_scope_required_scheduler_auto_backup',
    })
  }

  const tasks = normalizeTasks(deps.getSchedulerStatus())
  const task = tasks.find((item) => item.id === JARVIS_SCHEDULER_RUN_TASK_ID)
  if (!task) {
    return result({
      ok: false,
      action: input.action,
      scope,
      task_id: JARVIS_SCHEDULER_RUN_TASK_ID,
      scheduler_task_registered: false,
      exact_blocker: 'scheduler_auto_backup_task_not_registered',
    })
  }
  const before = new Set(deps.listBackupArtifacts().map((id) => basename(id)))
  const triggered = await deps.triggerTask(JARVIS_SCHEDULER_RUN_TASK_ID)
  const after = deps.listBackupArtifacts().map((id) => basename(id))
  const created = after.filter((id) => !before.has(id))

  return result({
    ok: triggered.ok,
    action: input.action,
    scope,
    task_id: JARVIS_SCHEDULER_RUN_TASK_ID,
    scheduler_task_registered: true,
    scheduler_task_enabled: task.enabled ?? true,
    scheduler_task_triggered: true,
    trigger_ok: triggered.ok,
    message: safeMessage(triggered.message),
    backup_artifact_ids: created,
    backup_artifacts_created: created.length,
    exact_blocker: triggered.ok ? null : 'scheduler_auto_backup_run_failed',
  })
}
