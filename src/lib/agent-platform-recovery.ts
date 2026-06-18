import os from 'node:os'
import { existsSync } from 'node:fs'

import { bridgeProviders } from '@/lib/bridge-provider-registry'
import { detectProviderSubscriptions } from '@/lib/provider-subscriptions'
import { credentialPresenceForProvider, credentialNamesForProvider } from '@/lib/gateway-model-provider-probes'
import { getGatewayBridgeRuntimeStatus } from '@/lib/gateway-bridge-runtime'
import { getDatabase } from '@/lib/db'

export const RECOVERY_SAFE_FLAGS = {
  credential_values_exposed: false,
  tokens_exposed: false,
  env_values_exposed: false,
  connector_execution_enabled: false,
  zapier_writes_enabled: false,
  buildwiki_permission_scope: 'opencloud-docs-farmer.service',
} as const

export type ProviderErrorClass =
  | 'invalid_local_request'
  | 'incompatible_model_capability'
  | 'authentication_failure'
  | 'authorization_failure'
  | 'billing_or_quota_unavailable'
  | 'rate_limit'
  | 'request_timeout'
  | 'provider_timeout'
  | 'network_failure'
  | 'provider_5xx'
  | 'malformed_provider_response'
  | 'context_limit_exceeded'
  | 'content_policy_rejection'
  | 'cancelled_by_user'
  | 'cancelled_by_shutdown'
  | 'worker_lease_lost'
  | 'unknown_failure'

export type RetryDecision = {
  retryable: boolean
  max_attempts: number
  jitter_required: boolean
  reason: string
}

export type ClassifiedProviderError = {
  provider_id: string
  http_status: number | null
  error_class: ProviderErrorClass
  retry: RetryDecision
  circuit_breaker_action: 'none' | 'mark_degraded' | 'open_circuit' | 'half_open_probe_only'
  operator_message: string
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
}

