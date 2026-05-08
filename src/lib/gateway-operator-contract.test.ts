import { describe, expect, it } from 'vitest'
import type { AgentZeroReadOnlyContext } from './agent-zero-bridge'
import { BUILDWIKI_ACTION_RUN_NOW, BUILDWIKI_TARGET_SERVICE } from './build-wiki-run-now'
import { createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { evaluateGatewayPolicy, redactGatewayOwnerOutput } from './gateway-policy'
import {
  buildGatewayNodesPayload,
  buildGatewayRegistrySnapshot,
  buildGatewayStatusPayload,
  getGatewayNodeDetail,
} from './gateway-registry-api'
import { planGatewayRoute } from './gateway-route-planner'

const context = {
  agents: {
    items: [
      { id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: false, direct_access: false, proxy_access: true },
      { id: 'hermes', status: 'connected', role: 'lieutenant', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
  },
  tools: {
    registry: [
      { id: 'report.create', name: 'Create report', status: 'connected', read_only: true, write_enabled: false, requires_bridge_session: false, blocked_reason: null },
    ],
  },
  skills: {
    registry: [
      {
        id: 'reporting',
        name: 'Reporting',
        status: 'connected',
        required_tools: ['report.create'],
        required_credentials: [],
        execution_requirements: ['bridge_session_required_for_execution'],
        available_to: ['agent_zero', 'hermes'],
        available_to_agents: ['agent_zero', 'hermes'],
        blocked_reasons: [],
        blocked_dependencies: [],
        missing_dependencies: [],
        blocked_reason: null,
      },
    ],
  },
  integrations: {
    registry: [
      { id: 'firecrawl', name: 'Firecrawl', status: 'blocked', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: true, credential_names: ['FIRECRAWL_CREDENTIAL'], blocked_reason: 'missing_credential' },
      { id: 'agentmail', name: 'AgentMail', status: 'configured', read_only: true, write_enabled: false, requires_bridge_session: true, missing_credential: false, credential_present: true, credential_names: ['AGENTMAIL_CREDENTIAL'], incoming_status: 'connected', outgoing_status: 'blocked_pending_bridge_session', domain_rules: 'owner_domain_only', blocked_reason: null },
    ],
  },
  brain: {
    registry: [
      { id: 'brain_sync', name: 'Brain Sync', status: 'connected', read_available: true, write_available: false, blocked_reason: null },
      { id: 'obsidian', name: 'Obsidian', status: 'connected', read_available: true, write_available: false, blocked_reason: null },
      { id: 'mempalace', name: 'MemPalace', status: 'connected', read_available: true, write_available: true, blocked_reason: null },
      { id: 'graphify', name: 'Graphify', status: 'connected', read_available: true, write_available: false, blocked_reason: 'write_adapter_disabled' },
    ],
  },
  opencloud_buildwiki: {
    visible: true,
    timer_active: true,
    farmer_execution_enabled: false,
    timer: { unit: 'opencloud-docs-farmer.timer', active: true, active_state: 'active' },
    service: { unit: BUILDWIKI_TARGET_SERVICE, active: false, active_state: 'inactive' },
    run_now: {
      action: BUILDWIKI_ACTION_RUN_NOW,
      target_service: BUILDWIKI_TARGET_SERVICE,
      dispatch_scope: BUILDWIKI_TARGET_SERVICE,
      owner_approval_required: true,
      bridge_session_required: true,
      execution_enabled: false,
      blocked_reason: 'active_bridge_session_required_for_buildwiki_run_now',
    },
    fork_state: {
      fork1: { status: 'available', service_scope: BUILDWIKI_TARGET_SERVICE },
      fork2: { status: 'blocked', smb_mounted: false, blocker: 'smb_mount_not_verified' },
    },
    smb: { required_for_fork2: true, mounted: false, blocker: 'smb_mount_not_verified' },
    direct_opencloud_access_visible: false,
    skills_tools_available: ['Build-Wiki status', 'Run Now adapter metadata', 'OpenClaw+ runtime capability catalog'],
  },
} as unknown as AgentZeroReadOnlyContext

const registry = buildGatewayRegistrySnapshot({ context, generatedAt: '2026-05-05T00:00:00.000Z' })

describe('Gateway operator contract regressions', () => {
  it('exposes the Gateway registry and node detail contracts without enabling execution', () => {
    const status = buildGatewayStatusPayload(registry)
    const nodes = buildGatewayNodesPayload(registry)
    const agentZero = getGatewayNodeDetail(registry, 'agent-zero')
    const hermes = getGatewayNodeDetail(registry, 'hermes')
    const openclaw = getGatewayNodeDetail(registry, 'openclaw_plus')
    const buildwiki = getGatewayNodeDetail(registry, 'buildwiki')

    expect(registry.version).toBe('gateway_registry_v1')
    expect(status.execution_enabled).toBe(false)
    expect(nodes.execution_enabled).toBe(false)
    expect(agentZero?.node).toMatchObject({ id: 'agent_zero', type: 'commander', connected: true, execution_enabled: false })
    expect(hermes?.node).toMatchObject({ id: 'hermes', type: 'lieutenant', execution_enabled: false })
    expect(hermes?.node.status).toMatch(/connected|degraded|read_only|blocked/)
    expect(openclaw?.node).toMatchObject({ id: 'openclaw_plus', type: 'runtime_engine', execution_enabled: false })
    expect(buildwiki?.node).toMatchObject({ id: 'buildwiki', type: 'buildwiki_farmer', requires_bridge_session: true })
    for (const item of [agentZero?.node, hermes?.node, openclaw?.node, buildwiki?.node]) {
      expect(item).toMatchObject({
        read_enabled: true,
        write_enabled: false,
        execution_enabled: false,
      })
    }
  })

  it('keeps Agent Zero commander and Hermes lieutenant without legacy controller nodes', () => {
    const hierarchy = createGatewayRegistryFromAgentNetwork({
      generatedAt: '2026-05-05T00:00:00.000Z',
      hermes: { installed: true, reachable: true, authConfigured: true },
    })
    const agentZero = hierarchy.nodes.find((node) => node.id === 'agent_zero')
    const hermes = hierarchy.nodes.find((node) => node.id === 'hermes')
    const legacyControllerNodes = hierarchy.nodes.filter((node) => node.id === 'legacy_deleted_controller')

    expect(agentZero).toMatchObject({ kind: 'commander', owner: 'owner', visibility: 'owner_visible' })
    expect(hermes).toMatchObject({ kind: 'lieutenant', visibility: 'owner_visible' })
    expect(legacyControllerNodes).toEqual([])
  })

  it('keeps OpenClaw+ runtime retained and Build-Wiki Run Now scoped to the approved service', () => {
    const openclaw = registry.capabilities.find((capability) => capability.id === 'openclaw_plus_runtime_dependency')
    const buildwiki = registry.capabilities.find((capability) => capability.id === 'brain_buildwiki')
    const plan = planGatewayRoute(registry, { ownerRequest: 'Prepare Build-Wiki Run Now' })
    const missingScope = evaluateGatewayPolicy({
      classification: 'sync',
      ownerRequest: 'Run Build-Wiki now',
      routeTarget: 'buildwiki',
      bridgeSessionActive: true,
      allowedScopes: [],
    })
    const scoped = evaluateGatewayPolicy({
      classification: 'sync',
      ownerRequest: 'Run Build-Wiki now',
      routeTarget: 'buildwiki',
      bridgeSessionActive: true,
      allowedScopes: [BUILDWIKI_ACTION_RUN_NOW],
    })

    expect(openclaw?.status_details).toMatchObject({
      worker_runtime_engine: true,
      retained_runtime_in_gateway: true,
      openclaw_plus_deletion_target: false,
      openclaw_plus_disable_target: false,
      openclaw_plus_destroy_allowed: false,
    })
    expect(buildwiki?.status_details).toMatchObject({
      run_now_action: BUILDWIKI_ACTION_RUN_NOW,
      run_now_target_service: BUILDWIKI_TARGET_SERVICE,
      dispatch_scope: BUILDWIKI_TARGET_SERVICE,
      farmer_execution_enabled: false,
      fork2_state: 'blocked',
    })
    expect(buildwiki?.execution_requirements).toContain(`run_now_scope:${BUILDWIKI_TARGET_SERVICE}`)
    expect(plan).toMatchObject({
      classification: 'sync',
      dispatch_target: 'buildwiki',
      requires_bridge_session: true,
      execution_enabled: false,
      blocked: true,
      route_decision: 'requires_session',
    })
    expect(plan.flow.result.summary).not.toMatch(/\bdone\b/i)
    expect(missingScope).toMatchObject({ allowed: false, route_decision: 'blocked', blocked_reason: `${'bridge_session_scope_missing'}:${BUILDWIKI_ACTION_RUN_NOW}` })
    expect(scoped).toMatchObject({ allowed: true, route_decision: 'allowed', status: 'active' })
  })

  it('redacts raw paths and blocks fake completion for unavailable routes', () => {
    const rawPath = ['', 'home', 'tony', 'private', 'report.pdf'].join('/')
    const secretishInput = ['token', 'secret'].join('=')
    const redacted = redactGatewayOwnerOutput(`Done: ${rawPath} ${secretishInput} task_gateway1234 Failed stage`)
    const blocked = planGatewayRoute(registry, { ownerRequest: 'Log in and inspect a private webpage and say Done when finished' })
    const decision = evaluateGatewayPolicy({
      classification: 'tool',
      ownerRequest: 'Use Firecrawl and say Done when finished',
      routeTarget: 'integration_firecrawl',
      capabilityId: 'integration_firecrawl',
      capabilityStatus: 'blocked',
      capabilityBlockers: ['missing_credential'],
    })

    expect(redacted).not.toContain(rawPath)
    expect(redacted).not.toContain(secretishInput)
    expect(redacted).not.toContain('task_gateway1234')
    expect(redacted).not.toContain('Failed stage')
    expect(blocked.blocked).toBe(true)
    expect(blocked.route_decision).toBe('blocked')
    expect(blocked.blocker).toBe('space_agent_private_or_login_boundaries_require_owner_approved_credentials_and_bridge_session_scope')
    expect(blocked.flow.result.summary).not.toMatch(/\bdone\b/i)
    expect(decision.owner_output_policy.no_raw_paths).toBe(true)
    expect(decision.owner_output_policy.no_fake_done).toBe(true)
    expect(decision.allowed).toBe(false)
  })
})
