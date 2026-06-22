import { createHash } from 'node:crypto'

export const JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID = 'gateway_ollama_local_model_execute'
export const JARVIS_OLLAMA_LOCAL_MODEL_ACTION = 'gateway.model.ollama_local.execute'
export const JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE = 'gateway_ollama_local_model_execute'
export const JARVIS_OLLAMA_LOCAL_MODEL_NAME = 'qwen2.5:0.5b'

type OllamaLocalModelInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type OllamaLocalModelDeps = {
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>
}

export type OllamaLocalModelResult = {
  ok: boolean
  adapter_id: typeof JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID
  action: string
  provider: 'ollama'
  model: typeof JARVIS_OLLAMA_LOCAL_MODEL_NAME | null
  prompt_hash: string | null
  prompt_tokens_estimate: number
  output_tokens: number
  max_tokens: number
  estimated_cost_usd: 0
  token_governor_enforced: true
  local_model_execution_called: boolean
  external_provider_called: false
  credential_values_exposed: false
  response_preview: string | null
  raw_prompt_returned: false
  raw_endpoint_exposed: false
  exact_blocker: string | null
}

function clean(value: unknown, fallback = '', max = 1000) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback)
    .replace(/https?:\/\/[^\s`'"]+/gi, '[redacted_url]')
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .slice(0, max)
}

function tokenEstimate(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

function promptHash(prompt: string) {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 24)
}

function block(action: string, exactBlocker: string): OllamaLocalModelResult {
  return {
    ok: false,
    adapter_id: JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
    action: action || 'unknown',
    provider: 'ollama',
    model: null,
    prompt_hash: null,
    prompt_tokens_estimate: 0,
    output_tokens: 0,
    max_tokens: 0,
    estimated_cost_usd: 0,
    token_governor_enforced: true,
    local_model_execution_called: false,
    external_provider_called: false,
    credential_values_exposed: false,
    response_preview: null,
    raw_prompt_returned: false,
    raw_endpoint_exposed: false,
    exact_blocker: exactBlocker,
  }
}

export async function executeJarvisOllamaLocalModel(
  request: OllamaLocalModelInput,
  deps: OllamaLocalModelDeps = {},
): Promise<OllamaLocalModelResult> {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = request.scope && typeof request.scope === 'object' && !Array.isArray(request.scope) ? request.scope : {}
  if (
    action !== JARVIS_OLLAMA_LOCAL_MODEL_ACTION ||
    scope.provider !== 'ollama' ||
    scope.operation !== 'local_generate' ||
    scope.model !== JARVIS_OLLAMA_LOCAL_MODEL_NAME
  ) {
    return block(action, 'exact_scope_required_gateway_ollama_local_model')
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const prompt = clean(input.prompt, '', 1000)
  if (!prompt) return block(action, 'ollama_local_model_prompt_required')

  const requestedMaxTokens = typeof input.max_tokens === 'number' && Number.isFinite(input.max_tokens)
    ? Math.floor(input.max_tokens)
    : 32
  if (requestedMaxTokens < 1 || requestedMaxTokens > 64) {
    return block(action, 'ollama_local_model_max_tokens_exceeded')
  }

  const fetcher = deps.fetchImpl || fetch
  const response = await fetcher('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: JARVIS_OLLAMA_LOCAL_MODEL_NAME,
      prompt,
      stream: false,
      options: {
        num_predict: requestedMaxTokens,
        temperature: 0,
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) return block(action, `ollama_local_model_http_${response.status}`)
  const json = await response.json().catch(() => ({})) as Record<string, unknown>
  const model = clean(json.model, JARVIS_OLLAMA_LOCAL_MODEL_NAME, 120)
  if (model !== JARVIS_OLLAMA_LOCAL_MODEL_NAME) return block(action, 'ollama_local_model_response_mismatch')

  const outputText = clean(json.response, '', 500)
  const outputTokens = typeof json.eval_count === 'number' && Number.isFinite(json.eval_count)
    ? Math.max(0, Math.floor(json.eval_count))
    : tokenEstimate(outputText)

  return {
    ok: true,
    adapter_id: JARVIS_OLLAMA_LOCAL_MODEL_ADAPTER_ID,
    action: JARVIS_OLLAMA_LOCAL_MODEL_ACTION,
    provider: 'ollama',
    model: JARVIS_OLLAMA_LOCAL_MODEL_NAME,
    prompt_hash: promptHash(prompt),
    prompt_tokens_estimate: typeof json.prompt_eval_count === 'number' && Number.isFinite(json.prompt_eval_count)
      ? Math.max(0, Math.floor(json.prompt_eval_count))
      : tokenEstimate(prompt),
    output_tokens: outputTokens,
    max_tokens: requestedMaxTokens,
    estimated_cost_usd: 0,
    token_governor_enforced: true,
    local_model_execution_called: true,
    external_provider_called: false,
    credential_values_exposed: false,
    response_preview: outputText.slice(0, 180),
    raw_prompt_returned: false,
    raw_endpoint_exposed: false,
    exact_blocker: null,
  }
}
