import { describe, expect, it } from 'vitest'
import { getAgentZeroTelegramDeliveryStatus, uploadAgentZeroReportToTelegram } from './agent-zero-telegram-delivery'

describe('Agent Zero Telegram delivery adapter', () => {
  it('reports blocked status when connector credentials are missing', () => {
    const status = getAgentZeroTelegramDeliveryStatus()
    expect(status.provider).toBe('telegram')
    expect(status.bridge_session_required).toBe(true)
    if (!status.connector_configured) {
      expect(status.blocked_reason).toBe('telegram_report_delivery_adapter_not_configured')
      expect(status.no_tokens_exposed).toBe(true)
    }
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
