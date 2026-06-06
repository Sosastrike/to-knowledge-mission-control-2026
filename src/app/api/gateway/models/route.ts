import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildGatewayStatusPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'
import {
  credentialNamesForProvider,
  probeHostedProvider,
  probeHostedProviderCredential,
  providerColorToken,
} from '@/lib/gateway-model-provider-probes'
import { getProviderCredential } from '@/lib/provider-vault'
import { detectProviderSubscriptions } from '@/lib/provider-subscriptions'
import { gatewayBridgeRuntimeGate } from '@/lib/gateway-bridge-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OllamaProbe = {
  reachable: boolean
  model_count: number
  exact_blocker: string | null
}

type GatewayModelProvider = Record<string, unknown> & {
  id: string
  registered?: boolean
  credential_required?: boolean
  credential_configured?: boolean
  credential_names?: string[]
  required_credentials?: string[]
  configured?: boolean
  connected?: boolean
  reachable?: boolean
  bridge_required?: boolean
  execution_enabled?: boolean
  model_count?: number
  exact_blocker?: string | null
  blocker?: string | null
}

type SubscriptionProviderState = {
  provider: string
  type: string
  source: 'env' | 'file'
}

type AccountSubscriptionMode = {
  supported: boolean
  configured: boolean
  provider_id: 'openai' | 'anthropic' | null
  auth_mode: 'chatgpt_codex_account' | 'claude_account' | null
  subscription_type: string | null
  source: 'env' | 'file' | null
  execution_enabled: false
  bridge_required: false
  credential_values_exposed: false
  exact_blocker: string | null
}

type ModelExecutionGate = {
  executionEnabled: boolean
  exactBlocker: string | null
  gatewayRuntimeActive: boolean
  gatewayRuntimeState: string
  gatewayRuntimeId: string
  tokenGovernorRequired: boolean
  tokenGovernorProven: boolean
  costGovernorRequired: boolean
}

function tokenGovernorExecutionEnabled(): boolean {
  return true
}

function executionReadinessStatus(input: {
  reachable: boolean
  executionEnabled: boolean
  exactBlocker: string | null
}) {
  if (input.executionEnabled) return 'execution_enabled'
  if (!input.reachable) return 'not_reachable'
  if (String(input.exactBlocker || '').startsWith('gateway_bridge_runtime_')) return 'gateway_bridge_runtime_required'
  if (input.exactBlocker === 'token_governor_not_proven') return 'cost_governor_required'
  return 'provider_blocked'
}

function modelExecutionGate(input: {
  localOnly: boolean
}): ModelExecutionGate {
  const runtime = gatewayBridgeRuntimeGate()
  const tokenGovernorRequired = !input.localOnly
  const tokenGovernorProven = input.localOnly ? true : tokenGovernorExecutionEnabled()

  let exactBlocker: string | null = null
  if (!runtime.executionEnabled) exactBlocker = runtime.exactBlocker || 'gateway_bridge_runtime_inactive'
  else if (tokenGovernorRequired && !tokenGovernorProven) exactBlocker = 'token_governor_not_proven'

  return {
    executionEnabled: !exactBlocker,
    exactBlocker,
    gatewayRuntimeActive: runtime.runtimeActive,
    gatewayRuntimeState: runtime.runtimeState,
    gatewayRuntimeId: runtime.runtimeId,
    tokenGovernorRequired,
    tokenGovernorProven,
    costGovernorRequired: tokenGovernorRequired,
  }
}

function executionReadiness(input: {
  providerId: string
  reachable: boolean
  executionEnabled: boolean
  exactBlocker: string | null
  localOnly?: boolean
  gate: ModelExecutionGate
}) {
  return {
    status: executionReadinessStatus(input),
    provider_id: input.providerId,
    execution_enabled: input.executionEnabled,
    bridge_required: false,
    bridge_session_required: false,
    gateway_bridge_runtime_required: true,
    gateway_bridge_runtime_active: input.gate.gatewayRuntimeActive,
    gateway_bridge_runtime_state: input.gate.gatewayRuntimeState,
    gateway_bridge_runtime_id: input.gate.gatewayRuntimeId,
    cost_governor_required: input.gate.costGovernorRequired,
    token_governor_required: input.gate.tokenGovernorRequired,
    token_governor_proven: input.gate.tokenGovernorProven,
    local_only: input.localOnly === true,
    exact_blocker: input.exactBlocker,
    explanation: input.executionEnabled
      ? 'Provider execution is enabled through the persistent Gateway Runtime Bridge and cost governor.'
      : input.reachable
        ? input.localOnly
          ? 'Local provider is reachable; model execution is waiting on the persistent Gateway Runtime Bridge.'
          : 'Provider credential and model-list probe are healthy; execution is waiting on the persistent Gateway Runtime Bridge or cost governor.'
        : 'Provider is not reachable yet; execution is blocked before Gateway Runtime Bridge or cost-governor checks.',
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  }
}

function ollamaBaseUrl(): string {
  return String(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '')
}

