import { describe, expect, it } from 'vitest'
import {
  AGENT_NETWORK_STATUS_STATES,
  CANONICAL_AGENT_NETWORK_HIERARCHY,
  HERMES_NUCLEAR_DISPATCHER_CAPABILITIES,
  getCanonicalAgentNetworkRows,
  getCanonicalAgentNetworkTierDefs,
  getHermesHierarchyStatus,
  isCanonicalAgentNetworkSeedId,
  isTonyActiveInHierarchy,
} from './agent-network-hierarchy'

describe('canonical Agent Zero and Ron Weasley hierarchy', () => {
  it('places Agent Zero as commander and Ron Weasley as Nuclear Dispatcher under him', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(hierarchy.owner.role).toContain('Owner')
    expect(hierarchy.commander.id).toBe('agent_zero')
    expect(hierarchy.commander.role).toBe('Commander / ecosystem lead')
    expect(hierarchy.commander.reports_to).toBe('owner')
    expect(hierarchy.nuclear_dispatcher.id).toBe('hermes')
    expect(hierarchy.nuclear_dispatcher.name).toBe('Ron Weasley')
    expect(hierarchy.nuclear_dispatcher.short_name).toBe('Ron')
    expect(hierarchy.nuclear_dispatcher.legacy_names).toEqual(['Hermes', 'Hermans'])
    expect(hierarchy.nuclear_dispatcher.role).toBe('Nuclear Dispatcher / optimization and workflow architect')
    expect(hierarchy.nuclear_dispatcher.supports).toBe('agent_zero')
    expect(hierarchy.edges).toContainEqual({ from: 'agent_zero', to: 'hermes', relation: 'delegates_to' })
  })

  it('keeps Tony archived and out of active hierarchy', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(isTonyActiveInHierarchy(hierarchy)).toBe(false)
    expect(hierarchy.retired.map((agent) => agent.id)).toEqual(['tony_legacy', 'tony_v2'])
    for (const retired of hierarchy.retired) {
      expect(retired.hidden_by_default).toBe(true)
      expect(retired.execution_enabled).toBe(false)
      expect(retired.role).toBe('legacy_archived')
      expect(retired.status).toBe('legacy_archived')
    }
  })

  it('aligns labels for approvals, reports, and shared skill ownership', () => {
    const hierarchy = CANONICAL_AGENT_NETWORK_HIERARCHY

    expect(hierarchy.labels.approval_queue).toBe('Approval Queue - Agent Zero Bridge Session')
    expect(hierarchy.labels.report_identity).toContain('Agent Zero commander')
    expect(hierarchy.labels.report_identity).toContain('Ron Weasley')
    expect(hierarchy.labels.report_identity).toContain('Nuclear Dispatcher')
    expect(hierarchy.skill_policy.available_to).toEqual(['agent_zero', 'hermes'])
    expect(hierarchy.skill_policy.tony_owns_skill_system).toBe(false)
  })

  it('shows Ron Weasley capability and delegated execution states', () => {
    expect(HERMES_NUCLEAR_DISPATCHER_CAPABILITIES).toEqual([
      'full ecosystem visibility',
      'Jarvis command registry parity',
      'delegated exact-scope execution',
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
    expect(CANONICAL_AGENT_NETWORK_HIERARCHY.nuclear_dispatcher.execution_enabled).toBe(true)
    expect(CANONICAL_AGENT_NETWORK_HIERARCHY.nuclear_dispatcher.bridge_session_required).toBe(true)
  })

  it('builds Gateway rows from canonical hierarchy and filters compatibility aliases', () => {
    const rows = getCanonicalAgentNetworkRows({ installed: true, reachable: true, authConfigured: false })
    const ids = rows.map((row) => row.id)
    const hermes = rows.find((row) => row.id === 'hermes')

    expect(ids).toEqual(['agent_zero', 'hermes', 'openclaw_plus', 'bridge_mcp'])
    expect(hermes?.status).toBe('degraded')
    expect(hermes?.blocker).toBe('hermes_auth_not_configured')
    expect(hermes?.name).toBe('Ron Weasley')
    expect(hermes?.support_edge).toBe('Agent Zero delegates certified exact scopes to Ron Weasley as Nuclear Dispatcher')
    expect(isCanonicalAgentNetworkSeedId('agent-zero')).toBe(true)
    expect(isCanonicalAgentNetworkSeedId('main')).toBe(true)
    expect(isCanonicalAgentNetworkSeedId('tony_legacy')).toBe(true)
  })

  it('keeps the tier headings aligned with the canonical hierarchy', () => {
    expect(getCanonicalAgentNetworkTierDefs().map((tier) => tier.id)).toEqual([
      'commander',
      'nuclear_dispatcher',
      'runtime',
      'system',
    ])
  })
})
