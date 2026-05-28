import { describe, expect, it } from 'vitest'

import { buildNuclearGatewayToolMigrationStatus } from '@/lib/nuclear-gateway-tool-migration'

describe('Nuclear Gateway tool migration map', () => {
  it('classifies OpenClaw dependencies without making OpenClaw broker, commander, or conversation owner', () => {
    const status = buildNuclearGatewayToolMigrationStatus()

    expect(status).toMatchObject({
      ok: true,
      route: 'bridge.nuclear-gateway.tool-migration',
      phase: 'phase_6_mcp_tool_migration',
      openclaw_command_authority_removed: true,
      openclaw_default_gateway_allowed: false,
      openclaw_credential_broker_allowed: false,
      openclaw_hidden_intermediary_allowed: false,
      openclaw_tool_broker_of_record: false,
      gateway_tool_broker_of_record: true,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      external_writes_enabled: false,
    })
    expect(status.entries_count).toBeGreaterThanOrEqual(9)
    expect(status.classification_counts.READ_ONLY).toBeGreaterThan(0)
    expect(status.classification_counts.WRITE_GATED).toBeGreaterThan(0)
    expect(status.classification_counts.CREDENTIAL_REQUIRED).toBeGreaterThan(0)
    expect(status.classification_counts.PERMISSION_REQUIRED).toBeGreaterThan(0)
    expect(status.classification_counts.UNSAFE_DISABLED).toBeGreaterThan(0)
    expect(status.entries.every((entry) => entry.credential_values_exposed === false)).toBe(true)
    expect(status.entries.every((entry) => entry.secret_values_inspected === false)).toBe(true)
    expect(status.entries.every((entry) => entry.openclaw_as_broker_allowed === false)).toBe(true)
    expect(status.entries.every((entry) => entry.openclaw_as_conversation_owner_allowed === false)).toBe(true)
  })

  it('keeps unsafe repair, backup, and send lanes blocked until exact Gateway adapters exist', () => {
    const status = buildNuclearGatewayToolMigrationStatus()
    const byId = Object.fromEntries(status.entries.map((entry) => [entry.id, entry]))

    expect(byId['openclaw.gateway.update_doctor']).toMatchObject({
      classification: 'UNSAFE_DISABLED',
      writes_enabled: false,
      execution_enabled: false,
      blocker: 'owner_directive_do_not_repair_openclaw',
      openclaw_allowed_role: 'not_allowed',
    })
    expect(byId['openclaw.backup.create']).toMatchObject({
      classification: 'PERMISSION_REQUIRED',
      bridge_session_required: true,
      jarvis_concurrence_required: true,
      writes_enabled: false,
      execution_enabled: false,
    })
    expect(byId['openclaw.sessions.send']).toMatchObject({
      classification: 'WRITE_GATED',
      migration_target: 'POST /api/bridge/agent-routing/send with canonical message envelope',
      openclaw_allowed_role: 'not_allowed',
      writes_enabled: false,
      execution_enabled: false,
    })
  })
})
