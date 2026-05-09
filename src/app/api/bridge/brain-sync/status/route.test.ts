import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  fetchClaudeClawJson: vi.fn(),
  hasClaudeClawDashboardToken: vi.fn(),
  getAgentZeroObsidianStatus: vi.fn(),
  getAgentZeroMemPalaceStatus: vi.fn(),
  readLatestRunNow: vi.fn(),
  readRunNowHistory: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/claudeclaw-telegram-approvals', () => ({
  fetchClaudeClawJson: mocks.fetchClaudeClawJson,
  hasClaudeClawDashboardToken: mocks.hasClaudeClawDashboardToken,
}))

vi.mock('@/lib/agent-zero-obsidian-adapter', () => ({
  getAgentZeroObsidianStatus: mocks.getAgentZeroObsidianStatus,
}))

vi.mock('@/lib/agent-zero-mempalace-adapter', () => ({
  getAgentZeroMemPalaceStatus: mocks.getAgentZeroMemPalaceStatus,
}))

vi.mock('@/lib/build-wiki-run-now', () => ({
  readLatestRunNow: mocks.readLatestRunNow,
  readRunNowHistory: mocks.readRunNowHistory,
}))

import { GET } from './route'

function makeRequest() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/status')
}

describe('Brain Sync status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({ user: { id: 1, role: 'viewer', workspace_id: 1, tenant_id: 1 } })
    mocks.hasClaudeClawDashboardToken.mockReturnValue(false)
    mocks.getAgentZeroObsidianStatus.mockReturnValue({
      ok: true,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'connected',
      vault_visible: true,
      vault_path_status: 'present',
      note_count: 42,
      indexed: true,
      last_indexed_at: '2026-05-09T12:00:00.000Z',
      available_actions: ['status', 'search', 'read', 'summarize'],
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: [],
    })
    mocks.getAgentZeroMemPalaceStatus.mockReturnValue({
      ok: false,
      mode: 'agent_zero_mempalace_read_only_adapter',
      status: 'blocked',
      mempalace_visible: false,
      graph_db_status: 'missing',
      vector_db_status: 'missing',
      data_dir_status: 'missing',
      config_status: 'missing',
      index_status: 'missing',
      last_seen_at: null,
      counts: {
        entities: null,
        triples: null,
        entity_types: null,
        predicates: null,
        collections: null,
        embeddings: null,
        fulltext_rows: null,
        safe_memory_summaries: 0,
      },
      available_actions: ['status'],
      safe_summary_available: false,
      raw_private_dump_enabled: false,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: ['mempalace_not_visible'],
    })
    mocks.readLatestRunNow.mockReturnValue({ persistence_ready: true, approval: null, run: null })
    mocks.readRunNowHistory.mockReturnValue({ persistence_ready: true, history: [] })
  })

  it('returns local read-only Brain status when ClaudeClaw dashboard token is missing', async () => {
    const response = await GET(makeRequest() as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.upstream).toMatchObject({
      claudeclaw_dashboard_token_configured: false,
      status: 'CREDENTIAL_GATED',
      blocker: 'claudeclaw_dashboard_token_missing',
      fallback: 'mission_control_local_readonly_adapters',
    })
    expect(payload.brain_sync.local_readonly_status_available).toBe(true)
    expect(payload.sources.find((source: any) => source.source === 'obsidian')).toMatchObject({
      status: 'read_only',
      count: 42,
      writes_enabled: false,
      owner_status: { status: 'READY', can_read: true, can_write: false },
    })
    expect(payload.sources.find((source: any) => source.source === 'mempalace')).toMatchObject({
      status: 'not_connected',
      writes_enabled: false,
      owner_status: { status: 'SERVICE_DOWN', can_write: false },
    })
    expect(payload.brain_systems.find((system: any) => system.id === 'buildwiki')).toMatchObject({
      visible: true,
      write_enabled: false,
      owner_status: { status: 'READY' },
    })
    expect(mocks.fetchClaudeClawJson).not.toHaveBeenCalled()
    expect(JSON.stringify(payload)).not.toMatch(/\/home\/|\/Users\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
  })

  it('keeps authentication required', async () => {
    mocks.requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })

    const response = await GET(makeRequest() as any)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Authentication required' })
  })
})
