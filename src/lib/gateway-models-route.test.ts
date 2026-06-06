import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ role: 'viewer' })),
}))

vi.mock('@/lib/gateway-registry-api', () => ({
  loadGatewayRegistry: vi.fn(async () => ({})),
  buildGatewayStatusPayload: vi.fn(() => ({
    llm_gateway: {
      providers: [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          registered: true,
          credential_required: true,
          credential_configured: true,
          configured: true,
          connected: true,
          reachable: true,
          bridge_required: true,
          execution_enabled: false,
          model_count: 3,
          exact_blocker: null,
        },
        {
          id: 'openai',
          name: 'OpenAI',
          registered: true,
          credential_required: true,
          credential_configured: true,
          configured: true,
          connected: true,
          reachable: true,
          bridge_required: true,
          execution_enabled: false,
          model_count: 3,
          exact_blocker: null,
        },
        {
          id: 'claude_anthropic',
          name: 'Claude/Anthropic',
          registered: true,
          credential_required: true,
          credential_configured: true,
          configured: true,
          connected: true,
          reachable: true,
          bridge_required: true,
          execution_enabled: false,
          model_count: 3,
          exact_blocker: null,
        },
        {
          id: 'ollama',
          name: 'Ollama',
          registered: true,
          credential_required: false,
          credential_configured: false,
          configured: true,
          connected: false,
          reachable: false,
          bridge_required: true,
          execution_enabled: false,
          model_count: 0,
          exact_blocker: 'ollama_local_service_unreachable',
        },
        {
          id: 'gemini',
          name: 'Gemini',
          registered: true,
          credential_required: true,
          credential_configured: false,
          configured: true,
          connected: false,
          reachable: false,
          bridge_required: true,
          execution_enabled: false,
          model_count: 0,
          exact_blocker: 'gemini_credential_required',
        },
        {
          id: 'groq',
          name: 'Groq',
          registered: true,
          credential_required: true,
          credential_configured: false,
          configured: true,
          connected: false,
          reachable: false,
          bridge_required: true,
          execution_enabled: false,
          model_count: 0,
          exact_blocker: 'groq_credential_required',
        },
        {
          id: 'xai_grok',
          name: 'xAI Grok',
          registered: true,
          credential_required: true,
          credential_configured: false,
          configured: true,
          connected: false,
          reachable: false,
          bridge_required: true,
          execution_enabled: false,
          model_count: 0,
          exact_blocker: 'xai_grok_credential_required',
        },
        {
          id: 'nvidia',
          name: 'NVIDIA NIM',
          registered: true,
          credential_required: true,
          credential_configured: false,
          configured: false,
          connected: false,
          reachable: false,
          bridge_required: true,
          execution_enabled: false,
          model_count: 0,
          exact_blocker: 'nvidia_credential_required',
        },
      ],
    },
  })),
}))

const providerVaultMock = vi.hoisted(() => ({
  getProviderCredential: vi.fn(),
}))

vi.mock('@/lib/provider-vault', () => providerVaultMock)

const providerSubscriptionsMock = vi.hoisted(() => ({
  detectProviderSubscriptions: vi.fn(() => ({ active: {} })),
}))

vi.mock('@/lib/provider-subscriptions', () => providerSubscriptionsMock)

const jarvisBridgeSessionMock = vi.hoisted(() => ({
  jarvisBridgeSessionStatus: vi.fn(() => ({
    state: 'inactive',
    allowed_scopes: [] as string[],
  })),
}))

vi.mock('@/lib/jarvis-bridge-session', () => jarvisBridgeSessionMock)

vi.mock('@/lib/jarvis-ollama-local-model-adapter', () => ({
  JARVIS_OLLAMA_LOCAL_MODEL_SESSION_SCOPE: 'gateway_ollama_local_model_execute',
}))

vi.mock('@/lib/jarvis-provider-model-execution-adapter', () => ({
  JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE: 'provider_model_execution',
}))

const gatewayBridgeRuntimeMock = vi.hoisted(() => ({
  gatewayBridgeRuntimeGate: vi.fn(() => ({
    executionEnabled: true,
    exactBlocker: null as string | null,
    runtimeActive: true,
    runtimeState: 'active',
    runtimeId: 'gateway-runtime',
    mode: 'persistent_gateway_runtime_bridge',
    actionBridgeSessionRequired: false,
    credential_values_exposed: false,
    tokens_exposed: false,
    env_values_exposed: false,
  })),
}))