function cleanMessage(message: string | null | undefined): string {
  return String(message || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gsk_|nva-|xai-|AQ)[A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .replace(/[A-Za-z0-9._-]{32,}/g, '[redacted]')
    .slice(0, 500)
}

function retryDecision(errorClass: ProviderErrorClass): RetryDecision {
  if (
    errorClass === 'rate_limit' ||
    errorClass === 'request_timeout' ||
    errorClass === 'provider_timeout' ||
    errorClass === 'network_failure' ||
    errorClass === 'provider_5xx'
  ) {
    return {
      retryable: true,
      max_attempts: 2,
      jitter_required: true,
      reason: 'bounded_retry_allowed_for_transient_provider_or_network_condition',
    }
  }

  return {
    retryable: false,
    max_attempts: 1,
    jitter_required: false,
    reason: 'non_retryable_error_must_not_retry_or_storm',
  }
}

export function classifyProviderError(input: {
  provider_id: string
  http_status?: number | null
  message?: string | null
  code?: string | null
  explicit_capability_mismatch?: boolean
}): ClassifiedProviderError {
  const status = input.http_status ?? null
  const message = cleanMessage([input.code, input.message].filter(Boolean).join(' ')).toLowerCase()
  let errorClass: ProviderErrorClass = 'unknown_failure'

  if (input.explicit_capability_mismatch) errorClass = 'incompatible_model_capability'
  else if (status === 400 && /(billing|usage|quota|credits|spend limit|extra usage|plan limits)/i.test(message)) errorClass = 'billing_or_quota_unavailable'
  else if (status === 400) errorClass = 'invalid_local_request'
  else if (status === 401) errorClass = 'authentication_failure'
  else if (status === 403) errorClass = /(billing|quota|credits|permission|not allowed)/i.test(message) ? 'billing_or_quota_unavailable' : 'authorization_failure'
  else if (status === 408) errorClass = 'request_timeout'
  else if (status === 409 && /lease/i.test(message)) errorClass = 'worker_lease_lost'
  else if (status === 413 || /context.*limit|token.*limit/i.test(message)) errorClass = 'context_limit_exceeded'
  else if (status === 422 && /content|policy|safety/i.test(message)) errorClass = 'content_policy_rejection'
  else if (status === 429) errorClass = 'rate_limit'
  else if (status !== null && status >= 500) errorClass = 'provider_5xx'
  else if (/timeout/i.test(message)) errorClass = 'provider_timeout'
  else if (/network|econnreset|enotfound|socket/i.test(message)) errorClass = 'network_failure'
  else if (/malformed|invalid json|parse/i.test(message)) errorClass = 'malformed_provider_response'
  else if (/cancelled.*user|user.*cancel/i.test(message)) errorClass = 'cancelled_by_user'
  else if (/shutdown/i.test(message)) errorClass = 'cancelled_by_shutdown'

  const retry = retryDecision(errorClass)
  const circuitBreakerAction =
    errorClass === 'billing_or_quota_unavailable' || errorClass === 'authentication_failure' || errorClass === 'authorization_failure'
      ? 'open_circuit'
      : retry.retryable
        ? 'mark_degraded'
        : 'none'

  return {
    provider_id: String(input.provider_id || 'unknown'),
    http_status: status,
    error_class: errorClass,
    retry,
    circuit_breaker_action: circuitBreakerAction,
    operator_message: operatorMessage(input.provider_id, errorClass),
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  }
}

function operatorMessage(providerId: string, errorClass: ProviderErrorClass): string {
  if (errorClass === 'billing_or_quota_unavailable') {
    return `${providerId} is unavailable because the provider account reports usage, billing, quota, or credits unavailable. This is non-retryable until owner/provider action.`
  }
  if (errorClass === 'invalid_local_request') {
    return `${providerId} rejected the request schema. Fix the local adapter/request mode before retrying.`
  }
  if (errorClass === 'incompatible_model_capability') {
    return `${providerId} route does not satisfy the requested model/tool/response capability.`
  }
  return `${providerId} route classified as ${errorClass}.`
}

export type ModelCapabilityRecord = {
  provider_id: string
  display_name: string
  credential_names: string[]
  credential_configured: boolean
  account_subscription_configured: boolean
  text: boolean
  image: boolean
  tool_calling: boolean
  structured_output: boolean
  streaming: boolean
  endpoint_modes: string[]
  current_health: 'unknown' | 'configured' | 'missing_credential' | 'read_only' | 'degraded'
  execution_enabled: false
  allowed_agents: string[]
  fallback_allowed: boolean
  explicit_model_override_allowed: true
  validation_required_before_execution: true
}

const PROVIDER_CAPABILITIES: Record<string, Partial<ModelCapabilityRecord>> = {
  openrouter: { text: true, image: true, tool_calling: true, structured_output: true, streaming: true, endpoint_modes: ['chat_completions_by_default', 'provider_specific_when_validated'], fallback_allowed: true },
  openai: { text: true, image: true, tool_calling: true, structured_output: true, streaming: true, endpoint_modes: ['responses_or_chat_completions_when_validated'], fallback_allowed: true },
  anthropic: { text: true, image: true, tool_calling: true, structured_output: false, streaming: true, endpoint_modes: ['anthropic_messages_or_claude_cli_account'], fallback_allowed: true },
  claude: { text: true, image: true, tool_calling: true, structured_output: false, streaming: true, endpoint_modes: ['claude_cli_account'], fallback_allowed: true },
  gemini: { text: true, image: true, tool_calling: true, structured_output: true, streaming: true, endpoint_modes: ['google_generate_content'], fallback_allowed: true },
  groq: { text: true, image: false, tool_calling: true, structured_output: true, streaming: true, endpoint_modes: ['openai_compatible_chat_completions'], fallback_allowed: true },
  xai_grok: { text: true, image: true, tool_calling: true, structured_output: true, streaming: true, endpoint_modes: ['openai_compatible_chat_completions'], fallback_allowed: true },
  nvidia: { text: true, image: true, tool_calling: false, structured_output: false, streaming: true, endpoint_modes: ['nvidia_nim_openai_compatible'], fallback_allowed: true },
  ollama: { text: true, image: false, tool_calling: false, structured_output: false, streaming: true, endpoint_modes: ['local_ollama'], fallback_allowed: true },
}

function providerDisplayName(providerId: string): string {
  return bridgeProviders.find((provider) => provider.id === providerId)?.label || providerId
}

export function buildModelCapabilityRegistry(): { generated_at: string; providers: ModelCapabilityRecord[]; summary: Record<string, unknown> } {
  const subscriptions = detectProviderSubscriptions().active
  const ids = Array.from(new Set([...Object.keys(PROVIDER_CAPABILITIES), ...bridgeProviders.map((provider) => provider.id)]))
  const providers = ids.map((providerId) => {
    const credential = credentialPresenceForProvider(providerId)
    const capability = PROVIDER_CAPABILITIES[providerId] || {}
    const accountSubscriptionConfigured = Boolean(subscriptions[providerId === 'claude' ? 'anthropic' : providerId])
    const credentialRequired = credential.names.length > 0 && providerId !== 'ollama'
    const configured = credential.present || accountSubscriptionConfigured || providerId === 'ollama'
    const currentHealth: ModelCapabilityRecord['current_health'] = configured
      ? 'configured'
      : credentialRequired
        ? 'missing_credential'
        : 'read_only'

    return {
      provider_id: providerId,
      display_name: providerDisplayName(providerId),
      credential_names: credential.names.length ? credential.names : credentialNamesForProvider(providerId),
      credential_configured: credential.present,
      account_subscription_configured: accountSubscriptionConfigured,
      text: capability.text !== false,
      image: capability.image === true,
      tool_calling: capability.tool_calling === true,
      structured_output: capability.structured_output === true,
      streaming: capability.streaming === true,
      endpoint_modes: capability.endpoint_modes || ['not_yet_validated'],
      current_health: currentHealth,
      execution_enabled: false,
      allowed_agents: ['agent-zero', 'tony', 'hermes', 'sofia', 'researcher', 'operator', 'builder', 'future-agents'],
      fallback_allowed: capability.fallback_allowed !== false,
      explicit_model_override_allowed: true,
      validation_required_before_execution: true,
    } satisfies ModelCapabilityRecord
  })

  return {
    generated_at: new Date().toISOString(),
    providers,
    summary: {
      providers_total: providers.length,
      configured_or_account_backed: providers.filter((provider) => provider.credential_configured || provider.account_subscription_configured).length,
      execution_enabled: false,
      explicit_model_override_allowed: true,
      validation_required_before_execution: true,
      no_secrets_exposed: true,
      ...RECOVERY_SAFE_FLAGS,
    },
  }
}

export function buildRecoveryDependencyMap() {
  return {
    browser: 'https://tkmc.knowledge-vs-ai.com',
    reverse_proxy: 'Caddy / Cloudflare public edge (observed externally, not modified by this recovery batch)',
    mission_control: 'mission-control.service on 127.0.0.1:3337',
    gateway_frontend: '/gateway and /gateway/agent-hub',
    agent_hub_api: '/api/gateway/agent-hub/status and /api/gateway/agent-hub/registry',
    agent_zero: 'agent-zero container on 100.116.35.95:50080',
    sofia: 'Mission Control Sofia direct-line routes under /api/bridge/sofia/*',
    model_registry: '/api/platform/recovery/model-capabilities',
    provider_status: '/api/gateway/models and /api/bridge/providers',
    jobs: '/api/platform/recovery/jobs and /api/tasks/queue',
    context: '/api/platform/recovery/context and /api/bridge/brain-context',
    dependency_order: [
      'Browser',
      'Cloudflare/Caddy',
      'Mission Control Gateway UI',
      'Agent Hub API',
      'Agent Zero container',
      'Sofia Mission Control routes',
      'model capability registry',
      'provider adapter',
      'external provider/account',
    ],
  }
}

export function buildBaselineSnapshot() {
  const runtime = getGatewayBridgeRuntimeStatus()
  return {
    generated_at: new Date().toISOString(),
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime_seconds: Math.round(os.uptime()),
      cpu_count: os.cpus().length,
      total_memory_bytes: os.totalmem(),
      free_memory_bytes: os.freemem(),
    },
    process: {
      node: process.version,
      pid: process.pid,
      uptime_seconds: Math.round(process.uptime()),
      cwd: process.cwd(),
      next_runtime: 'nodejs',
    },
    repositories: {
      mission_control: '/home/tony/mission-control',
      claudeclaw: '/home/tony/claudeclaw',
      dirty_tree_policy: 'stage_only_files_touched_by_recovery_batch',
    },
    dependency_map: buildRecoveryDependencyMap(),
    gateway_bridge_runtime: runtime,
    confirmed_facts: [
      'Mission Control exposes Gateway, Agent Hub, provider, task, and Sofia route surfaces.',
      'Sofia is represented by Mission Control direct-line routes under /api/bridge/sofia/*.',
      'Provider execution remains disabled in this recovery batch.',
      'Build-Wiki Run Now scope remains opencloud-docs-farmer.service only.',
    ],
    hypotheses: [
      {
        hypothesis: 'Observed provider failures are caused by request-mode or account/quota issues, not physical host exhaustion.',
        confirmation_test: 'Use provider error taxonomy plus redacted live/provider canaries where credentials and policy permit.',
      },
      {
        hypothesis: 'Agent Hub Open UI failures are caused by route/session/proxy mismatch, not missing Agent Zero container.',
        confirmation_test: 'Trace /api/gateway/agent-hub/registry Open UI target and browser-visible route with auth session.',
      },
    ],
    ...RECOVERY_SAFE_FLAGS,
  }
}

