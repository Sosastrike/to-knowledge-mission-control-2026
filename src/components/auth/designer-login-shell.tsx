'use client'

// ─────────────────────────────────────────────────────────────────────
//  src/components/auth/designer-login-shell.tsx
//
//  1:1 port of the designer-approved login UI from
//    ~/claudeclaw/mc-ui-new/Login.html
//
//  Structure mirrors the canonical:
//    .auth-shell (grid 1fr 420px)
//      .auth-hero    — SVG graph backdrop, brand mark, title/sub, stats, footer
//      .auth-panel   — tabs (Log in / Sign up), form, divider, SSO buttons, bottom
//
//  Backend wiring is preserved — this file only renders. All auth handlers
//  remain in src/app/login/page.tsx.
// ─────────────────────────────────────────────────────────────────────
import { useState, type FormEventHandler, type ReactNode } from 'react'
import styles from './designer-login-shell.module.css'

interface DesignerLoginShellProps {
  username: string
  password: string
  error: string
  pendingApproval: boolean
  needsSetup: boolean
  loading: boolean
  googleLoading: boolean
  googleReady: boolean
  googleClientId: string
  microsoftLoading: boolean
  microsoftReady: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onGoogleSignIn: () => void
  onMicrosoftSignIn: () => void
  onClearPending: () => void
  onSetup: () => void
}

type PanelMode = 'login' | 'request' | 'forgot'

// ── decorative SVGs (faithful to Login.html) ─────────────────────────

function HeroGraph() {
  return (
    <svg className={styles.heroGraph} viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="tkmc-auth-ring" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(107,179,255,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx="180" cy="260" r="200" fill="url(#tkmc-auth-ring)" />
      <g stroke="rgba(107,179,255,0.2)" strokeWidth="0.6" fill="none">
        <circle cx="180" cy="260" r="60" />
        <circle cx="180" cy="260" r="110" />
        <circle cx="180" cy="260" r="170" />
      </g>
      <g fill="#6bb3ff" opacity="0.7">
        <circle cx="120" cy="200" r="2" />
        <circle cx="240" cy="210" r="1.5" />
        <circle cx="200" cy="310" r="2.5" />
        <circle cx="100" cy="280" r="1.5" />
        <circle cx="260" cy="330" r="2" />
      </g>
      <g fill="#a16bff" opacity="0.7">
        <circle cx="340" cy="180" r="2" />
        <circle cx="420" cy="240" r="1.5" />
        <circle cx="380" cy="300" r="2" />
      </g>
      <g fill="#ff4f8a" opacity="0.7">
        <circle cx="160" cy="420" r="2" />
        <circle cx="220" cy="460" r="1.5" />
      </g>
    </svg>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7C21.8 18.6 23 15.7 23 12.2z" />
      <path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.6 13.8a6.6 6.6 0 0 1 0-4.2V6.9H1.8a11 11 0 0 0 0 10.2z" />
      <path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.3 1.7l3.3-3.3A11 11 0 0 0 1.8 6.9l3.8 2.9C6.5 7.1 9 5.4 12 5.4z" />
    </svg>
  )
}

function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="#F35325" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="#81BC06" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="#05A6F0" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFBA08" />
    </svg>
  )
}

// ── inline notice (used to surface real backend states; styled to
//    match the .auth-honest pattern from canonical Login.html) ────────

function Notice({
  tone = 'warn',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'error'
  title?: string
  children: ReactNode
}) {
  const cls = `${styles.notice} ${tone === 'error' ? styles.noticeError : tone === 'info' ? styles.noticeInfo : styles.noticeWarn}`
  return (
    <div className={cls} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title}</strong>}
      <span>{children}</span>
    </div>
  )
}

// ── main shell ───────────────────────────────────────────────────────

