import { describe, expect, it } from 'vitest'

import {
  HERMES_COMMAND_CENTER_ROUTE,
  HERMES_LEGACY_WEB_INTERFACE_BASE,
  HERMES_STANDALONE_PROXY_ROUTE,
  HERMES_SHARED_WORKSPACE_ROUTE,
  HERMES_WEB_INTERFACE_ACTIONS,
  HERMES_WEB_INTERFACE_BASE,
  HERMES_WEB_INTERFACE_PAGES,
  HERMES_WEB_INTERFACE_SECTIONS,
  buildHermesWebInterfaceProof,
  getHermesWebInterfacePage,
} from './hermes-web-interface'

describe('Ron Weasley Web Interface Mission Control contract', () => {
  it('publishes every required Mission Control Ron Weasley page on canonical Ron routes', () => {
    expect(HERMES_WEB_INTERFACE_PAGES.map((page) => page.href)).toEqual([
      '/gateway/agent-hub/ron',
      '/gateway/agent-hub/ron/config',
      '/gateway/agent-hub/ron/status',
      '/gateway/agent-hub/ron/routes',
      '/gateway/agent-hub/ron/brain-map',
      '/gateway/agent-hub/ron/tool-map',
      '/gateway/agent-hub/ron/skill-registry',
      '/gateway/agent-hub/ron/mini-agent-registry',
      '/gateway/agent-hub/ron/pipelines',
      '/gateway/agent-hub/ron/tasks',
      '/gateway/agent-hub/ron/logs',
      '/gateway/agent-hub/ron/dispatch-plan',
      '/gateway/agent-hub/ron/jarvis-concurrence',
    ])
    expect(HERMES_WEB_INTERFACE_BASE).toBe('/gateway/agent-hub/ron')
    expect(HERMES_LEGACY_WEB_INTERFACE_BASE).toBe('/gateway/agent-hub/hermes')
  })

  it('wires required legacy API routes without making POST buttons fake navigations', () => {
    expect(getHermesWebInterfacePage('status')).toMatchObject({
      apiRoute: '/api/bridge/hermes/status',
      method: 'GET',
    })
    expect(getHermesWebInterfacePage('brain-map')).toMatchObject({
      apiRoute: '/api/bridge/hermes/brain-map',
      method: 'GET',
    })
    expect(getHermesWebInterfacePage('tool-map')).toMatchObject({
      apiRoute: '/api/bridge/hermes/tool-map',
      method: 'GET',
    })
    expect(getHermesWebInterfacePage('skill-registry')).toMatchObject({
      apiRoute: '/api/bridge/hermes/skill-registry',
      method: 'GET',
    })
    expect(getHermesWebInterfacePage('mini-agent-registry')).toMatchObject({
      apiRoute: '/api/bridge/hermes/mini-agent-registry',
      method: 'GET',
    })
    expect(getHermesWebInterfacePage('dispatch-plan')).toMatchObject({
      apiRoute: '/api/bridge/hermes/dispatch-plan',
      method: 'POST',
    })
    expect(getHermesWebInterfacePage('jarvis-concurrence')).toMatchObject({
      apiRoute: '/api/bridge/hermes/jarvis-concurrence-request',
      method: 'POST',
    })
  })

  it('contains all owner-required command center sections', () => {
    expect(HERMES_WEB_INTERFACE_SECTIONS).toEqual([
      'Ron Weasley Overview',
      'Status / readiness',
      'Active dispatch plans',
      'Jarvis concurrence queue',
      'Brain / memory map',
      'Tool map',
      'Skill registry',
      'Mini-agent registry',
      'Workflow compiler',
      'Paperclip intelligence',
      'n8n / Zapier optimization',
      'Agent performance optimizer',
      'Logs / audit / rollback',
    ])
  })

  it('proves buttons are real Mission Control routes and OpenCloud is not Ron Weasley', () => {
    expect(HERMES_WEB_INTERFACE_ACTIONS.every((action) => action.href.trim().length > 0)).toBe(true)
    expect(HERMES_WEB_INTERFACE_ACTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Open Ron Weasley WebUI', href: HERMES_SHARED_WORKSPACE_ROUTE }),
      expect.objectContaining({ label: 'Open command center', href: HERMES_COMMAND_CENTER_ROUTE }),
    ]))
    expect(HERMES_WEB_INTERFACE_ACTIONS.find((action) => action.label === 'Open Ron Weasley WebUI')?.href).not.toBe(HERMES_COMMAND_CENTER_ROUTE)
    const proof = buildHermesWebInterfaceProof()
    expect(proof.no_fake_buttons).toBe(true)
    expect(proof.identity.hermes).toBe('legacy_route_alias_for_ron_weasley')
    expect(proof.identity.canonical_name).toBe('Ron Weasley')
    expect(proof.identity.short_name).toBe('Ron')
    expect(proof.identity.full_title).toBe('Ron Weasley — Nuclear Dispatcher')
    expect(proof.identity.legacy_names).toEqual(['Hermes', 'Hermans'])
    expect(proof.identity.opencloud).toBe('supporting_runtime_only')
    expect(proof.identity.opencloud_intermediary).toBe(false)
    expect(proof.status).toBe('HERMES_WEBUI_MISSION_CONTROL_SURFACE_READY')
    expect(proof.final_status_target).toBe('HERMES_WEBUI_MISSION_CONTROL_READY')
    expect(proof.standalone_webui.status).toBe('SHARED_AGENT_PLATFORM_WORKSPACE_READY_LEGACY_PROXY_RETAINED_FOR_ROLLBACK')
    expect(proof.standalone_webui.proxy_route).toBe(HERMES_SHARED_WORKSPACE_ROUTE)
    expect(proof.standalone_webui.legacy_proxy_route).toBe(HERMES_STANDALONE_PROXY_ROUTE)
    expect(proof.standalone_webui.health_route).toBe('/api/bridge/hermes-webui/health')
    expect(proof.standalone_webui.mission_control_command_center_is_primary).toBe(true)
  })
})
