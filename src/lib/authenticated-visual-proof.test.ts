import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTH_VISUAL_PROOF_ROUTES,
  buildAuthenticatedVisualProofPlan,
  parseVisualProofRoutes,
  redactVisualProofText,
  safeVisualProofArtifactName,
} from './authenticated-visual-proof'

describe('authenticated visual proof planning', () => {
  it('classifies missing owner session as owner-gated without claiming visual proof', () => {
    const plan = buildAuthenticatedVisualProofPlan({
      baseUrl: 'http://127.0.0.1:3337',
      cookieValue: '',
    })

    expect(plan.owner_session_available).toBe(false)
    expect(plan.blocker_class).toBe('OWNER_GATED')
    expect(plan.blocker).toBe('owner_authenticated_browser_session_required')
    expect(plan.capture_mode).toBe('owner-session-required')
    expect(plan.can_capture_screenshots).toBe(false)
  })

  it('normalizes default and custom route lists for protected page proof', () => {
    expect(DEFAULT_AUTH_VISUAL_PROOF_ROUTES).toContain('/gateway')
    expect(DEFAULT_AUTH_VISUAL_PROOF_ROUTES).toContain('/gateway/agent-hub')
    expect(DEFAULT_AUTH_VISUAL_PROOF_ROUTES).toContain('/gateway/bridge-session')

    expect(parseVisualProofRoutes(' gateway, /gateway/agent-hub, gateway, ,/agents ')).toEqual([
      '/gateway',
      '/gateway/agent-hub',
      '/agents',
    ])
  })

  it('creates screenshot artifact names without leaking raw paths or query strings', () => {
    expect(safeVisualProofArtifactName('/gateway/agent-hub?token=abc')).toBe('gateway-agent-hub.png')
    expect(safeVisualProofArtifactName('/')).toBe('root.png')
    expect(safeVisualProofArtifactName('/Users/sosastrike/private/auth.json')).toBe('redacted-path.png')
  })

  it('redacts secret-shaped and path-shaped text from proof output', () => {
    const secretLike = `sk-${'1234567890abcdef'}`
    const bearerLike = `Bearer ${'abc.def_123'}`
    const redacted = redactVisualProofText(
      `${bearerLike} /Users/sosastrike/private/auth.json ${secretLike} /home/me/token`,
    )

    expect(redacted).toContain('Bearer [redacted]')
    expect(redacted).toContain('[redacted-auth-file]')
    expect(redacted).toContain('[redacted-secret]')
    expect(redacted).not.toContain('/Users/sosastrike')
    expect(redacted).not.toContain('/home/me')
  })
})