async function probeOllama(): Promise<OllamaProbe> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const response = await fetch(`${ollamaBaseUrl()}/api/tags`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      return { reachable: false, model_count: 0, exact_blocker: `ollama_tags_http_${response.status}` }
    }
    const payload = await response.json().catch(() => ({}))
    const models = Array.isArray(payload?.models) ? payload.models : []
    return { reachable: true, model_count: models.length, exact_blocker: null }
  } catch {
    return { reachable: false, model_count: 0, exact_blocker: 'ollama_local_service_unreachable' }
  } finally {
    clearTimeout(timeout)
  }
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function hostedExecutionBlocker(input: {
  id: string
  credentialConfigured: boolean
  reachable: boolean
  probeBlocker: string | null
  fallbackBlocker: string | null
}) {
  if (!input.credentialConfigured) return `${input.id}_credential_required`
  if (input.reachable) return null
  return input.probeBlocker || input.fallbackBlocker || `${input.id}_probe_not_reachable`
}

function normalizeProviderId(id: string): string {
  const normalized = String(id || '').toLowerCase()
  if (normalized === 'google') return 'gemini'
  if (normalized === 'claude' || normalized === 'claude_anthropic') return 'anthropic'
  if (normalized === 'xai' || normalized === 'grok') return 'xai_grok'
  return normalized
}

function accountProviderId(providerId: string): 'openai' | 'anthropic' | null {
  const id = normalizeProviderId(providerId)
  if (id === 'openai') return 'openai'
  if (id === 'anthropic') return 'anthropic'
  return null
}

