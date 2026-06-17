import { describe, expect, it, vi } from 'vitest'

import {
  executeJarvisProviderModelExecution,
  JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
  JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID,
  JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE,
} from '@/lib/jarvis-provider-model-execution-adapter'

const baseSession = {
  id: 'session-provider-test',
  allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE],
  cost_cap_usd: 0.05,
}

function okCredential(value = 'test-provider-credential-value') {
  return {
    found: true as const,
    source: 'vault' as const,
    value,
    env_var_name: 'GROQ_API_KEY',
    masked_preview: 'gsk...7890',
    provider_id: 'groq',
    credential_values_exposed: false as const,
  }
}

describe('Jarvis hosted provider model execution adapter', () => {
  it('blocks before provider execution when exact scope does not match', async () => {
    const fetchImpl = vi.fn()
    const result = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: { provider: 'groq', operation: 'chat_completion', model: 'llama-3.3-70b-versatile' },
        input: { prompt: 'hello', max_tokens: 8 },
        session: baseSession,
      },
      {
        getCredential: vi.fn(() => okCredential()),
        probeProvider: vi.fn(),
        fetchImpl,
      },
    )

    expect(JARVIS_PROVIDER_MODEL_EXECUTION_ADAPTER_ID).toBe('provider_model_execution')
    expect(result.ok).toBe(false)
    expect(result.exact_blocker).toBe('bridge_session_scope_missing_provider_model_execution:groq:llama-3.3-70b-versatile')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stops xAI Grok on safe model-list 403 and never calls generation', async () => {
    const fetchImpl = vi.fn()
    const result = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'xai_grok',
          operation: 'chat_completion',
          model: 'grok-3-mini',
          exact_scope: 'provider_model_execution:xai_grok:grok-3-mini',
        },
        input: { prompt: 'hello', max_tokens: 8 },
        session: {
          ...baseSession,
          allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE, 'provider_model_execution:xai_grok:grok-3-mini'],
        },
      },
      {
        getCredential: vi.fn(() => okCredential('xai_test_secret_1234567890')),
        probeProvider: vi.fn().mockResolvedValue({
          provider_id: 'xai_grok',
          credential_names: ['XAI_API_KEY'],
          credential_configured: true,
          reachable: false,
          probe_status: 'http_error',
          exact_blocker: 'xai_grok_probe_http_403',
          credential_values_exposed: false,
        }),
        fetchImpl,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.exact_blocker).toBe('xai_grok_probe_http_403')
    expect(result.external_provider_called).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('enforces max token and cost caps before external provider calls', async () => {
    const fetchImpl = vi.fn()
    const tooManyTokens = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'nvidia',
          operation: 'chat_completion',
          model: 'meta/llama-3.3-70b-instruct',
          exact_scope: 'provider_model_execution:nvidia:meta/llama-3.3-70b-instruct',
        },
        input: { prompt: 'hello', max_tokens: 512 },
        session: {
          ...baseSession,
          allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE, 'provider_model_execution:nvidia:meta/llama-3.3-70b-instruct'],
        },
      },
      {
        getCredential: vi.fn(() => okCredential('nva_test_secret_1234567890')),
        probeProvider: vi.fn(),
        fetchImpl,
      },
    )

    expect(tooManyTokens.ok).toBe(false)
    expect(tooManyTokens.exact_blocker).toBe('provider_model_execution_max_tokens_exceeded')
    expect(fetchImpl).not.toHaveBeenCalled()

    const overBudget = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'openrouter',
          operation: 'chat_completion',
          model: 'openai/gpt-5',
          exact_scope: 'provider_model_execution:openrouter:openai/gpt-5',
        },
        input: { prompt: 'hello', max_tokens: 64 },
        session: {
          ...baseSession,
          cost_cap_usd: 0.000001,
          allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE, 'provider_model_execution:openrouter:openai/gpt-5'],
        },
      },
      {
        getCredential: vi.fn(() => okCredential('openrouter-test-credential-value')),
        probeProvider: vi.fn().mockResolvedValue({ reachable: true, exact_blocker: null, probe_status: 'ok' }),
        fetchImpl,
      },
    )

    expect(overBudget.ok).toBe(false)
    expect(overBudget.exact_blocker).toBe('provider_model_execution_cost_cap_exceeded')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('runs a sanitized hosted provider call only after credential, model-list, exact scope, and cost gates pass', async () => {
    const rawSecret = 'groq-test-credential-value'
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: 'provider lane online' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    }))
    const recordUsage = vi.fn()

    const result = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'groq',
          operation: 'chat_completion',
          model: 'llama-3.3-70b-versatile',
          exact_scope: 'provider_model_execution:groq:llama-3.3-70b-versatile',
        },
        input: { prompt: 'Say provider lane online.', max_tokens: 16 },
        session: {
          ...baseSession,
          allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE, 'provider_model_execution:groq:llama-3.3-70b-versatile'],
        },
      },
      {
        getCredential: vi.fn(() => okCredential(rawSecret)),
        probeProvider: vi.fn().mockResolvedValue({ reachable: true, exact_blocker: null, probe_status: 'ok' }),
        fetchImpl,
        recordUsage,
      },
    )

    expect(fetchImpl).toHaveBeenCalledWith('https://api.groq.com/openai/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"stream":false'),
    }))
    expect(result).toMatchObject({
      ok: true,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      external_provider_called: true,
      credential_values_exposed: false,
      token_governor_enforced: true,
      raw_prompt_returned: false,
      exact_blocker: null,
    })
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      session_id: 'session-provider-test',
      credential_values_exposed: false,
    }))
    expect(JSON.stringify(result)).not.toContain(rawSecret)
    expect(JSON.stringify(result)).not.toContain('Say provider lane online')
  })

  it('runs direct OpenAI through the same exact-scope provider execution adapter', async () => {
    const rawSecret = 'openai-test-credential-value'
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: 'openai lane online' } }],
      usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
    }))
    const recordUsage = vi.fn()

    const result = await executeJarvisProviderModelExecution(
      {
        action: JARVIS_PROVIDER_MODEL_EXECUTION_ACTION,
        scope: {
          provider: 'openai',
          operation: 'chat_completion',
          model: 'gpt-4.1-mini',
          exact_scope: 'provider_model_execution:openai:gpt-4.1-mini',
        },
        input: { prompt: 'Say openai lane online.', max_tokens: 16 },
        session: {
          ...baseSession,
          allowed_scopes: [JARVIS_PROVIDER_MODEL_EXECUTION_SESSION_SCOPE, 'provider_model_execution:openai:gpt-4.1-mini'],
        },
      },
      {
        getCredential: vi.fn(() => ({ ...okCredential(rawSecret), provider_id: 'openai', env_var_name: 'OPENAI_API_KEY' })),
        probeProvider: vi.fn().mockResolvedValue({ reachable: true, exact_blocker: null, probe_status: 'ok' }),
        fetchImpl,
        recordUsage,
      },
    )

    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"model":"gpt-4.1-mini"'),
    }))
    expect(result).toMatchObject({
      ok: true,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      external_provider_called: true,
      credential_values_exposed: false,
      raw_prompt_returned: false,
      exact_blocker: null,
    })
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      session_id: 'session-provider-test',
      credential_values_exposed: false,
    }))
    expect(JSON.stringify(result)).not.toContain(rawSecret)
    expect(JSON.stringify(result)).not.toContain('Say openai lane online')
  })

})
