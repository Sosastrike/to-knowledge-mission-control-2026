import { describe, expect, it } from 'vitest'

import { sanitizeBridgeProviderPayload } from './bridge-provider-sanitizer'

describe('sanitizeBridgeProviderPayload', () => {
  it('redacts raw local paths without hiding literal service names or credential labels', () => {
    const sanitized = sanitizeBridgeProviderPayload({
      detail: {
        endpoint: '/home/tony/example/runtime.sock',
        notes: 'Build-Wiki uses opencloud-docs-farmer.service as a literal legacy systemd unit.',
        credential_name: 'OPENAI_API_KEY',
      },
    })

    expect(JSON.stringify(sanitized)).not.toContain('/home/tony')
    expect(JSON.stringify(sanitized)).toContain('<redacted-path>')
    expect(JSON.stringify(sanitized)).toContain('opencloud-docs-farmer.service')
    expect(JSON.stringify(sanitized)).toContain('OPENAI_API_KEY')
  })

  it('redacts sensitive string fields', () => {
    const sanitized = sanitizeBridgeProviderPayload({
      nested: { api_key: 'placeholder-to-redact' },
    })

    expect(JSON.stringify(sanitized)).not.toContain('placeholder-to-redact')
    expect(JSON.stringify(sanitized)).toContain('<redacted-secret>')
  })
})
