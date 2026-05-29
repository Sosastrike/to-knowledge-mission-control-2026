import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import {
  buildHermesWebUiHealth,
  buildHermesWebUiIdentity,
  buildHermesWebUiPreflight,
  buildHermesWebUiRoutes,
  buildHermesWebUiStatus,
  getHermesWebUiBrowserUrl,
} from '@/lib/hermes-webui-status'
import { GET as getHermesWebUiStatus } from '@/app/api/bridge/hermes/webui/status/route'
import { GET as getHermesWebUiPreflight } from '@/app/api/bridge/hermes-webui/preflight/route'

describe('Ron Weasley WebUI status', () => {
  let repoDir: string

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'hermes-webui-status-'))
    mkdirSync(join(repoDir, 'api'), { recursive: true })
    mkdirSync(join(repoDir, 'static'), { recursive: true })
    writeFileSync(join(repoDir, 'server.py'), '# server\n')
    writeFileSync(join(repoDir, 'api', 'routes.py'), '# routes\n')
    writeFileSync(join(repoDir, 'api', 'config.py'), 'HERMES_WEBUI_HOST HERMES_WEBUI_PORT HERMES_WEBUI_PASSWORD\n')
    writeFileSync(join(repoDir, 'static', 'index.html'), '<main>Hermes</main>\n')
    writeFileSync(join(repoDir, 'requirements.txt'), 'pyyaml>=6.0\n')
    writeFileSync(join(repoDir, 'Dockerfile'), 'FROM python:3.12-slim\n')
    writeFileSync(join(repoDir, 'docker-compose.yml'), 'services:\n  hermes-webui:\n    ports:\n      - "127.0.0.1:8787:8787"\n')
    writeFileSync(join(repoDir, 'docker-compose.two-container.yml'), 'services:\n  hermes-agent:\n  hermes-webui:\n')
    writeFileSync(join(repoDir, 'docker-compose.three-container.yml'), 'services:\n  hermes-agent:\n  hermes-dashboard:\n  hermes-webui:\n')
    writeFileSync(join(repoDir, 'bootstrap.py'), '# bootstrap\n')
    writeFileSync(join(repoDir, 'ctl.sh'), '#!/usr/bin/env bash\n')
    writeFileSync(join(repoDir, 'start.sh'), '#!/usr/bin/env bash\n')
    writeFileSync(join(repoDir, 'README.md'), 'Hermes WebUI\nSSE streaming\nHERMES_WEBUI_AGENT_DIR\nssh -N -L 8787:127.0.0.1:8787 host\n')
    process.env.HERMES_WEBUI_REPO = repoDir
    process.env.HERMES_WEBUI_URL = 'http://127.0.0.1:8787/'
    process.env.HERMES_WEBUI_AGENT_DIR = repoDir
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.HERMES_WEBUI_REPO
    delete process.env.HERMES_WEBUI_URL
    delete process.env.HERMES_WEBUI_AGENT_DIR
    rmSync(repoDir, { recursive: true, force: true })
  })

  it('reports the standalone loopback Ron Weasley WebUI surface without OpenClaw in the path', async () => {
    const status = await buildHermesWebUiStatus()

    expect(status).toMatchObject({
      route: 'bridge.hermes.webui.status',
      service: 'Ron Weasley WebUI',
      canonical_name: 'Ron Weasley',
      short_name: 'Ron',
      full_title: 'Ron Weasley — Nuclear Dispatcher',
      legacy_names: ['Hermes', 'Hermans'],
      state: 'READY',
      webui_repo_present: true,
      health_reachable: true,
      direct_line_surface: true,
      mission_control_intermediary: false,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
      credential_values_exposed: false,
      public_exposure_created: false,
      writes_enabled: false,
    })
    expect(status.browser_url).toBe('/gateway/agent-hub/ron/webui/app')
  })

  it('rejects non-loopback WebUI URLs instead of probing arbitrary hosts', async () => {
    process.env.HERMES_WEBUI_URL = 'https://example.com/hermes'

    const status = await buildHermesWebUiStatus()

    expect(status).toMatchObject({
      state: 'BACKEND_REQUIRED',
      exact_blocker: 'hermes_webui_url_must_be_loopback',
      health_reachable: false,
    })
    expect(getHermesWebUiBrowserUrl()).toBe('/gateway/agent-hub/ron/webui/app')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('protects the status route when unauthenticated', async () => {
    const response = await getHermesWebUiStatus(new NextRequest('http://localhost/api/bridge/hermes/webui/status'))

    expect(response.status).toBe(401)
  })

  it('returns a no-secret P0 preflight packet with the safe loopback install strategy', async () => {
    const preflight = await buildHermesWebUiPreflight()

    expect(preflight).toMatchObject({
      route: 'bridge.hermes-webui.preflight',
      project: 'Ron Weasley WebUI Mission Control Integration',
      repo_present: true,
      runtime_type: 'python_threading_http_server_vanilla_js_sse',
      docker_support: true,
      secrets_required_for_webui_shell: false,
      public_exposure_risk: 'LOW_LOOPBACK_ONLY',
      no_secret_proof: {
        credential_values_exposed: false,
        env_values_printed: false,
        token_values_printed: false,
      },
    })
    expect(preflight.required_env_names).toContain('HERMES_WEBUI_AGENT_DIR')
    expect(preflight.required_env_names).toContain('HERMES_WEBUI_BOT_NAME')
    expect(preflight.required_env_names).toContain('HERMES_WEBUI_TLS_CERT')
    expect(preflight.secret_env_names_by_name_only).toContain('HERMES_WEBUI_PASSWORD')
    expect(preflight.repo_env_names_confirmed_by_name_only).toContain('HERMES_WEBUI_HOST')
    expect(preflight.required_ports.docker_compose_default_exposes_loopback_only).toBe(true)
    expect(preflight.install_methods.docker_compose_two_container).toBe(true)
    expect(preflight.auth_model.standalone_login_route).toBe('/login')
    expect(preflight.hermes_connection_method.final_authority).toBe('agent-zero-jarvis')
    expect(preflight.server_install_helper).toMatchObject({
      path: 'scripts/install-hermes-webui-runtime.sh',
      bind_policy: 'loopback_only',
      edits_env_file: false,
      starts_public_listener: false,
      skips_agent_auto_install: true,
    })
    expect(preflight.source_inventory.streaming).toBe('api/streaming.py')
    expect(preflight.safe_p1_install_command.join('\n')).toContain('HERMES_WEBUI_HOST=127.0.0.1')
  })

  it('ships a no-secret loopback runtime installer helper for the server hop', () => {
    const helper = readFileSync(join(process.cwd(), 'scripts/install-hermes-webui-runtime.sh'), 'utf8')

    expect(helper).toContain('INSTALL_BLOCKED: non_loopback_bind_refused')
    expect(helper).toContain('exec ./ctl.sh start --skip-agent-install')
    expect(helper).toContain('public_exposure_created: false')
    expect(helper).toContain('no_secret_proof: env_names_only_no_values')
    expect(helper).not.toContain('HERMES_WEBUI_PASSWORD=')
    expect(helper).not.toContain('.env')
  })

  it('exposes direct-line identity and real button routes without making OpenCloud the intermediary', async () => {
    const identity = buildHermesWebUiIdentity()
    const routes = buildHermesWebUiRoutes()
    const requiredMissionControlPages = [
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
    ]

    expect(identity).toMatchObject({
      target_agent: 'hermes',
      conversation_owner: 'ron-weasley',
      canonical_name: 'Ron Weasley',
      short_name: 'Ron',
      full_title: 'Ron Weasley — Nuclear Dispatcher',
      legacy_names: ['Hermes', 'Hermans'],
      reports_to: 'agent-zero-jarvis',
      direct_line_used: true,
      opencloud_hidden_intermediary: false,
      creates_second_hermes_brain: false,
    })
    expect(routes.fake_buttons_allowed).toBe(false)
    expect(routes.button_contract.every((button) => button.href || button.disabled_reason)).toBe(true)
    expect(routes.button_contract.filter((button) => button.href?.startsWith('/api/'))).toEqual([])
    expect(routes.button_contract.find((button) => button.label === 'Open Ron Weasley WebUI')).toMatchObject({
      href: null,
      disabled_reason: expect.stringContaining('hermes_webui_health_not_proven'),
    })
    expect(buildHermesWebUiRoutes({ standaloneReachable: true }).button_contract.find((button) => button.label === 'Open Ron Weasley WebUI')).toMatchObject({
      href: '/gateway/agent-hub/ron/webui/app',
      disabled_reason: null,
    })
    expect(routes.button_contract).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Open Ron Weasley Command Center', href: '/gateway/agent-hub/ron/config' }),
      expect.objectContaining({ label: 'Status', href: '/gateway/agent-hub/ron/status', api_route: '/api/bridge/hermes-webui/status' }),
      expect.objectContaining({ label: 'Routes', href: '/gateway/agent-hub/ron/routes', api_route: '/api/bridge/hermes-webui/routes' }),
      expect.objectContaining({ label: 'Brain Map', href: '/gateway/agent-hub/ron/brain-map', api_route: '/api/bridge/hermes/brain-map' }),
      expect.objectContaining({ label: 'Tool Map', href: '/gateway/agent-hub/ron/tool-map', api_route: '/api/bridge/hermes/tool-map' }),
      expect.objectContaining({ label: 'Skill Registry', href: '/gateway/agent-hub/ron/skill-registry', api_route: '/api/bridge/hermes/skill-registry' }),
      expect.objectContaining({ label: 'Mini-Agent Registry', href: '/gateway/agent-hub/ron/mini-agent-registry', api_route: '/api/bridge/hermes/mini-agent-registry' }),
      expect.objectContaining({ label: 'Dispatch Plan', href: '/gateway/agent-hub/ron/dispatch-plan', api_route: '/api/bridge/hermes/dispatch-plan' }),
      expect.objectContaining({ label: 'Request Jarvis Concurrence', href: '/gateway/agent-hub/ron/jarvis-concurrence', api_route: '/api/bridge/hermes/jarvis-concurrence-request' }),
      expect.objectContaining({ label: 'View Pipeline', href: '/gateway/agent-hub/ron/pipelines' }),
      expect.objectContaining({ label: 'View Audit', href: '/gateway/agent-hub/ron/logs' }),
      expect.objectContaining({ label: 'Trace Direct Line', href: '/gateway/agent-hub/ron/routes', api_route: '/api/bridge/hermes-webui/identity' }),
    ]))
    expect(routes.legacy_mission_control_page_aliases).toContain('/gateway/agent-hub/hermes/config')
    expect(routes.webui_routes.preflight).toBe('/api/bridge/hermes-webui/preflight')
    expect(routes.mission_control_pages).toEqual(requiredMissionControlPages)
    expect(routes.required_ui_sections).toEqual(expect.arrayContaining([
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
    ]))
  })

  it('reports a scoped health route without overwriting it with the legacy alias route name', async () => {
    const health = await buildHermesWebUiHealth()

    expect(health).toMatchObject({
      route: 'bridge.hermes-webui.health',
      status: 'RUNNING',
      health_reachable: true,
    })
    expect(health.labels).toContain('DIRECT_LINE_ACTIVE')
  })

  it('protects the canonical preflight route when unauthenticated', async () => {
    const response = await getHermesWebUiPreflight(new NextRequest('http://localhost/api/bridge/hermes-webui/preflight'))

    expect(response.status).toBe(401)
  })
})
