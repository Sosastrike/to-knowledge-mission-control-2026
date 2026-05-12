import { describe, expect, it } from 'vitest'
import {
  MONITORING_FAILURE_STATE_KINDS,
  buildMonitoringFailureStatePayload,
  mapToolErrorToOwnerStatus,
} from './monitoring-failure-states'
import { TOOL_ERROR_KINDS } from './tool-error-classifier'

describe('monitoring failure states', () => {
  it('exposes every approved owner-facing tool blocker without inventing new states', () => {
    const payload = buildMonitoringFailureStatePayload({
      checkedAt: '2026-05-11T20:00:00.000Z',
      runtimeHealth: {
        ok: true,
        status: 'LIVE',
        source_commit: 'abc1234',
        source_branch: 'to-knowledge-mc',
        blockers: [],
        deployment: {
          rollback_command: 'git revert <monitoring-failure-states-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
        },
      },
    })

    expect(MONITORING_FAILURE_STATE_KINDS).toEqual(TOOL_ERROR_KINDS)
    expect(payload.failure_state_catalog.map((entry) => entry.kind)).toEqual(TOOL_ERROR_KINDS)
    expect(payload.allowed_owner_statuses).toEqual([
      'LIVE',
      'READY',
      'OWNER_GATED',
      'CREDENTIAL_GATED',
      'SERVICE_DOWN',
      'BLOCKED',
      'DISABLED',
    ])
  })

  it('maps failure classes into the canonical Mission Control status language', () => {
    expect(mapToolErrorToOwnerStatus('OWNER_GATED').status).toBe('OWNER_GATED')
    expect(mapToolErrorToOwnerStatus('AUTH_REQUIRED').status).toBe('OWNER_GATED')
    expect(mapToolErrorToOwnerStatus('CREDENTIAL_GATED').status).toBe('CREDENTIAL_GATED')
    expect(mapToolErrorToOwnerStatus('SERVICE_DOWN').status).toBe('SERVICE_DOWN')
    expect(mapToolErrorToOwnerStatus('BACKEND_MISSING').status).toBe('BLOCKED')
    expect(mapToolErrorToOwnerStatus('ROUTE_MISSING').status).toBe('BLOCKED')
    expect(mapToolErrorToOwnerStatus('EXECUTION_DISABLED').status).toBe('DISABLED')
    expect(mapToolErrorToOwnerStatus('WRITE_DISABLED').status).toBe('DISABLED')
    expect(mapToolErrorToOwnerStatus('EXTERNAL_WRITE_DISABLED').status).toBe('DISABLED')
    expect(mapToolErrorToOwnerStatus('UNKNOWN').status).toBe('BLOCKED')
  })

  it('reports runtime service-down truth from the injected runtime health payload', () => {
    const payload = buildMonitoringFailureStatePayload({
      checkedAt: '2026-05-11T20:00:00.000Z',
      runtimeHealth: {
        ok: false,
        status: 'SERVICE_DOWN',
        source_commit: 'abc1234',
        source_branch: 'to-knowledge-mc',
        blockers: ['runtime_listener_missing'],
        deployment: {
          rollback_command: 'git revert <monitoring-failure-states-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
        },
      },
    })

    expect(payload.runtime.status).toBe('SERVICE_DOWN')
    expect(payload.runtime.blockers).toEqual(['runtime_listener_missing'])
    expect(payload.surfaces.find((surface) => surface.id === 'mission-control-runtime')).toMatchObject({
      owner_status: {
        status: 'SERVICE_DOWN',
        blocker_class: 'SERVICE_DOWN',
      },
      failure_state: {
        kind: 'SERVICE_DOWN',
      },
    })
  })

  it('keeps protected agent and connector surfaces honest instead of marking them fake LIVE', () => {
    const payload = buildMonitoringFailureStatePayload({
      checkedAt: '2026-05-11T20:00:00.000Z',
      runtimeHealth: {
        ok: true,
        status: 'LIVE',
        source_commit: 'abc1234',
        source_branch: 'to-knowledge-mc',
        blockers: [],
        deployment: {
          rollback_command: 'git revert <monitoring-failure-states-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
        },
      },
    })

    expect(payload.surfaces.find((surface) => surface.id === 'agent-zero')).toMatchObject({
      route: '/api/bridge/agent-zero/status',
      owner_status: {
        status: 'OWNER_GATED',
      },
      failure_state: {
        kind: 'AUTH_REQUIRED',
      },
    })
    expect(payload.surfaces.find((surface) => surface.id === 'telegram-delivery')).toMatchObject({
      owner_status: {
        status: 'OWNER_GATED',
      },
      failure_state: {
        kind: 'OWNER_GATED',
      },
    })
    expect(payload.surfaces.find((surface) => surface.id === 'paperclip')).toMatchObject({
      owner_status: {
        status: 'SERVICE_DOWN',
      },
      failure_state: {
        kind: 'SERVICE_DOWN',
      },
    })
    expect(payload.surfaces.find((surface) => surface.id === 'google-drive')).toMatchObject({
      owner_status: {
        status: 'CREDENTIAL_GATED',
      },
      failure_state: {
        kind: 'CREDENTIAL_GATED',
      },
    })
  })

  it('redacts secret-like values, auth files, private hosts, and raw local paths', () => {
    const rawUserPath = ['/Users', 'sosastrike'].join('/')
    const authFile = ['auth', 'json'].join('.')
    const bearer = ['Bearer', 'abcdefghijklmnop'].join(' ')
    const secret = ['sk', '12345678901234567890'].join('-')
    const payload = buildMonitoringFailureStatePayload({
      checkedAt: '2026-05-11T20:00:00.000Z',
      runtimeHealth: {
        ok: false,
        status: 'SERVICE_DOWN',
        source_commit: 'abc1234',
        source_branch: 'to-knowledge-mc',
        blockers: [`service down at ${rawUserPath}/private/${authFile} with ${bearer} and ${secret}`],
        deployment: {
          rollback_command: 'git revert <monitoring-failure-states-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
        },
      },
    })

    const text = JSON.stringify(payload)
    expect(text).not.toContain(rawUserPath)
    expect(text).not.toContain('/home/')
    expect(text).not.toContain(authFile)
    expect(text).not.toContain(bearer)
    expect(text).not.toContain(secret)
  })
})
