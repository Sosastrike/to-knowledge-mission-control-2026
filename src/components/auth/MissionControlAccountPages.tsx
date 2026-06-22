'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type SessionPayload = {
  authenticated?: boolean
  display_name?: string | null
  account_type?: string | null
  roles?: string[]
  allowed_operations?: string[]
}

type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; session: SessionPayload }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' }

function primaryRole(session: SessionPayload): string {
  return session.roles?.[0] || 'viewer'
}

function useMissionControlSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'checking' })

  useEffect(() => {
    let active = true
    fetch('/api/auth/session', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('session_unavailable')
        return response.json() as Promise<SessionPayload>
      })
      .then((payload) => {
        if (!active) return
        if (payload.authenticated) setState({ status: 'authenticated', session: payload })
        else setState({ status: 'unauthenticated' })
      })
      .catch(() => {
        if (active) setState({ status: 'unavailable' })
      })

    return () => {
      active = false
    }
  }, [])

  return state
}

function clearPrivateClientCache() {
  try {
    window.sessionStorage.clear()
  } catch {
    // Ignore browser storage access failures during logout cleanup.
  }

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (/^(mission-control|mc-|agent-platform|tkmc:private)/i.test(key)) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore browser storage access failures during logout cleanup.
  }
}

function useLogoutAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const logout = useCallback(async () => {
    if (pending) return
    setPending(true)
    setError('')

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Logout failed')
      clearPrivateClientCache()
      window.location.replace('/login')
    } catch (err) {
      setPending(false)
      setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'Logout timed out')
    } finally {
      window.clearTimeout(timeout)
    }
  }, [pending])

  return { error, logout, pending }
}

function AccountShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="mc-account-page">
      <section className="mc-account-card" aria-labelledby="mc-account-heading">
        <p className="mc-account-eyebrow">{eyebrow}</p>
        <h1 id="mc-account-heading">{title}</h1>
        {children}
      </section>
    </main>
  )
}

function SessionLoading() {
  return (
    <AccountShell eyebrow="Mission Control" title="Checking session">
      <p className="mc-account-muted">Verifying your Mission Control session.</p>
    </AccountShell>
  )
}

function SessionUnavailable() {
  return (
    <AccountShell eyebrow="Mission Control" title="Session unavailable">
      <p className="mc-account-muted">Mission Control could not verify the current session. Refresh or return to login.</p>
      <Link className="mc-account-link" href="/login">Go to login</Link>
    </AccountShell>
  )
}

function SignedOut() {
  return (
    <AccountShell eyebrow="Mission Control" title="Signed out">
      <p className="mc-account-muted">No active Mission Control session is available in this browser.</p>
      <Link className="mc-account-link" href="/login">Go to login</Link>
    </AccountShell>
  )
}

export function MissionControlAccountPage() {
  const state = useMissionControlSession()
  const logout = useLogoutAction()

  if (state.status === 'checking') return <SessionLoading />
  if (state.status === 'unavailable') return <SessionUnavailable />
  if (state.status === 'unauthenticated') return <SignedOut />

  const session = state.session
  const displayName = session.display_name || 'Signed in'
  const accountType = session.account_type || 'human'
  const role = primaryRole(session)

  return (
    <AccountShell eyebrow="Mission Control" title="Account">
      <dl className="mc-account-details">
        <div>
          <dt>Signed in as</dt>
          <dd>{displayName}</dd>
        </div>
        <div>
          <dt>Account type</dt>
          <dd>{accountType}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{role}</dd>
        </div>
      </dl>
      <div className="mc-account-actions">
        <Link className="mc-account-link" href="/logout">Logout confirmation</Link>
        <button type="button" className="mc-account-danger" onClick={logout.logout} disabled={logout.pending}>
          {logout.pending ? 'Logging out...' : 'Log out'}
        </button>
      </div>
      {logout.error && <p className="mc-account-error" role="alert">{logout.error}</p>}
    </AccountShell>
  )
}

export function MissionControlLogoutPage() {
  const state = useMissionControlSession()
  const logout = useLogoutAction()

  if (state.status === 'checking') return <SessionLoading />
  if (state.status === 'unavailable') return <SessionUnavailable />
  if (state.status === 'unauthenticated') return <SignedOut />

  const displayName = state.session.display_name || 'the current Mission Control account'

  return (
    <AccountShell eyebrow="Mission Control" title="Log out">
      <p className="mc-account-muted">
        Confirm log out for <strong>{displayName}</strong>. This sends a real logout request and invalidates the current Mission Control session.
      </p>
      <div className="mc-account-actions">
        <Link className="mc-account-link" href="/account">Back to account</Link>
        <button type="button" className="mc-account-danger" onClick={logout.logout} disabled={logout.pending}>
          {logout.pending ? 'Logging out...' : 'Confirm log out'}
        </button>
      </div>
      {logout.error && <p className="mc-account-error" role="alert">{logout.error}</p>}
    </AccountShell>
  )
}
