import { createHash } from 'node:crypto'

import { getDatabase } from '@/lib/db'
import { calculateTokenCost } from '@/lib/token-pricing'
import { getProviderCredential, type ProviderCredentialResult } from '@/lib/provider-vault'
import { probeHostedProviderCredential, type ProviderProbeResult } from '@/lib/gateway-model-provider-probes'

export const JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID = 'provider_model_execution'
export const JARVIS_PROVIDER_MODEL_EXECUTION_ACTION = 'gateway.model.provider.execute'
export const JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE = 'provider_model_execution'

type ProviderId = 'openrouter' | 'gemini' | 'groq' | 'nvidia' | 'xai_grok'

type ProviderModelExecutionSession = {
  id: string
  allowed_scopes?: string[]
  cost_cap_usd?: number | null
}

type ProviderModelExecutionInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
  session?: ProviderModelExecutionSession | null
}

export type ProviderModelUsageRecord = {
  provider: ProviderId
  model: string
  session_id: string
  prompt_tokens: number
  output_tokens: number
  cost_usd: number
  credential_values_exposed: false
}

type ProviderModelExecutionDeps = {
  getCredential?: (providerId: ProviderId) => ProviderCredentialResult
  probeProvider?: (providerId: ProviderId, credential: string) => Promise<Pick<ProviderProbeResult, 'reachable' | 'probe_status' | 'exact_blocker'>>
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>
  readSessionSpend?: (sessionId: string) => number
  recordUsage?: (usage: ProviderModelUsageRecord) => void
}

export type ProviderModelExecutionResult = {
  ok: boolean
  adapter_id: typeof JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID
  action: string
  provider: ProviderId | null
  model: string | null
  prompt_hash: string | null
  prompt_tokens_estimate: number
  output_tokens: number
  max_tokens: number
  estimated_cost_usd: number
  session_spend_usd: number
  session_remaining_cap_usd: number | null
  token_governor_enforced: true
  cost_governor_enforced: true
  external_provider_called: boolean
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
  response_preview: string | null
  raw_prompt_returned: false
  raw_endpoint_exposed: false
  exact_blocker: string | null
}

const MAX_PROMPT_CHARS = 1200
const MAX_OUTPUT_TOKENS = 128

function canonicalProvider(value: unknown): ProviderId | null {
  const id = String(value || '').trim().toLowerCase()
  if (id === 'google') return 'gemini'
  if (id === 'grok' || id === 'xai') return 'xai_grok'
  if (id === 'openrouter' || id === 'gemini' || id === 'groq' || id === 'nvidia' || id === 'xai_grok') return id
  return null
}

