import { describe, expect, it } from 'vitest'
import { classifyError, classifyErrors } from '../error-classifier.js'

describe('classifyError — http_status driven', () => {
  it('401 → AUTH_REQUIRED', () => {
    expect(classifyError({ http_status: 401 }).kind).toBe('AUTH_REQUIRED')
  })

  it('403 → OWNER_GATED', () => {
    expect(classifyError({ http_status: 403 }).kind).toBe('OWNER_GATED')
  })

  it('404 → ROUTE_MISSING', () => {
    expect(classifyError({ http_status: 404 }).kind).toBe('ROUTE_MISSING')
  })

  it('423 → OWNER_GATED', () => {
    expect(classifyError({ http_status: 423 }).kind).toBe('OWNER_GATED')
  })

  it('502/503/504 → SERVICE_DOWN', () => {
    for (const s of [502, 503, 504]) {
      expect(classifyError({ http_status: s }).kind).toBe('SERVICE_DOWN')
    }
  })
})

describe('classifyError — message driven', () => {
  it('credential text → CREDENTIAL_GATED', () => {
    expect(classifyError({ message: 'missing FIRECRAWL_API_KEY' }).kind).toBe('CREDENTIAL_GATED')
    expect(classifyError({ message: 'Zapier ZAPIER_ACCESS_TOKEN is not set' }).kind).toBe('CREDENTIAL_GATED')
  })

  it('owner-approval text → OWNER_GATED', () => {
    expect(classifyError({ message: 'awaiting owner approval in Telegram' }).kind).toBe('OWNER_GATED')
  })

  it('service-down text → SERVICE_DOWN', () => {
    expect(classifyError({ message: 'connect ECONNREFUSED on the upstream' }).kind).toBe('SERVICE_DOWN')
  })

  it('not-implemented → BACKEND_MISSING', () => {
    expect(classifyError({ message: 'not implemented yet' }).kind).toBe('BACKEND_MISSING')
  })
})

describe('classifyError — context driven', () => {
  it('requires_owner_approval=true → OWNER_GATED', () => {
    expect(classifyError({ context: { requires_owner_approval: true } }).kind).toBe('OWNER_GATED')
  })

  it('execution_enabled=false → EXECUTION_DISABLED', () => {
    expect(classifyError({ context: { execution_enabled: false } }).kind).toBe('EXECUTION_DISABLED')
  })

  it('has_credential=false → CREDENTIAL_GATED', () => {
    expect(classifyError({ context: { has_credential: false } }).kind).toBe('CREDENTIAL_GATED')
  })

  it('has_backend=false → BACKEND_MISSING', () => {
    expect(classifyError({ context: { has_backend: false } }).kind).toBe('BACKEND_MISSING')
  })
})

describe('classifyError — output safety', () => {
  it('redacts secrets and absolute paths in technical_detail', () => {
    const r = classifyError({
      message: 'failed reading /home/tony/mission-control/.env (FIRECRAWL_API_KEY=fc-secret-token)',
    })
    expect(r.technical_detail).not.toContain('fc-secret-token')
    expect(r.technical_detail).not.toContain('/home/tony')
  })

  it('owner_action_required matches the kind contract', () => {
    expect(classifyError({ http_status: 401 }).owner_action_required).toBe(true)
    expect(classifyError({ http_status: 404 }).owner_action_required).toBe(false)
    expect(classifyError({ http_status: 404 }).codex_can_fix).toBe(true)
  })
})

describe('classifyErrors — dedupe', () => {
  it('dedupes by (kind, owner_message)', () => {
    const out = classifyErrors([
      { http_status: 404 },
      { http_status: 404 },
      { http_status: 401 },
    ])
    expect(out.length).toBe(2)
  })
})
