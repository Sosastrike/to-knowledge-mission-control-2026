import { describe, expect, it } from 'vitest'

import {
  buildContextStatusSnapshot,
  buildModelCapabilityRegistry,
  classifyProviderError,
} from './agent-platform-recovery'

describe('agent platform recovery contracts', () => {
  it('classifies Anthropic usage/billing HTTP 400 as non-retryable', () => {
    const result = classifyProviderError({
      provider_id: 'anthropic',
      http_status: 400,
      message: 'Third-party apps now draw from your extra usage, not your plan limits. Add more credits.',
    })

    expect(result.error_class).toBe('billing_or_quota_unavailable')
    expect(result.retry.retryable).toBe(false)
    expect(result.retry.max_attempts).toBe(1)
    expect(result.circuit_breaker_action).toBe('open_circuit')
    expect(result.credential_values_exposed).toBe(false)
  })

  it('classifies OpenRouter invalid request HTTP 400 as local adapter/schema failure', () => {
    const result = classifyProviderError({
      provider_id: 'openrouter',
      http_status: 400,
      message: 'Invalid Responses API request',
    })

    expect(result.error_class).toBe('invalid_local_request')
    expect(result.retry.retryable).toBe(false)
    expect(result.operator_message).toContain('Fix the local adapter/request mode')
  })

  it('allows bounded retries only for transient classes', () => {
    const rateLimit = classifyProviderError({ provider_id: 'openrouter', http_status: 429, message: 'rate limit' })
    const providerDown = classifyProviderError({ provider_id: 'openrouter', http_status: 503, message: 'provider unavailable' })

    expect(rateLimit.retry.retryable).toBe(true)
    expect(rateLimit.retry.max_attempts).toBe(2)
    expect(providerDown.retry.retryable).toBe(true)
    expect(providerDown.circuit_breaker_action).toBe('mark_degraded')
  })

  it('exposes provider capabilities without enabling execution or leaking secrets', () => {
    const registry = buildModelCapabilityRegistry()
    const providers = registry.providers.map((provider) => provider.provider_id)

    expect(providers).toContain('openrouter')
    expect(providers).toContain('openai')
    expect(providers).toContain('anthropic')
    expect(providers).toContain('ollama')
    expect(registry.summary.execution_enabled).toBe(false)
    expect(registry.summary.credential_values_exposed).toBe(false)
    expect(registry.providers.every((provider) => provider.execution_enabled === false)).toBe(true)
    expect(registry.providers.every((provider) => provider.explicit_model_override_allowed === true)).toBe(true)
  })

  it('defines proactive context checkpoint behavior without pretending enforcement is complete', () => {
    const status = buildContextStatusSnapshot()

    expect(status.context_policy.model_relative_budgets_required).toBe(true)
    expect(status.context_policy.checkpoint_before_repeated_compaction).toBe(true)
    expect(status.checkpoints.current_status).toBe('contract_defined_not_globally_enforced')
    expect(status.connector_execution_enabled).toBe(false)
  })
})
