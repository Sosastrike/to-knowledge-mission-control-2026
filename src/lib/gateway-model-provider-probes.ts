export type GatewayModelProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'claude'
  | 'claude_anthropic'
  | 'gemini'
  | 'google'
  | 'groq'
  | 'xai'
  | 'xai_grok'
  | 'grok'
  | 'nvidia'
  | 'ollama'
  | string

export type ProviderProbeResult = {
  provider_id: string
  credential_names: string[]
  credential_configured: boolean
  reachable: boolean
  probe_status: 'not_attempted' | 'ok' | 'http_error' | 'unreachable' | 'unsupported'
  http_status?: number | null
  exact_blocker: string | null
  provider_error_summary?: ProviderErrorSummary | null
}

type FetchLike = typeof fetch

export type ProviderErrorSummary = {
  code: string | null
  type: string | null
  status: string | null
  message: string | null
  credential_values_exposed: false
  tokens_exposed: false
  env_values_exposed: false
}

const HOSTED_PROVIDER_CREDENTIALS: Record<string, string[]> = {
  openrouter: ['OPENROUTER_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  claude_anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  gemini: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  groq: ['GROQ_API_KEY'],
  xai: ['XAI_API_KEY'],
  xai_grok: ['XAI_API_KEY'],
  grok: ['XAI_API_KEY'],
  nvidia: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
}

function canonicalProviderId(providerId: GatewayModelProviderId): string {
  const id = String(providerId || '').toLowerCase()
  if (id === 'google') return 'gemini'
  if (id === 'xai' || id === 'grok') return 'xai_grok'
  return id
}

export function credentialNamesForProvider(providerId: GatewayModelProviderId): string[] {
  const id = canonicalProviderId(providerId)
  return HOSTED_PROVIDER_CREDENTIALS[id] || HOSTED_PROVIDER_CREDENTIALS[String(providerId || '').toLowerCase()] || []
}

export function credentialPresenceForProvider(
  providerId: GatewayModelProviderId,
  env: Record<string, string | undefined> = process.env,
): { present: boolean; names: string[] } {
  const names = credentialNamesForProvider(providerId)
  return {
    names,
    present: names.some((name) => Boolean(String(env[name] || '').trim())),
  }
}

function credentialValueForProvider(
  providerId: GatewayModelProviderId,
  env: Record<string, string | undefined>,
): string | null {
  for (const name of credentialNamesForProvider(providerId)) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

function sanitizeProviderError(value: unknown): string {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gsk_|nva-|xai-|AQ)[A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .replace(/[A-Za-z0-9._-]{32,}/g, '[redacted]')
}

export function classifyProviderProbeBlocker(providerId: GatewayModelProviderId, status: number | null): string {
  const id = canonicalProviderId(providerId)
  if (id === 'xai_grok') {
    if (status === null) return 'xai_grok_network_or_timeout'
    if (status === 401) return 'xai_grok_credential_invalid_or_unauthorized'
    if (status === 403) return 'xai_grok_permission_or_billing_required'
    if (status === 404) return 'xai_grok_endpoint_or_model_not_found'
    if (status === 429) return 'xai_grok_rate_limit_or_quota_exceeded'
    return `xai_grok_probe_http_${status}`
  }
  if (status === null) return `${id}_probe_unreachable`
  return `${id}_probe_http_${status}`
}

function summarizeProviderErrorPayload(text: string): ProviderErrorSummary | null {
  const sanitizedText = sanitizeProviderError(text).slice(0, 1200)
  if (!sanitizedText) return null
  try {
    const payload = JSON.parse(sanitizedText) as Record<string, unknown>
    const nestedError = payload.error && typeof payload.error === 'object'
      ? payload.error as Record<string, unknown>
      : payload
    return {
      code: nestedError.code ? sanitizeProviderError(nestedError.code) : null,
      type: nestedError.type ? sanitizeProviderError(nestedError.type) : null,
      status: nestedError.status ? sanitizeProviderError(nestedError.status) : null,
      message: nestedError.message ? sanitizeProviderError(nestedError.message) : null,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  } catch {
    return {
      code: null,
      type: null,
      status: null,
      message: sanitizedText,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    }
  }
}

export function providerColorToken(input: {
  provider_id: GatewayModelProviderId
  registered: boolean
  credential_required: boolean
  credential_configured: boolean
  reachable: boolean
  execution_enabled: boolean
}): 'green' | 'yellow' | 'blue' | 'red' | 'gray' {
  if (input.execution_enabled) return 'green'
  if (input.credential_required && !input.credential_configured) return 'red'
  if (!input.registered) return 'gray'
  if (input.reachable) return 'yellow'
  return input.credential_required ? 'red' : 'gray'
}

export async function probeHostedProvider(
  providerId: GatewayModelProviderId,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 3500,
): Promise<ProviderProbeResult> {
  const id = canonicalProviderId(providerId)
  const names = credentialNamesForProvider(id)
  const credential = credentialValueForProvider(id, env)
  if (!names.length) {
    return {
      provider_id: id,
      credential_names: names,
      credential_configured: false,
      reachable: false,
      probe_status: 'unsupported',
      http_status: null,
      exact_blocker: `${id}_hosted_probe_not_supported`,
    }
  }
  if (!credential) {
    return {
      provider_id: id,
      credential_names: names,
      credential_configured: false,
      reachable: false,
      probe_status: 'not_attempted',
      http_status: null,
      exact_blocker: `${id}_credential_required`,
    }
  }

  return probeHostedProviderCredential(id, credential, fetchImpl, timeoutMs)
}

export async function probeHostedProviderCredential(
  providerId: GatewayModelProviderId,
  credential: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 3500,
): Promise<ProviderProbeResult> {
  const id = canonicalProviderId(providerId)
  const names = credentialNamesForProvider(id)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const request = providerProbeRequest(id, credential)
    if (!request) {
      return {
        provider_id: id,
        credential_names: names,
        credential_configured: true,
        reachable: false,
        probe_status: 'unsupported',
        http_status: null,
        exact_blocker: `${id}_live_probe_not_available_without_execution_scope`,
      }
    }

    const response = await fetchImpl(request.url, {
      method: request.method || 'GET',
      headers: request.headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return {
        provider_id: id,
        credential_names: names,
        credential_configured: true,
        reachable: false,
        probe_status: 'http_error',
        http_status: response.status,
        exact_blocker: classifyProviderProbeBlocker(id, response.status),
        provider_error_summary: summarizeProviderErrorPayload(errorText),
      }
    }
    return {
      provider_id: id,
      credential_names: names,
      credential_configured: true,
      reachable: true,
      probe_status: 'ok',
      http_status: response.status,
      exact_blocker: null,
    }
  } catch {
    return {
      provider_id: id,
      credential_names: names,
      credential_configured: true,
      reachable: false,
      probe_status: 'unreachable',
      http_status: null,
      exact_blocker: classifyProviderProbeBlocker(id, null),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function providerProbeRequest(providerId: string, credential: string): { url: string; method?: string; headers?: HeadersInit } | null {
  if (providerId === 'openrouter') {
    return {
      url: 'https://openrouter.ai/api/v1/models',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  if (providerId === 'openai') {
    return {
      url: 'https://api.openai.com/v1/models',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  if (providerId === 'anthropic' || providerId === 'claude' || providerId === 'claude_anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/models',
      headers: {
        Accept: 'application/json',
        'x-api-key': credential,
        'anthropic-version': '2023-06-01',
      },
    }
  }
  if (providerId === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(credential)}`,
      headers: { Accept: 'application/json' },
    }
  }
  if (providerId === 'groq') {
    return {
      url: 'https://api.groq.com/openai/v1/models',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  if (providerId === 'xai_grok') {
    return {
      url: 'https://api.x.ai/v1/models',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  if (providerId === 'nvidia') {
    return {
      url: 'https://integrate.api.nvidia.com/v1/models',
      headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
    }
  }
  return null
}
