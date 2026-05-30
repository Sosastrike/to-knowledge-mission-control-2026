import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '@/lib/config'
import { GET as getIdentityStatus } from '@/app/api/bridge/identity/status/route'
import { GET as getIdentityProjectStatus } from '@/app/api/bridge/identity/project-status/route'
import { GET as getIdentityOperatorProcedure } from '@/app/api/bridge/identity/operator-procedure/route'
import { GET as getIdentityDevices } from '@/app/api/bridge/identity/devices/route'
import { POST as postIdentityDeviceRegister } from '@/app/api/bridge/identity/devices/register/route'
import { GET as getIdentityPolicy } from '@/app/api/bridge/identity/policy/route'
import { POST as postIdentityCheckAction } from '@/app/api/bridge/identity/check-action/route'
import { POST as postChallengeStart } from '@/app/api/bridge/identity/challenge/start/route'
import { POST as postChallengeVerify } from '@/app/api/bridge/identity/challenge/verify/route'
import { GET as getCameraStatus } from '@/app/api/bridge/identity/camera/status/route'
import { POST as postCameraRequest } from '@/app/api/bridge/identity/camera/request/route'
import { POST as postCameraCaptureProof } from '@/app/api/bridge/identity/camera/capture-proof/route'
import { POST as postFaceEnroll } from '@/app/api/bridge/identity/face/enroll/route'
import { POST as postVoiceEnroll } from '@/app/api/bridge/identity/voice/enroll/route'
import { POST as postScore } from '@/app/api/bridge/identity/score/route'

const requireRoleMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

function request(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(url, init)
}