export function DesignerLoginShell({
  username,
  password,
  error,
  pendingApproval,
  needsSetup,
  loading,
  googleLoading,
  googleReady,
  googleClientId,
  microsoftLoading,
  microsoftReady,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onGoogleSignIn,
  onMicrosoftSignIn,
  onClearPending,
  onSetup,
}: DesignerLoginShellProps) {
  const [mode, setMode] = useState<PanelMode>('login')
  const authBlocked = pendingApproval || loading || googleLoading || microsoftLoading
  const googleConfigured = Boolean(googleClientId)

  return (
    <main className={styles.root}>
      <section className={styles.shell} aria-label="To-Knowledge Mission Control sign in">
        {/* ── Hero / left panel ──────────────────────────────────── */}
        <section className={styles.hero}>
          <HeroGraph />

          <div className={styles.brand}>
            <div className={styles.brandMark} aria-hidden="true" />
            <span>
              To-Knowledge <span>Mission Control</span>
            </span>
          </div>

          <div className={styles.heroBody}>
            <h1>Your agents, memories, and systems — one living interface.</h1>
            <p>Sign in to oversee agent operations, sync your second brain, and run the Mission Control command center.</p>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>1.24M</div>
                <div className={styles.statLabel}>Nodes</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>8.74M</div>
                <div className={styles.statLabel}>Edges</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>98%</div>
                <div className={styles.statLabel}>Sync health</div>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <span>© 2025 To-Knowledge</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.footerLink}>Status</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.footerLink}>Security</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.footerLink}>Docs</span>
          </div>
        </section>

        {/* ── Right panel ────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.tabs} aria-label="Authentication">
            <span className={styles.activeTab}>Log in</span>
          </div>

          {mode === 'login' && (
            <>
              <div>
                <h2 className={styles.heading}>Welcome back</h2>
                <p className={styles.subheading}>Sign in to To-Knowledge Mission Control.</p>
              </div>

              {error && <Notice tone="error" title="Sign-in failed">{error}</Notice>}

              {pendingApproval && (
                <Notice tone="warn" title="Access request pending">
                  Your account is waiting for admin approval.{' '}
                  <button type="button" className={styles.linkInline} onClick={onClearPending}>
                    Try again
                  </button>
                </Notice>
              )}

              {needsSetup && (
                <Notice tone="info" title="No admin account">
                  Create the first admin account to continue.{' '}
                  <button type="button" className={styles.linkInline} onClick={onSetup}>
                    Create admin account
                  </button>
                </Notice>
              )}

              <form
                onSubmit={onSubmit}
                className={authBlocked ? `${styles.form} ${styles.mutedForm}` : styles.form}
              >
                <div className={styles.field}>
                  <label htmlFor="username">Email</label>
                  <input
                    id="username"
                    name="username"
                    className={styles.input}
                    type="text"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder="you@to-knowledge.com"
                    autoComplete="username"
                    autoFocus
                    required
                    aria-required="true"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    aria-required="true"
                  />
                </div>

                <div className={styles.row}>
                  <label className={styles.check}>
                    <input type="checkbox" name="remember" defaultChecked />
                    Remember me for 30 days
                  </label>
                </div>

                <button
                  className={styles.submit}
                  type="submit"
                  disabled={loading || pendingApproval}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className={styles.divider}>or continue with</div>

              <div className={styles.sso}>
                {/* Google Workspace — clickable iff NEXT_PUBLIC_GOOGLE_CLIENT_ID
                    is set AND the Google GSI script has loaded. Otherwise the
                    button is visibly marked unavailable, never silently grayed. */}
                {(() => {
                  const googleBadge = !googleConfigured
                    ? 'Requires owner setup'
                    : !googleReady
                    ? 'Loading…'
                    : null
                  const googleUnavailable = !googleConfigured || !googleReady
                  return (
                    <button
                      type="button"
                      onClick={onGoogleSignIn}
                      disabled={
                        !googleConfigured ||
                        !googleReady ||
                        googleLoading ||
                        loading ||
                        pendingApproval
                      }
                      className={googleUnavailable ? styles.ssoUnavailable : undefined}
                      aria-label={
                        !googleConfigured
                          ? 'Continue with Google Workspace — requires owner setup'
                          : !googleReady
                          ? 'Continue with Google Workspace — loading'
                          : 'Continue with Google Workspace'
                      }
                      title={
                        !googleConfigured
                          ? 'Requires owner setup — configure Google OAuth (NEXT_PUBLIC_GOOGLE_CLIENT_ID)'
                          : !googleReady
                          ? 'Google Workspace sign-in is loading…'
                          : undefined
                      }
                    >
                      <span className={styles.glyph}>
                        <GoogleGlyph />
                      </span>
                      <span className={styles.ssoLabel}>
                        {googleLoading ? 'Signing in with Google…' : 'Continue with Google Workspace'}
                      </span>
                      {googleBadge && <span className={styles.ssoBadge}>{googleBadge}</span>}
                    </button>
                  )
                })()}

                {/* Microsoft 365 — enabled only when server-side Entra
                    configuration is complete. Otherwise it remains visibly
                    setup-pending, never silently grayed. */}
                <button
                  type="button"
                  onClick={onMicrosoftSignIn}
                  disabled={!microsoftReady || microsoftLoading || loading || pendingApproval}
                  className={!microsoftReady ? styles.ssoUnavailable : undefined}
                  aria-label={
                    microsoftReady
                      ? 'Continue with Microsoft 365'
                      : 'Continue with Microsoft 365 — requires owner setup'
                  }
                  title={
                    microsoftReady
                      ? undefined
                      : 'Requires owner setup — Microsoft Entra ID OAuth provider'
                  }
                >
                  <span className={styles.glyph}>
                    <MicrosoftGlyph />
                  </span>
                  <span className={styles.ssoLabel}>
                    {microsoftLoading ? 'Redirecting to Microsoft…' : 'Continue with Microsoft 365'}
                  </span>
                  {!microsoftReady && <span className={styles.ssoBadge}>Requires owner setup</span>}
                </button>

              </div>
            </>
          )}

          {mode === 'request' && (
            <>
              <div>
                <h2 className={styles.heading}>Request access</h2>
                <p className={styles.subheading}>
                  Mission Control is invite-only. We&apos;ll notify the admin to review.
                </p>
              </div>

              <Notice tone="warn" title="Invite-only">
                Sign-ups require admin approval. Without a valid invite code, requests are queued for the admin inbox.
              </Notice>

              <button
                type="button"
                className={styles.submit}
                onClick={() => setMode('login')}
              >
                Back to sign in
              </button>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <div>
                <h2 className={styles.heading}>Reset your password</h2>
                <p className={styles.subheading}>
                  We&apos;ll email you a secure link to set a new password.
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  className={styles.input}
                  type="email"
                  placeholder="you@to-knowledge.com"
                  autoComplete="email"
                />
              </div>

              <button type="button" className={styles.submit} disabled>
                Send reset link
              </button>

              <Notice tone="warn" title="SMTP not yet wired">
                Password reset emails require an SMTP profile configured in Settings → Messaging. Until then, resets must be issued by an admin.
              </Notice>

              <div className={styles.bottom}>
                <button
                  type="button"
                  className={styles.linkInline}
                  onClick={() => setMode('login')}
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
