import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAgentZeroObsidianStatus = vi.fn()
const searchAgentZeroObsidianNotes = vi.fn()
const readAgentZeroObsidianNote = vi.fn()
const summarizeAgentZeroObsidianNote = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ user: { role: 'viewer' } })),
}))

vi.mock('@/lib/rate-limit', () => ({
  readLimiter: vi.fn(() => null),
}))

vi.mock('@/lib/agent-zero-obsidian-adapter', () => ({
  getAgentZeroObsidianStatus,
  searchAgentZeroObsidianNotes,
  readAgentZeroObsidianNote,
  summarizeAgentZeroObsidianNote,
}))

describe('Agent Zero Obsidian route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns SERVICE_DOWN owner status when the local Obsidian vault is unavailable', async () => {
    getAgentZeroObsidianStatus.mockReturnValue({
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'blocked',
      vault_visible: false,
      vault_path_status: 'missing',
      note_count: 0,
      indexed: false,
      last_indexed_at: null,
      available_actions: ['status'],
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: ['obsidian_vault_missing_or_unreadable'],
    })

    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/agent-zero/obsidian'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.owner_status).toMatchObject({
      status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      can_read: false,
      can_write: false,
      can_execute: false,
    })
    expect(body.write_enabled).toBe(false)
    expect(body.execution_enabled).toBe(false)
    expect(body.direct_filesystem_exposed).toBe(false)
  })

  it('returns READY owner status for safe read-only Obsidian visibility', async () => {
    getAgentZeroObsidianStatus.mockReturnValue({
      ok: true,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'connected',
      vault_visible: true,
      vault_path_status: 'present',
      note_count: 2,
      indexed: true,
      last_indexed_at: '2026-05-09T10:00:00.000Z',
      available_actions: ['status', 'search', 'read', 'summarize'],
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: [],
    })

    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/agent-zero/obsidian'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.owner_status).toMatchObject({
      status: 'READY',
      blocker_class: 'NONE',
      can_read: true,
      can_write: false,
      can_execute: false,
    })
    expect(body.adapter_scope.write_enabled).toBe(false)
    expect(body.adapter_scope.direct_filesystem_exposed).toBe(false)
  })

  it('classifies unsupported actions as BLOCKED instead of service down', async () => {
    const route = await import('./route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/agent-zero/obsidian?action=delete'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('unsupported_obsidian_adapter_action')
    expect(body.owner_status).toMatchObject({
      status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      can_read: false,
      can_write: false,
      can_execute: false,
    })
  })
})
