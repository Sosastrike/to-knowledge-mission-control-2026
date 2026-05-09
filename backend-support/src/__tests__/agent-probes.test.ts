import { describe, expect, it } from 'vitest'
import { AGENT_ROSTER, buildAgentHealth } from '../agent-probes.js'

describe('buildAgentHealth — roster integrity', () => {
  it('returns one row per roster entry, in roster order', () => {
    const out = buildAgentHealth([])
    expect(out.length).toBe(AGENT_ROSTER.length)
    for (let i = 0; i < AGENT_ROSTER.length; i += 1) {
      expect(out[i].id).toBe(AGENT_ROSTER[i].id)
      expect(out[i].label).toBe(AGENT_ROSTER[i].label)
    }
  })

  it('reports UNKNOWN when probe data is missing', () => {
    const out = buildAgentHealth([])
    for (const row of out) {
      expect(row.status).toBe('UNKNOWN')
      expect(row.reachable).toBe(false)
      expect(row.configured).toBe(false)
    }
  })
})

describe('buildAgentHealth — status classification', () => {
  it('SERVICE_DOWN when service is unit-backed but not running', () => {
    const out = buildAgentHealth([
      { id: 'hermes', service_running: false, configured: true, credential_configured: true, reachable: true },
    ])
    const hermes = out.find((r) => r.id === 'hermes')!
    expect(hermes.status).toBe('SERVICE_DOWN')
    expect(hermes.blocker).toContain('inactive')
  })

  it('does not require service_running for paperclip (no service unit)', () => {
    const out = buildAgentHealth([
      { id: 'paperclip', configured: true, credential_configured: true, reachable: true },
    ])
    const paperclip = out.find((r) => r.id === 'paperclip')!
    expect(paperclip.status).toBe('READY')
  })

  it('CREDENTIAL_GATED when credential is missing', () => {
    const out = buildAgentHealth([
      { id: 'spaceagent_firecrawl', service_running: true, configured: true, credential_configured: false, reachable: true },
    ])
    expect(out.find((r) => r.id === 'spaceagent_firecrawl')!.status).toBe('CREDENTIAL_GATED')
  })

  it('BLOCKED when configured=false (backend adapter missing)', () => {
    const out = buildAgentHealth([
      { id: 'agent_zero', configured: false, credential_configured: true, reachable: true, service_running: true },
    ])
    expect(out.find((r) => r.id === 'agent_zero')!.status).toBe('BLOCKED')
  })

  it('OWNER_GATED when reachable=false', () => {
    const out = buildAgentHealth([
      { id: 'pi', configured: true, credential_configured: true, reachable: false, service_running: true },
    ])
    expect(out.find((r) => r.id === 'pi')!.status).toBe('OWNER_GATED')
  })

  it('READ_ONLY downgrade when execution disabled', () => {
    const out = buildAgentHealth(
      [
        { id: 'spaceagent_youtube', configured: true, credential_configured: true, reachable: true, service_running: true },
      ],
      { executionEnabled: false },
    )
    expect(out.find((r) => r.id === 'spaceagent_youtube')!.status).toBe('READ_ONLY')
  })

  it('redacts blocker text', () => {
    const out = buildAgentHealth([
      {
        id: 'hermes',
        service_running: false,
        blocker: 'unit not at /home/tony/hermes/run.sh; FIRECRAWL_API_KEY=fc-1234',
      },
    ])
    const hermes = out.find((r) => r.id === 'hermes')!
    expect(hermes.blocker).not.toContain('/home/tony')
    expect(hermes.blocker).not.toContain('fc-1234')
  })
})
