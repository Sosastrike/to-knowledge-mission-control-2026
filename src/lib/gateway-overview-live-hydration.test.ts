import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const gatewayDataSource = readFileSync(
  join(process.cwd(), 'public/designer-mission-control/design/gateway/shared/gateway-data.js'),
  'utf8',
)

function runGatewayData(payloads: Record<string, unknown> = {}) {
  const requested: string[] = []

  class FakeXMLHttpRequest {
    status = 0
    responseText = ''
    private path = ''

    open(_method: string, path: string) {
      this.path = path
      requested.push(path)
    }

    setRequestHeader() {
      return undefined
    }

    send() {
      const payload = payloads[this.path]
      if (!payload) {
        this.status = 404
        this.responseText = ''
        return
      }
      this.status = 200
      this.responseText = JSON.stringify(payload)
    }
  }

  const context = {
    window: {} as { GATEWAY?: any },
    XMLHttpRequest: FakeXMLHttpRequest,
  }
  vm.runInNewContext(gatewayDataSource, context)
  return { gateway: context.window.GATEWAY, requested }
}

describe('Gateway Overview designer data hydration', () => {
  it('keeps the designer data file usable without a live API', () => {
    const { gateway } = runGatewayData()

    expect(gateway.get('gateway.core')).toMatchObject({
      name: 'Gateway Core',
      status: 'green',
    })
    expect(gateway.get('int.firecrawl')).toMatchObject({
      name: 'Firecrawl',
      status: 'green',
    })
  })

  it('hydrates Gateway Overview statuses from read-only live Gateway APIs without changing design labels', () => {
    const { gateway, requested } = runGatewayData({
      '/api/gateway/nodes': {
        ok: true,
        nodes: [
          {
            id: 'gateway',
            status: 'connected',
            connected: true,
            configured: true,
            read_enabled: true,
            write_enabled: false,
            execution_enabled: false,
            requires_bridge_session: false,
            health: { summary: 'Gateway status source live.', last_seen: '2026-05-09T12:00:00.000Z' },
          },
          {
            id: 'hermes',
            status: 'degraded',
            connected: true,
            configured: true,
            read_enabled: true,
            write_enabled: false,
            execution_enabled: false,
            requires_bridge_session: true,
            blocked_reason: 'hermes_degraded_or_pending_live_proof',
            health: { summary: 'Hermes live proof pending.', last_seen: '2026-05-09T12:00:00.000Z' },
          },
          {
            id: 'obsidian',
            status: 'read_only',
            connected: true,
            configured: true,
            read_enabled: true,
            write_enabled: false,
            execution_enabled: false,
            requires_bridge_session: true,
            blocked_reason: 'obsidian_write_adapter_disabled',
          },
          {
            id: 'integration_firecrawl',
            status: 'blocked',
            connected: false,
            configured: false,
            read_enabled: false,
            write_enabled: false,
            execution_enabled: false,
            requires_bridge_session: false,
            blocked_reason: 'credential_required',
          },
          {
            id: 'model_openrouter',
            status: 'blocked',
            connected: false,
            configured: false,
            read_enabled: false,
            write_enabled: false,
            execution_enabled: false,
            requires_bridge_session: false,
            blocked_reason: 'openrouter_not_configured_or_not_visible_in_provider_registry',
          },
        ],
      },
      '/api/gateway/status': {
        ok: true,
        buildwiki_openclaw: {
          openclaw_status: 'connected',
          owner_approval_required: true,
          farmer_execution_enabled: false,
          run_now_target_service: 'opencloud-docs-farmer.service',
          last_run_status: null,
          service_active: true,
          timer_active: true,
          fork1_state: 'ready',
          fork2_blocker: 'smb_fork2_requires_verified_mount_and_owner_approval',
          blockers: [],
        },
      },
    })

    expect(requested).toEqual(['/api/gateway/nodes', '/api/gateway/status'])
    expect(gateway.get('gateway.core')).toMatchObject({
      name: 'Gateway Core',
      status: 'green',
      summary: 'Gateway status source live.',
    })
    expect(gateway.get('agent.hermes')).toMatchObject({
      name: 'Hermes',
      status: 'yellow',
      blocked_reason: 'hermes_degraded_or_pending_live_proof',
    })
    expect(gateway.get('brain.obsidian')).toMatchObject({
      name: 'Obsidian Vault',
      status: 'blue',
      R: 1,
      W: 0,
    })
    expect(gateway.get('int.firecrawl')).toMatchObject({
      name: 'Firecrawl',
      status: 'red',
      blocked_reason: 'credential_required',
    })
    expect(gateway.get('model.openrouter')).toMatchObject({
      name: 'OpenRouter',
      status: 'red',
      blocked_reason: 'openrouter_not_configured_or_not_visible_in_provider_registry',
    })
    expect(gateway.get('brain.buildwiki')).toMatchObject({
      status: 'yellow',
      X: 0,
      bridge: 1,
      summary: 'Documentation knowledge base. Run Now scoped to opencloud-docs-farmer.service only.',
      blocked_reason: 'Owner approval required for buildwiki.run_now.',
    })
    expect(gateway.OPENCLOUD_CHILDREN.find((child: any) => child.id === 'oc.fork2')).toMatchObject({
      status: 'red',
      blocked_reason: 'smb_fork2_requires_verified_mount_and_owner_approval',
    })
  })
})
