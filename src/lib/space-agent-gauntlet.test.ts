import { describe, expect, it } from 'vitest'

import {
  buildFullSpaceAgentGauntletScenarios,
  buildSpaceAgentBrowserBlockedScenarios,
  buildSpaceAgentHandoffScenarios,
  buildSpaceAgentMiniAgentScenarios,
  buildSpaceAgentRoutingScenarios,
  buildSpaceAgentWebResearchScenarios,
  buildSpaceAgentYouTubeScenarios,
  runFullSpaceAgentGauntlet,
} from './space-agent-gauntlet'

describe('Space Agent full gauntlet', () => {
  it('builds the required scenario counts for phases 281-286', () => {
    expect(buildSpaceAgentRoutingScenarios()).toHaveLength(1000)
    expect(buildSpaceAgentWebResearchScenarios()).toHaveLength(1000)
    expect(buildSpaceAgentYouTubeScenarios()).toHaveLength(500)
    expect(buildSpaceAgentBrowserBlockedScenarios()).toHaveLength(500)
    expect(buildSpaceAgentHandoffScenarios()).toHaveLength(500)
    expect(buildSpaceAgentMiniAgentScenarios()).toHaveLength(500)
  })

  it('runs no-secret, no-fake-access, and no-unauthorized-execution gauntlets for phases 287-290', () => {
    const scenarios = buildFullSpaceAgentGauntletScenarios()
    const result = runFullSpaceAgentGauntlet(scenarios)

    expect(result.ok).toBe(true)
    expect(result.scenario_count).toBe(4000)
    expect(result.categories).toEqual({
      routing: 1000,
      web_research: 1000,
      youtube: 500,
      browser_blocked: 500,
      handoff: 500,
      mini_agent: 500,
    })
    expect(result.failed).toBe(0)
    expect(result.failures_by_kind).toEqual({
      secret_leak: 0,
      fake_access: 0,
      unauthorized_execution: 0,
      gateway_bypass: 0,
      commander_takeover: 0,
    })
    expect(result.no_secret_gauntlet_passed).toBe(true)
    expect(result.no_fake_access_gauntlet_passed).toBe(true)
    expect(result.no_unauthorized_execution_gauntlet_passed).toBe(true)
    expect(result.execution_enabled).toBe(false)
    expect(result.writes_enabled).toBe(false)
    expect(result.external_writes_enabled).toBe(false)
  })
})
