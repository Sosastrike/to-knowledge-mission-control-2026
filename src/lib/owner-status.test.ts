import { describe, expect, it } from 'vitest'
import { describeOwnerFacingStatus, OWNER_FACING_STATUS_STATES, ownerSafeStatusText } from './owner-status'

describe('owner-facing status contract', () => {
  it('defines the locked canonical owner status vocabulary', () => {
    expect(OWNER_FACING_STATUS_STATES).toEqual([
      'LIVE',
      'READY',
      'OWNER_GATED',
      'CREDENTIAL_GATED',
      'SERVICE_DOWN',
      'BLOCKED',
      'DISABLED',
    ])
  })

  it('maps runtime and connector blockers to exact owner-facing states', () => {
    expect(describeOwnerFacingStatus({
      rawStatus: 'read_only',
      readEnabled: true,
      blockers: ['firecrawl_credential_required'],
      preferReadyWhenReadable: true,
    })).toMatchObject({
      status: 'READY',
      tone: 'blue',
      can_read: true,
      can_execute: false,
      blocker_class: 'NONE',
    })

    expect(describeOwnerFacingStatus({
      rawStatus: 'credential_required',
      credentialNames: ['FIRECRAWL_API_KEY'],
      blockers: ['firecrawl_credential_required'],
    })).toMatchObject({
      status: 'CREDENTIAL_GATED',
      tone: 'yellow',
      blocker_class: 'CREDENTIAL_GATED',
    })

    expect(describeOwnerFacingStatus({
      rawStatus: 'blocked',
      blockers: ['openclaw_doctor_runtime_not_reachable'],
    })).toMatchObject({
      status: 'SERVICE_DOWN',
      tone: 'red',
      blocker_class: 'SERVICE_DOWN',
    })

    expect(describeOwnerFacingStatus({
      rawStatus: 'owner_approval_required',
      requiresOwnerApproval: true,
      requiresBridgeSession: true,
    })).toMatchObject({
      status: 'OWNER_GATED',
      tone: 'yellow',
      bridge_session_required: true,
    })
  })

  it('redacts owner-unsafe status reasons', () => {
    const ownerPath = '/Users/' + 'owner/private/auth.json'
    const bearer = 'Bearer ' + 'abc.def_1234567890123456'
    const fakeSecret = 'sk-' + '1234567890123456'
    expect(ownerSafeStatusText(`failed at ${ownerPath} with ${bearer} and ${fakeSecret}`)).toBe(
      'failed at [redacted-path] with Bearer [redacted] and [redacted-secret]',
    )
  })
})
