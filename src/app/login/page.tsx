'use client'

// ─────────────────────────────────────────────────────────────────────
//  src/app/login/page.tsx
//
//  Login page — backend-only logic (no presentation). Renders the
//  designer-approved DesignerLoginShell which is a 1:1 port of
//    ~/claudeclaw/mc-ui-new/Login.html
//  (sha256 7b5b02e087b50b9e3894c66d365fe201d00077fd5a8eccb6ff8878079c4e9c27)
//
//  All auth handlers preserved unchanged from the prior version:
//    - POST /api/auth/login (username + password)
//    - POST /api/auth/google (Google Sign-In credential)
//    - GET  /api/auth/azure-ad (Microsoft 365 / Entra OAuth redirect)
//    - GET  /api/setup       (first-boot redirect to /setup if needed)
//    - PENDING_APPROVAL / NO_USERS handling
//    - useTranslations error strings
//
//  Removed (moved out of login UI per designer): the "Advanced gateway
//  settings" picker. The localStorage-backed gateway URL key is still
//  exported from @/lib/device-identity and read by other pages; only
//  this page no longer renders the UI for setting it.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { DesignerLoginShell } from '@/components/auth/designer-login-shell'

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsIdApi {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }): void
  prompt(): void
}

interface GoogleApi {
  accounts: {
    id: GoogleAccountsIdApi
  }
}

type LoginRequestBody =
  | { username: string; password: string }
  | { credential?: string }

type LoginErrorPayload = {
  code?: string
  error?: string
  hint?: string
}

function readLoginErrorPayload(value: unknown): LoginErrorPayload {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
    hint: typeof record.hint === 'string' ? record.hint : undefined,
  }
}

declare global {
  interface Window {
    google?: GoogleApi
  }
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)
  const [microsoftReady, setMicrosoftReady] = useState(false)
  const googleCallbackRef = useRef<((response: GoogleCredentialResponse) => void) | null>(null)

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  // Check if first-time setup is needed on page load — auto-redirect to /setup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('authError')
    const authCode = params.get('authCode')
    if (authError) {
      setError(authError)
      setPendingApproval(authCode === 'PENDING_APPROVAL')
      setNeedsSetup(false)
    }

    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) {
          window.location.href = '/setup'
        }
      })
      .catch(() => {
        // Ignore — setup check is best-effort
      })
  }, [])

  useEffect(() => {
    fetch('/api/auth/azure-ad/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setMicrosoftReady(Boolean(data?.configured))
      })
      .catch(() => setMicrosoftReady(false))
  }, [])

  const completeLogin = useCallback(
    async (path: string, body: LoginRequestBody) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = readLoginErrorPayload(await res.json().catch(() => null))
        if (data.code === 'PENDING_APPROVAL') {
          setPendingApproval(true)
          setNeedsSetup(false)
          setError('')
          setLoading(false)
          setGoogleLoading(false)
          return false
        }
        if (data.code === 'NO_USERS') {
          setNeedsSetup(true)
          setError('')
          setLoading(false)
          setGoogleLoading(false)
          return false
        }
        setError(data.error || t('loginFailed'))
        setPendingApproval(false)
        setNeedsSetup(false)
        setLoading(false)
        setGoogleLoading(false)
        return false
      }

      // Full reload ensures the session cookie is sent on all subsequent requests.
      // router.push() + refresh() can race and use stale RSC payloads.
      // Owner directive 2026-04-29: land on the official TKMC app root.
      // The root now shows the active Mission Control landing surface.
      window.location.href = '/designer-mission-control/Mission%20Control.html?page=mission'
      return true
    },
    [t],
  )

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Read DOM values directly to handle browser autofill (which doesn't fire onChange)
    const form = e.target as HTMLFormElement
    const formUsername =
      (form.elements.namedItem('username') as HTMLInputElement)?.value || username
    const formPassword =
      (form.elements.namedItem('password') as HTMLInputElement)?.value || password

    try {
      await completeLogin('/api/auth/login', { username: formUsername, password: formPassword })
    } catch {
      setError(t('networkError'))
      setLoading(false)
    }
  }

  // Initialize Google Sign-In SDK (hidden prompt mode)
  useEffect(() => {
    if (!googleClientId) return

    const onScriptLoad = () => {
      if (!window.google) return
      googleCallbackRef.current = async (response: GoogleCredentialResponse) => {
        setError('')
        setGoogleLoading(true)
        try {
          const ok = await completeLogin('/api/auth/google', { credential: response?.credential })
          if (!ok) return
        } catch {
          setError(t('googleSignInFailed'))
          setGoogleLoading(false)
        }
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: GoogleCredentialResponse) =>
          googleCallbackRef.current?.(response),
      })
      setGoogleReady(true)
    }

    const existing = document.querySelector('script[data-google-gsi="1"]') as HTMLScriptElement | null
    if (existing) {
      if (window.google) onScriptLoad()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.setAttribute('data-google-gsi', '1')
    script.onload = onScriptLoad
    script.onerror = () => setError(t('googleSignInFailed'))
    document.head.appendChild(script)
  }, [googleClientId, completeLogin, t])

  const handleGoogleSignIn = () => {
    if (!window.google || !googleReady) return
    window.google.accounts.id.prompt()
  }

  const handleMicrosoftSignIn = () => {
    if (!microsoftReady) return
    setError('')
    setMicrosoftLoading(true)
    window.location.href = '/api/auth/azure-ad'
  }

  return (
    <DesignerLoginShell
      username={username}
      password={password}
      error={error}
      pendingApproval={pendingApproval}
      needsSetup={needsSetup}
      loading={loading}
      googleLoading={googleLoading}
      googleReady={googleReady}
      googleClientId={googleClientId}
      microsoftLoading={microsoftLoading}
      microsoftReady={microsoftReady}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onMicrosoftSignIn={handleMicrosoftSignIn}
      onClearPending={() => {
        setPendingApproval(false)
        setError('')
        setGoogleLoading(false)
        setMicrosoftLoading(false)
      }}
      onSetup={() => {
        window.location.href = '/setup'
      }}
    />
  )
}
