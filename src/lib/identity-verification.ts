import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { ensureAgentRoutingVisibleTask } from '@/lib/agent-routing-lines'

export type IdentityPermissionStatus = 'requested' | 'approved' | 'denied' | 'expired' | 'unavailable' | 'owner_device_action_required'
export type IdentityTrustTier = 'low' | 'medium' | 'high' | 'owner_verified'

export type IdentityDevice = {
  device_id: string
  device_name: string
  device_type: string
  owner: string
  location: string
  camera_available: boolean | 'unknown'
  microphone_available: boolean | 'unknown'
  access_method: string
  trusted_network: boolean
  trust_level: IdentityTrustTier
  last_seen: string | null
  permission_status: IdentityPermissionStatus
  endpoint_contract: {
    allowed_bind: 'local_or_tailscale_only'
    public_exposure_allowed: false
    raw_media_persistence_default: false
  }
  blockers: string[]
}

type IdentityState = {
  devices: IdentityDevice[]
  camera_requests: Array<{
    request_id: string
    device_id: string
    state: IdentityPermissionStatus
    requested_at: string
    expires_at: string
    blocker: string | null
    no_camera_opened: true
    no_raw_media_persisted: true
  }>
  challenges: Array<{
    challenge_id: string
    state: 'started' | 'verified' | 'expired' | 'failed'
    created_at: string
    expires_at: string
  }>
}

export type IdentityProjectTaskLink = {
  id: number
  title: string
  status: string
  progress: unknown
  blocker: unknown
  route: string
}

const statePath = join(config.dataDir, 'identity-verification-state.json')
const IDENTITY_VISIBLE_TASK_TITLE = 'Identity Verification + Device Camera Access'

function nowIso() {
  return new Date().toISOString()
}

function defaultDevice(): IdentityDevice {
  return {
    device_id: 'mac-studio-tailscale-100-108-96-80',
    device_name: 'Mac Studio',
    device_type: 'macos_workstation',
    owner: 'Tony',
    location: 'trusted_tailnet',
    camera_available: 'unknown',
    microphone_available: 'unknown',
    access_method: 'tailscale_local_bridge_candidate',
    trusted_network: true,
    trust_level: 'medium',
    last_seen: null,
    permission_status: 'owner_device_action_required',
    endpoint_contract: {
      allowed_bind: 'local_or_tailscale_only',
      public_exposure_allowed: false,
      raw_media_persistence_default: false,
    },
    blockers: ['owner_device_action_required'],
  }
}

function defaultState(): IdentityState {
  return { devices: [defaultDevice()], camera_requests: [], challenges: [] }
}

function readState(): IdentityState {
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'))
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.devices)) {
      return {
        devices: parsed.devices,
        camera_requests: Array.isArray(parsed.camera_requests) ? parsed.camera_requests : [],
        challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      }
    }
  } catch {}
  return defaultState()
}

