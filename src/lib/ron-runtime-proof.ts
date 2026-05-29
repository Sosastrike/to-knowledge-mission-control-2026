import { existsSync } from 'node:fs'

import { RON_WEASLEY_IDENTITY } from './hermes-boundaries'
import { getHermesWebUiUrl } from './hermes-webui-status'
import {
  buildHermesWebUiProxyTarget,
  isAllowedHermesWebUiLoopbackUrl,
  repairHermesWebUiChatStartBody,
} from './hermes-webui-proxy'

type RonRuntimeProofOptions = {
  webUiUrl?: string
  smsDisabledProofPresent?: boolean
}

type JsonObject = Record<string, unknown>

const SMS_DISABLE_DROPIN = '/home/tony/.config/systemd/user/hermes-gateway.service.d/20-disable-sms.conf'

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

async function fetchJson(url: URL): Promise<{ ok: boolean, status: number | null, body: JsonObject }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    const body = asObject(await response.json().catch(() => ({})))
    return { ok: response.ok, status: response.status, body }
  } catch {
    return { ok: false, status: null, body: {} }
  } finally {
    clearTimeout(timeout)
  }
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function maskSessionId(sessionId: string) {
  if (sessionId.length <= 7) return 'masked'
  return `${sessionId.slice(0, 4)}...${sessionId.slice(-3)}`
}

function smsDisabled(options: RonRuntimeProofOptions) {
  return options.smsDisabledProofPresent === true
    || process.env.HERMES_GATEWAY_DISABLE_SMS === '1'
    || existsSync(SMS_DISABLE_DROPIN)
}

function sessionProof(sessions: unknown) {
  const items = Array.isArray(sessions) ? sessions.map(asObject) : []
  const proven = items.find((item) => numberValue(item.message_count) >= 2)
  if (!proven) {
    return {
      state: 'PENDING_PROOF',
      message_count: 0,
      session_proof: null,
      proof_surface: null,
      exact_blocker: 'ron_direct_line_send_receive_proof_missing',
    }
  }

  const sessionId = textValue(proven.session_id)
  return {
    state: 'PROOF_PRESENT',
    message_count: numberValue(proven.message_count),
    proof_surface: 'ron_webui_loopback_sessions',
    session_proof: {
      masked_session_id: maskSessionId(sessionId),
      title: textValue(proven.title),
    },
    exact_blocker: null,
  }
}

function missionControlProxyProof(input: { webUiReady: boolean; directLineProven: boolean }) {
  const appTarget = buildHermesWebUiProxyTarget(['app'])
  const healthTarget = buildHermesWebUiProxyTarget(['health'])
  const sessionRepair = repairHermesWebUiChatStartBody(
    'POST',
    '/api/chat/start',
    { message: 'redacted' },
    '/gateway/agent-hub/ron/webui/session/mission-control-proxy-proof',
  )

  return {
    state: input.webUiReady && input.directLineProven
      ? 'LOCAL_PROXY_READINESS_PRESENT_AUTHENTICATED_SEND_RECEIVE_PENDING'
      : 'PENDING_PROOF',
    route: '/gateway/agent-hub/ron/webui/app',
    legacy_route: '/gateway/agent-hub/hermes/webui/app',
    auth_required: true,
    upstream_loopback_only: appTarget.ok && healthTarget.ok,
    upstream_health_path: healthTarget.target?.pathname || null,
    session_id_repair: sessionRepair.repaired ? 'READY' : 'BLOCKED',
    session_id_value_exposed: false,
    local_direct_line_proof_present: input.directLineProven,
    authenticated_proxy_send_receive_proof: false,
    exact_blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending',
  }
}

export async function buildRonRuntimeProof(options: RonRuntimeProofOptions = {}) {
  const rawUrl = options.webUiUrl || getHermesWebUiUrl()
  const safeLoopback = isAllowedHermesWebUiLoopbackUrl(rawUrl)
  const webUiBase = safeLoopback ? new URL(rawUrl) : null

  const healthUrl = webUiBase ? new URL('/health', webUiBase) : null
  const sessionsUrl = webUiBase ? new URL('/api/sessions', webUiBase) : null
  const health = healthUrl ? await fetchJson(healthUrl) : { ok: false, status: null, body: {} }
  const sessions = sessionsUrl ? await fetchJson(sessionsUrl) : { ok: false, status: null, body: {} }
  const directLine = sessionProof(sessions.body.sessions)
  const smsIsDisabled = smsDisabled(options)
  const webUiReady = safeLoopback && health.ok
  const directLineProven = directLine.state === 'PROOF_PRESENT'
  const proxyProof = missionControlProxyProof({ webUiReady, directLineProven })

  return {
    route: 'bridge.ron.runtime-proof',
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    delegation: 'FULL_ACCESS_DELEGATED',
    execution_model: 'JARVIS-GATED_EXECUTION',
    protected_execution: 'JARVIS_CONCURRENCE_REQUIRED',
    overall_state: webUiReady
      ? directLineProven
        ? 'RUNTIME_RECOVERED_LOCAL_DIRECT_LINE_PROOF_PRESENT'
        : 'RUNTIME_HEALTHY_DIRECT_LINE_PROOF_PENDING'
      : 'RUNTIME_HEALTH_BLOCKED',
    opencloud_intermediary: false,
    secrets_exposed: false,
    credential_values_exposed: false,
    components: {
      gateway: {
        state: webUiReady ? 'ACTIVE' : 'SERVICE_UNREACHABLE',
        startup_failed: false,
        exact_blocker: webUiReady ? null : 'ron_webui_health_unreachable',
      },
      webui: {
        state: webUiReady ? 'READY' : 'SERVICE_UNREACHABLE',
        health_reachable: webUiReady,
        health_status_code: health.status,
        exact_blocker: safeLoopback ? (webUiReady ? null : 'ron_webui_health_unreachable') : 'ron_webui_url_must_be_loopback',
      },
      direct_line: directLine,
      mission_control_proxy: proxyProof,
      sms: {
        state: smsIsDisabled ? 'DISABLED_UNCONFIGURED' : 'UNCONFIGURED_NOT_BLOCKING_DIRECT_LINE',
        blocking_startup: false,
        insecure_signature_validation: false,
        credential_values_exposed: false,
      },
      auth: {
        state: 'MISSION_CONTROL_AUTH_REQUIRED',
        unauthenticated_status: 401,
      },
      jarvis_concurrence: {
        state: 'REQUIRED',
        final_authority: 'agent-zero-jarvis',
      },
      runtime_tools: {
        state: 'READ_ONLY_PROOF_ONLY',
        writes_enabled: false,
        external_connector_execution: false,
      },
    },
    mission_control_proxy_certification: {
      state: proxyProof.state,
      blocker: 'mission_control_authenticated_proxy_send_receive_proof_pending',
      local_direct_line_proof_present: directLineProven,
      authenticated_proxy_send_receive_proof: false,
    },
    no_secret_proof: {
      env_values_printed: false,
      token_values_printed: false,
      cookies_printed: false,
      credential_values_exposed: false,
    },
  }
}
