import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import {
  buildAgentLineTraceLive,
  buildAgentLineTraceRecord,
  externalAgentReceiveTraceSources,
  hasExternalAgentReceiveProof,
} from '@/lib/agent-line-trace'
import { listAgentRoutingLines } from '@/lib/agent-routing-lines'
import { getDatabase } from '@/lib/db'
import { GET as getTraceLive } from '@/app/api/bridge/agent-routing/trace/live/route'
import { POST as postTraceProbe } from '@/app/api/bridge/agent-routing/trace/probe/route'

describe('Direct Agent Line Trace Kit', () => {
  it.each([
    ['agent-zero-jarvis'],
    ['ron-weasley'],
    ['pi'],
    ['paperclip'],
    ['spaceagent'],
    ['hermes-webui'],
    ['brain-bridge'],
  ])('passes direct-line trace for %s without OpenCloud intermediary', (targetAgent) => {
    const record = buildAgentLineTraceRecord({
      target_agent: targetAgent,
      nonce: `TRACE-test-${targetAgent}`,
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      target_agent: targetAgent,
      direct_line_used: true,
      opencloud_used: false,
      opencloud_role: 'not_used',
      openclaw_used: false,
      openclaw_role: 'not_used',
      local_gateway_probe: false,
      verification_sources: [],
      message_received_by_agent: true,
      response_sent: true,
      status: 'PASS',
      blocker: null,
      credential_values_exposed: false,
      raw_message_body_exposed: false,
    })
    expect(record.route_trace).toEqual(expect.arrayContaining(['owner', 'mission-control', 'nuclear-gateway', targetAgent]))
  })

  it('passes every registered active direct line and keeps OpenCloud out of the conversation owner path', () => {
    const activeLines = listAgentRoutingLines().filter((line) => line.direct_line_active)
    expect(activeLines.length).toBeGreaterThan(20)

    for (const line of activeLines) {
      const record = buildAgentLineTraceRecord({
        target_agent: line.agent_id,
        nonce: `TRACE-test-registry-${line.agent_id}`,
        create_visible_task_on_failure: false,
      })

      expect(record.status, line.agent_id).toBe('PASS')
      expect(record.blocker, line.agent_id).toBeNull()
      expect(record.direct_line_used, line.agent_id).toBe(true)
      expect(record.conversation_owner, line.agent_id).not.toMatch(/opencloud|openclaw|claudeclaw/i)
      expect(record.opencloud_used, line.agent_id).toBe(false)
      expect(record.route_trace, line.agent_id).toEqual(expect.arrayContaining(['owner', 'mission-control', 'nuclear-gateway', line.agent_id]))
    }
  })

  it('fails when OpenCloud/OpenClaw is a hidden intermediary', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-opencloud',
      intermediaries: ['openclaw'],
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'FAIL',
      blocker: 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED',
      opencloud_used: true,
      opencloud_role: 'forbidden_hidden_intermediary',
    })
  })

  it('fails any hidden intermediary that is not declared as an explicit tool call', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-generic-hidden-intermediary',
      intermediaries: ['legacy-transport-layer'],
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'FAIL',
      blocker: 'HIDDEN_INTERMEDIARY_DETECTED',
      direct_line_used: false,
      intermediaries: ['legacy-transport-layer'],
      opencloud_used: false,
      opencloud_role: 'not_used',
    })
  })

  it('summarizes generic hidden intermediary failures separately from OpenCloud violations', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-live-generic-hidden-summary',
      intermediaries: ['legacy-transport-layer'],
      create_visible_task_on_failure: false,
    })
    const live = buildAgentLineTraceLive({ agent: 'ron-weasley', nonce: record.nonce })

    expect(live).toMatchObject({
      trace_count: 1,
      summary: {
        total: 1,
        pass: 0,
        fail: 1,
        hidden_intermediary_detected: 1,
        opencloud_hidden_intermediary_detected: 0,
        openclaw_hidden_intermediary_detected: 0,
        latest_status: 'FAIL',
        latest_blocker: 'HIDDEN_INTERMEDIARY_DETECTED',
        blockers: {
          HIDDEN_INTERMEDIARY_DETECTED: 1,
        },
      },
    })
    expect(JSON.stringify(live)).not.toMatch(/message body|chat_id|cookie|token/i)
  })

  it('allows OpenCloud/OpenClaw only as an explicit supporting tool call, never as intermediary', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-opencloud-tool-only',
      tools_called: ['openclaw'],
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'PASS',
      blocker: null,
      direct_line_used: true,
      opencloud_used: true,
      opencloud_role: 'supporting_tool_only',
      openclaw_used: true,
      openclaw_role: 'supporting_tool_only',
      intermediaries: [],
      tools_called: ['openclaw'],
    })
  })

  it('labels local probe traces as Mission Control protected probe proof', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-local-gateway-probe',
      local_gateway_probe: true,
      verification_sources: ['mission_control_protected_probe_route'],
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      target_agent: 'ron-weasley',
      status: 'PASS',
      local_gateway_probe: true,
      verification_sources: ['mission_control_protected_probe_route'],
      direct_line_used: true,
      opencloud_used: false,
    })
  })

  it('classifies external receive proof separately from local-only probe proof', () => {
    const external = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-external-receive-proof',
      local_gateway_probe: false,
      verification_sources: ['mission_control_trace_route', 'mission_control_journal_nonce', 'agent_runtime_journal_nonce'],
      create_visible_task_on_failure: false,
    })
    const localOnly = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-local-only-receive-proof',
      local_gateway_probe: true,
      verification_sources: ['mission_control_protected_probe_route', 'mission_control_trace_route'],
      create_visible_task_on_failure: false,
    })

    expect(externalAgentReceiveTraceSources(external.verification_sources)).toEqual([
      'mission_control_journal_nonce',
      'agent_runtime_journal_nonce',
    ])
    expect(hasExternalAgentReceiveProof(external)).toBe(true)
    expect(externalAgentReceiveTraceSources(localOnly.verification_sources)).toEqual([])
    expect(hasExternalAgentReceiveProof(localOnly)).toBe(false)

    const live = buildAgentLineTraceLive({ agent: 'ron-weasley' })
    expect(live.summary.external_receive_proof_pass).toBeGreaterThanOrEqual(1)
    expect(live.summary.local_only_pass).toBeGreaterThanOrEqual(1)
  })

  it('fails when the wrong agent responds', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-wrong-agent',
      response_sent: true,
      response_agent: 'hermes',
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'FAIL',
      blocker: 'WRONG_AGENT_RESPONDED',
    })
  })

  it('fails when route trace is missing', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-missing-route',
      route_trace: [],
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'FAIL',
      blocker: 'ROUTE_TRACE_MISSING',
    })
  })

  it('proves voice transcription and output-channel override state', () => {
    const voicePass = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-voice-pass',
      mode: 'voice',
      voice_transcribed: true,
      requested_output_mode: 'text',
      tts_actually_called: false,
      create_visible_task_on_failure: false,
    })
    const voiceMissing = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-voice-missing',
      mode: 'voice',
      voice_transcribed: false,
      create_visible_task_on_failure: false,
    })
    const overrideIgnored = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-text-override',
      requested_output_mode: 'text',
      tts_actually_called: true,
      create_visible_task_on_failure: false,
    })

    expect(voicePass.status).toBe('PASS')
    expect(voicePass.voice_transcribed).toBe(true)
    expect(voiceMissing).toMatchObject({ status: 'FAIL', blocker: 'VOICE_TRANSCRIPTION_MISSING' })
    expect(overrideIgnored).toMatchObject({ status: 'FAIL', blocker: 'TEXT_OVERRIDE_IGNORED' })
  })

  it('traces Ron WebUI through the legacy Hermes source surface for the canonical Ron agent', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      target_system: 'hermes-webui',
      source_channel: 'terminal',
      source_surface: 'hermes-webui',
      nonce: 'TRACE-test-hermes-webui-source',
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      target_agent: 'ron-weasley',
      target_system: 'hermes-webui',
      source_surface: 'hermes-webui',
      conversation_owner: 'ron-weasley',
      direct_line_used: true,
      status: 'PASS',
      blocker: null,
    })
    expect(record.route_trace).toEqual(expect.arrayContaining(['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley']))
  })

  it('traces Ron Weasley aliases through the legacy Hermes direct line without OpenCloud', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron',
      nonce: 'TRACE-test-ron-alias-direct-line',
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      target_agent: 'ron-weasley',
      conversation_owner: 'ron-weasley',
      direct_line_used: true,
      status: 'PASS',
      blocker: null,
      opencloud_used: false,
    })
    expect(record.route_trace).toEqual(['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley'])
  })

  it('uses scoped route traces for company agents, Ron mini-agents, and Brain child lanes', () => {
    expect(buildAgentLineTraceRecord({
      target_agent: 'paperclip.eco.ceo',
      nonce: 'TRACE-test-company-agent-trace',
      create_visible_task_on_failure: false,
    }).route_trace).toEqual([
      'owner',
      'mission-control',
      'nuclear-gateway',
      'paperclip',
      'paperclip.company.eco',
      'paperclip.eco.ceo',
    ])

    expect(buildAgentLineTraceRecord({
      target_agent: 'hermes-mini-agent.workflow-drafter',
      nonce: 'TRACE-test-hermes-mini-agent-trace',
      create_visible_task_on_failure: false,
    }).route_trace).toEqual([
      'owner',
      'mission-control',
      'nuclear-gateway',
      'ron-weasley',
      'ron-mini-agent.workflow-drafter',
    ])

    expect(buildAgentLineTraceRecord({
      target_agent: 'obsidian',
      nonce: 'TRACE-test-brain-child-trace',
      create_visible_task_on_failure: false,
    }).route_trace).toEqual([
      'owner',
      'mission-control',
      'nuclear-gateway',
      'brain-bridge',
      'obsidian',
    ])
  })

  it('creates owner-visible task proof for failed traces', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'paperclip',
      nonce: 'TRACE-test-visible-task',
      response_sent: false,
      create_visible_task_on_failure: true,
    })

    expect(record.status).toBe('FAIL')
    expect(record.visible_task_id).toMatch(/^\d+$/)

    const db = getDatabase()
    const task = db.prepare('SELECT title, metadata FROM tasks WHERE id = ?').get(Number(record.visible_task_id)) as { title: string; metadata: string } | undefined
    expect(task?.title).toBe('Direct Agent Line Trace Failure — paperclip')
    expect(JSON.parse(task?.metadata || '{}')).toMatchObject({
      nonce: 'TRACE-test-visible-task',
      target_agent: 'paperclip',
      failure_code: 'RESPONSE_NOT_SENT',
      project_continues: true,
      credential_values_exposed: false,
    })
  })

  it('keeps direct_line_used true when the route reached the agent but the response failed', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'paperclip',
      nonce: 'TRACE-test-response-not-sent-direct-line',
      message_received_by_agent: true,
      response_sent: false,
      create_visible_task_on_failure: false,
    })

    expect(record).toMatchObject({
      status: 'FAIL',
      blocker: 'RESPONSE_NOT_SENT',
      direct_line_used: true,
      opencloud_used: false,
    })
  })

  it('terminal script posts final failures to Mission Control when auth is available', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/agent-line-trace.sh'), 'utf8')

    expect(script).toContain('post_final_trace_result')
    expect(script).toContain('agent-line-trace.sh --agent ron')
    expect(script).toContain('ron|ron-weasley|hermes')
    expect(script).toContain('hermes-webui)')
    expect(script).toContain('CONVERSATION_OWNER="ron-weasley"')
    expect(script).toContain('DISPLAY_AGENT="Ron Weasley"')
    expect(script).toContain('"conversation_owner": "$CONVERSATION_OWNER"')
    expect(script).toContain('"source_channel": "terminal"')
    expect(script).toContain('"direct_line_used": bool($FOUND_RECEIVE) and not bool($FOUND_OPENCLOUD)')
    expect(script).toContain('"message_received_by_agent": bool($FOUND_RECEIVE)')
    expect(script).toContain('"response_sent": bool($FOUND_RESPONSE)')
    expect(script).toContain('"openclaw_used": bool($FOUND_OPENCLOUD)')
    expect(script).toContain('"openclaw_role": "forbidden_hidden_intermediary" if bool($FOUND_OPENCLOUD) else "not_used"')
    expect(script).toContain('def normalize_route_trace(trace):')
    expect(script).toContain('if hop in ("mission_control_gateway", "mission-control-gateway"):')
    expect(script).toContain('local_signal_route_trace = ["owner", "mission-control", "nuclear-gateway"]')
    expect(script).toContain('normalized.insert(1, "mission-control")')
    expect(script).toContain('nuclear-gateway')
    expect(script).toContain('"legacy_target_agent": "$LEGACY_TARGET_AGENT" or None')
    expect(script).toContain('SOURCE_SURFACE="hermes-webui"')
    expect(script).toContain('create_visible_task_on_failure')
    expect(script).toContain('"source_surface": "$SOURCE_SURFACE"')
    expect(script).toContain('/api/bridge/agent-routing/trace/probe')
    expect(script).toContain('"local_gateway_probe": true')
    expect(script).toContain('mission_control_protected_probe_route')
    expect(script).toContain('mission_control_journal_nonce')
    expect(script).toContain('agent_runtime_journal_nonce')
    expect(script).toContain('agent_zero_docker_nonce')
    expect(script).toContain("-w '%{http_code}'")
    expect(script).toContain('200|201|202|204|409')
    expect(script).toContain('data.get("record") or data.get("trace")')
    expect(script).toContain('"opencloud_intermediary"')
    expect(script).toContain('"opencloud_role"')
    expect(script).toContain('"route_trace"')
    expect(script).toContain('mission_control_auth_required_for_visible_task_creation')
    expect(script).not.toContain('TELEGRAM_BOT_TOKEN')
  })

  it('bounds network, journal, and container probes so trace commands cannot hang indefinitely', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/agent-line-trace.sh'), 'utf8')

    expect(script).toContain('TRACE_CURL_MAX_SECONDS')
    expect(script).toContain('TRACE_CHECK_MAX_SECONDS')
    expect(script).toContain('TRACE_CONNECT_TIMEOUT_SECONDS')
    expect(script).toContain('bounded_cmd()')
    expect(script).toContain('curl --connect-timeout "$TRACE_CONNECT_TIMEOUT_SECONDS" --max-time "$TRACE_CURL_MAX_SECONDS"')
    expect(script).toContain('bounded_cmd journalctl')
    expect(script).toContain('bounded_cmd docker logs')
    expect(script).toContain('bounded_cmd docker ps')
  })

  it('terminal script lets Mission Control compute scoped route traces for final probes', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/agent-line-trace.sh'), 'utf8')

    expect(script).not.toContain('"route_trace": route_trace')
    expect(script).toContain('ROUTE_TRACE_JSON')
    expect(script).toContain('mission_control_route_trace')
  })

  it('does not let local probe mode fake voice transcription proof', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/agent-line-trace.sh'), 'utf8')

    expect(script).toContain('PROBE_VOICE_TRANSCRIBED=')
    expect(script).toContain('"voice_transcribed": $PROBE_VOICE_TRANSCRIBED')
    expect(script).not.toContain('"voice_transcribed": true,\n  "response_sent": true')
  })

  it('ships a no-secret installer helper for the canonical server trace script path', () => {
    const installer = readFileSync(join(process.cwd(), 'scripts/install-agent-line-trace.sh'), 'utf8')

    expect(installer).toContain('/home/tony/agent-line-trace.sh')
    expect(installer).toContain('INSTALL_BLOCKED: target_directory_missing')
    expect(installer).toContain('INSTALL_BLOCKED: target_directory_not_writable')
    expect(installer).toContain('install -m 0755 "$SOURCE" "$TARGET"')
    expect(installer).not.toMatch(/TELEGRAM_BOT_TOKEN|AUTH_PASS=|MC_API_KEY=|MC_BEARER_TOKEN=|\\.env/)
  })

  it('keeps a trace alias on the probe API response for terminal compatibility', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/bridge/agent-routing/trace/probe/route.ts'), 'utf8')

    expect(route).toContain('record,')
    expect(route).toContain('trace: record')
  })

  it('keeps live trace records redacted and queryable', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'ron-weasley',
      nonce: 'TRACE-test-live-query',
      create_visible_task_on_failure: false,
    })
    const live = buildAgentLineTraceLive({ agent: 'ron-weasley', nonce: record.nonce })

    expect(live.traces).toHaveLength(1)
    expect(JSON.stringify(live)).not.toMatch(/message body|chat_id|token|cookie/i)
    expect(live).toMatchObject({
      route: 'bridge.agent-routing.trace.live',
      credential_values_exposed: false,
      raw_message_body_exposed: false,
      summary: {
        total: 1,
        pass: 1,
        fail: 0,
        latest_status: 'PASS',
        latest_blocker: null,
      },
    })
    expect(live.supported_agents.find((agent) => agent.agent_id === 'ron-weasley')).toMatchObject({
      direct_line_active: true,
      visible_task_required: true,
      audit_required: true,
      rollback_required: true,
      opencloud_intermediary_allowed: false,
      last_verified: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
  })

  it('summarizes live trace failures without exposing raw message content', () => {
    const record = buildAgentLineTraceRecord({
      target_agent: 'agent-zero-jarvis',
      nonce: 'TRACE-test-live-opencloud-summary',
      intermediaries: ['opencloud'],
      create_visible_task_on_failure: false,
    })
    const live = buildAgentLineTraceLive({ agent: 'agent-zero-jarvis', nonce: record.nonce })

    expect(live).toMatchObject({
      trace_count: 1,
      summary: {
        total: 1,
        pass: 0,
        fail: 1,
        hidden_intermediary_detected: 1,
        opencloud_hidden_intermediary_detected: 1,
        openclaw_hidden_intermediary_detected: 1,
        latest_status: 'FAIL',
        latest_blocker: 'OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED',
        blockers: {
          OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED: 1,
        },
      },
    })
    expect(JSON.stringify(live)).not.toMatch(/message body|chat_id|cookie/i)
  })

  it('protects trace routes when unauthenticated', async () => {
    const [live, probe] = await Promise.all([
      getTraceLive(new NextRequest('http://localhost/api/bridge/agent-routing/trace/live')),
      postTraceProbe(new NextRequest('http://localhost/api/bridge/agent-routing/trace/probe', {
        method: 'POST',
        body: JSON.stringify({ target_agent: 'hermes' }),
      })),
    ])

    expect(live.status).toBe(401)
    expect(probe.status).toBe(401)
  })


  it('allows SpaceAgent scoped token to use trace routes without the global API key', async () => {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const rawKey = `mca_test_spaceagent_trace_${now}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    db.prepare(`
      INSERT OR IGNORE INTO agents (name, role, session_key, status, created_at, updated_at, workspace_id)
      VALUES ('spaceagent', 'Independent Specialized Agent', 'spaceagent-test-session', 'idle', ?, ?, 1)
    `).run(now, now)
    const agent = db.prepare(`SELECT id FROM agents WHERE name = 'spaceagent' AND workspace_id = 1`).get() as { id: number }

    try {
      db.prepare(`
        INSERT OR IGNORE INTO agent_api_keys (
          agent_id, workspace_id, name, key_hash, key_prefix, scopes, created_by, created_at, updated_at
        ) VALUES (?, 1, 'spaceagent-trace-test', ?, ?, ?, 'test', ?, ?)
      `).run(
        agent.id,
        keyHash,
        rawKey.slice(0, 12),
        JSON.stringify(['spaceagent.read', 'spaceagent.gateway_read', 'spaceagent.task_event_write']),
        now,
        now,
      )

      const headers = {
        'x-api-key': rawKey,
        'x-agent-name': 'spaceagent',
        'content-type': 'application/json',
      }

      const probe = await postTraceProbe(new NextRequest('http://localhost/api/bridge/agent-routing/trace/probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target_agent: 'spaceagent',
          nonce: 'TRACE-test-spaceagent-scoped-token',
          create_visible_task_on_failure: false,
        }),
      }))
      const live = await getTraceLive(new NextRequest('http://localhost/api/bridge/agent-routing/trace/live?agent=spaceagent&nonce=TRACE-test-spaceagent-scoped-token', {
        headers,
      }))

      expect(probe.status).toBe(200)
      expect(live.status).toBe(200)
      const payload = await live.json()
      expect(payload).toMatchObject({
        credential_values_exposed: false,
        raw_message_body_exposed: false,
        summary: {
          latest_status: 'PASS',
        },
      })
    } finally {
      db.prepare(`
        UPDATE agent_api_keys
        SET revoked_at = COALESCE(revoked_at, ?), updated_at = ?
        WHERE key_hash = ? AND name = 'spaceagent-trace-test'
      `).run(now, now, keyHash)
    }
  })

  it('allows Ron scoped token to use trace routes without the global API key', async () => {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const rawKey = `mca_test_ron_trace_${now}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    db.prepare(`
      INSERT OR IGNORE INTO agents (name, role, session_key, status, created_at, updated_at, workspace_id)
      VALUES ('ron-weasley', 'Nuclear Dispatcher', 'ron-weasley-test-session', 'idle', ?, ?, 1)
    `).run(now, now)
    const agent = db.prepare(`SELECT id FROM agents WHERE name = 'ron-weasley' AND workspace_id = 1`).get() as { id: number }

    try {
      db.prepare(`
        INSERT OR IGNORE INTO agent_api_keys (
          agent_id, workspace_id, name, key_hash, key_prefix, scopes, created_by, created_at, updated_at
        ) VALUES (?, 1, 'ron-trace-test', ?, ?, ?, 'test', ?, ?)
      `).run(
        agent.id,
        keyHash,
        rawKey.slice(0, 12),
        JSON.stringify(['ron.read', 'ron.gateway_read', 'ron.task_event_write']),
        now,
        now,
      )

      const headers = {
        'x-api-key': rawKey,
        'x-agent-name': 'ron-weasley',
        'content-type': 'application/json',
      }

      const probe = await postTraceProbe(new NextRequest('http://localhost/api/bridge/agent-routing/trace/probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target_agent: 'hermes',
          conversation_owner: 'ron-weasley',
          nonce: 'TRACE-test-ron-scoped-token',
          create_visible_task_on_failure: false,
        }),
      }))
      const live = await getTraceLive(new NextRequest('http://localhost/api/bridge/agent-routing/trace/live?agent=hermes&nonce=TRACE-test-ron-scoped-token', {
        headers,
      }))

      expect(probe.status).toBe(200)
      expect(live.status).toBe(200)
      const payload = await live.json()
      expect(payload).toMatchObject({
        credential_values_exposed: false,
        raw_message_body_exposed: false,
        summary: {
          latest_status: 'PASS',
        },
      })
    } finally {
      db.prepare(`
        UPDATE agent_api_keys
        SET revoked_at = COALESCE(revoked_at, ?), updated_at = ?
        WHERE key_hash = ? AND name = 'ron-trace-test'
      `).run(now, now, keyHash)
    }
  })
})