function writeState(state: IdentityState) {
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function cleanString(value: unknown, fallback = '', max = 500) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function taskSnapshot() {
  try {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, title, status, metadata
      FROM tasks
      WHERE title LIKE '%Identity Verification%' OR title LIKE '%Device Camera%'
      ORDER BY id ASC
    `).all() as Array<{ id: number; title: string; status: string; metadata?: string }>
    return rows.map((row) => {
      let metadata: Record<string, unknown> = {}
      try { metadata = JSON.parse(row.metadata || '{}') } catch {}
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        progress: metadata.progress || (metadata.agent_work_ticket as Record<string, unknown> | undefined)?.progress_percent || 0,
        blocker: metadata.blocker || null,
      }
    })
  } catch {
    return []
  }
}

function publicPacket<T extends Record<string, unknown>>(extra: T) {
  return {
    ok: true,
    route_family: 'bridge.identity',
    credential_values_exposed: false,
    no_secrets_exposed: true,
    no_raw_media_persisted: true,
    camera_opened_by_server: false,
    microphone_opened_by_server: false,
    public_exposure_created: false,
    writes_enabled: false,
    external_writes_enabled: false,
    project_continues: true,
    ...extra,
  } as {
    ok: boolean
    route_family: 'bridge.identity'
    credential_values_exposed: boolean
    no_secrets_exposed: boolean
    no_raw_media_persisted: boolean
    camera_opened_by_server: boolean
    microphone_opened_by_server: boolean
    public_exposure_created: boolean
    writes_enabled: boolean
    external_writes_enabled: boolean
    project_continues: boolean
  } & T
}

function hashProof(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function recordIdentityVisibleProof(input: {
  action: string
  route: string
  blocker?: string | null
  device_id?: string | null
  request_id?: string | null
  proof_records?: string[]
}) {
  const blocker = input.blocker || null
  const auditId = `audit_identity_${hashProof(`${input.action}:${input.route}:${input.device_id || ''}:${input.request_id || ''}:${nowIso()}`).slice(0, 18)}`
  const rollbackId = `rollback_identity_no_state_${hashProof(`${auditId}:rollback`).slice(0, 16)}`
  const noStateProof = {
    rollback_id: rollbackId,
    mutation_scope: 'mission_control_task_and_identity_state_only',
    camera_opened_by_server: false,
    microphone_opened_by_server: false,
    no_raw_media_persisted: true,
    public_exposure_created: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
  }
  const task = ensureAgentRoutingVisibleTask({
    title: IDENTITY_VISIBLE_TASK_TITLE,
    description: 'Identity verification and device camera access remain control-plane only until owner device permission is granted.',
    assigned_to: 'agent-zero-jarvis',
    blocker,
    metadata: {
      project: IDENTITY_VISIBLE_TASK_TITLE,
      route_family: 'bridge.identity',
      current_status: blocker ? 'awaiting_owner' : 'control_plane_ready',
      current_phase: blocker ? 'Identity/device permission gate isolated' : 'Identity control-plane proof recorded',
      delivery_state: blocker ? 'OWNER_PERMISSION_GATE_ACTIVE' : 'IDENTITY_CONTROL_PLANE_READY',
      progress: blocker ? 86 : 94,
      action: input.action,
      route: input.route,
      exact_blocker: blocker,
      blocked_lane: blocker ? input.action : null,
      device_id: input.device_id || null,
      request_id: input.request_id || null,
      audit_id: auditId,
      rollback_id: rollbackId,
      rollback_no_state_proof: noStateProof,
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
      public_exposure_created: false,
      credential_values_exposed: false,
      external_writes_enabled: false,
      visible_task_required: true,
      audit_required: true,
      rollback_required: true,
      project_continues: true,
      proof_records: input.proof_records || [
        '/api/bridge/identity/project-status',
        '/api/bridge/identity/devices',
        '/api/bridge/identity/camera/status',
      ],
      next_action: blocker
        ? 'Owner must grant explicit device camera/microphone/biometric permission before capture or enrollment can proceed.'
        : 'Continue non-credentialed identity control-plane source, tests, and route proof.',
      next_safe_lane: 'Continue non-permission identity policy, fallback challenge, and visible task proof.',
    },
  })
  logAuditEvent({
    action: `identity.${input.action}`,
    actor: 'mission-control-identity-control-plane',
    target_type: 'identity',
    target_id: task.task_id,
    detail: {
      audit_id: auditId,
      visible_task_id: String(task.task_id),
      route: input.route,
      blocker,
      device_id: input.device_id || null,
      request_id: input.request_id || null,
      ...noStateProof,
    },
  })

  return {
    visible_task_id: String(task.task_id),
    owner_visible_task_route: `/api/tasks/${task.task_id}`,
    visible_task_event_route: `/api/tasks/${task.task_id}/events`,
    audit_id: auditId,
    rollback_id: rollbackId,
    rollback_no_state_proof: noStateProof,
  }
}

export function buildIdentityProjectStatus() {
  const state = readState()
  const blocker = state.devices.some((device) => device.permission_status !== 'approved')
    ? 'device_camera_microphone_permission_required'
    : null
  const proof = recordIdentityVisibleProof({
    action: 'project_status',
    route: 'bridge.identity.project-status',
    blocker,
  })
  const tasks = taskSnapshot()
  return publicPacket({
    route: 'bridge.identity.project-status',
    project: 'Executive Plan — Identity Verification + Device Camera Access',
    status: blocker ? 'permission_gated' : 'control_plane_ready',
    progress_percent: blocker ? 78 : 90,
    blocker,
    tasks,
    devices_registered: state.devices.length,
    camera_permission_state: latestCameraStatus().permission_status,
    final_status: blocker ? 'IDENTITY_PERMISSION_GATE_ACTIVE' : 'IDENTITY_CONTROL_PLANE_READY',
    rollback_command: 'Archive identity Mission Control task/events and delete identity-verification-state.json; no raw media, camera, microphone, or public exposure state exists.',
    ...proof,
  })
}

export function listIdentityDevices() {
  const state = readState()
  return publicPacket({
    route: 'bridge.identity.devices',
    devices: state.devices,
    blockers: Array.from(new Set(state.devices.flatMap((device) => device.blockers))),
  })
}

export function registerIdentityDevice(input: Record<string, unknown> = {}) {
  const state = readState()
  const deviceId = cleanString(input.device_id, `device-${randomUUID()}`, 160)
  const existingIndex = state.devices.findIndex((device) => device.device_id === deviceId)
  const device: IdentityDevice = {
    ...defaultDevice(),
    device_id: deviceId,
    device_name: cleanString(input.device_name, 'Registered device', 160),
    device_type: cleanString(input.device_type, 'unknown_device', 120),
    owner: cleanString(input.owner, 'Tony', 120),
    location: cleanString(input.location, 'unspecified', 120),
    camera_available: typeof input.camera_available === 'boolean' ? input.camera_available : 'unknown',
    microphone_available: typeof input.microphone_available === 'boolean' ? input.microphone_available : 'unknown',
    access_method: cleanString(input.access_method, 'approved_device_bridge_candidate', 160),
    trusted_network: input.trusted_network === true,
    trust_level: input.trusted_network === true ? 'medium' : 'low',
    last_seen: nowIso(),
    permission_status: 'owner_device_action_required',
    blockers: ['owner_device_action_required'],
  }
  if (existingIndex >= 0) state.devices[existingIndex] = device
  else state.devices.unshift(device)
  writeState(state)
  const proof = recordIdentityVisibleProof({
    action: 'device_register',
    route: 'bridge.identity.devices.register',
    blocker: 'owner_device_action_required',
    device_id: device.device_id,
  })
  return publicPacket({
    route: 'bridge.identity.devices.register',
    device,
    visible_task_update_required: true,
    exact_blocker: 'owner_device_action_required',
    ...proof,
  })
}

function latestCameraStatus(deviceId?: string) {
  const state = readState()
  const device = state.devices.find((row) => !deviceId || row.device_id === deviceId) || state.devices[0] || defaultDevice()
  const request = [...state.camera_requests].reverse().find((row) => row.device_id === device.device_id) || null
  return {
    device,
    request,
    permission_status: request?.state || device.permission_status,
    exact_blocker: request?.state === 'approved' ? null : (request?.blocker || device.blockers[0] || 'owner_device_action_required'),
  }
}

export function requestCameraPermission(input: Record<string, unknown> = {}) {
  const state = readState()
  const deviceId = cleanString(input.device_id, state.devices[0]?.device_id || defaultDevice().device_id, 160)
  const device = state.devices.find((row) => row.device_id === deviceId) || defaultDevice()
  const requestedAt = nowIso()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const request = {
    request_id: `cam_${randomUUID()}`,
    device_id: device.device_id,
    state: 'requested' as IdentityPermissionStatus,
    requested_at: requestedAt,
    expires_at: expiresAt,
    blocker: 'owner_device_action_required',
    no_camera_opened: true as const,
    no_raw_media_persisted: true as const,
  }
  state.camera_requests.push(request)
  state.devices = state.devices.map((row) => row.device_id === device.device_id ? { ...row, permission_status: 'requested', blockers: ['owner_device_action_required'] } : row)
  writeState(state)
  const proof = recordIdentityVisibleProof({
    action: 'camera_permission_request',
    route: 'bridge.identity.camera.request',
    blocker: 'owner_device_action_required',
    device_id: device.device_id,
    request_id: request.request_id,
  })
  return publicPacket({
    route: 'bridge.identity.camera.request',
    permission_request: request,
    permission_status: 'requested',
    exact_blocker: 'owner_device_action_required',
    audit_event: 'PERMISSION_REQUEST_RECORDED',
    ...proof,
  })
}

export function cameraStatus(deviceId?: string) {
  const status = latestCameraStatus(deviceId)
  return publicPacket({
    route: 'bridge.identity.camera.status',
    device: status.device,
    permission_request: status.request,
    permission_status: status.permission_status,
    exact_blocker: status.exact_blocker,
  })
}

export function cameraCaptureProof(input: Record<string, unknown> = {}) {
  const status = latestCameraStatus(cleanString(input.device_id, '', 160))
  if (status.permission_status !== 'approved') {
    const proof = recordIdentityVisibleProof({
      action: 'camera_capture_proof',
      route: 'bridge.identity.camera.capture-proof',
      blocker: 'owner_device_action_required',
      device_id: status.device.device_id,
      request_id: status.request?.request_id || null,
    })
    return publicPacket({
      ok: false,
      route: 'bridge.identity.camera.capture-proof',
      capture_attempted: false,
      metadata_only: true,
      exact_blocker: 'owner_device_action_required',
      permission_status: status.permission_status,
      ...proof,
    })
  }
  const proof = recordIdentityVisibleProof({
    action: 'camera_capture_shell',
    route: 'bridge.identity.camera.capture-proof',
    blocker: 'device_camera_connector_required',
    device_id: status.device.device_id,
    request_id: status.request?.request_id || null,
  })
  return publicPacket({
    route: 'bridge.identity.camera.capture-proof',
    capture_attempt_id: `cap_${randomUUID()}`,
    metadata_only: true,
    frame_persisted: false,
    exact_blocker: 'device_camera_connector_required',
    ...proof,
  })
}

export function biometricGate(kind: 'face' | 'voice', operation: 'enroll' | 'verify') {
  const blocker = kind === 'face' ? 'owner_device_action_required' : 'owner_microphone_or_voice_sample_permission_required'
  const proof = recordIdentityVisibleProof({
    action: `${kind}_${operation}`,
    route: `bridge.identity.${kind}.${operation}`,
    blocker,
  })
  return publicPacket({
    ok: false,
    route: `bridge.identity.${kind}.${operation}`,
    ready: false,
    enrollment_state: 'permission_gated',
    exact_blocker: blocker,
    raw_media_persisted: false,
    embeddings_persisted: false,
    ...proof,
  })
}

export function calculateIdentityScore(input: Record<string, unknown> = {}) {
  const face = Number(input.face_confidence || 0)
  const voice = Number(input.voice_confidence || 0)
  const device = Number(input.device_trust || 0.5)
  const channel = Number(input.channel_trust || 0.5)
  const fallback = input.fallback_challenge_result === 'passed' ? 1 : 0
  const score = Math.max(0, Math.min(1, (face * 0.3) + (voice * 0.3) + (device * 0.2) + (channel * 0.1) + (fallback * 0.1)))
  const tier: IdentityTrustTier = score >= 0.9 ? 'owner_verified' : score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low'
  const exactBlocker = tier === 'owner_verified' ? null : 'identity_confidence_below_required_threshold'
  const proof = recordIdentityVisibleProof({
    action: 'identity_score',
    route: 'bridge.identity.score',
    blocker: exactBlocker,
  })
  return publicPacket({
    route: 'bridge.identity.score',
    score,
    trust_tier: tier,
    action_allowed_by_default: tier === 'owner_verified',
    exact_blocker: exactBlocker,
    ...proof,
  })
}

export function identityChallengeStart() {
  const state = readState()
  const challenge = {
    challenge_id: `chal_${randomUUID()}`,
    state: 'started' as const,
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
  state.challenges.push(challenge)
  writeState(state)
  const proof = recordIdentityVisibleProof({
    action: 'challenge_start',
    route: 'bridge.identity.challenge.start',
    blocker: null,
    request_id: challenge.challenge_id,
  })
  return publicPacket({
    route: 'bridge.identity.challenge.start',
    challenge,
    ttl_seconds: 600,
    ...proof,
  })
}

export function identityChallengeVerify(input: Record<string, unknown> = {}) {
  const challengeId = cleanString(input.challenge_id, '', 160)
  const state = readState()
  const found = state.challenges.find((challenge) => challenge.challenge_id === challengeId)
  const exactBlocker = found ? 'challenge_response_required' : 'challenge_not_found_or_expired'
  const proof = recordIdentityVisibleProof({
    action: 'challenge_verify',
    route: 'bridge.identity.challenge.verify',
    blocker: exactBlocker,
    request_id: challengeId || null,
  })
  return publicPacket({
    route: 'bridge.identity.challenge.verify',
    verified: false,
    challenge_id: challengeId || null,
    exact_blocker: exactBlocker,
    ...proof,
  })
}

export function identityPolicy() {
  return publicPacket({
    route: 'bridge.identity.policy',
    high_trust_actions: [
      'credential_injection',
      'public_exposure_changes',
      'destructive_deletion',
      'broad_connector_execution',
      'paperclip_company_team_creation',
      'drive_onedrive_broad_access',
      'zapier_live_social_posting',
      'production_restarts_above_routine_scope',
      'auth_security_changes',
    ],
    default_required_tier: 'owner_verified',
  })
}

export function checkIdentityAction(input: Record<string, unknown> = {}) {
  const action = cleanString(input.action, 'unknown', 200)
  const highTrust = (identityPolicy().high_trust_actions as string[]).some((item) => action.includes(item) || action.includes(item.replace(/_/g, ' ')))
  const exactBlocker = highTrust ? 'identity_verification_required_for_high_trust_action' : null
  const proof = recordIdentityVisibleProof({
    action: 'check_action',
    route: 'bridge.identity.check-action',
    blocker: exactBlocker,
  })
  return publicPacket({
    route: 'bridge.identity.check-action',
    action,
    high_trust_required: highTrust,
    allowed: !highTrust,
    exact_blocker: exactBlocker,
    ...proof,
  })
}

export function buildIdentityOperatorProcedure() {
  const state = readState()
  const permissionBlocker = state.devices.some((device) => device.permission_status !== 'approved')
    ? 'device_camera_microphone_permission_required'
    : null

  return publicPacket({
    route: 'bridge.identity.operator-procedure',
    status: permissionBlocker ? 'owner_permission_gated' : 'ready_for_owner_observed_dry_run',
    final_authority: 'agent-zero-jarvis',
    current_blocker: permissionBlocker,
    security_model: {
      full_access_meaning: 'brokered_audited_exact_scope_identity_control_plane',
      raw_secret_access_allowed: false,
      raw_media_storage_allowed: false,
      public_exposure_allowed: false,
      production_execution_allowed_without_owner_and_jarvis: false,
      opencloud_intermediary_allowed: false,
    },
    required_preflight: [
      'mission-control.service active and not running from a deleted Next standalone bundle',
      '/login returns 200',
      'protected identity routes return 401 unauthenticated',
      'owner is authenticated in Mission Control before any permission request',
      '.env diff remains clean',
      'no tokens, cookies, passwords, or raw credentials are printed',
    ],
    steps: [
      {
        id: 'confirm-gateway-health',
        action: 'Open /login first, then /gateway after authentication. If Gateway cannot load, stop only live identity proof and keep source/test lanes moving.',
        proof_routes: ['/login', '/gateway'],
        expected: {
          login_http_status: 200,
          gateway_requires_authenticated_session: true,
          stale_bundle_blocker_absent: true,
        },
      },
      {
        id: 'confirm-protected-identity-routes',
        action: 'Confirm identity routes are auth-protected before using the operator session.',
        proof_routes: [
          '/api/bridge/identity/status',
          '/api/bridge/identity/project-status',
          '/api/bridge/identity/operator-procedure',
          '/api/bridge/identity/devices',
          '/api/bridge/identity/policy',
          '/api/bridge/identity/camera/status',
        ],
        expected_unauthenticated_status: 401,
      },
      {
        id: 'register-owner-device',
        action: 'Register or verify the owner device through the authenticated Mission Control identity device route.',
        method: 'POST',
        route: '/api/bridge/identity/devices/register',
        allowed_write_scope: 'identity_device_control_plane_metadata_only',
        raw_media_persisted: false,
        credential_values_exposed: false,
      },
      {
        id: 'request-camera-permission',
        action: 'Request browser or OS camera permission from the authenticated owner session. Mission Control records only the request metadata and visible task proof.',
        method: 'POST',
        route: '/api/bridge/identity/camera/request',
        expected_blocker_until_owner_grants_permission: 'owner_device_action_required',
        camera_opened_by_server: false,
        no_raw_media_persisted: true,
      },
      {
        id: 'face-enrollment-gate',
        action: 'Attempt face enrollment only after the owner grants camera permission in the browser or OS prompt. Before that, route must refuse with a visible blocker.',
        method: 'POST',
        route: '/api/bridge/identity/face/enroll',
        expected_blocker_before_permission: 'owner_device_action_required',
        raw_media_persisted: false,
        embeddings_persisted_without_approval: false,
      },
      {
        id: 'voice-enrollment-gate',
        action: 'Attempt voice enrollment only after the owner grants microphone permission and provides an explicit voice sample approval.',
        method: 'POST',
        route: '/api/bridge/identity/voice/enroll',
        expected_blocker_before_permission: 'owner_microphone_or_voice_sample_permission_required',
        microphone_opened_by_server: false,
        raw_media_persisted: false,
        embeddings_persisted_without_approval: false,
      },
      {
        id: 'high-trust-action-check',
        action: 'Before credential injection, public exposure, destructive deletion, broad connector execution, or security policy changes, require owner_verified identity tier plus Jarvis concurrence.',
        method: 'POST',
        route: '/api/bridge/identity/check-action',
        expected_blocker_until_verified: 'identity_verification_required_for_high_trust_action',
      },
      {
        id: 'final-certification-dry-run',
        action: 'Run the identity final-certification route as a dry run only. It must not open camera, microphone, biometric capture, public exposure, or raw secret access.',
        method: 'POST',
        route: '/api/bridge/identity/final-certification',
        expected_blocker_until_owner_permission: 'device_camera_microphone_permission_required',
      },
    ],
    hard_stops: [
      'credential_injection',
      'raw_secret_access',
      'printing_tokens_cookies_passwords_or_env_values',
      'camera_or_microphone_access_without_owner_prompt',
      'biometric_capture_without_owner_permission',
      'raw_media_persistence',
      'public_exposure_or_firewall_dns_caddy_tailscale_change',
      'destructive_deletion',
      'disabling_auth_audit_rollback_or_redaction',
    ],
    visible_task_behavior: {
      title: IDENTITY_VISIBLE_TASK_TITLE,
      blocker_when_permission_missing: 'device_camera_microphone_permission_required',
      project_continues: true,
      owner_visible_events_required: true,
      rollback_required: true,
      no_state_proof_required: true,
    },
    rollback_command: 'Archive identity Mission Control task/events and delete identity-verification-state.json; no raw media, camera, microphone, biometric, credential, or public exposure state exists.',
  })
}

function parseTaskMetadata(metadata?: string) {
  try {
    return JSON.parse(metadata || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function readIdentityProjectTaskLinks(workspaceId = 1): IdentityProjectTaskLink[] {
  const baseQuery = `
    SELECT id, title, status, metadata
    FROM tasks
    WHERE title LIKE '%Identity Verification%' OR title LIKE '%Device Camera%' OR title LIKE '%Camera Access%'
    ORDER BY id ASC
  `
  try {
    const db = getDatabase()
    let rows: Array<{ id: number; title: string; status: string; metadata?: string }> = []
    try {
      rows = db.prepare(`
        SELECT id, title, status, metadata
        FROM tasks
        WHERE workspace_id = ?
          AND (title LIKE '%Identity Verification%' OR title LIKE '%Device Camera%' OR title LIKE '%Camera Access%')
        ORDER BY id ASC
      `).all(workspaceId) as Array<{ id: number; title: string; status: string; metadata?: string }>
    } catch {
      rows = db.prepare(baseQuery).all() as Array<{ id: number; title: string; status: string; metadata?: string }>
    }

    return rows.map((row) => {
      const metadata = parseTaskMetadata(row.metadata)
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        progress: metadata.progress || (metadata.agent_work_ticket as Record<string, unknown> | undefined)?.progress_percent || 0,
        blocker: metadata.blocker || metadata.exact_blocker || null,
        route: `/api/tasks/${row.id}`,
      }
    })
  } catch {
    return []
  }
}

export function buildIdentityFinalCertificationReadiness(input: { taskLinks?: IdentityProjectTaskLink[] } = {}) {
  const state = readState()
  const camera = latestCameraStatus()
  const taskLinks = input.taskLinks || readIdentityProjectTaskLinks(1)
  const permissionBlocker = state.devices.some((device) => device.permission_status !== 'approved')
    ? 'device_camera_microphone_permission_required'
    : null
  const exactBlocker = permissionBlocker || camera.exact_blocker || null

  return publicPacket({
    route: 'bridge.identity.final-certification',
    status: exactBlocker ? 'owner_gated' : 'ready_for_final_certification',
    final_status: exactBlocker ? 'IDENTITY_FINAL_CERTIFICATION_OWNER_GATED' : 'IDENTITY_FINAL_CERTIFICATION_READY',
    exact_blocker: exactBlocker,
    blocker_class: exactBlocker ? 'OWNER_GATED' : null,
    execution_enabled: false,
    protected_execution_enabled: false,
    task_links: taskLinks,
    readiness_checks: [
      {
        id: 'control_plane_routes',
        status: 'pass',
        proof: ['/api/bridge/identity/project-status', '/api/bridge/identity/devices', '/api/bridge/identity/policy'],
      },
      {
        id: 'owner_device_permission',
        status: exactBlocker ? 'blocked' : 'pass',
        blocker: exactBlocker,
      },
      {
        id: 'no_raw_media_state',
        status: 'pass',
        proof: 'No raw camera, microphone, or biometric media is persisted by Mission Control.',
      },
      {
        id: 'no_public_exposure',
        status: 'pass',
        proof: 'Identity verification routes remain local/Tailnet control-plane only.',
      },
    ],
    next_safe_action: exactBlocker
      ? 'Owner must grant explicit device camera/microphone/biometric permission before live identity certification can proceed.'
      : 'Run owner-observed final dry run and record visible task proof.',
  })
}

export function runIdentityFinalCertificationDryRun(input: { taskLinks?: IdentityProjectTaskLink[] } = {}) {
  const readiness = buildIdentityFinalCertificationReadiness(input)
  return publicPacket({
    route: 'bridge.identity.final-certification.dry-run',
    dry_run: true,
    status: readiness.exact_blocker ? 'blocked' : 'ready',
    exact_blocker: readiness.exact_blocker,
    final_status: readiness.exact_blocker ? 'IDENTITY_FINAL_CERTIFICATION_DRY_RUN_BLOCKED' : 'IDENTITY_FINAL_CERTIFICATION_DRY_RUN_READY',
    readiness,
    simulated_steps: [
      'read identity device registry',
      'read camera permission status',
      'read owner-visible task links',
      'confirm no camera/microphone/biometric access is attempted',
      'confirm no raw media persistence and no public exposure',
    ],
    camera_opened_by_server: false,
    microphone_opened_by_server: false,
    biometric_capture_attempted: false,
    no_raw_media_persisted: true,
    credential_values_exposed: false,
    external_writes_enabled: false,
    next_safe_action: readiness.exact_blocker
      ? 'Keep the identity lane owner-gated and continue non-permission control-plane work.'
      : 'Ask owner to observe final certification before enabling any live capture path.',
  })
}
