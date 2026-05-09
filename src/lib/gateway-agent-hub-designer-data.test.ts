import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const agentDataSource = readFileSync(
  join(process.cwd(), 'public/designer-mission-control/design/gateway/shared/agent-data.js'),
  'utf8',
)

const agentHubHtml = readFileSync(
  join(process.cwd(), 'public/designer-mission-control/design/gateway/Agent Hub.html'),
  'utf8',
)

function runAgentData(payload: unknown = null) {
  class FakeXMLHttpRequest {
    status = 0
    responseText = ''

    open() {
      return undefined
    }

    setRequestHeader() {
      return undefined
    }

    send() {
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
    window: {} as { AGENTS?: any },
    XMLHttpRequest: FakeXMLHttpRequest,
    getComputedStyle: () => ({ getPropertyValue: () => '#6b7280' }),
  }
  vm.runInNewContext(agentDataSource, context)
  return context.window.AGENTS
}

describe('Gateway Agent Hub designer data hydration', () => {
  it('keeps the mounted designer Agent Hub aligned to the six-agent production roster', () => {
    const agents = runAgentData()

    expect(agents.agents.map((agent: any) => agent.id)).toEqual([
      'paperclip',
      'agent-zero',
      'hermes',
      'space-agent',
      'pi-mono',
      'openclaw-plus',
    ])
    expect(agents.byId('openclaw-plus')).toMatchObject({
      name: 'OpenClaw+',
      status: 'red',
      blocked_reason: 'openclaw_doctor_runtime_not_reachable',
    })
    expect(agents.cost['openclaw-plus']).toMatchObject({ today_usd: 0, day_cap_usd: 5 })
  })

  it('hydrates the OpenClaw+ card instead of silently dropping live Agent Hub status', () => {
    const agents = runAgentData({
      ok: true,
      agents: [
        {
          id: 'openclaw-plus',
          role: 'Runtime / Skills / Mini-Agent Execution Layer',
          status: 'blocked',
          production_truth: 'SERVICE_DOWN until the OpenClaw+ CLI is reachable from Mission Control.',
          read_enabled: true,
          write_enabled: false,
          execution_enabled: false,
          requires_bridge_session: true,
          blocked_reason: 'openclaw_doctor_runtime_not_reachable',
          blockers: ['openclaw_doctor_runtime_not_reachable'],
          capabilities: ['OpenClaw+ shared skills', 'mini-agent execution'],
          interface: {
            auth_required: true,
            local_ui_proven: false,
            tailnet_ui_proven: false,
            mission_control_surface: '/gateway/agent-hub',
          },
          routes: {
            audit: '/api/gateway/agent-hub/agents/openclaw-plus/audit',
            health: '/api/gateway/agent-hub/agents/openclaw-plus/health',
          },
        },
      ],
    })

    expect(agents.byId('openclaw-plus')).toMatchObject({
      role: 'Runtime / Skills / Mini-Agent Execution Layer',
      status: 'red',
      R: true,
      W: false,
      X: false,
      bridge: true,
      blocked_reason: 'openclaw_doctor_runtime_not_reachable',
      audit_route: '/api/gateway/agent-hub/agents/openclaw-plus/audit',
    })
    expect(agents.byId('openclaw-plus').caps).toContain('OpenClaw+ shared skills')
  })

  it('keeps Agent Hub controls from rendering as fake unclassified buttons', () => {
    expect(agentHubHtml).toContain('data-action="open-route"')
    expect(agentHubHtml).toContain('Protected command dispatch requires a scoped Bridge Session')
    expect(agentHubHtml).toContain('Localhost or Tailnet UI is not proven')
    expect(agentHubHtml).toContain('OpenClaw+ <span class="role">Runtime / skills</span>')
    expect(agentHubHtml).not.toContain('Design only — no production calls')
  })
})
