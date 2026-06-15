import {
  rememberAgentZeroTaskResult,
  type AgentZeroMemPalaceMemoryWriteResult,
} from '@/lib/agent-zero-mempalace-adapter'

export const JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID = 'mempalace_categorized_memory_write'
export const JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION = 'mempalace.memory.categorized_summary_write'
export const JARVIS_MEMPALACE_CATEGORIZED_MEMORY_SESSION_SCOPE = 'mempalace_categorized_memory_write'

export type JarvisMemPalaceCategorizedMemoryResult = {
  ok: boolean
  adapter_id: typeof JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID
  action: typeof JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION
  memory_created: boolean
  memory_id: string | null
  memory_key: string | null
  memory_category: 'task_result' | null
  task_id: string | null
  report_id: string | null
  credential_values_exposed: false
  raw_records_returned: false
  raw_private_dump_enabled: false
  direct_filesystem_exposed: false
  overwrite_performed: false
  exact_blocker: string | null
}

type AdapterInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type Deps = {
  rememberTaskResult?: typeof rememberAgentZeroTaskResult
}

function blocked(exact_blocker: string): JarvisMemPalaceCategorizedMemoryResult {
  return {
    ok: false,
    adapter_id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
    action: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
    memory_created: false,
    memory_id: null,
    memory_key: null,
    memory_category: null,
    task_id: null,
    report_id: null,
    credential_values_exposed: false,
    raw_records_returned: false,
    raw_private_dump_enabled: false,
    direct_filesystem_exposed: false,
    overwrite_performed: false,
    exact_blocker,
  }
}

function sanitizeText(value: unknown, fallback = '', max = 3000): string {
  const raw = typeof value === 'string' ? value : fallback
  return String(raw || fallback)
    .replace(/\0/g, '')
    .replace(/\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s`]+["']?/gi, (match) => {
      const key = match.split(/[:=]/)[0]?.trim() || 'secret'
      return `${key}=<redacted>`
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gi, 'Bearer <redacted>')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{16,}/g, '<redacted-token>')
    .replace(/\/home\/tony\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .replace(/\bruntime\/(?:executive-reports|reports|task-reports)\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .trim()
    .slice(0, max)
}

function safeId(value: unknown, fallback: string): string {
  return sanitizeText(value, fallback, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || fallback
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : []
  return Array.from(new Set(raw
    .map((item) => sanitizeText(item, '', 60).toLowerCase().replace(/[^a-z0-9_/-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .concat(['categorized-memory'])))
    .slice(0, 16)
}

function exactScopeMatches(scope: Record<string, unknown> | undefined): boolean {
  return Boolean(
    scope
      && scope.system === 'mempalace'
      && scope.operation === 'categorized_memory_write'
      && scope.vault === 'safe_memory_summary'
      && scope.category === 'task_result',
  )
}

function memoryResult(write: AgentZeroMemPalaceMemoryWriteResult): JarvisMemPalaceCategorizedMemoryResult {
  const exactBlocker = write.ok ? null : write.blockers[0] || 'mempalace_categorized_memory_write_failed'
  return {
    ok: write.ok,
    adapter_id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
    action: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
    memory_created: write.ok,
    memory_id: write.memory?.id || null,
    memory_key: write.memory?.memory_key || null,
    memory_category: write.memory?.category === 'task_result' ? 'task_result' : null,
    task_id: write.memory?.task_id || null,
    report_id: write.memory?.report_id || null,
    credential_values_exposed: false,
    raw_records_returned: false,
    raw_private_dump_enabled: false,
    direct_filesystem_exposed: false,
    overwrite_performed: false,
    exact_blocker: exactBlocker,
  }
}

export function executeJarvisMemPalaceCategorizedMemory(input: AdapterInput, deps: Deps = {}): JarvisMemPalaceCategorizedMemoryResult {
  if (input.action !== JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION || !exactScopeMatches(input.scope)) {
    return blocked('exact_scope_required_mempalace_categorized_memory')
  }

  const payload = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
  const taskId = safeId(payload.task_id, '')
  if (!taskId) return blocked('mempalace_categorized_memory_task_id_required')
  const summary = sanitizeText(payload.summary, '')
  if (!summary) return blocked('mempalace_categorized_memory_summary_required')

  const rememberTaskResult = deps.rememberTaskResult || rememberAgentZeroTaskResult
  const write = rememberTaskResult({
    taskId,
    resultSummary: summary,
    reportId: sanitizeText(payload.report_id, '', 120) || null,
    reportUrl: sanitizeText(payload.report_url, '', 300) || null,
    confidence: 0.86,
    tags: normalizeTags(payload.tags),
  })
  return memoryResult(write)
}