vi.mock('@/lib/gateway-bridge-runtime', () => gatewayBridgeRuntimeMock)

const originalEnv = { ...process.env }

function clearProviderEnv() {
  delete process.env.OPENROUTER_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.CLAUDE_API_KEY
  delete process.env.GOOGLE_API_KEY
  delete process.env.GEMINI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.GROQ_API_KEY
  delete process.env.XAI_API_KEY
  delete process.env.NVIDIA_API_KEY
  delete process.env.NGC_API_KEY
  delete process.env.NVIDIA_NIM_API_KEY
}

describe('/api/gateway/models provider truth', () => {
  beforeEach(() => {
    vi.resetModules()
    clearProviderEnv()
    providerVaultMock.getProviderCredential.mockReset()
    providerSubscriptionsMock.detectProviderSubscriptions.mockReset()
    providerSubscriptionsMock.detectProviderSubscriptions.mockReturnValue({ active: {} })
    jarvisBridgeSessionMock.jarvisBridgeSessionStatus.mockReset()
    jarvisBridgeSessionMock.jarvisBridgeSessionStatus.mockReturnValue({
      state: 'inactive',
      allowed_scopes: [] as string[],
    })
    gatewayBridgeRuntimeMock.gatewayBridgeRuntimeGate.mockReset()
    gatewayBridgeRuntimeMock.gatewayBridgeRuntimeGate.mockReturnValue({
      executionEnabled: true,
      exactBlocker: null as string | null,
      runtimeActive: true,
      runtimeState: 'active',
      runtimeId: 'gateway-runtime',
      mode: 'persistent_gateway_runtime_bridge',
      actionBridgeSessionRequired: false,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      const envNames: Record<string, string[]> = {
        openrouter: ['OPENROUTER_API_KEY'],
        openai: ['OPENAI_API_KEY'],
        anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
        claude_anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
        gemini: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
        groq: ['GROQ_API_KEY'],
        xai_grok: ['XAI_API_KEY'],
        nvidia: ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'],
      }
      const envVar = (envNames[providerId] || []).find((name) => process.env[name])
      if (envVar) {
        return {
          found: true,
          source: 'env',
          value: process.env[envVar],
          env_var_name: envVar,
          masked_preview: 'env...mock',
          provider_id: providerId,
          credential_values_exposed: false,
        }
      }
      return { found: false, source: 'none', value: null, provider_id: providerId, credential_values_exposed: false }
    })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('local Ollama unreachable')
    }))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('marks missing hosted provider credentials as red blocked instead of gray or connected', async () => {
    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.summary).toMatchObject({
      credential_values_exposed: false,
      tokens_exposed: false,
      cookies_exposed: false,
      env_values_exposed: false,
      hosted_execution_gated: false,
    })

    for (const id of ['openrouter', 'openai', 'claude_anthropic', 'gemini', 'groq', 'xai_grok', 'nvidia']) {
      expect(payload.providers.find((provider: { id: string }) => provider.id === id)).toMatchObject({
        registered: true,
        reachable: false,
        credential_required: true,
        credential_configured: false,
        execution_enabled: false,
        color_token: 'red',
        pipeline_connected: true,
        agent_access: 'registered_read_status_write_execute_gated',
      })
    }

    const sensitivePattern = new RegExp([
      'sk-[A-Za-z0-9_-]+',
      'Bearer\\s+[A-Za-z0-9._-]+',
      'redacted_probe_value',
      `cookie${'='}`,
    ].join('|'))
    expect(payload.providers.find((provider: { id: string }) => provider.id === 'nvidia')?.exact_blocker).toBe('nvidia_credential_required')
    expect(JSON.stringify(payload)).not.toMatch(sensitivePattern)
  })

  it('enables credentialed hosted probes through the persistent Gateway Runtime Bridge', async () => {
    process.env.GROQ_API_KEY = 'redacted_probe_value'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.groq.com')) {
        return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const groq = payload.providers.find((provider: { id: string }) => provider.id === 'groq')

    expect(groq).toMatchObject({
      credential_configured: true,
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      api_key_probe_status: 'ok',
      api_key_exact_blocker: null,
      execution_readiness: {
        status: 'execution_enabled',
        cost_governor_required: true,
        token_governor_required: true,
        local_only: false,
        exact_blocker: null,
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted_probe_value')
  })

  it('treats Ollama as a local service probe instead of a missing API credential', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('127.0.0.1:11434/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'qwen2.5:0.5b' }] }), { status: 200 })
      }
      throw new Error('unexpected hosted probe')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const ollama = payload.providers.find((provider: { id: string }) => provider.id === 'ollama')

    expect(ollama).toMatchObject({
      auth_mode: 'local_service',
      credential_required: false,
      credential_configured: true,
      reachable: true,
      model_count: 1,
      execution_enabled: true,
      color_token: 'green',
      probe_status: 'ok',
      api_key_probe_status: 'not_required',
      api_key_exact_blocker: null,
      execution_readiness: {
        status: 'execution_enabled',
        cost_governor_required: false,
        token_governor_required: false,
        local_only: true,
        exact_blocker: null,
      },
    })
    expect(JSON.stringify(payload)).not.toMatch(/OLLAMA_(?:HOST|BASE_URL)=/i)
  })

  it('keeps local Ollama enabled without requiring a short-lived Bridge Session scope', async () => {
    jarvisBridgeSessionMock.jarvisBridgeSessionStatus.mockReturnValue({
      state: 'active',
      allowed_scopes: ['gateway_ollama_local_model_execute'],
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('127.0.0.1:11434/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'qwen2.5:0.5b' }] }), { status: 200 })
      }
      throw new Error('unexpected hosted probe')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const ollama = payload.providers.find((provider: { id: string }) => provider.id === 'ollama')

    expect(ollama).toMatchObject({
      auth_mode: 'local_service',
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      execution_readiness: {
        status: 'execution_enabled',
        gateway_bridge_runtime_active: true,
        gateway_bridge_runtime_state: 'active',
        cost_governor_required: false,
        token_governor_required: false,
        local_only: true,
        exact_blocker: null,
      },
    })
  })

  it('enables validated hosted providers when Gateway Runtime Bridge is active', async () => {
    jarvisBridgeSessionMock.jarvisBridgeSessionStatus.mockReturnValue({
      state: 'active',
      allowed_scopes: ['provider_model_execution'],
    })
    process.env.GROQ_API_KEY = 'redacted_probe_value'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.groq.com')) {
        return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const groq = payload.providers.find((provider: { id: string }) => provider.id === 'groq')

    expect(groq).toMatchObject({
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      execution_readiness: {
        status: 'execution_enabled',
        gateway_bridge_runtime_active: true,
        gateway_bridge_runtime_state: 'active',
        cost_governor_required: true,
        token_governor_required: true,
        token_governor_proven: true,
        exact_blocker: null,
      },
    })
  })

  it('reports Ollama local service blockers without asking for an API key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const ollama = payload.providers.find((provider: { id: string }) => provider.id === 'ollama')

    expect(ollama).toMatchObject({
      auth_mode: 'local_service',
      credential_required: false,
      credential_configured: true,
      reachable: false,
      execution_enabled: false,
      color_token: 'red',
      probe_status: 'unreachable',
      api_key_probe_status: 'not_required',
      api_key_exact_blocker: null,
      exact_blocker: 'ollama_local_service_unreachable',
      execution_readiness: {
        status: 'not_reachable',
        cost_governor_required: false,
        token_governor_required: false,
        local_only: true,
        exact_blocker: 'ollama_local_service_unreachable',
      },
    })
  })

  it('hydrates hosted provider credentials from encrypted vault before env fallback', async () => {
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      if (providerId === 'gemini') {
        return {
          found: true,
          source: 'vault',
          value: 'vault-gemini-secret',
          env_var_name: 'GEMINI_API_KEY',
        }
      }
      return { found: false, source: 'none', value: null }
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ models: [{ name: 'models/gemini-1.5-pro' }] }), { status: 200 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const gemini = payload.providers.find((provider: { id: string }) => provider.id === 'gemini')

    expect(gemini).toMatchObject({
      credential_configured: true,
      credential_source: 'vault',
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      api_key_probe_status: 'ok',
      api_key_exact_blocker: null,
    })
    expect(JSON.stringify(payload)).not.toContain('vault-gemini-secret')
  })

  it('separates OpenAI Codex account mode from invalid OpenAI API key mode', async () => {
    providerSubscriptionsMock.detectProviderSubscriptions.mockReturnValue({
      active: {
        openai: { provider: 'openai', type: 'chatgpt', source: 'file' },
      },
    })
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      if (providerId === 'openai') {
        return {
          found: true,
          source: 'vault',
          value: 'redacted-invalid-openai-key',
          env_var_name: 'OPENAI_API_KEY',
          masked_preview: 'sk-...bad',
          provider_id: 'openai',
          credential_values_exposed: false,
        }
      }
      return { found: false, source: 'none', value: null, provider_id: providerId, credential_values_exposed: false }
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.openai.com')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const openai = payload.providers.find((provider: { id: string }) => provider.id === 'openai')

    expect(openai).toMatchObject({
      account_configured: true,
      auth_mode: 'account_subscription',
      connected: true,
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      auth_modes: {
        api_key: {
          configured: true,
          reachable: false,
          probe_status: 'http_error',
          exact_blocker: 'openai_probe_http_401',
        },
        account_subscription: {
          supported: true,
          configured: true,
          provider_id: 'openai',
          auth_mode: 'chatgpt_codex_account',
          subscription_type: 'chatgpt',
          source: 'file',
          execution_enabled: false,
          bridge_required: false,
          credential_values_exposed: false,
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted-invalid-openai-key')
  })

  it('separates Claude account mode from invalid Anthropic API key mode', async () => {
    providerSubscriptionsMock.detectProviderSubscriptions.mockReturnValue({
      active: {
        anthropic: { provider: 'anthropic', type: 'pro', source: 'file' },
      },
    })
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      if (providerId === 'anthropic') {
        return {
          found: true,
          source: 'vault',
          value: 'redacted-invalid-anthropic-key',
          env_var_name: 'ANTHROPIC_API_KEY',
          masked_preview: 'PAS...HERE',
          provider_id: 'anthropic',
          credential_values_exposed: false,
        }
      }
      return { found: false, source: 'none', value: null, provider_id: providerId, credential_values_exposed: false }
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.anthropic.com')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const claude = payload.providers.find((provider: { id: string }) => provider.id === 'claude_anthropic')

    expect(claude).toMatchObject({
      account_configured: true,
      auth_mode: 'account_subscription',
      connected: true,
      reachable: true,
      execution_enabled: true,
      color_token: 'green',
      exact_blocker: null,
      auth_modes: {
        api_key: {
          configured: true,
          reachable: false,
          probe_status: 'http_error',
          exact_blocker: 'anthropic_probe_http_401',
        },
        account_subscription: {
          supported: true,
          configured: true,
          provider_id: 'anthropic',
          auth_mode: 'claude_account',
          subscription_type: 'pro',
          source: 'file',
          execution_enabled: false,
          bridge_required: false,
          credential_values_exposed: false,
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted-invalid-anthropic-key')
  })

  it('surfaces sanitized xAI Grok 403 permission details without exposing the API key', async () => {
    jarvisBridgeSessionMock.jarvisBridgeSessionStatus.mockReturnValue({
      state: 'active',
      allowed_scopes: ['provider_model_execution'],
    })
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      if (providerId === 'xai_grok') {
        return {
          found: true,
          source: 'vault',
          value: 'redacted_xai_provider_test_value',
          env_var_name: 'XAI_API_KEY',
          masked_preview: 'xai...test',
          provider_id: 'xai_grok',
          credential_values_exposed: false,
        }
      }
      return { found: false, source: 'none', value: null, provider_id: providerId, credential_values_exposed: false }
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.x.ai')) {
        return new Response(JSON.stringify({
          error: {
            code: 'The caller does not have permission to execute the specified operation',
          },
        }), { status: 403 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const xaiGrok = payload.providers.find((provider: { id: string }) => provider.id === 'xai_grok')

    expect(xaiGrok).toMatchObject({
      credential_configured: true,
      reachable: false,
      execution_enabled: false,
      color_token: 'red',
      exact_blocker: 'xai_grok_permission_or_billing_required',
      api_key_exact_blocker: 'xai_grok_permission_or_billing_required',
      provider_error_summary: {
        code: 'The caller does not have permission to execute the specified operation',
        credential_values_exposed: false,
        tokens_exposed: false,
        env_values_exposed: false,
      },
      execution_readiness: {
        status: 'not_reachable',
        gateway_bridge_runtime_active: true,
        gateway_bridge_runtime_state: 'active',
        exact_blocker: 'xai_grok_permission_or_billing_required',
      },
      auth_modes: {
        api_key: {
          configured: true,
          reachable: false,
          probe_status: 'http_error',
          exact_blocker: 'xai_grok_permission_or_billing_required',
          provider_error_summary: {
            code: 'The caller does not have permission to execute the specified operation',
          },
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted_xai_provider_test_value')
  })

  it('maps xAI Grok 401 to invalid or unauthorized without exposing the API key', async () => {
    providerVaultMock.getProviderCredential.mockImplementation((providerId: string) => {
      if (providerId === 'xai_grok') {
        return {
          found: true,
          source: 'vault',
          value: 'redacted_xai_invalid_test_value',
          env_var_name: 'XAI_API_KEY',
          masked_preview: 'xai...bad',
          provider_id: 'xai_grok',
          credential_values_exposed: false,
        }
      }
      return { found: false, source: 'none', value: null, provider_id: providerId, credential_values_exposed: false }
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.x.ai')) {
        return new Response(JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const xaiGrok = payload.providers.find((provider: { id: string }) => provider.id === 'xai_grok')

    expect(xaiGrok).toMatchObject({
      credential_configured: true,
      reachable: false,
      execution_enabled: false,
      exact_blocker: 'xai_grok_credential_invalid_or_unauthorized',
      api_key_exact_blocker: 'xai_grok_credential_invalid_or_unauthorized',
      auth_modes: {
        api_key: {
          configured: true,
          reachable: false,
          probe_status: 'http_error',
          exact_blocker: 'xai_grok_credential_invalid_or_unauthorized',
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted_xai_invalid_test_value')
  })

  it('keeps xAI Grok API-key only with no subscription fallback', async () => {
    providerSubscriptionsMock.detectProviderSubscriptions.mockReturnValue({
      active: {
        openai: { provider: 'openai', type: 'chatgpt', source: 'file' },
        anthropic: { provider: 'anthropic', type: 'pro', source: 'file' },
      },
    })

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const xaiGrok = payload.providers.find((provider: { id: string }) => provider.id === 'xai_grok')

    expect(xaiGrok).toMatchObject({
      account_configured: false,
      auth_mode: 'api_key',
      credential_configured: false,
      reachable: false,
      color_token: 'red',
      exact_blocker: 'xai_grok_credential_required',
      auth_modes: {
        account_subscription: {
          supported: false,
          configured: false,
          provider_id: null,
        },
      },
    })
  })

  it('blocks reachable providers with gateway_bridge_runtime_inactive when the persistent runtime bridge is paused', async () => {
    gatewayBridgeRuntimeMock.gatewayBridgeRuntimeGate.mockReturnValue({
      executionEnabled: false,
      exactBlocker: 'gateway_bridge_runtime_inactive',
      runtimeActive: false,
      runtimeState: 'inactive',
      runtimeId: 'gateway-runtime',
      mode: 'persistent_gateway_runtime_bridge',
      actionBridgeSessionRequired: false,
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
    process.env.GROQ_API_KEY = 'redacted_probe_value'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.groq.com')) {
        return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200 })
      }
      throw new Error('local Ollama unreachable')
    }))

    const { GET } = await import('@/app/api/gateway/models/route')

    const response = await GET(new NextRequest('http://localhost/api/gateway/models'))
    const payload = await response.json()
    const groq = payload.providers.find((provider: { id: string }) => provider.id === 'groq')

    expect(groq).toMatchObject({
      reachable: true,
      execution_enabled: false,
      color_token: 'yellow',
      exact_blocker: 'gateway_bridge_runtime_inactive',
      execution_readiness: {
        status: 'gateway_bridge_runtime_required',
        gateway_bridge_runtime_active: false,
        gateway_bridge_runtime_state: 'inactive',
        exact_blocker: 'gateway_bridge_runtime_inactive',
      },
    })
    expect(JSON.stringify(payload)).not.toContain('redacted_probe_value')
  })

})