function post(url: string, body: Record<string, unknown> = {}) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('identity verification protected routes', () => {
  beforeEach(() => {
    requireRoleMock.mockReset()
    rmSync(join(config.dataDir, 'identity-verification-state.json'), { force: true })
  })

  it('returns 401 unauthenticated for read and operator identity routes', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })

    const responses = await Promise.all([
      getIdentityStatus(request('http://localhost/api/bridge/identity/status')),
      getIdentityProjectStatus(request('http://localhost/api/bridge/identity/project-status')),
      getIdentityOperatorProcedure(request('http://localhost/api/bridge/identity/operator-procedure')),
      getIdentityDevices(request('http://localhost/api/bridge/identity/devices')),
      postIdentityDeviceRegister(post('http://localhost/api/bridge/identity/devices/register')),
      getIdentityPolicy(request('http://localhost/api/bridge/identity/policy')),
      postIdentityCheckAction(post('http://localhost/api/bridge/identity/check-action')),
      postChallengeStart(post('http://localhost/api/bridge/identity/challenge/start')),
      postChallengeVerify(post('http://localhost/api/bridge/identity/challenge/verify')),
      getCameraStatus(request('http://localhost/api/bridge/identity/camera/status')),
      postCameraRequest(post('http://localhost/api/bridge/identity/camera/request')),
      postCameraCaptureProof(post('http://localhost/api/bridge/identity/camera/capture-proof')),
      postFaceEnroll(post('http://localhost/api/bridge/identity/face/enroll')),
      postVoiceEnroll(post('http://localhost/api/bridge/identity/voice/enroll')),
      postScore(post('http://localhost/api/bridge/identity/score')),
    ])

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401])
  })

  it('returns no-secret control-plane packets when authenticated without opening camera or microphone', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'operator' } })

    const statusResponse = await getIdentityStatus(request('http://localhost/api/bridge/identity/status'))
    const projectStatusResponse = await getIdentityProjectStatus(request('http://localhost/api/bridge/identity/project-status'))
    const operatorProcedureResponse = await getIdentityOperatorProcedure(request('http://localhost/api/bridge/identity/operator-procedure'))
    const deviceRegisterResponse = await postIdentityDeviceRegister(post('http://localhost/api/bridge/identity/devices/register', {
      device_id: 'owner-device-test',
      device_name: 'Owner test device',
      trusted_network: true,
    }))
    const policyResponse = await getIdentityPolicy(request('http://localhost/api/bridge/identity/policy'))
    const checkActionResponse = await postIdentityCheckAction(post('http://localhost/api/bridge/identity/check-action', { action: 'credential_injection' }))
    const challengeStartResponse = await postChallengeStart(post('http://localhost/api/bridge/identity/challenge/start'))
    const cameraRequestResponse = await postCameraRequest(post('http://localhost/api/bridge/identity/camera/request'))
    const captureResponse = await postCameraCaptureProof(post('http://localhost/api/bridge/identity/camera/capture-proof'))
    const voiceResponse = await postVoiceEnroll(post('http://localhost/api/bridge/identity/voice/enroll'))

    const status = await statusResponse.json()
    const projectStatus = await projectStatusResponse.json()
    const operatorProcedure = await operatorProcedureResponse.json()
    const deviceRegister = await deviceRegisterResponse.json()
    const policy = await policyResponse.json()
    const checkAction = await checkActionResponse.json()
    const challengeStart = await challengeStartResponse.json()
    const cameraRequest = await cameraRequestResponse.json()
    const capture = await captureResponse.json()
    const voice = await voiceResponse.json()
    const serialized = JSON.stringify({ status, projectStatus, operatorProcedure, deviceRegister, policy, checkAction, challengeStart, cameraRequest, capture, voice })

    expect(status).toMatchObject({
      route: 'bridge.identity.project-status',
      status: 'permission_gated',
      credential_values_exposed: false,
      no_secrets_exposed: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
      public_exposure_created: false,
      project_continues: true,
    })
    expect(projectStatus).toMatchObject({
      route: 'bridge.identity.project-status',
      status: 'permission_gated',
      blocker: 'device_camera_microphone_permission_required',
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
    })
    expect(operatorProcedure).toMatchObject({
      route: 'bridge.identity.operator-procedure',
      status: 'owner_permission_gated',
      current_blocker: 'device_camera_microphone_permission_required',
      no_raw_media_persisted: true,
      camera_opened_by_server: false,
      microphone_opened_by_server: false,
      public_exposure_created: false,
    })
    expect(operatorProcedure.steps.map((step: { id: string }) => step.id)).toContain('face-enrollment-gate')
    expect(operatorProcedure.steps.map((step: { id: string }) => step.id)).toContain('voice-enrollment-gate')
    expect(deviceRegister).toMatchObject({
      route: 'bridge.identity.devices.register',
      exact_blocker: 'owner_device_action_required',
      no_secrets_exposed: true,
      no_raw_media_persisted: true,
    })
    expect(policy.high_trust_actions).toContain('credential_injection')
    expect(policy).toMatchObject({ no_secrets_exposed: true, public_exposure_created: false })
    expect(checkAction).toMatchObject({
      allowed: false,
      exact_blocker: 'identity_verification_required_for_high_trust_action',
      no_secrets_exposed: true,
    })
    expect(challengeStart).toMatchObject({
      route: 'bridge.identity.challenge.start',
      ttl_seconds: 600,
      no_raw_media_persisted: true,
    })
    expect(cameraRequest).toMatchObject({
      permission_status: 'requested',
      exact_blocker: 'owner_device_action_required',
      no_raw_media_persisted: true,
    })
    expect(captureResponse.status).toBe(423)
    expect(capture).toMatchObject({
      ok: false,
      capture_attempted: false,
      exact_blocker: 'owner_device_action_required',
      no_raw_media_persisted: true,
    })
    expect(voiceResponse.status).toBe(423)
    expect(voice).toMatchObject({
      ok: false,
      exact_blocker: 'owner_microphone_or_voice_sample_permission_required',
      raw_media_persisted: false,
      embeddings_persisted: false,
    })
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]|api[_-]?key["':]\s*["'][^"']+/i)
  })
})
