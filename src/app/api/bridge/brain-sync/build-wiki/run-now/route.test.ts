import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  readLatestAgentZeroBridgeSession: vi.fn(),
  fetchClaudeClawJson: vi.fn(),
  readLatestTelegramBuildWikiRunNowApproval: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/agent-zero-bridge-session', () => ({
  readLatestAgentZeroBridgeSession: mocks.readLatestAgentZeroBridgeSession,
}))

vi.mock('@/lib/claudeclaw-telegram-approvals', () => ({
  fetchClaudeClawJson: mocks.fetchClaudeClawJson,
}))

vi.mock('@/lib/build-wiki-telegram-run-now', () => ({
  readLatestTelegramBuildWikiRunNowApproval: mocks.readLatestTelegramBuildWikiRunNowApproval,
}))

import { POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/run-now', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('Build-Wiki Run Now route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: {
        id: 1,
        username: 'owner',
        display_name: 'Owner',
        role: 'admin',
        workspace_id: 1,
        tenant_id: 1,
      },
    })
    mocks.readLatestAgentZeroBridgeSession.mockReturnValue({
      session: {
        status: 'not_active',
        session_id: null,
        execution_enabled: false,
        allowed_tools: [],
      },
    })
  })

  it('blocks Run Now approval creation until a scoped Bridge Session is active', async () => {
    const response = await POST(request({ reason: 'probe' }))
    const payload = await response.json()

    expect(response.status).toBe(423)
    expect(payload).toMatchObject({
      ok: false,
      mode: 'buildwiki_run_now_bridge_session_required',
      bridge_session_required: true,
      required_scope: 'buildwiki.run_now',
      approval_request_created: false,
      execution_enabled: false,
      accepted_for_execution: false,
      writes_enabled: false,
      blocked_reason: 'active_bridge_session_required_for_buildwiki_run_now',
    })
    expect(mocks.fetchClaudeClawJson).not.toHaveBeenCalled()
  })
})
