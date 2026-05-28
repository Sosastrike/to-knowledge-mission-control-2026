import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('@/lib/claudeclaw-telegram-approvals', () => ({
  hasClaudeClawDashboardToken: () => true,
}))

vi.mock('@/lib/build-wiki-run-now', () => ({
  readLatestRunNow: () => ({
    persistence_ready: true,
    approval: { id: 'approval_1', created_at: '2026-05-21T00:00:00.000Z' },
    run: null,
  }),
}))

import {
  buildBrainBridgeEvents,
  buildBrainBridgeGatewayStatus,
  buildBrainBridgeLaneStatus,
  parseLatestBuildWikiFarmerEvent,
  parseLatestGraphifyEvent,
} from '@/lib/brain-sync-gateway-status'

describe('Brain Bridge Gateway status', () => {
  beforeEach(() => {
    vi.stubEnv('OPENCLOUD_FARMER_LOG_PATH', '/tmp/mission-control-test-missing-farmer.log')
    vi.stubEnv('GRAPHIFY_GRAPH_PATH', '/tmp/mission-control-test-missing-graphify.json')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports exact lane states instead of generic backend required', () => {
    const status = buildBrainBridgeGatewayStatus()

    expect(status.route).toBe('bridge.brain-sync.gateway-status')
    expect(status.gateway_connected).toBe(true)
    expect(status.nuclear_gateway_connected).toBe(true)
    expect(status.jarvis_connected).toBe(true)
    expect(status.hermes_connected).toBe(true)
    expect(status.openclaw_intermediary).toBe(false)
    expect(status.openclaw_conversation_owner).toBe(false)
    expect(status.credential_broker).toBe('nuclear.gateway')
    expect(status.memory_write_policy).toBe('approval_gated_exact_scope_only')
    expect(status.no_secrets_exposed).toBe(true)
    expect(status.project_continues).toBe(true)
    expect(status.obsidian.state).toBe('WRITE_GATED')
    expect(status.obsidian.no_secrets_exposed).toBe(true)
    expect(status.obsidian.gateway_route).toBe('/api/bridge/brain-sync/obsidian/status')
    expect(status.obsidian.nuclear_gateway_connected).toBe(true)
    expect(status.obsidian.openclaw_intermediary).toBe(false)
    expect(status.obsidian.openclaw_conversation_owner).toBe(false)
    expect(status.mempalace.state).toBe('WRITE_GATED')
    expect(status.graphify.state).toBe('EVENT_STREAM_REQUIRED')
    expect(status.build_wiki.state).toBe('EVENT_STREAM_REQUIRED')
    expect(status.build_wiki.read_state).toBe('LIVE_READ_ONLY')
    expect(status.build_wiki.exact_action_availability).toContain('brain.buildwiki.run_now_approval')
    expect(status.approvals.state).toBe('WRITE_GATED')
    expect(status.lanes).toMatchObject({
      obsidian: { state: 'WRITE_GATED' },
      mempalace: { state: 'WRITE_GATED' },
      graphify: { state: 'EVENT_STREAM_REQUIRED' },
      build_wiki: { state: 'EVENT_STREAM_REQUIRED' },
      memory_approvals: { state: 'WRITE_GATED' },
    })
    expect(status.generated_at).toMatch(/T/)
    expect(status.canonical_routes.gateway_status).toBe('/api/bridge/brain-sync/gateway-status')
    expect(status.visible_task_id).toMatch(/^\d+$/)
    expect(status.owner_visible_task_route).toMatch(/^\/api\/tasks\/\d+$/)
    expect(status.visible_task_event_route).toMatch(/^\/api\/tasks\/\d+\/events$/)
    expect(status.audit_id).toMatch(/^audit_brain_bridge_/)
    expect(status.rollback_id).toMatch(/^rollback_brain_bridge_no_state_/)
    expect(status.rollback_no_state_proof).toMatchObject({
      memory_write_executed: false,
      external_writes_enabled: false,
      public_exposure_created: false,
      credential_values_exposed: false,
    })
    expect(JSON.stringify(status)).not.toContain('"state":"BACKEND_REQUIRED"')
  })

  it('exposes per-lane exact action availability', () => {
    expect(buildBrainBridgeLaneStatus('obsidian')).toMatchObject({
      id: 'obsidian',
      read_state: 'LIVE_READ_ONLY',
      write_state: 'WRITE_GATED',
      event_stream_state: 'EVENT_STREAM_REQUIRED',
      gateway_route: '/api/bridge/brain-sync/obsidian/status',
      nuclear_gateway_connected: true,
      openclaw_intermediary: false,
      openclaw_conversation_owner: false,
      memory_write_policy: 'approval_gated_exact_scope_only',
      credential_values_exposed: false,
      no_secrets_exposed: true,
    })
  })

  it('publishes V1 polling event names without pretending SSE is ready', () => {
    const events = buildBrainBridgeEvents()

    expect(events.mode).toBe('polling_v1')
    expect(events.event_stream).toBe('polling_v1_snapshot')
    expect(events.sse_enabled).toBe(false)
    expect(events.sse_blocker).toBe('brain_bridge_v1_uses_polling_not_sse')
    expect(events.no_secrets_exposed).toBe(true)
    expect(events.project_continues).toBe(true)
    expect(events.visible_task_id).toMatch(/^\d+$/)
    expect(events.audit_id).toMatch(/^audit_brain_bridge_/)
    expect(events.rollback_no_state_proof).toMatchObject({
      memory_write_executed: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
    })
    expect(events.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'MEMORY_READ',
      'MEMORY_WRITE_REQUESTED',
      'OBSIDIAN_SYNC_EVENT',
      'CANONICAL_TRUTH_PROMOTED',
    ]))
  })

  it('recognizes read-only Build-Wiki/Farmer log events without exposing raw paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-buildwiki-farmer-'))
    const logPath = join(dir, 'farmer.log')
    writeFileSync(logPath, [
      '[2026-05-27T13:38:17Z] run start MAX_NEW=3 MTIME_DAYS=1 sources=6',
      '[2026-05-27T13:38:17Z] run complete. imported=0 cap=3 window=1d',
      'imported 0 file(s)',
    ].join('\n'))
    vi.stubEnv('OPENCLOUD_FARMER_LOG_PATH', logPath)

    try {
      const parsed = parseLatestBuildWikiFarmerEvent(readFileSync(logPath, 'utf8'))
      const lane = buildBrainBridgeLaneStatus('build-wiki')
      const events = buildBrainBridgeEvents()
      const buildWikiEvent = events.events.find((event) => event.type === 'BUILDWIKI_EVENT')

      expect(parsed).toMatchObject({
        type: 'BUILDWIKI_FARMER_RUN_COMPLETE',
        observed_at: '2026-05-27T13:38:17Z',
        imported_count: 0,
        cap: 3,
        window: '1d',
        sources_count: 6,
        raw_path_exposed: false,
        credential_values_exposed: false,
      })
      expect(lane).toMatchObject({
        state: 'LIVE_READ_ONLY',
        event_stream_state: 'READY',
        blockers: [],
      })
      expect(buildWikiEvent).toMatchObject({
        available: true,
        state: 'READY',
        observed_event: {
          source: 'opencloud-docs-farmer.log',
          raw_path_exposed: false,
        },
      })
      expect(JSON.stringify({ lane, events })).not.toContain(logPath)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('recognizes read-only Graphify graph events without exposing raw paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-graphify-'))
    const graphPath = join(dir, 'graph.json')
    writeFileSync(graphPath, JSON.stringify({
      nodes: [
        { id: 'gateway', label: 'Gateway', community: 1, source_file: 'src/gateway.ts' },
        { id: 'ron', label: 'Ron Weasley', community: 1, source_file: 'src/gateway.ts' },
      ],
      links: [
        { source: 'gateway', target: 'ron', relation: 'routes_to' },
      ],
    }))
    vi.stubEnv('GRAPHIFY_GRAPH_PATH', graphPath)

    try {
      const parsed = parseLatestGraphifyEvent(readFileSync(graphPath, 'utf8'), '2026-05-27T15:30:00.000Z')
      const lane = buildBrainBridgeLaneStatus('graphify')
      const events = buildBrainBridgeEvents()
      const graphifyEvent = events.events.find((event) => event.type === 'GRAPHIFY_UPDATE')

      expect(parsed).toMatchObject({
        type: 'GRAPHIFY_GRAPH_READY',
        observed_at: '2026-05-27T15:30:00.000Z',
        node_count: 2,
        edge_count: 1,
        communities_count: 1,
        source_files_count: 1,
        source: 'graphify-out/graph.json',
        raw_path_exposed: false,
        credential_values_exposed: false,
      })
      expect(lane).toMatchObject({
        state: 'LIVE_READ_ONLY',
        event_stream_state: 'READY',
        blockers: [],
      })
      expect(graphifyEvent).toMatchObject({
        available: true,
        state: 'READY',
        observed_event: {
          source: 'graphify-out/graph.json',
          raw_path_exposed: false,
        },
      })
      expect(JSON.stringify({ lane, events })).not.toContain(graphPath)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps Agent Network Brain Bridge cards from using stale generic backend fallback copy', () => {
    const source = readFileSync(new URL('../components/agent-network/AgentNetworkClient.tsx', import.meta.url), 'utf8')

    expect(source).toContain('function exactBrainBridgeLaneState')
    expect(source).toContain('Object.values(payload.lanes || {})')
    expect(source).toContain("if (lane.state && lane.state !== 'BACKEND_REQUIRED') return lane.state")
    expect(source).toContain("lane.credential_state === 'required_by_name_only'")
    expect(source).toContain('lane.exact_action_availability.join')
    expect(source).not.toContain("lane.state || 'BACKEND_REQUIRED'")
    expect(source).not.toContain('if (lane.state) return lane.state')
    expect(source).not.toContain("return 'BACKEND_REQUIRED'\n}\n\nfunction BrainBridgeLaneCard")
    expect(source).not.toContain('generic Backend required copy')
  })
})
