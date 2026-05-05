import { describe, expect, it, vi } from 'vitest'
import {
  auditGatewayPolicyDecision,
  evaluateGatewayPolicy,
  gatewayPolicyBadges,
  redactGatewayOwnerOutput,
} from './gateway-policy'

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('Gateway policy enforcement', () => {
  it('keeps discovery and status routes read-only without requiring a Bridge Session', () => {
    const decision = evaluateGatewayPolicy({
      classification: 'chat',
      ownerRequest: 'What is Gateway status?',
      routeTarget: 'agent_zero',
      requiresBridgeSession: false,
    })

    expect(decision.allowed).toBe(true)
    expect(decision.status).toBe('read_only')
    expect(decision.bridge_session_required).toBe(false)
    expect(gatewayPolicyBadges(decision)).toContain('read_only')
  })

  it('requires active Bridge Session for external writes', () => {
    const decision = evaluateGatewayPolicy({
      classification: 'upload',
      ownerRequest: 'Upload the report to Google Drive',
      routeTarget: 'integrations',
      capabilityId: 'integration_google_drive',
      requiresBridgeSession: true,
      bridgeSessionActive: false,
    })

    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe('blocked')
    expect(decision.external_write_requested).toBe(true)
    expect(decision.blocked_reason).toBe('active_bridge_session_required_for_external_write')
    expect(gatewayPolicyBadges(decision)).toEqual(expect.arrayContaining(['session_required', 'blocked']))
  })

  it('requires an active Bridge Session for side-effectful skill execution', () => {
    const decision = evaluateGatewayPolicy({
      classification: 'skill',
      ownerRequest: 'Execute the Reporting skill',
      routeTarget: 'openclaw_plus',
      capabilityId: 'skill_reporting',
      requiresBridgeSession: true,
      bridgeSessionActive: false,
    })

    expect(decision.allowed).toBe(false)
    expect(decision.required_scope).toBe('skill.execute')
    expect(decision.blocked_reason).toBe('active_bridge_session_required_for_write')
  })

  it('requires scoped policy for Build-Wiki, Zapier writes, HeyGen, Drive, and OneDrive actions', () => {
    const buildwiki = evaluateGatewayPolicy({
      classification: 'sync',
      ownerRequest: 'Run Build-Wiki now',
      routeTarget: 'buildwiki',
      bridgeSessionActive: true,
      allowedScopes: [],
    })
    const zapier = evaluateGatewayPolicy({
      classification: 'tool',
      ownerRequest: 'Create a Zapier task',
      routeTarget: 'integrations',
      capabilityId: 'integration_zapier',
      bridgeSessionActive: true,
      allowedScopes: ['zapier.write'],
    })
    const heygen = evaluateGatewayPolicy({
      classification: 'tool',
      ownerRequest: 'Generate a HeyGen video',
      routeTarget: 'integrations',
      capabilityId: 'integration_heygen',
      bridgeSessionActive: true,
      allowedScopes: ['heygen.generate'],
    })
    const drive = evaluateGatewayPolicy({
      classification: 'upload',
      ownerRequest: 'Upload to Google Drive',
      routeTarget: 'integrations',
      capabilityId: 'integration_google_drive',
      bridgeSessionActive: true,
      allowedScopes: ['google_drive.upload'],
    })
    const onedrive = evaluateGatewayPolicy({
      classification: 'upload',
      ownerRequest: 'Upload to OneDrive',
      routeTarget: 'integrations',
      capabilityId: 'integration_onedrive',
      bridgeSessionActive: true,
      allowedScopes: ['onedrive.upload'],
    })

    expect(buildwiki.blocked_reason).toBe('bridge_session_scope_missing:buildwiki.run_now')
    expect(zapier.status).toBe('active')
    expect(heygen.status).toBe('active')
    expect(drive.status).toBe('active')
    expect(onedrive.status).toBe('active')
  })

  it('restricts AgentMail send/reply to approved domains or email addresses', () => {
    const outside = evaluateGatewayPolicy({
      classification: 'protected_action',
      ownerRequest: 'Send email to person@example.net',
      routeTarget: 'integrations',
      bridgeSessionActive: true,
      allowedScopes: ['agentmail.send'],
      allowedEmailDomains: ['knowledge-vs-ai.com'],
    })
    const inside = evaluateGatewayPolicy({
      classification: 'protected_action',
      ownerRequest: 'Send email to owner@knowledge-vs-ai.com',
      routeTarget: 'integrations',
      bridgeSessionActive: true,
      allowedScopes: ['agentmail.send'],
      allowedEmailDomains: ['knowledge-vs-ai.com'],
    })

    expect(outside.allowed).toBe(false)
    expect(outside.blocked_reason).toBe('agentmail_domain_not_allowed')
    expect(inside.allowed).toBe(true)
    expect(inside.status).toBe('active')
  })

  it('redacts keys, auth references, raw paths, task ids, and internal stage names', () => {
    const sampleCredential = ['sk', '12345678901234567890'].join('-')
    const output = redactGatewayOwnerOutput(
      `Credential ${sampleCredential} at /home/tony/private task_abcd1234 Failed stage`,
    )

    expect(output).not.toContain('sk-')
    expect(output).not.toContain('/home/tony')
    expect(output).not.toContain('task_abcd1234')
    expect(output).not.toContain('Failed stage')
  })

  it('audits blocked and active policy decisions', () => {
    const events: unknown[] = []
    const blocked = evaluateGatewayPolicy({
      classification: 'protected_action',
      ownerRequest: 'Restart Mission Control',
      routeTarget: 'agent_zero',
      bridgeSessionActive: false,
    })
    const active = evaluateGatewayPolicy({
      classification: 'upload',
      ownerRequest: 'Upload to OneDrive',
      routeTarget: 'integrations',
      capabilityId: 'integration_onedrive',
      bridgeSessionActive: true,
      allowedScopes: ['onedrive.upload'],
    })
    const readOnly = evaluateGatewayPolicy({
      classification: 'chat',
      ownerRequest: 'Who is commander?',
      routeTarget: 'agent_zero',
    })

    expect(auditGatewayPolicyDecision(blocked, 'agent_zero', (event) => events.push(event))).toMatchObject({
      action: 'gateway.policy.decision',
      allowed: false,
    })
    expect(auditGatewayPolicyDecision(active, 'integrations', (event) => events.push(event))).toMatchObject({
      action: 'gateway.policy.decision',
      allowed: true,
      badge: 'active',
    })
    expect(auditGatewayPolicyDecision(readOnly, 'agent_zero', (event) => events.push(event))).toBeNull()
    expect(events).toHaveLength(2)
  })
})
