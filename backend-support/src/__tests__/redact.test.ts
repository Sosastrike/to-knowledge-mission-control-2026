import { describe, expect, it } from 'vitest'
import { redactObject, redactOrigin, redactString } from '../redact.js'

describe('redactString', () => {
  it('strips obvious bearer tokens', () => {
    const r = redactString('Bearer abcdef1234567890')
    expect(r).toBe('Bearer [redacted]')
    expect(r).not.toContain('abcdef1234567890')
  })

  it('redacts API key style strings', () => {
    const r = redactString('Use sk-abcd1234efgh5678ijkl9012mnopqrst for auth')
    expect(r).not.toContain('sk-abcd1234efgh5678ijkl9012mnopqrst')
    expect(r).toContain('[redacted]')
  })

  it('redacts environment-style assignments', () => {
    const r = redactString('FIRECRAWL_API_KEY=fc-secret-token-1234')
    expect(r).not.toContain('fc-secret-token-1234')
    expect(r).toContain('FIRECRAWL_API_KEY=[redacted]')
  })

  it('redacts /Users/* paths', () => {
    const r = redactString('error in /Users/sosastrike/Documents/New project/foo')
    expect(r).not.toContain('/Users/sosastrike')
    expect(r).toContain('/Users/[redacted]')
  })

  it('redacts /home/* paths', () => {
    const r = redactString('failed to read /home/tony/mission-control/.env')
    expect(r).not.toContain('/home/tony')
    expect(r).toContain('/home/[redacted]')
  })

  it('redacts private hosts', () => {
    expect(redactString('connect to 127.0.0.1:3000')).not.toContain('127.0.0.1')
    expect(redactString('connect to 192.168.1.42')).not.toContain('192.168.1.42')
    expect(redactString('localhost:3000 down')).not.toContain('localhost')
  })

  it('preserves /api/* paths because they are part of the public contract', () => {
    expect(redactString('GET /api/gateway/status returned 200')).toContain('/api/gateway/status')
  })
})

describe('redactObject', () => {
  it('walks nested objects and arrays', () => {
    const input = {
      blocker: 'check FIRECRAWL_API_KEY=fc-secret-token-1234',
      paths: ['/home/tony/mission-control', '/api/gateway/status'],
      nested: { token: 'Bearer abcdef1234567890' },
    }
    const out = redactObject(input)
    expect(JSON.stringify(out)).not.toContain('fc-secret-token-1234')
    expect(JSON.stringify(out)).not.toContain('/home/tony')
    expect(JSON.stringify(out)).not.toContain('abcdef1234567890')
    expect(JSON.stringify(out)).toContain('/api/gateway/status')
  })
})

describe('redactOrigin', () => {
  it('replaces localhost-style origins', () => {
    expect(redactOrigin('http://localhost:3000')).toBe('http://[redacted-host]')
    expect(redactOrigin('http://127.0.0.1:3000')).toBe('http://[redacted-host]')
  })

  it('keeps the protocol+hostname for public origins, drops the port', () => {
    expect(redactOrigin('https://mission-control.example.com:8443')).toBe('https://mission-control.example.com')
  })

  it('handles invalid origins safely', () => {
    expect(redactOrigin('not a url')).toBe('[redacted-origin]')
  })
})
