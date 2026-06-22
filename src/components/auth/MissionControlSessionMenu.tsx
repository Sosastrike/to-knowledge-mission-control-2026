'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type SessionPayload = {
  authenticated?: boolean
  actor_id?: string | null
  display_name?: string | null
  account_type?: string | null
  roles?: string[]
  allowed_operations?: string[]
}

type MissionControlSessionMenuProps = {
  className?: string
  hideWhenSignedOut?: boolean
  showAccountLink?: boolean
  variant?: 'inline' | 'global'
}

type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; session: SessionPayload }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; message: string }

function primaryRole(session: SessionPayload): string {
  return session.roles?.[0] || 'viewer'
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
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

export function MissionControlSessionMenu({
  className,
  hideWhenSignedOut = false,
  showAccountLink = true,
  variant = 'inline',
}: MissionControlSessionMenuProps) {
  const [state, setState] = useState<SessionState>({ status: 'checking' })
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const menuClassName = classNames('mc-session-menu', `mc-session-menu--${variant}`, className)

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
      clearPrivateClientCache()
      setState({ status: 'unauthenticated' })
      window.location.replace('/login')
    } catch (error) {
      setLogoutPending(false)
      setLogoutError(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Logout timed out')
    } finally {
      window.clearTimeout(timeout)
    }
  }, [logoutPending])

  if (state.status === 'checking') {
    return (
      <section className={menuClassName} data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Checking session</span>
      </section>
    )
  }

  if (state.status === 'unauthenticated') {
    if (hideWhenSignedOut) return null
    return (
      <section className={menuClassName} data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Signed out</span>
        <Link className="mc-session-login" href="/login">Log in</Link>
      </section>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <section className={classNames(menuClassName, 'mc-session-warning')} data-testid="mission-control-session-menu" aria-label="Mission Control session">
        <span className="mc-session-kicker">Session unavailable</span>
      </section>
    )
  }

  const session = state.session
  const displayName = session.display_name || 'Signed in'
  const role = primaryRole(session)
  const accountType = session.account_type || 'human'

  return (
    <section className={menuClassName} data-testid="mission-control-session-menu" aria-label="Mission Control session">
      <div className="mc-session-identity">
        <span className="mc-session-kicker">Signed in</span>
        <strong>{displayName}</strong>
        <span className="mc-session-role">{accountType}</span>
        <span className="mc-session-role">{role}</span>
      </div>
      <div className="mc-session-actions" aria-label="Account actions">
        {showAccountLink && <Link className="mc-session-login" href="/account">Account</Link>}
        <button type="button" className="mc-session-logout" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending ? 'Logging out...' : 'Log out'}
        </button>
      </div>
      {logoutError && <span className="mc-session-error" role="alert">{logoutError}</span>}
    </section>
  )
}
