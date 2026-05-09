import { describe, expect, it } from 'vitest'
import { evaluateTokenGovernorPreflight, sanitizeTokenGovernorText } from './token-governor'

const generatedAt = '2026-05-09T15:00:00.000Z'

describe('Token Governor preflight', () => {
  it('allows requests inside budget without enabling execution', () => {
    const result = evaluateTokenGovernorPreflight({
      scope: 'agent',
      subjectId: 'agent-zero',
      subjectName: 'Agent Zero',
      model: 'claude-sonnet',
      spentCents: 1000,
      projectedCents: 500,
      budgetCents: 5000,
    }, generatedAt)

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      status: 'within_budget',
      blocker_class: 'NONE',
      blocked_reason: null,
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      no_provider_route_change: true,
    })
    expect(result.audit_event).toMatchObject({
      event: 'token_governor.preflight',
      decision: 'allow',
      external_write: false,
      no_secrets_exposed: true,
      raw_paths_exposed: false,
    })
  })

  it('warns near the budget threshold without blocking', () => {
    const result = evaluateTokenGovernorPreflight({
      scope: 'project',
      subjectId: 'gateway-buildout',
      spentCents: 7000,
      projectedCents: 900,
      budgetCents: 10000,
    }, generatedAt)

    expect(result).toMatchObject({
      ok: true,
      decision: 'warn',
      status: 'warning',
      blocked_reason: 'token_governor_budget_warning',
      usage_percent: 79,
    })
  })

  it('blocks exhausted budgets', () => {
    const result = evaluateTokenGovernorPreflight({
      scope: 'goal',
      subjectId: 'hermes-live-proof',
      spentCents: 8800,
      projectedCents: 300,
      budgetCents: 10000,
    }, generatedAt)

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      status: 'blocked',
      blocker_class: 'BLOCKED',
      blocked_reason: 'token_governor_budget_exhausted',
      usage_percent: 91,
    })
  })

  it('blocks missing budgets as owner-gated', () => {
    const result = evaluateTokenGovernorPreflight({
      scope: 'model_provider',
      subjectId: 'firecrawl',
      spentCents: 0,
      projectedCents: 100,
      budgetCents: null,
    }, generatedAt)

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      status: 'missing_budget',
      blocker_class: 'OWNER_GATED',
      blocked_reason: 'token_governor_budget_missing',
    })
  })

  it('blocks restricted model routes before budget math', () => {
    const result = evaluateTokenGovernorPreflight({
      scope: 'model_provider',
      subjectId: 'expensive-model',
      model: 'claude-opus-review',
      spentCents: 0,
      projectedCents: 100,
      budgetCents: 10000,
    }, generatedAt)

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      status: 'model_restricted',
      blocker_class: 'BLOCKED',
      blocked_reason: 'token_governor_model_restricted',
    })
  })

  it('redacts owner-unsafe values from text fields', () => {
    const rawPath = ['', 'Users', 'example', 'private'].join('/')
    const keyName = ['API', 'KEY'].join('_')
    const bearerPrefix = ['Bea', 'rer'].join('')
    const token = ['sk', 'exampleexampleexample'].join('-')
    const value = sanitizeTokenGovernorText(`use ${rawPath} with ${keyName}=sample-redacted-input and ${bearerPrefix} ${token}`)
    expect(value).toContain('[redacted-path]')
    expect(value).toContain(`${keyName}=<redacted>`)
    expect(value).toContain('<redacted-secret>')
    expect(value).not.toContain(rawPath)
    expect(value).not.toContain('sample-redacted-input')
    expect(value).not.toContain(`${bearerPrefix} ${token}`)
  })
})
