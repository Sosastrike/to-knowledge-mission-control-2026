'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SessionPayload = {
  authenticated?: boolean
  actor_id?: string | null
  display_name?: string | null
  account_type?: string | null
  roles?: string[]
  allowed_operations?: string[]
}

type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; session: SessionPayload }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; message: string }

function primaryRole(session: SessionPayload): string {
  return session.roles?.[0] || 'viewer'
}

export function MissionControlSessionMenu() {
  const router = useRouter()
  const [state, setState] = useState<SessionState>({ status: 'checking' })
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')

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
        if (active) setState({ status: 'unavailable', message: 'Session unavailable' })
      })

    return () => {
      active = false
    }
  }, [])

  const handleLogout = useCallback(async () => {
    if (logoutPending) return
    setLogoutPending(true)
    setLogoutError('')

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
      if (!response.ok) {
        throw new Error(payload.error || 'Logout failed')
      }
      setState({ status: 'unauthenticated' })
      router.replace('/login')
      router.refresh?.()
    } catch (error) {
      setLogoutPending(false)
      setLogoutError(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Logout timed out')
    } finally {
      window.clearTimeout(timeout)
    }
  }, [logoutPending, router])

  if (state.status === 'checking') {
    return (
      <section className="mc-session-menu" data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Checking session</span>
      </section>
    )
  }

  if (state.status === 'unauthenticated') {
    return (
      <section className="mc-session-menu" data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Signed out</span>
        <Link className="mc-session-login" href="/login">Log in</Link>
      </section>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <section className="mc-session-menu mc-session-warning" data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Session unavailable</span>
      </section>
    )
  }

  const session = state.session
  const displayName = session.display_name || 'Signed in'
  const role = primaryRole(session)

  return (
    <section className="mc-session-menu" data-testid="mission-control-session-menu" aria-label="Mission Control session">
      <div className="mc-session-identity">
        <span className="mc-session-kicker">Signed in</span>
        <strong>{displayName}</strong>
        <span className="mc-session-role">{role}</span>
      </div>
      <button type="button" className="mc-session-logout" onClick={handleLogout} disabled={logoutPending}>
        {logoutPending ? 'Logging out...' : 'Log out'}
      </button>
      {logoutError && <span className="mc-session-error" role="alert">{logoutError}</span>}
    </section>
  )
}
