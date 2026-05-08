import { describe, expect, it } from 'vitest'
import {
  AGENT_NETWORK_STATUS_STATES,
  CANONICAL_AGENT_NETWORK_HIERARCHY,
  HERMES_LIEUTENANT_CAPABILITIES,
  getCanonicalAgentNetworkRows,
  getCanonicalAgentNetworkTierDefs,
  getHermesHierarchyStatus,
  isCanonicalAgentNetworkSeedId,
  isTonyActiveInHierarchy,
} from './agent-network-hierarchy'

describe('canonical Agent Zero and Hermes hierarchy', () => {
  it('places Agent Zero as commander and Hermes as lieutenant under him', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(hierarchy.owner.role).toContain('Owner')
    expect(hierarchy.commander.id).toBe('agent_zero')
    expect(hierarchy.commander.role).toBe('Commander / ecosystem lead')
    expect(hierarchy.commander.reports_to).toBe('owner')
    expect(hierarchy.lieutenant.id).toBe('hermes')
    expect(hierarchy.lieutenant.role).toBe('Lieutenant / skill-workflow specialist')
    expect(hierarchy.lieutenant.supports).toBe('agent_zero')
    expect(hierarchy.edges).toContainEqual({ from: 'agent_zero', to: 'hermes', relation: 'supported_by' })
  })

  it('keeps legacy controller IDs out of active hierarchy', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(isTonyActiveInHierarchy(hierarchy)).toBe(false)
    expect(hierarchy.retired).toEqual([])
  })

  it('aligns labels for approvals, reports, and shared skill ownership', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(hierarchy.labels.approval_queue).toBe('Approval Queue - Agent Zero Bridge Session')
    expect(hierarchy.labels.report_identity).toContain('Agent Zero commander')
    expect(hierarchy.labels.report_identity).toContain('Hermes lieutenant')
    expect(hierarchy.skill_policy.available_to).toEqual(['agent_zero', 'hermes'])
    expect(hierarchy.skill_policy.legacy_controller_owns_skill_system).toBe(false)
  })

  it('shows Hermes capability and execution states without enabling execution', () => {
    expect(HERMES_LIEUTENANT_CAPABILITIES).toEqual([
      'skills',
      'workflow planning',
      'automation design',
      'spec generation',
      'debugging support',
    ])
    expect([...AGENT_NETWORK_STATUS_STATES]).toEqual(['connected', 'degraded', 'pending', 'blocked', 'legacy_archived'])

    const blocked = getHermesHierarchyStatus({ installed: false })
    const pending = getHermesHierarchyStatus({ installed: true })
    const connected = getHermesHierarchyStatus({ installed: true, reachable: true, authConfigured: true })

    expect(blocked).toMatchObject({ state: 'blocked', blocker: 'hermes_runtime_not_installed_or_not_detected' })
    expect(pending).toMatchObject({ state: 'pending', blocker: 'hermes_live_health_not_proven' })
    expect(connected).toMatchObject({ state: 'connected', blocker: null })
    expect(CANONICAL_AGENT_NETWORK_HIERARCHY.lieutenant.execution_enabled).toBe(false)
    expect(CANONICAL_AGENT_NETWORK_HIERARCHY.lieutenant.bridge_session_required).toBe(true)
  })

  it('builds Gateway rows from canonical hierarchy and filters compatibility aliases', () => {
    const rows = getCanonicalAgentNetworkRows({ installed: true, reachable: true, authConfigured: false })
    const ids = rows.map((row) => row.id)
    const hermes = rows.find((row) => row.id === 'hermes')

    expect(ids).toEqual(['agent_zero', 'hermes', 'openclaw_plus', 'bridge_mcp'])
    expect(hermes?.status).toBe('degraded')
    expect(hermes?.blocker).toBe('hermes_auth_not_configured')
    expect(hermes?.support_edge).toBe('Hermes supports Agent Zero')
    expect(isCanonicalAgentNetworkSeedId('agent-zero')).toBe(true)
    expect(isCanonicalAgentNetworkSeedId('main')).toBe(true)
    expect(isCanonicalAgentNetworkSeedId('tony_legacy')).toBe(false)
  })

  it('keeps the tier headings aligned with the canonical hierarchy', () => {
    expect(getCanonicalAgentNetworkTierDefs().map((tier) => tier.id)).toEqual([
      'commander',
      'lieutenant',
      'runtime',
      'system',
    ])
  })
})
