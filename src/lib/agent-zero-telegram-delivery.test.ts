import { describe, expect, it } from 'vitest'
import { getAgentZeroTelegramDeliveryStatus, uploadAgentZeroReportToTelegram } from './agent-zero-telegram-delivery'

describe('Agent Zero Telegram delivery adapter', () => {
  it('reports blocked status when connector credentials are missing', () => {
    const status = getAgentZeroTelegramDeliveryStatus()
    expect(status.provider).toBe('telegram')
    expect(status.bridge_session_required).toBe(true)
    expect(status.active_commander).toBe('agent_zero')
    expect(status.owner_command_route).toBe('agent_zero')
    expect(status.tony_active).toBe(false)
    expect(status.inbound_owner_validation_model).toBe('owner_chat_id_match_required')
    expect(status.proof_packet).toMatchObject({
      lane: 'Telegram owner command lane',
      active_commander: 'agent_zero',
      owner_command_route: 'agent_zero',
      tony_active: false,
      bridge_session_required: true,
      send_enabled_without_bridge: false,
      inbound_owner_validation_required: true,
      fake_delivery_allowed: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    if (!status.connector_configured) {
      expect(status.canonical_status).toBe('CREDENTIAL_GATED')
      expect(status.blocker_class).toBe('CREDENTIAL_GATED')
      expect(status.blocked_reason).toBe('telegram_report_delivery_adapter_not_configured')
      expect(status.no_tokens_exposed).toBe(true)
    } else {
      expect(status.canonical_status).toBe('OWNER_GATED')
      expect(status.blocker_class).toBe('OWNER_GATED')
    }
    expect(JSON.stringify(status)).not.toMatch(/sk-[A-Za-z0-9]{20,}|bot[0-9]+:[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|\/Users\/sosastrike/i)
  })

  it('blocks upload when report id is missing or unknown without fake completion', async () => {
    const result = await uploadAgentZeroReportToTelegram({
      requester: { userId: 1, username: 'tester', workspaceId: 1, tenantId: 1 },
      reportId: 'azr_invalid_123456789abc',
      bridgeSessionId: null,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.accepted_for_execution).toBe(false)
    expect(result.blocked_reason).toBe('agent_zero_report_not_found')
    expect(result.no_fake_done).toBe(true)
    expect(result.no_tokens_exposed).toBe(true)
  })
})
