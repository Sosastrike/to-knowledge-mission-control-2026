import { describe, expect, it } from 'vitest'

import { createGatewayRegistryFromAgentNetwork, getGatewayRoleMatrixEntry } from './gateway-model'
import {
  createSpaceAgentBoundaryDecision,
  type SpaceAgentForbiddenAction,
} from './space-agent-research'

const forbiddenActions: Array<{
  phase: number
  action: SpaceAgentForbiddenAction
  blocker: string
  externalWrite: boolean
}> = [
  {
    phase: 261,
    action: 'send_email',
    blocker: 'space_agent_email_send_forbidden_handoff_to_gateway_delivery_adapter_required',
    externalWrite: true,
  },
  {
    phase: 262,
    action: 'upload_drive',
    blocker: 'space_agent_drive_upload_forbidden_handoff_to_gateway_delivery_adapter_required',
    externalWrite: true,
  },
  {
    phase: 263,
    action: 'run_buildwiki',
    blocker: 'space_agent_buildwiki_execution_forbidden_agent_zero_bridge_session_required',
    externalWrite: false,
  },
  {
    phase: 264,
    action: 'zapier_write',
    blocker: 'space_agent_zapier_write_forbidden_bridge_session_scope_required',
    externalWrite: true,
  },
  {
    phase: 265,
    action: 'heygen_generate',
    blocker: 'space_agent_heygen_generation_forbidden_bridge_session_scope_required',
    externalWrite: true,
  },
  {
    phase: 266,
    action: 'mount_smb',
    blocker: 'space_agent_smb_mount_forbidden',
    externalWrite: false,
  },
  {
    phase: 267,
    action: 'read_secret',
    blocker: 'space_agent_direct_secret_read_forbidden',
    externalWrite: false,
  },
  {
    phase: 268,
    action: 'use_docker_socket',
    blocker: 'space_agent_docker_socket_forbidden',
    externalWrite: false,
  },
  {
    phase: 269,
    action: 'become_commander',
    blocker: 'space_agent_cannot_become_commander_agent_zero_remains_commander',
    externalWrite: false,
  },
  {
    phase: 270,
    action: 'bypass_gateway',
    blocker: 'space_agent_gateway_bypass_forbidden',
    externalWrite: false,
  },
]

describe('Space Agent forbidden action boundaries', () => {
  it('blocks all protected non-research actions for phases 261-270', () => {
    for (const item of forbiddenActions) {
      const decision = createSpaceAgentBoundaryDecision(item.action)

      expect(decision).toMatchObject({
        schema: 'space_agent_boundary_decision_v1',
        agent: 'space_agent',
        action: item.action,
        allowed: false,
        route_decision: 'blocked',
        blocked_reason: item.blocker,
        requires_gateway: true,
        execution_enabled: false,
        writes_enabled: false,
        external_write: item.externalWrite,
        direct_secret_access_allowed: false,
        docker_socket_allowed: false,
        raw_root_shell_allowed: false,
        commander_authority_allowed: false,
        gateway_bypass_allowed: false,
        no_fake_done: true,
        no_secrets_exposed: true,
        no_raw_paths: true,
      })
      expect(decision.owner_visible_summary).toContain(item.blocker)
      expect(decision.owner_visible_summary).not.toMatch(/\bDone\b/i)
      expect(JSON.stringify(decision)).not.toMatch(/API_KEY|Bearer\s+|auth\.json|\/home\//i)
    }
  })

  it('requires Gateway handoff for external delivery and protected execution attempts', () => {
    for (const item of forbiddenActions.filter((entry) => !['become_commander', 'bypass_gateway'].includes(entry.action))) {
      const decision = createSpaceAgentBoundaryDecision(item.action)

      expect(decision.handoff_required).toBe(true)
      expect(decision.handoff_target).toBe('gateway')
      expect(decision.requires_bridge_session).toBe(true)
    }
  })

  it('keeps Space Agent subordinate in the Gateway registry and role matrix', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-06T00:00:00.000Z' })
    const spaceAgent = registry.nodes.find((node) => node.id === 'space_agent')
    const spaceCapability = registry.capabilities.find((capability) => capability.id === 'space_agent_research_packet')
    const agentZero = getGatewayRoleMatrixEntry('agent_zero')
    const role = getGatewayRoleMatrixEntry('space_agent')

    expect(spaceAgent).toMatchObject({
      id: 'space_agent',
      kind: 'specialist_agent',
      parent: 'gateway',
      execution_state: 'read_only_by_default',
      external_writes: 'disabled',
    })
    expect(spaceAgent?.supervisors).toEqual(expect.arrayContaining(['agent_zero', 'hermes', 'pi']))
    expect(spaceCapability?.status_details).toMatchObject({
      subordinate_to_gateway: true,
      agent_zero_commander: true,
      space_agent_is_commander: false,
      commander_replacement: false,
      execution_enabled: false,
    })
    expect(role).toMatchObject({
      id: 'space_agent',
      commander: false,
    })
    expect(role?.reports_to).toEqual(expect.arrayContaining(['agent_zero', 'gateway']))
    expect(agentZero?.supervises).toContain('space_agent')
  })
})