function sanitizeText(value: unknown, fallback = '', max = 1200): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gsk_|nva-|xai-|AQ)[A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .replace(/[A-Za-z0-9._-]{48,}/g, '[redacted]')
    .replace(/https?:\/\/[^\s`'"]+/gi, '[redacted_url]')
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function tokenEstimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 24)
}

export function providerModelExactScope(provider: ProviderId, model: string): string {
  return `${JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE}:${provider}:${model}`
}

function block(input: {
  action?: string
  provider?: ProviderId | null
  model?: string | null
  exactBlocker: string
  promptHash?: string | null
  promptTokens?: number
  maxTokens?: number
  estimatedCost?: number
  sessionSpend?: number
  remainingCap?: number | null
}): ProviderModelExecutionResult {
  return {
    ok: false,
    adapter_id: JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
    action: input.action || 'unknown',
    provider: input.provider || null,
    model: input.model || null,
    prompt_hash: input.promptHash || null,
    prompt_tokens_estimate: input.promptTokens || 0,
    output_tokens: 0,
    max_tokens: input.maxTokens || 0,
    estimated_cost_usd: input.estimatedCost || 0,
    session_spend_usd: input.sessionSpend || 0,
    session_remaining_cap_usd: input.remainingCap === undefined ? null : input.remainingCap,
    token_governor_enforced: true,
    cost_governor_enforced: true,
    external_provider_called: false,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    response_preview: null,
    raw_prompt_returned: false,
    raw_endpoint_exposed: false,
    exact_blocker: input.exactBlocker,
  }
}

function normalizeUsageNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

function responseTextFromOpenAiCompatible(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const message = (first as Record<string, unknown>).message
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') {
          return (part as Record<string, unknown>).text
        }
        return ''
      }).join('')
    }
  }
  const text = (first as Record<string, unknown>).text
  return typeof text === 'string' ? text : ''
}

function responseTextFromGemini(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  const first = candidates[0]
  if (!first || typeof first !== 'object') return ''
  const content = (first as Record<string, unknown>).content
  if (!content || typeof content !== 'object') return ''
  const parts = Array.isArray((content as Record<string, unknown>).parts) ? (content as Record<string, unknown>).parts as unknown[] : []
  return parts.map((part) => {
    if (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') {
      return (part as Record<string, unknown>).text
    }
    return ''
  }).join('')
}

function providerRequest(provider: ProviderId, credential: string, model: string, prompt: string, maxTokens: number): { url: string; init: RequestInit } {
  if (provider === 'gemini') {
    const modelPath = model.startsWith('models/') ? model : `models/${model}`
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(credential)}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      },
    }
  }

  const urls: Record<Exclude<ProviderId, 'gemini'>, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
    xai_grok: 'https://api.x.ai/v1/chat/completions',
  }
  return {
    url: urls[provider],
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: maxTokens,
        stream: false,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    },
  }
}

function defaultReadSessionSpend(sessionId: string): number {
  try {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM token_usage
      WHERE session_id = ?
    `).get(sessionId) as { total?: number } | undefined
    return typeof row?.total === 'number' && Number.isFinite(row.total) ? Math.max(0, row.total) : 0
  } catch {
    return 0
  }
}

function defaultRecordUsage(usage: ProviderModelUsageRecord): void {
  try {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO token_usage (model, session_id, input_tokens, output_tokens, cost_usd, agent_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `${usage.provider}/${usage.model}`,
      usage.session_id,
      usage.prompt_tokens,
      usage.output_tokens,
      usage.cost_usd,
      'agent-zero-jarvis',
    )
  } catch {
    // Cost governor audit is best-effort behind the primary Jarvis audit record.
  }
}

