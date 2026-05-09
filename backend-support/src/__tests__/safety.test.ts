// End-to-end safety tests: the full surface must never leak secrets, raw paths,
// or fake LIVE statuses. These tests run against the public exports only.
import { describe, expect, it } from 'vitest'
import {
  buildAgentHealth,
  buildBuildWikiStatus,
  buildRouteSmokeReport,
  classifyError,
  normalizeGatewayStatus,
} from '../index.js'

const FAKE_SECRETS = ['fc-secret-token-1234', 'sk-abcdef0123456789ABCDEF0123456789', 'Bearer abcdef0123456789']
const FAKE_PATHS = ['/home/tony/mission-control', '/Users/sosastrike/Documents/Active', 'http://127.0.0.1:3000']

function assertNoLeaks(payload: unknown) {
  const json = JSON.stringify(payload)
  for (const s of FAKE_SECRETS) expect(json).not.toContain(s)
  for (const p of FAKE_PATHS) expect(json).not.toContain(p)
}

describe('end-to-end safety: redaction is applied across every surface', () => {
  it('normalizeGatewayStatus never echoes secrets/paths', () => {
    const snap = normalizeGatewayStatus({
      execution_enabled: false,
      tools: [
        {
          id: 'firecrawl',
          label: 'FireCrawl',
          state: 'CREDENTIAL_REQUIRED',
          blocker: 'check FIRECRAWL_API_KEY=fc-secret-token-1234 in /home/tony/mission-control/.env',
          next_action: 'Owner sets FIRECRAWL_API_KEY in /home/tony/mission-control/.env',
        },
      ],
      blockers: [
        {
          kind: 'CREDENTIAL_GATED',
          owner_message: 'FireCrawl key missing',
          technical_detail: 'sk-abcdef0123456789ABCDEF0123456789 not present',
          next_action: 'Owner sets the value',
        },
      ],
    })
    assertNoLeaks(snap)
  })

  it('buildAgentHealth never echoes secrets/paths', () => {
    const out = buildAgentHealth([
      { id: 'hermes', service_running: false, blocker: 'unit at /home/tony/hermes; Bearer abcdef0123456789' },
    ])
    assertNoLeaks(out)
  })

  it('buildRouteSmokeReport redacts redirect targets', () => {
    const r = buildRouteSmokeReport(
      [{ path: '/gateway', http_status: 302, redirect_target: '/login?return=/home/tony/mission-control' }],
      'http://127.0.0.1:3000',
    )
    assertNoLeaks(r)
  })

  it('buildBuildWikiStatus redacts run summaries', () => {
    const out = buildBuildWikiStatus({
      telegram: {
        id: 't1',
        status: 'approved',
        run_status: 'failed',
        run_exit_code: 1,
        run_summary: 'failed at /home/tony/mission-control with FIRECRAWL_API_KEY=fc-secret-token-1234',
      },
    })
    assertNoLeaks(out)
  })

  it('classifyError never echoes secrets/paths in technical_detail', () => {
    const c = classifyError({ message: 'sk-abcdef0123456789ABCDEF0123456789 missing in /home/tony/mission-control/.env' })
    assertNoLeaks(c)
  })
})

describe('safety: no fake LIVE under execution-disabled', () => {
  it('every component status downgrades when execution is disabled', () => {
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
    const labels = [
      ...snap.agents.map((c) => c.status),
      ...snap.providers.map((c) => c.status),
      ...snap.tools.map((c) => c.status),
      ...snap.connectors.map((c) => c.status),
      snap.bridge.status,
      snap.buildwiki_farmer.status,
    ]
    expect(labels).not.toContain('LIVE')
  })

  it('safety_status flags DEGRADED when external writes on but execution off', () => {
    const snap = normalizeGatewayStatus({ execution_enabled: false, external_writes_enabled: true })
    expect(snap.safety_status).toBe('DEGRADED')
  })
})
