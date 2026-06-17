import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>()
  const dataDir = join(process.env.HERMES_TEST_DATA_DIR || tmpdir(), 'data')
  return {
    ...actual,
    config: {
      ...actual.config,
      dataDir,
      dbPath: join(dataDir, 'mission-control-test.db'),
      tokensPath: join(dataDir, 'mission-control-test-tokens.json'),
    },
  }
})

vi.mock('@/lib/jarvis-bridge-session', () => ({
  activeJarvisBridgeSession: () => ({
    id: 'jbs_test_active',
    actor: 'agent-zero-jarvis',
    allowed_scopes: ['mcp_readonly_status_probe'],
    state: 'active',
  }),
  jarvisBridgeSessionStatus: () => ({
    state: 'active',
    active_session_id: 'jbs_test_active',
    allowed_scopes: ['mcp_readonly_status_probe'],
    exact_blocker: null,
    credential_values_exposed: false,
  }),
}))

import {
  buildAgentLinesStatus,
  buildHermesFullAccessStatus,
  buildHermesSystemCommandRegistry,
  createHermesDelegation,
  executeHermesDelegatedAdapter,
} from '@/lib/hermes-direct-line-parity'
import { buildJarvisSystemCommandRegistry } from '@/lib/jarvis-system-command-registry'