export async function executeJarvisProviderModelExecution(
  request: ProviderModelExecutionInput,
  deps: ProviderModelExecutionDeps = {},
): Promise<ProviderModelExecutionResult> {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  const provider = canonicalProvider(scope.provider)
  const model = sanitizeText(scope.model, '', 160)
  const exactScope = provider && model ? providerModelExactScope(provider, model) : null

  if (action !== JARVIS_PROVIDER_MODEL_EXECUTION_ACTION || !provider || scope.operation !== 'chat_completion' || !model) {
    return block({ action, provider, model: model || null, exactBlocker: 'exact_scope_required_provider_model_execution' })
  }
  if (!exactScope) return block({ action, provider, model, exactBlocker: 'exact_scope_required_provider_model_execution' })
  const requiredExactScope = exactScope

  if (scope.exact_scope !== requiredExactScope) {
    return block({ action, provider, model, exactBlocker: `bridge_session_scope_missing_${requiredExactScope}` })
  }

  const session = request.session || null
  const allowedScopes = Array.isArray(session?.allowed_scopes) ? session.allowed_scopes : []
  if (!session?.id || !allowedScopes.includes(JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE)) {
    return block({ action, provider, model, exactBlocker: `bridge_session_scope_missing_${JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE}` })
  }
  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const prompt = sanitizeText(input.prompt, '', MAX_PROMPT_CHARS)
  if (!prompt) return block({ action, provider, model, exactBlocker: 'provider_model_execution_prompt_required' })

  const requestedMaxTokens = typeof input.max_tokens === 'number' && Number.isFinite(input.max_tokens)
    ? Math.floor(input.max_tokens)
    : 64
  if (requestedMaxTokens < 1 || requestedMaxTokens > MAX_OUTPUT_TOKENS) {
    return block({ action, provider, model, exactBlocker: 'provider_model_execution_max_tokens_exceeded' })
  }

  const promptTokens = tokenEstimate(prompt)
  const estimatedCost = calculateTokenCost(`${provider}/${model}`, promptTokens, requestedMaxTokens)
  const readSpend = deps.readSessionSpend || defaultReadSessionSpend
  const sessionSpend = readSpend(session.id)
  const cap = typeof session.cost_cap_usd === 'number' && Number.isFinite(session.cost_cap_usd)
    ? Math.max(0, session.cost_cap_usd)
    : 0
  const remainingCap = Math.max(0, cap - sessionSpend)
  if (cap <= 0 || estimatedCost > remainingCap) {
    return block({
      action,
      provider,
      model,
      exactBlocker: 'provider_model_execution_cost_cap_exceeded',
      promptHash: promptHash(prompt),
      promptTokens,
      maxTokens: requestedMaxTokens,
      estimatedCost,
      sessionSpend,
      remainingCap,
    })
  }

  const credential = (deps.getCredential || getProviderCredential)(provider)
  if (!credential.found) {
    return block({
      action,
      provider,
      model,
      exactBlocker: credential.exact_blocker || `${provider}_credential_required`,
      promptHash: promptHash(prompt),
      promptTokens,
      maxTokens: requestedMaxTokens,
      estimatedCost,
      sessionSpend,
      remainingCap,
    })
  }

  const probe = await (deps.probeProvider || ((providerId: ProviderId, value: string) => probeHostedProviderCredential(providerId, value)))(provider, credential.value)
  if (!probe.reachable || probe.exact_blocker) {
    return block({
      action,
      provider,
      model,
      exactBlocker: probe.exact_blocker || `${provider}_probe_not_reachable`,
      promptHash: promptHash(prompt),
      promptTokens,
      maxTokens: requestedMaxTokens,
      estimatedCost,
      sessionSpend,
      remainingCap,
    })
  }

  const requestConfig = providerRequest(provider, credential.value, model, prompt, requestedMaxTokens)
  const fetcher = deps.fetchImpl || fetch
  const response = await fetcher(requestConfig.url, requestConfig.init)
  if (!response.ok) {
    return block({
      action,
      provider,
      model,
      exactBlocker: `${provider}_generation_http_${response.status}`,
      promptHash: promptHash(prompt),
      promptTokens,
      maxTokens: requestedMaxTokens,
      estimatedCost,
      sessionSpend,
      remainingCap,
    })
  }

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage as Record<string, unknown> : {}
  const usageMetadata = payload.usageMetadata && typeof payload.usageMetadata === 'object'
    ? payload.usageMetadata as Record<string, unknown>
    : {}
  const actualPromptTokens = normalizeUsageNumber(usage.prompt_tokens, normalizeUsageNumber(usageMetadata.promptTokenCount, promptTokens))
  const outputText = provider === 'gemini' ? responseTextFromGemini(payload) : responseTextFromOpenAiCompatible(payload)
  const actualOutputTokens = normalizeUsageNumber(
    usage.completion_tokens,
    normalizeUsageNumber(usageMetadata.candidatesTokenCount, tokenEstimate(outputText)),
  )
  const actualCost = calculateTokenCost(`${provider}/${model}`, actualPromptTokens, actualOutputTokens)
  const recordUsage = deps.recordUsage || defaultRecordUsage
  recordUsage({
    provider,
    model,
    session_id: session.id,
    prompt_tokens: actualPromptTokens,
    output_tokens: actualOutputTokens,
    cost_usd: actualCost,
    credential_values_exposed: false,
  })

  return {
    ok: true,
    adapter_id: JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
    action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
    provider,
    model,
    prompt_hash: promptHash(prompt),
    prompt_tokens_estimate: actualPromptTokens,
    output_tokens: actualOutputTokens,
    max_tokens: requestedMaxTokens,
    estimated_cost_usd: actualCost,
    session_spend_usd: sessionSpend,
    session_remaining_cap_usd: remainingCap,
    token_governor_enforced: true,
    cost_governor_enforced: true,
    external_provider_called: true,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
    response_preview: sanitizeText(outputText, '', 300),
    raw_prompt_returned: false,
    raw_endpoint_exposed: false,
    exact_blocker: null,
  }
}
