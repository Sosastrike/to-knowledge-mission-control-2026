import { describe, expect, it } from 'vitest'
import { buildPaperclipGatewayVisualNode } from './AgentNetworkClient'

const baseNode = {
  id: 'paperclip',
  label: 'Paperclip Workforce Control Plane',
  lane: 'core',
  eyebrow: 'workforce',
  status: 'missing',
  statusLabel: 'not configured',
  capabilities: ['company/task orchestration'],
  blockers: ['workforce mutations require Bridge Session'],
  lastTest: '/api/bridge/paperclip/status',
} as any

describe('buildPaperclipGatewayVisualNode', () => {
  it('shows blocked workforce status, read-only links, and a disabled launch button when Paperclip is offline', () => {
    const node = buildPaperclipGatewayVisualNode(baseNode, {
      reachable: false,
      configured: false,
      ui_link: 'http://127.0.0.1:3100',
      blocker: 'paperclip_ui_not_running',
      status_endpoint: '/api/bridge/paperclip/status',
      issues_endpoint: '/api/bridge/paperclip/issues',
      agents_endpoint: '/api/bridge/paperclip/agents',
      companies_endpoint: '/api/bridge/paperclip/companies',
      workforce_summary: {
        company_count: null,
        active_agents: null,
        active_issues: null,
        budget_status: 'not reachable',
        heartbeat_status: 'not reachable',
      },
      bridge_session: { required_for_mutations: true },
      service: { public_exposure: false },
      writes_enabled: false,
    } as any, 'ok', '')

    expect(node.status).toBe('blocked')
    expect(node.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Active tasks', value: 'not available', tone: 'blocked' }),
      expect.objectContaining({ label: 'Active agents', value: 'not available', tone: 'blocked' }),
    ]))
    expect(node.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Budget', value: 'not reachable', tone: 'blocked' }),
      expect.objectContaining({ label: 'Heartbeat', value: 'not reachable', tone: 'blocked' }),
    ]))
    expect(node.links?.map((link) => link.label)).toEqual(expect.arrayContaining(['Latest work products', 'Agents', 'Companies']))
    expect(node.blockedTasks).toEqual(expect.arrayContaining([
      'paperclip_ui_not_running',
      'Paperclip task creation requires Bridge Session',
      'Paperclip work product storage requires Bridge Session',
      'Paperclip external writes are disabled',
    ]))
    expect(node.action).toMatchObject({ label: 'Open Paperclip', href: null, disabled: true, authRequired: true })
    expect(JSON.stringify(node)).not.toMatch(/auth\.json|secret_value|token_value/i)
  })

  it('enables launch only for a reachable local or Tailnet Paperclip UI', () => {
    const node = buildPaperclipGatewayVisualNode(baseNode, {
      reachable: true,
      configured: true,
      ui_link: 'http://100.116.35.95:3100/dashboard',
      blocker: null,
      workforce_summary: {
        company_count: 1,
        active_agents: 4,
        active_issues: 7,
        budget_status: 'within budget',
        heartbeat_status: 'healthy',
      },
      bridge_session: { required_for_mutations: true },
      service: { public_exposure: false },
      writes_enabled: false,
    } as any, 'ok', '')

    expect(node.status).toBe('connected')
    expect(node.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Active tasks', value: '7' }),
      expect.objectContaining({ label: 'Active agents', value: '4' }),
    ]))
    expect(node.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Budget', value: 'within budget', tone: 'good' }),
      expect.objectContaining({ label: 'Heartbeat', value: 'healthy', tone: 'good' }),
    ]))
    expect(node.action).toMatchObject({ href: 'http://100.116.35.95:3100', disabled: false, authRequired: true })
  })

  it('strips unsafe public or credential-bearing UI links', () => {
    const node = buildPaperclipGatewayVisualNode(baseNode, {
      reachable: true,
      configured: true,
      ui_link: 'https://paperclip.example.com?token=redacted',
      blocker: null,
      workforce_summary: {
        company_count: 1,
        active_agents: 1,
        active_issues: 1,
        budget_status: 'within budget',
        heartbeat_status: 'healthy',
      },
      bridge_session: { required_for_mutations: true },
      service: { public_exposure: false },
      writes_enabled: false,
    } as any, 'ok', '')

    expect(node.status).toBe('connected')
    expect(node.action).toMatchObject({ href: null, disabled: true, authRequired: true })
    expect(node.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'UI link', value: 'not configured' }),
    ]))
    expect(JSON.stringify(node)).not.toMatch(/token=redacted/)
  })
})
