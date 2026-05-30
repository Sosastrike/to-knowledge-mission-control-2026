import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { config } from '@/lib/config'
import {
  biometricGate,
  buildIdentityOperatorProcedure,
  buildIdentityProjectStatus,
  calculateIdentityScore,
  cameraCaptureProof,
  cameraStatus,
  checkIdentityAction,
  identityPolicy,
  identityChallengeStart,
  listIdentityDevices,
  requestCameraPermission,
} from '@/lib/identity-verification'
import { getDatabase } from '@/lib/db'

describe('identity verification control plane', () => {
  beforeEach(() => {
    rmSync(join(config.dataDir, 'identity-verification-state.json'), { force: true })
  })

  it('returns project status and permission-gated Mac Studio candidate without raw media', () => {
    const status = buildIdentityProjectStatus()
    expect(status).toMatchObject({
      route: 'bridge.identity.project-status',
      credential_values_exposed: false,
      no_secrets_exposed: true,
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
      project_continues: true,
    })
    expect(listIdentityDevices().devices[0]).toMatchObject({
      device_name: 'Mac Studio',
      trusted_network: true,
      permission_status: 'owner_device_action_required',
    })
  })

  it('records camera permission requests without opening camera or persisting media', () => {
    const requested = requestCameraPermission({})
    expect(requested).toMatchObject({
      route: 'bridge.identity.camera.request',
      permission_status: 'requested',
      exact_blocker: 'owner_device_action_required',
      camera_opened_by_server: false,
      no_raw_media_persisted: true,
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      visible_task_event_route: expect.stringMatching(/^\/api\/tasks\/\d+\/events$/),
      audit_id: expect.stringMatching(/^audit_identity_/),
      rollback_id: expect.stringMatching(/^rollback_identity_no_state_/),
      rollback_no_state_proof: {
        no_raw_media_persisted: true,
        camera_opened_by_server: false,
        microphone_opened_by_server: false,
        public_exposure_created: false,
      },
    })
    expect(requested.visible_task_id).toMatch(/^\d+$/)
    const task = getDatabase().prepare('SELECT title, status, metadata FROM tasks WHERE id = ?').get(Number(requested.visible_task_id)) as { title: string; status: string; metadata: string } | undefined
    expect(task).toMatchObject({
      title: 'Identity Verification + Device Camera Access',
      status: 'awaiting_owner',
    })
    const metadata = JSON.parse(task?.metadata || '{}') as Record<string, unknown>
    expect(metadata).toMatchObject({
      project: 'Identity Verification + Device Camera Access',
      exact_blocker: 'owner_device_action_required',
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      project_continues: true,
    })
    expect(cameraStatus()).toMatchObject({
      route: 'bridge.identity.camera.status',
      permission_status: 'requested',
      exact_blocker: 'owner_device_action_required',
    })
  })

  it('blocks capture, face enrollment, and voice enrollment until owner/device permission exists', () => {
    expect(cameraCaptureProof({})).toMatchObject({
      ok: false,
      capture_attempted: false,
      exact_blocker: 'owner_device_action_required',
      visible_task_id: expect.stringMatching(/^\d+$/),
      audit_id: expect.stringMatching(/^audit_identity_/),
      rollback_no_state_proof: {
        no_raw_media_persisted: true,
        camera_opened_by_server: false,
      },
    })
    expect(biometricGate('face', 'enroll')).toMatchObject({ ok: false, exact_blocker: 'owner_device_action_required' })
    expect(biometricGate('voice', 'enroll')).toMatchObject({ ok: false, exact_blocker: 'owner_microphone_or_voice_sample_permission_required' })
  })

  it('calculates trust tiers and protects high-trust actions', () => {
    expect(calculateIdentityScore({
      face_confidence: 0.95,
      voice_confidence: 0.95,
      device_trust: 1,
      channel_trust: 1,
      fallback_challenge_result: 'passed',
    })).toMatchObject({ trust_tier: 'owner_verified', exact_blocker: null })
    expect(identityPolicy().high_trust_actions).toContain('credential_injection')
    expect(checkIdentityAction({ action: 'credential_injection' })).toMatchObject({
      allowed: false,
      exact_blocker: 'identity_verification_required_for_high_trust_action',
    })
  })

  it('records visible proof for fallback challenge and scoring control-plane routes', () => {
    const challenge = identityChallengeStart()
    expect(challenge).toMatchObject({
      route: 'bridge.identity.challenge.start',
      ttl_seconds: 600,
      visible_task_id: expect.stringMatching(/^\d+$/),
      audit_id: expect.stringMatching(/^audit_identity_/),
      rollback_id: expect.stringMatching(/^rollback_identity_no_state_/),
      rollback_no_state_proof: {
        no_raw_media_persisted: true,
        camera_opened_by_server: false,
        microphone_opened_by_server: false,
      },
    })

    const score = calculateIdentityScore({
      face_confidence: 0.2,
      voice_confidence: 0.2,
      device_trust: 0.5,
      channel_trust: 0.5,
    })
    expect(score).toMatchObject({
      route: 'bridge.identity.score',
      exact_blocker: 'identity_confidence_below_required_threshold',
      visible_task_id: expect.stringMatching(/^\d+$/),
      audit_id: expect.stringMatching(/^audit_identity_/),
      no_raw_media_persisted: true,
    })

    const check = checkIdentityAction({ action: 'credential_injection' })
    expect(check).toMatchObject({
      route: 'bridge.identity.check-action',
      exact_blocker: 'identity_verification_required_for_high_trust_action',
      visible_task_id: expect.stringMatching(/^\d+$/),
      audit_id: expect.stringMatching(/^audit_identity_/),
      no_raw_media_persisted: true,
    })
  })

  it('exposes a concrete face and voice operator procedure without live capture or secrets', () => {
    const procedure = buildIdentityOperatorProcedure()
    expect(procedure).toMatchObject({
      route: 'bridge.identity.operator-procedure',
      status: 'owner_permission_gated',
      credential_values_exposed: false,
      no_secrets_exposed: true,
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
      public_exposure_created: false,
      project_continues: true,
      final_authority: 'agent-zero-jarvis',
      current_blocker: 'device_camera_microphone_permission_required',
    })
    expect(procedure.steps.map((step) => step.id)).toEqual([
      'confirm-gateway-health',
      'confirm-protected-identity-routes',
      'register-owner-device',
      'request-camera-permission',
      'face-enrollment-gate',
      'voice-enrollment-gate',
      'high-trust-action-check',
      'final-certification-dry-run',
    ])
    expect(JSON.stringify(procedure)).toContain('owner_device_action_required')
    expect(JSON.stringify(procedure)).toContain('owner_microphone_or_voice_sample_permission_required')
    expect(JSON.stringify(procedure)).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]|api[_-]?key["':]\s*["'][^"']+/i)
  })
})
