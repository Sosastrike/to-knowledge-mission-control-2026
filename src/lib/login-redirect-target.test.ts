import { describe, expect, it } from 'vitest'

import { getPostLoginTarget } from './login-redirect-target'

describe('getPostLoginTarget', () => {
  it('returns the Brain Sync page when login carries the brain-sync page hint', () => {
    expect(getPostLoginTarget('?page=brain-sync')).toBe(
      '/designer-mission-control/Mission%20Control.html?page=brain-sync',
    )
  })

  it('returns the focused Gbrain Sync page when login carries the gbrain-sync page hint', () => {
    expect(getPostLoginTarget('?page=gbrain-sync')).toBe(
      '/designer-mission-control/Mission%20Control.html?page=gbrain-sync',
    )
  })

  it('returns safe internal next paths for protected-route login redirects', () => {
    expect(getPostLoginTarget('?next=%2Fgateway%2Fagent-hub%2Fagent-zero%2Fchat')).toBe(
      '/gateway/agent-hub/agent-zero/chat',
    )
    expect(
      getPostLoginTarget('?next=%2Fdesigner-mission-control%2FMission%2520Control.html%3Fpage%3Dgbrain-sync'),
    ).toBe('/designer-mission-control/Mission%20Control.html?page=gbrain-sync')
  })

  it('refuses external, API, login, and setup redirect targets', () => {
    const fallback = '/designer-mission-control/Mission%20Control.html?page=mission'

    expect(getPostLoginTarget('?next=https%3A%2F%2Fevil.example')).toBe(fallback)
    expect(getPostLoginTarget('?next=%2F%2Fevil.example%2Fpath')).toBe(fallback)
    expect(getPostLoginTarget('?next=%2Fapi%2Fbridge%2Fgbrain%2Fstatus')).toBe(fallback)
    expect(getPostLoginTarget('?next=%2Flogin')).toBe(fallback)
    expect(getPostLoginTarget('?next=%2Fsetup')).toBe(fallback)
  })
})
