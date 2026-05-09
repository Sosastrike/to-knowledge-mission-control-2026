import { describe, expect, it } from 'vitest'
import { buildKnowledgeReport } from './knowledge-report'

describe('buildKnowledgeReport', () => {
  it('summarizes indexed, not-indexed, blocked, disabled, and last sync without raw paths', () => {
    const report = buildKnowledgeReport({
      generated_at: '2026-05-09T22:30:00.000Z',
      upstream: {
        status: 'CREDENTIAL_GATED',
        blocker: 'claudeclaw_dashboard_token_missing',
      },
      sources: [
        {
          source: 'obsidian',
          status: 'read_only',
          count: 42,
          last_known_sync_at: '2026-05-09T12:00:00.000Z',
          summary: 'Local vault visible.',
          path: '/Users/sosastrike/private/vault',
          details: { indexed: true, vault_path_status: 'present' },
          owner_status: { status: 'READY' },
        },
        {
          source: 'mempalace',
          status: 'read_only',
          count: 0,
          last_known_sync_at: null,
          summary: 'Visible but no safe summaries indexed yet.',
          details: { indexed: false },
          owner_status: { status: 'READY' },
        },
        {
          source: 'graphify',
          status: 'not_connected',
          count: null,
          last_error: '/home/tony/.graphify missing',
          missing_connector_warning: 'Graphify connector missing.',
          owner_status: { status: 'SERVICE_DOWN' },
        },
        {
          source: 'archive_import',
          status: 'disabled',
          summary: 'Disabled by policy.',
          owner_status: { status: 'DISABLED' },
        },
      ],
      brain_sync: {
        production_memory_writes_enabled: false,
        protected_memory_changes_enabled: false,
      },
    })

    expect(report.summary).toMatchObject({
      total_sources: 4,
      indexed: 1,
      not_indexed: 1,
      blocked: 1,
      disabled: 1,
      last_sync_at: '2026-05-09T12:00:00.000Z',
    })
    expect(report.sources.find((source) => source.id === 'obsidian')).toMatchObject({
      index_state: 'indexed',
      owner_status: 'READY',
      safe_link: '/gateway/brain',
    })
    expect(report.sources.find((source) => source.id === 'mempalace')?.index_state).toBe('not_indexed')
    expect(report.sources.find((source) => source.id === 'graphify')?.index_state).toBe('blocked')
    expect(report.sources.find((source) => source.id === 'archive_import')?.index_state).toBe('disabled')
    expect(report.safety).toMatchObject({
      raw_local_paths_exposed: false,
      memory_writes_enabled: false,
      external_writes_enabled: false,
    })
    expect(JSON.stringify(report)).not.toMatch(/\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}/)
    expect(report.markdown).toContain('## Knowledge Report')
    expect(report.markdown).toContain('Blocked: 1')
  })
})