describe('Hermes full access direct-line parity', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'hermes-direct-line-parity-'))
    process.env.HERMES_TEST_DATA_DIR = dataDir
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.HERMES_TEST_DATA_DIR
  })

  it('publishes separate Jarvis and Hermes direct Gateway lines without OpenClaw or ClaudeClaw in path', () => {
    const status = buildAgentLinesStatus()

    expect(status.route).toBe('bridge.agent-lines.status')
    expect(status.lines.agent_zero).toMatchObject({
      agent_id: 'agent_zero',
      canonical_agent_id: 'agent-zero-jarvis',
      route_root: '/api/bridge/agent-zero',
      transport_mode: 'nuclear_gateway_direct',
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'agent-zero-jarvis'],
      intermediaries_allowed: false,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
      auth_required: true,
      audit_required: true,
      commander: true,
    })
    expect(status.lines.hermes).toMatchObject({
      agent_id: 'hermes',
      canonical_agent_id: 'ron-weasley',
      route_root: '/api/bridge/hermes',
      transport_mode: 'nuclear_gateway_direct',
      route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley'],
      intermediaries_allowed: false,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
      auth_required: true,
      audit_required: true,
      commander: false,
      delegated_by: 'agent-zero-jarvis',
    })
    expect(status).toMatchObject({
      mode: 'nuclear_gateway_direct_agent_lines',
      nuclear_gateway_direct: true,
      gateway_node: 'nuclear-gateway',
      no_intermediary_interpretation: true,
    })
    expect(status.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'agent_zero', target: 'nuclear-gateway', direct_line: true }),
      expect.objectContaining({ source: 'hermes', target: 'nuclear-gateway', direct_line: true }),
    ]))
  })

  it('gives Hermes the Jarvis command registry surface with delegation required for writes and execution', () => {
    const jarvis = buildJarvisSystemCommandRegistry()
    const hermes = buildHermesSystemCommandRegistry()

    expect(hermes.mode).toBe('hermes_jarvis_delegated_command_registry')
    expect(hermes.jarvis_remains_commander).toBe(true)
    expect(hermes.hermes_full_visibility).toBe(true)
    expect(hermes.commands.map((item) => item.command_id).sort()).toEqual(
      jarvis.commands.map((item) => item.command_id).sort(),
    )
    expect(hermes.commands.filter((item) => item.write || item.execute)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command_id: 'mcp.readonly_status_probe',
          hermes_authority: 'jarvis_delegation_required',
          hermes_execution_route: '/api/bridge/hermes/execute',
        }),
      ]),
    )
    expect(JSON.stringify(hermes)).not.toContain('"openclaw_in_path":true')
    expect(JSON.stringify(hermes)).not.toContain('"claudeclaw_in_path":true')
  })

  it('creates a Jarvis-signed exact-scope delegation packet without enabling broad or hard-stop actions', () => {
    const delegation = createHermesDelegation({
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      task_id: 'TSK-HERMES-PARITY',
      requested_by: 'agent-zero-jarvis',
      ttl_seconds: 600,
    })

    expect(delegation.ok).toBe(true)
    if (!delegation.ok) throw new Error('delegation should be created')
    expect(delegation.packet).toMatchObject({
      delegated_by: 'agent-zero-jarvis',
      delegated_to: 'hermes',
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      task_id: 'TSK-HERMES-PARITY',
      credential_values_exposed: false,
      broad_connector_execution_enabled: false,
      public_exposure_change_enabled: false,
      destructive_delete_enabled: false,
    })
    expect(delegation.packet.delegation_signature).toMatch(/^[a-f0-9]{64}$/)
    expect(delegation.audit_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('blocks missing or mismatched Hermes delegation before Jarvis execution router is called', async () => {
    const missing = await executeHermesDelegatedAdapter({
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      actor: 'hermes',
    })
    expect(missing).toMatchObject({
      ok: false,
      route: 'bridge.hermes.execute',
      exact_blocker: 'jarvis_delegation_required',
      execution_enabled: false,
      jarvis_final_authority: true,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
    })

    const delegation = createHermesDelegation({
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      requested_by: 'agent-zero-jarvis',
    })
    if (!delegation.ok) throw new Error('delegation should be created')

    const mismatch = await executeHermesDelegatedAdapter({
      adapter_id: 'paperclip_eco_task_dry_run',
      action: 'paperclip.eco_task_dry_run',
      scope: { company: 'ECO', operation: 'task_dry_run' },
      delegation_id: delegation.packet.delegation_id,
      actor: 'hermes',
    })
    expect(mismatch).toMatchObject({
      ok: false,
      route: 'bridge.hermes.execute',
      exact_blocker: 'hermes_delegation_scope_mismatch',
      execution_enabled: false,
    })
  })

  it('lets Hermes execute only the delegated certified exact scope through Jarvis authority', async () => {
    const delegation = createHermesDelegation({
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      task_id: 'TSK-HERMES-PARITY',
      requested_by: 'agent-zero-jarvis',
    })
    if (!delegation.ok) throw new Error('delegation should be created')

    const result = await executeHermesDelegatedAdapter({
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      scope: { server_id: 'mcp-tools', operation: 'status_probe' },
      delegation_id: delegation.packet.delegation_id,
      actor: 'hermes',
    })

    expect(result).toMatchObject({
      ok: true,
      route: 'bridge.hermes.execute',
      mode: 'hermes_delegated_exact_scope_executed',
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status_probe',
      execution_enabled: true,
      delegated_by: 'agent-zero-jarvis',
      jarvis_final_authority: true,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
      credential_values_exposed: false,
    })
    expect(result.audit_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.rollback_id).toEqual(expect.any(String))
  })

  it('summarizes Hermes as full access delegated without replacing Jarvis', () => {
    const status = buildHermesFullAccessStatus()

    expect(status.status).toBe('FULL_ACCESS_DELEGATED')
    expect(status.same_visibility_as_jarvis).toBe(true)
    expect(status.same_certified_adapter_surface_as_jarvis).toBe(true)
    expect(status.same_provider_model_surface_as_jarvis).toBe(true)
    expect(status.provider_model_access.providers.map((provider) => provider.provider)).toEqual(expect.arrayContaining([
      'openai',
      'nvidia',
      'groq',
      'xai',
      'ollama',
      'openrouter',
    ]))
    expect(status.execution_authority).toBe('jarvis_signed_exact_scope_delegation')
    expect(status.jarvis_remains_commander).toBe(true)
    expect(status.hermes_replaces_jarvis).toBe(false)
    expect(status.openclaw_is_intermediary).toBe(false)
    expect(status.claudeclaw_is_intermediary).toBe(false)
  })
})