function tableExists(db: ReturnType<typeof getDatabase>, tableName: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(tableName) as { name?: string } | undefined
  return Boolean(row?.name)
}

function countRows(db: ReturnType<typeof getDatabase>, tableName: string): number | null {
  if (!tableExists(db, tableName)) return null
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
  return row.count
}

export function buildJobStatusSnapshot() {
  const db = getDatabase()
  const taskCount = countRows(db, 'tasks')
  const inProgress = tableExists(db, 'tasks')
    ? (db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'`).get() as { count: number }).count
    : null
  const awaitingOwner = tableExists(db, 'tasks')
    ? (db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'awaiting_owner'`).get() as { count: number }).count
    : null

  return {
    generated_at: new Date().toISOString(),
    route: 'platform.recovery.jobs',
    durable_job_contract: {
      required_fields: ['job_id', 'task_type', 'owner', 'state', 'input', 'idempotency_key', 'worker_id', 'start_time', 'last_heartbeat', 'progress', 'log_location', 'result', 'exit_status', 'retry_count', 'audit_events'],
      new_messages_must_not_cancel_unrelated_jobs: true,
      explicit_cancel_required: true,
      browser_refresh_must_not_erase_job_state: true,
    },
    current_storage: {
      tasks_table_present: tableExists(db, 'tasks'),
      tasks_total: taskCount,
      tasks_in_progress: inProgress,
      tasks_awaiting_owner: awaitingOwner,
      claude_tasks_readonly_scanner_present: existsSync('/home/tony/mission-control/src/lib/claude-tasks.ts'),
    },
    next_gap: 'Add or connect a full durable worker/job table before calling arbitrary long-running work background execution.',
    ...RECOVERY_SAFE_FLAGS,
  }
}

export function buildContextStatusSnapshot() {
  return {
    generated_at: new Date().toISOString(),
    route: 'platform.recovery.context',
    context_policy: {
      model_relative_budgets_required: true,
      checkpoint_before_repeated_compaction: true,
      raw_transcript_archive_required: true,
      structured_handoff_required_before_model_transition: true,
      do_not_resend_100k_token_sessions: true,
    },
    checkpoints: {
      current_status: 'contract_defined_not_globally_enforced',
      checkpoint_record_required_fields: ['task_id', 'agent_id', 'checkpoint_version', 'objective', 'constraints', 'completed_steps', 'outstanding_steps', 'artifacts', 'tool_results', 'approvals', 'last_model_used', 'error_history'],
    },
    live_context_routes: {
      mission_control_bridge_brain_context: '/api/bridge/brain-context',
      claudeclaw_brain_context: '/api/brain/context',
    },
    failure_behavior: 'If a provider fails or context budget is exceeded, freeze checkpoint and resume through validated route instead of growing raw prompt.',
    ...RECOVERY_SAFE_FLAGS,
  }
}
