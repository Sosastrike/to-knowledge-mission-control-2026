import { describe, expect, it } from 'vitest'
import { normalizeGatewayStatus } from '../status-normalizer.js'
import { CANONICAL_STATUS_SET } from '../types.js'

describe('normalizeGatewayStatus — empty / null inputs', () => {
  it('handles null input gracefully', () => {
    const snap = normalizeGatewayStatus(null)
    expect(snap.execution_enabled).toBe(false)
    expect(snap.writes_enabled).toBe(false)
    expect(snap.external_writes_enabled).toBe(false)
    expect(snap.agents).toEqual([])
    expect(snap.providers).toEqual([])
    expect(snap.tools).toEqual([])
    expect(snap.connectors).toEqual([])
    expect(snap.bridge.status).toBe('BLOCKED')
    expect(snap.buildwiki_farmer.service_name).toBe('opencloud-docs-farmer.service')
    expect(snap.buildwiki_farmer.run_now_requires_owner_approval).toBe(true)
    expect(CANONICAL_STATUS_SET.has(snap.overall_status)).toBe(true)
  })

  it('uses generated_at when supplied, otherwise current ISO', () => {
    const ts = '2026-05-09T10:00:00.000Z'
    expect(normalizeGatewayStatus({ generated_at: ts }).generated_at).toBe(ts)
    const auto = normalizeGatewayStatus({})
    expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(auto.generated_at)).toBe(true)
  })
})

describe('normalizeGatewayStatus — execution gate', () => {
  it('downgrades LIVE / READY components to READ_ONLY when execution_enabled=false', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      agents: [{ id: 'agent-zero', label: 'Agent Zero', status: 'LIVE' }],
      providers: [{ id: 'p1', label: 'P1', status: 'READY' }],
    })
    expect(snap.agents[0].status).toBe('READ_ONLY')
    expect(snap.providers[0].status).toBe('READ_ONLY')
  })

  it('keeps LIVE when execution is enabled', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      agents: [{ id: 'agent-zero', label: 'Agent Zero', status: 'LIVE' }],
    })
    expect(snap.agents[0].status).toBe('LIVE')
  })
})

describe('normalizeGatewayStatus — connector readiness mapping', () => {
  it('maps existing BACKEND_REQUIRED / CREDENTIAL_REQUIRED labels into canonical', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      connectors: [
        { id: 'firecrawl', label: 'FireCrawl', state: 'CREDENTIAL_REQUIRED' },
        { id: 'n8n', label: 'n8n', state: 'BACKEND_REQUIRED' },
        { id: 'zapier', label: 'Zapier MCP', state: 'OWNER_APPROVAL_REQUIRED' },
      ],
    })
    const byId = Object.fromEntries(snap.connectors.map((c) => [c.id, c.status]))
    expect(byId.firecrawl).toBe('CREDENTIAL_GATED')
    expect(byId.n8n).toBe('BLOCKED')
    expect(byId.zapier).toBe('OWNER_GATED')
  })

  it('promotes UNKNOWN to CREDENTIAL_GATED when credential map shows missing creds', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      connectors: [
        {
          id: 'firecrawl',
          label: 'FireCrawl',
          credentials_present_by_name: { FIRECRAWL_API_KEY: false },
        },
      ],
    })
    expect(snap.connectors[0].status).toBe('CREDENTIAL_GATED')
  })
})

describe('normalizeGatewayStatus — bridge', () => {
  it('reports BLOCKED when approval persistence is missing', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      bridge: { approval_persistence_ready: false, audit_chain_ready: true, runner_available: true },
    })
    expect(snap.bridge.status).toBe('BLOCKED')
  })

  it('reports OWNER_GATED when runner is missing but approval+audit are ready', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      bridge: { approval_persistence_ready: true, audit_chain_ready: true, runner_available: false },
    })
    expect(snap.bridge.status).toBe('OWNER_GATED')
  })

  it('reports READY when all three flags are true and execution enabled', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      bridge: { approval_persistence_ready: true, audit_chain_ready: true, runner_available: true },
    })
    expect(snap.bridge.status).toBe('READY')
  })

  it('reports READ_ONLY when all flags are true but execution disabled', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      bridge: { approval_persistence_ready: true, audit_chain_ready: true, runner_available: true },
    })
    expect(snap.bridge.status).toBe('READ_ONLY')
  })
})

describe('normalizeGatewayStatus — safety_status', () => {
  it('flags DEGRADED when external writes on but execution off', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      external_writes_enabled: true,
    })
    expect(snap.safety_status).toBe('DEGRADED')
  })

  it('READ_ONLY when execution off and writes off', () => {
    const snap = normalizeGatewayStatus({ execution_enabled: false })
    expect(snap.safety_status).toBe('READ_ONLY')
  })

  it('READY when execution on and writes on (consistent)', () => {
    const snap = normalizeGatewayStatus({ execution_enabled: true, writes_enabled: true })
    expect(snap.safety_status).toBe('READY')
  })
})

describe('normalizeGatewayStatus — blockers and next actions', () => {
  it('infers blockers from non-LIVE components', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      tools: [
        { id: 'firecrawl', label: 'FireCrawl', state: 'CREDENTIAL_REQUIRED', blocker: 'API key missing', next_action: 'Owner adds key' },
      ],
    })
    expect(snap.blockers.length).toBeGreaterThan(0)
    const cred = snap.blockers.find((b) => b.kind === 'CREDENTIAL_GATED')
    expect(cred).toBeDefined()
    expect(cred?.owner_action_required).toBe(true)
  })

  it('redacts secrets and absolute paths in blocker text', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      tools: [
        {
          id: 'firecrawl',
          label: 'FireCrawl',
          state: 'CREDENTIAL_REQUIRED',
          blocker: 'check FIRECRAWL_API_KEY=fc-secret-1234 in /home/tony/mission-control/.env',
          next_action: 'Owner sets FIRECRAWL_API_KEY',
        },
      ],
    })
    const text = JSON.stringify(snap.blockers)
    expect(text).not.toContain('fc-secret-1234')
    expect(text).not.toContain('/home/tony')
  })

  it('produces a deduped next_actions list (max 8)', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: true,
      tools: Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        label: `T${i}`,
        state: 'CREDENTIAL_REQUIRED',
        blocker: `T${i} missing key`,
        next_action: `Owner adds key for T${i}`,
      })),
    })
    expect(snap.next_actions.length).toBeLessThanOrEqual(8)
  })
})

describe('normalizeGatewayStatus — fake-LIVE prevention', () => {
  it('never emits LIVE for an executable component when execution is disabled', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      writes_enabled: false,
      external_writes_enabled: false,
      agents: [{ id: 'a', label: 'A', status: 'LIVE' }],
      providers: [{ id: 'p', label: 'P', status: 'LIVE' }],
      tools: [{ id: 't', label: 'T', status: 'LIVE' }],
      connectors: [{ id: 'c', label: 'C', status: 'LIVE' }],
      bridge: { status: 'LIVE', approval_persistence_ready: true, audit_chain_ready: true, runner_available: true },
      buildwiki_farmer: { status: 'LIVE', ui_state: 'completed' },
    })
    const allStatuses = [
      ...snap.agents.map((c) => c.status),
      ...snap.providers.map((c) => c.status),
      ...snap.tools.map((c) => c.status),
      ...snap.connectors.map((c) => c.status),
      snap.bridge.status,
      snap.buildwiki_farmer.status,
    ]
    expect(allStatuses).not.toContain('LIVE')
  })
})