function accountSubscriptionMode(
  providerId: string,
  subscriptions: Record<string, SubscriptionProviderState | undefined>,
): AccountSubscriptionMode {
  const accountProvider = accountProviderId(providerId)
  if (!accountProvider) {
    return {
      supported: false,
      configured: false,
      provider_id: null,
      auth_mode: null,
      subscription_type: null,
      source: null,
      execution_enabled: false,
      bridge_required: false,
      credential_values_exposed: false,
      exact_blocker: null,
    }
  }

  const subscription = subscriptions[accountProvider]
  const configured = Boolean(subscription)
  return {
    supported: true,
    configured,
    provider_id: accountProvider,
    auth_mode: accountProvider === 'openai' ? 'chatgpt_codex_account' : 'claude_account',
    subscription_type: subscription?.type || null,
    source: subscription?.source || null,
    execution_enabled: false,
    bridge_required: false,
    credential_values_exposed: false,
    exact_blocker: configured ? null : `${accountProvider}_account_login_required`,
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const registry = await loadGatewayRegistry()
  const gatewayStatus = buildGatewayStatusPayload(registry)
  const generatedAt = new Date().toISOString()
  const ollama = await probeOllama()
  const sourceProviders = gatewayStatus.llm_gateway.providers as GatewayModelProvider[]
  const subscriptions = detectProviderSubscriptions().active
  const credentialStates = new Map<string, ReturnType<typeof getProviderCredential>>()
  const hostedProbes = new Map<string, Awaited<ReturnType<typeof probeHostedProvider>>>()
  await Promise.all(sourceProviders.map(async (provider) => {
    if (provider.id === 'ollama') return
    const id = normalizeProviderId(provider.id)
    if (!credentialNamesForProvider(id).length) return
    const credential = getProviderCredential(id)
    credentialStates.set(provider.id, credential)
    hostedProbes.set(provider.id, credential.found
      ? await probeHostedProviderCredential(id, credential.value)
      : await probeHostedProvider(id, {}))
  }))

  const providers = sourceProviders.map((provider) => {
    if (provider.id === 'ollama') {
      const gate = modelExecutionGate({ localOnly: true })
      const executionEnabled = ollama.reachable && gate.executionEnabled
      const colorToken = providerColorToken({
        provider_id: provider.id,
        registered: provider.registered !== false,
        credential_required: false,
        credential_configured: true,
        reachable: ollama.reachable,
        execution_enabled: executionEnabled,
      })
      const exactBlocker = ollama.reachable
        ? gate.exactBlocker
        : provider.exact_blocker || ollama.exact_blocker
      return {
        ...provider,
        registered: provider.registered !== false,
        auth_mode: 'local_service',
        credential_required: false,
        credential_configured: true,
        credential_names: [],
        status: ollama.reachable ? 'read_only' : provider.status,
        connected: ollama.reachable || provider.connected,
        configured: ollama.reachable || provider.configured,
        reachable: ollama.reachable,
        model_count: ollama.reachable ? ollama.model_count : provider.model_count,
        execution_enabled: executionEnabled,
        exact_blocker: exactBlocker,
        blocker: exactBlocker,
        last_probe: generatedAt,
        color_token: ollama.reachable ? colorToken : 'red',
        pipeline_connected: true,
        agent_access: 'registered_read_status_write_execute_gated',
        probe_status: ollama.reachable ? 'ok' : 'unreachable',
        api_key_probe_status: 'not_required',
        api_key_exact_blocker: null,
        execution_readiness: executionReadiness({
          providerId: provider.id,
          reachable: ollama.reachable,
          executionEnabled,
          exactBlocker,
          localOnly: true,
          gate,
        }),
        credential_values_exposed: false,
      }
    }

    const credentialNames = unique([
      ...(Array.isArray(provider.credential_names) ? provider.credential_names : []),
      ...(Array.isArray(provider.required_credentials) ? provider.required_credentials : []),
      ...credentialNamesForProvider(provider.id),
    ])
    const isHostedProvider = credentialNames.length > 0
    if (!isHostedProvider) return provider

    const id = normalizeProviderId(provider.id)
    const accountMode = accountSubscriptionMode(id, subscriptions)
    const probe = hostedProbes.get(provider.id) || null
    const credentialState = credentialStates.get(provider.id)
    const credentialConfigured = Boolean(credentialState?.found || probe?.credential_configured)
    const apiKeyReachable = credentialConfigured ? Boolean(probe?.reachable) : false
    const reachable = apiKeyReachable || accountMode.configured
    const gate = modelExecutionGate({ localOnly: false })
    const executionEnabled = reachable && gate.executionEnabled
    const apiKeyBlocker = hostedExecutionBlocker({
      id,
      credentialConfigured,
      reachable: apiKeyReachable,
      probeBlocker: probe?.exact_blocker || null,
      fallbackBlocker: provider.exact_blocker || provider.blocker || null,
    })
    const exactBlocker = accountMode.configured || apiKeyReachable
      ? gate.exactBlocker
      : apiKeyBlocker
    const authMode = accountMode.configured ? 'account_subscription' : 'api_key'
    return {
      ...provider,
      registered: provider.registered !== false,
      status: reachable ? 'read_only' : 'blocked',
      connected: reachable,
      configured: Boolean(provider.configured || credentialConfigured),
      reachable,
      account_configured: accountMode.configured,
      auth_mode: authMode,
      credential_required: true,
      credential_configured: credentialConfigured,
      vault_present: credentialState?.source === 'vault',
      credential_source: credentialState?.source || 'none',
      credential_names: credentialNames,
      execution_enabled: executionEnabled,
      exact_blocker: exactBlocker,
      blocker: exactBlocker,
      last_probe: generatedAt,
      color_token: providerColorToken({
        provider_id: id,
        registered: provider.registered !== false,
        credential_required: !accountMode.configured,
        credential_configured: credentialConfigured || accountMode.configured,
        reachable,
        execution_enabled: executionEnabled,
      }),
      pipeline_connected: true,
      agent_access: 'registered_read_status_write_execute_gated',
      execution_readiness: executionReadiness({
        providerId: id,
        reachable,
        executionEnabled,
        exactBlocker,
        gate,
      }),
      probe_status: accountMode.configured && !apiKeyReachable ? 'account_subscription' : probe?.probe_status || 'not_attempted',
      validation_status: probe?.probe_status || provider.validation_status || 'not_attempted',
      api_key_probe_status: probe?.probe_status || 'not_attempted',
      api_key_http_status: probe?.http_status ?? null,
      api_key_exact_blocker: apiKeyBlocker,
      provider_error_summary: probe?.provider_error_summary || null,
      auth_modes: {
        api_key: {
          supported: true,
          configured: credentialConfigured,
          credential_source: credentialState?.source || 'none',
          reachable: apiKeyReachable,
          probe_status: probe?.probe_status || 'not_attempted',
          http_status: probe?.http_status ?? null,
          exact_blocker: apiKeyBlocker,
          provider_error_summary: probe?.provider_error_summary || null,
          execution_enabled: executionEnabled,
          bridge_required: false,
          credential_values_exposed: false,
        },
        account_subscription: accountMode,
      },
      credential_values_exposed: false,
    }
  })

  return NextResponse.json({
    ok: true,
    source: 'gateway_model_provider_probe',
    generated_at: generatedAt,
    providers,
    summary: {
      provider_count: providers.length,
      reachable_count: providers.filter((provider) => provider.reachable).length,
      credential_required_count: providers.filter((provider) => (
        provider.credential_required &&
        !provider.credential_configured &&
        provider.account_configured !== true
      )).length,
      account_subscription_count: providers.filter((provider) => provider.account_configured === true).length,
      execution_enabled_count: providers.filter((provider) => provider.execution_enabled === true).length,
      hosted_execution_gated: providers.some((provider) => provider.reachable && provider.execution_enabled !== true),
      execution_gate_blocker: providers.some((provider) => String(provider.exact_blocker || '').startsWith('gateway_bridge_runtime_'))
        ? 'gateway_bridge_runtime_inactive'
        : providers.some((provider) => provider.exact_blocker === 'token_governor_not_proven')
          ? 'token_governor_not_proven'
          : null,
      bridge_required: false,
      gateway_bridge_runtime_required: true,
      cost_governor_required: true,
      token_governor_required: true,
      token_governor_proven: tokenGovernorExecutionEnabled(),
      credential_values_exposed: false,
      tokens_exposed: false,
      cookies_exposed: false,
      env_values_exposed: false,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
