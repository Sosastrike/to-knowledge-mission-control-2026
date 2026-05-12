import { describe, expect, it } from 'vitest'
import { ownerFacingError, ownerFacingErrorText, ownerSafeText } from './owner-facing-error'

describe('owner-facing error copy', () => {
  it('classifies HTTP text and redacts raw detail before UI rendering', () => {
    const classified = ownerFacingError(new Error('HTTP 503 at http://127.0.0.1:9999 with API_KEY=secret-value in /Users/sosastrike/private'))

    expect(classified).toMatchObject({
      kind: 'SERVICE_DOWN',
      owner_message: 'The backing service is unreachable.',
    })
    expect(JSON.stringify(classified)).not.toContain('secret-value')
    expect(JSON.stringify(classified)).not.toContain('127.0.0.1')
    expect(JSON.stringify(classified)).not.toContain('/Users/sosastrike')
  })

  it('returns owner-facing next action text instead of raw exceptions', () => {
    expect(ownerFacingErrorText({ status: 401, body: { error: 'Unauthorized' } })).toBe(
      'AUTH_REQUIRED: Sign-in is required. Next: Owner signs in through Mission Control before retrying.',
    )
  })

  it('redacts arbitrary owner-facing metadata strings', () => {
    const text = ownerSafeText('cwd=/Users/sosastrike/private token=sk-1234567890abcdef auth.json host=127.0.0.1:3000')

    expect(text).toContain('[redacted-user-path]')
    expect(text).toContain('[redacted]')
    expect(text).toContain('[redacted-auth-file]')
    expect(text).toContain('[redacted-host]')
    expect(text).not.toContain('/Users/sosastrike')
    expect(text).not.toContain('sk-1234567890abcdef')
    expect(text).not.toContain('127.0.0.1')
  })
})
