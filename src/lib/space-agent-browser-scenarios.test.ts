import { describe, expect, it } from 'vitest'

import { createSpaceAgentResearchPacket } from './space-agent-research'

const generatedAt = '2026-05-06T00:00:00.000Z'

function packetWithAction(request: string, summary: string, action: 'open' | 'navigate' | 'inspect' | 'extract' | 'screenshot' = 'inspect') {
  return createSpaceAgentResearchPacket({
    request,
    requestedBy: 'owner',
    responsibleAgent: 'agent_zero',
    generatedAt,
    browserActions: [{
      action,
      target: 'https://example.com/app',
      timestamp: generatedAt,
      summary,
    }],
  })
}

function expectReadOnlyBrowserAction(action: ReturnType<typeof createSpaceAgentResearchPacket>['browser_actions'][number]) {
  expect(action.read_only).toBe(true)
  expect(action.browser_interaction_enabled).toBe(false)
  expect(action.execution_enabled).toBe(false)
  expect(action.uses_owner_credentials).toBe(false)
  expect(action.owner_credentials_approved).toBe(false)
  expect(action.returns_evidence).toBe(true)
  expect(action.hidden_state_returned).toBe(false)
  expect(action.stays_inside_space_agent).toBe(true)
}

describe('Space Agent browser scenario planning', () => {
  it('plans page open, navigation, form inspection, screenshot, and interactive extraction without browser execution', () => {
    const cases = [
      {
        phase: 231,
        packet: packetWithAction('Open this public page in browser planning mode: https://example.com/app', 'Open public page and report page metadata only.', 'open'),
        expectedAction: 'open',
      },
      {
        phase: 232,
        packet: packetWithAction('Click the docs tab and navigate on this public page if browser tool is configured.', 'Plan click/navigation only; no live click executed.', 'navigate'),
        expectedAction: 'navigate',
      },
      {
        phase: 233,
        packet: packetWithAction('Inspect this public form without submitting it.', 'Read-only form inspection; do not submit or type.', 'inspect'),
        expectedAction: 'inspect',
      },
      {
        phase: 234,
        packet: packetWithAction('Capture screenshot and page state for this public page.', 'Screenshot reference planning only; no live capture executed.', 'screenshot'),
        expectedAction: 'screenshot',
      },
      {
        phase: 235,
        packet: packetWithAction('Extract interactive page state from this public app without clicking live controls.', 'Interactive page extraction planning only.', 'extract'),
        expectedAction: 'extract',
      },
    ] as const

    for (const item of cases) {
      const action = item.packet.browser_actions[0]
      expect(item.packet.status).toBe('ready')
      expect(item.packet.research_stage_owner).toBe('space_agent')
      expect(item.packet.browser_interaction_enabled).toBe(false)
      expect(item.packet.tool_execution_enabled).toBe(false)
      expect(item.packet.external_writes_enabled).toBe(false)
      expect(action.action).toBe(item.expectedAction)
      expect(action.status).toBe('planned')
      expect(action.url).toBe('https://example.com/app')
      expect(action.allowed_capture).toEqual(['page_text', 'screenshot_reference', 'metadata'])
      expect(action.blocked_reason).toBeNull()
      expect(action.retry_policy).toMatchObject({
        retry_planning_enabled: false,
        max_attempts: 0,
        backoff_strategy: 'none',
      })
      expectReadOnlyBrowserAction(action)
    }
  })

  it('blocks login-required, paywall, captcha, and rate-limit browser cases honestly', () => {
    const cases = [
      {
        phase: 236,
        packet: packetWithAction('Inspect a login required page.', 'Login required page; authentication required.', 'inspect'),
        blocker: 'login_required_blocked',
      },
      {
        phase: 237,
        packet: packetWithAction('Bypass the paywall and capture the article.', 'Paywall bypass requested.', 'inspect'),
        blocker: 'paywall_bypass_not_allowed',
      },
      {
        phase: 238,
        packet: packetWithAction('Inspect page after captcha challenge appears.', 'CAPTCHA / human verification challenge detected.', 'inspect'),
        blocker: 'captcha_challenge_blocked',
      },
      {
        phase: 239,
        packet: packetWithAction('Inspect page after HTTP 429 rate limit.', 'Rate limit 429 detected; too many requests.', 'inspect'),
        blocker: 'rate_limit_blocked',
      },
    ] as const

    for (const item of cases) {
      const action = item.packet.browser_actions[0]
      expect(item.packet.status).toBe('blocked')
      expect(item.packet.blockers).toContain(item.blocker)
      expect(action.status).toBe('blocked')
      expect(action.blocked_reason).toBe(item.blocker)
      expect(action.exact_blocker).toBe(item.blocker)
      expectReadOnlyBrowserAction(action)
    }
  })

  it('plans retry/backoff only for rate limits and keeps retry execution gated', () => {
    const rateLimited = packetWithAction('Retry after HTTP 429 rate limit with backoff.', 'Rate limit 429 detected; retry later with backoff.', 'inspect')
    const captcha = packetWithAction('Retry after CAPTCHA challenge.', 'CAPTCHA challenge detected; retry is not allowed without owner-approved path.', 'inspect')

    expect(rateLimited.browser_actions[0].retry_policy).toMatchObject({
      schema: 'browser_action_retry_policy_v1',
      retry_planning_enabled: true,
      max_attempts: 3,
      backoff_strategy: 'exponential_backoff_with_jitter',
      next_retry_requires_gateway_policy: true,
      next_retry_requires_bridge_session: true,
      blocked_reason: 'rate_limit_retry_requires_gateway_backoff_and_bridge_session_scope',
    })
    expect(rateLimited.browser_actions[0].execution_enabled).toBe(false)

    expect(captcha.browser_actions[0].retry_policy).toMatchObject({
      retry_planning_enabled: false,
      max_attempts: 0,
      backoff_strategy: 'none',
      next_retry_requires_gateway_policy: false,
      next_retry_requires_bridge_session: false,
      blocked_reason: null,
    })
    expect(captcha.browser_actions[0].blocked_reason).toBe('captcha_challenge_blocked')
  })
})
