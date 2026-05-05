import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGatewayCapability, createGatewayRegistryFromAgentNetwork } from './gateway-model'
import { evaluateGatewayPolicy } from './gateway-policy'
import {
  buildGatewayGovernanceManifest,
  buildGatewaySecurityProof,
  GATEWAY_GOVERNANCE_DOCUMENTS,
} from './gateway-security-proof'

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function makeGovernanceRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-governance-'))
  tempRoots.push(root)
  for (const document of GATEWAY_GOVERNANCE_DOCUMENTS) {
    fs.writeFileSync(path.join(root, document.filename), `${document.label}\n`)
  }
  return root
}

describe('Gateway security proof', () => {
  it('loads governance metadata without exposing governance paths or file contents', () => {
    const governanceRoot = makeGovernanceRoot()
    const manifest = buildGatewayGovernanceManifest({ governanceRoot })

    expect(manifest.required_documents_loaded).toBe(true)
    expect(manifest.loaded_count).toBe(GATEWAY_GOVERNANCE_DOCUMENTS.length)
    expect(manifest.documents.map((document) => document.id)).toEqual([
      'universal_laws',
      'honesty_protocol',
      'channels_policy',
      'preflight',
      'redaction_spec',
    ])
    expect(JSON.stringify(manifest)).not.toContain(governanceRoot)
    expect(JSON.stringify(manifest)).not.toContain('/home/tony')
  })

  it('records Gateway security proof for redaction, auth, Bridge Session, and forbidden surfaces', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-04T00:00:00.000Z' })
    const proof = buildGatewaySecurityProof(registry, {
      governanceRoot: makeGovernanceRoot(),
      generatedAt: '2026-05-04T00:00:00.000Z',
    })

    expect(proof.ok).toBe(true)
    expect(proof.governance.required_documents_loaded).toBe(true)
    expect(proof.policies).toMatchObject({
      auth_required: true,
      tailscale_or_mission_control_auth_required: true,
      redaction_required: true,
      no_secret_output: true,
      no_raw_path_output: true,
      agentmail_domain_restricted: true,
      bridge_session_required_for_writes: true,
      external_writes_blocked_without_session: true,
      protected_scopes_enforced: true,
      public_hermes_ui_exposed: false,
      raw_shell_enabled: false,
      root_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
    })
    expect(proof.checks.every((check) => check.passed)).toBe(true)
    expect(JSON.stringify(proof)).not.toMatch(/sk-[A-Za-z0-9]|AUTH_FILE|auth\.json|\/home\/tony|\/a0\//)
  })

  it('keeps AgentMail allowlisted and blocks writes/external providers unless scoped', () => {
    const outsideDomain = evaluateGatewayPolicy({
      classification: 'protected_action',
      ownerRequest: 'Send email to person@example.net',
      routeTarget: 'agentmail',
      bridgeSessionActive: true,
      allowedScopes: ['agentmail.send'],
      allowedEmailDomains: ['knowledge-vs-ai.com'],
    })
    const noSession = evaluateGatewayPolicy({
      classification: 'upload',
      ownerRequest: 'Upload a report to Google Drive',
      routeTarget: 'google_drive',
      capabilityId: 'integration_google_drive',
      bridgeSessionActive: false,
    })
    const unscopedHeyGen = evaluateGatewayPolicy({
      classification: 'tool',
      ownerRequest: 'Generate a HeyGen video',
      routeTarget: 'heygen',
      capabilityId: 'integration_heygen',
      bridgeSessionActive: true,
      allowedScopes: [],
    })
    const unscopedZapier = evaluateGatewayPolicy({
      classification: 'tool',
      ownerRequest: 'Create a Zapier task',
      routeTarget: 'zapier',
      capabilityId: 'integration_zapier',
      bridgeSessionActive: true,
      allowedScopes: [],
    })

    expect(outsideDomain.blocked_reason).toBe('agentmail_domain_not_allowed')
    expect(noSession.blocked_reason).toBe('active_bridge_session_required_for_external_write')
    expect(unscopedHeyGen.blocked_reason).toBe('bridge_session_scope_missing:heygen.generate')
    expect(unscopedZapier.blocked_reason).toBe('bridge_session_scope_missing:zapier.write')
  })

  it('detects unsafe Hermes public UI, Docker socket, root shell, and direct secret-read exposure without returning the raw values', () => {
    const registry = createGatewayRegistryFromAgentNetwork({ generatedAt: '2026-05-04T00:00:00.000Z' })
    registry.capabilities.push(createGatewayCapability({
      id: 'hermes_public_ui_probe',
      label: 'Hermes public UI probe',
      kind: 'api',
      status: 'blocked',
      source_node: 'hermes',
      status_details: {
        url: 'https://hermes.example.com',
        docker_socket_enabled: true,
        root_shell_enabled: true,
        direct_secret_reads_enabled: true,
      },
    }))
    const proof = buildGatewaySecurityProof(registry, { governanceRoot: makeGovernanceRoot() })

    expect(proof.ok).toBe(false)
    expect(proof.checks.find((check) => check.id === 'no_public_hermes_ui')).toMatchObject({ passed: false })
    expect(proof.checks.find((check) => check.id === 'no_docker_socket')).toMatchObject({ passed: false })
    expect(proof.checks.find((check) => check.id === 'no_root_shell')).toMatchObject({ passed: false })
    expect(proof.checks.find((check) => check.id === 'no_direct_secret_reads')).toMatchObject({ passed: false })
    expect(JSON.stringify(proof)).not.toContain('https://hermes.example.com')
    expect(JSON.stringify(proof)).not.toContain('/var/run/docker.sock')
  })
})
