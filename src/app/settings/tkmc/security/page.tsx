'use client'

// TKMC Settings — Security / 2FA / SSO readiness
import { useEffect, useState } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'
import { TKMC_ROLES, ROLE_LABELS, ROLE_2FA_CADENCE_DAYS } from '@/lib/tkmc-rbac'

type SecurityTab = 'cadence' | 'authenticator' | 'sms' | 'sso'

type SsoProvider = {
  id: string
  label: string
  state: string
  visible: boolean
  clickable_when_configured: boolean
  login_endpoint: string | null
  callback_path: string | null
  required_env_names?: string[]
  optional_env_names?: string[]
  missing_env_names?: string[]
  owner_action_required: boolean
  note: string
}

type SsoReadiness = {
  ok: boolean
  canonical_login_url: string
  providers: SsoProvider[]
  invite_access: {
    state: string
    model: string
    request_endpoint: string
    review_endpoint: string
    reviewer_required_role: string
    direct_public_signup_enabled: boolean
    note: string
  }
  session_policy: {
    tkmc: string
    mc: string
    shared_session_enabled: boolean
    redirect_mc_to_tkmc: boolean
    note: string
  }
  safe_ui_contract: {
    sso_buttons_stay_visible: boolean
    setup_pending_buttons_disabled: boolean
    never_fake_login_behavior: boolean
    saml_hidden_this_phase: boolean
    no_secret_values_in_response: boolean
  }
}

const TABS: { id: SecurityTab; label: string }[] = [
  { id: 'cadence', label: '2FA Cadence' },
  { id: 'authenticator', label: 'Authenticator App' },
  { id: 'sms', label: 'SMS (Twilio)' },
  { id: 'sso', label: 'SSO Readiness' },
]

function stateBadgeClass(state: string) {
  if (state === 'LIVE' || state === 'READY' || state === 'READY_FOR_ADMIN_REVIEW') return 'bg-emerald-500/15 text-emerald-400'
  if (state === 'SETUP_REQUIRED') return 'bg-amber-500/15 text-amber-400'
  if (state === 'DISABLED') return 'bg-muted/20 text-muted-foreground'
  return 'bg-surface-1 text-muted-foreground'
}

function StateBadge({ state }: { state: string }) {
  return <span className={`text-2xs px-2 py-0.5 rounded-full ${stateBadgeClass(state)}`}>{state.replaceAll('_', ' ')}</span>
}

export default function SecuritySettingsPage() {
  const [tab, setTab] = useState<SecurityTab>('cadence')
  const [sso, setSso] = useState<SsoReadiness | null>(null)
  const [ssoError, setSsoError] = useState<string | null>(null)

  async function loadSsoReadiness() {
    setSsoError(null)
    try {
      const res = await fetch('/api/auth/sso-readiness', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setSso(data as SsoReadiness)
    } catch (error) {
      setSsoError(error instanceof Error ? error.message : 'Unable to load SSO readiness')
    }
  }

  useEffect(() => { loadSsoReadiness() }, [])

  return (
    <SettingsShell active="security">
      <SettingsPageHeader categoryId="security" />

      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cadence' && (
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-surface-1 border border-border text-xs text-muted-foreground">
            Role-based 2FA frequency. Users will be prompted to re-authenticate after this many days once the 2FA backend is connected.
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">2FA Frequency</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Methods</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TKMC_ROLES.map(role => {
                  const days = ROLE_2FA_CADENCE_DAYS[role]
                  const label = days === 1 ? 'Daily' : days === 7 ? 'Weekly' : days === 30 ? 'Monthly' : `${days} days`
                  return (
                    <tr key={role}>
                      <td className="px-4 py-3 font-medium text-foreground">{ROLE_LABELS[role]}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">Authenticator app planned · SMS optional after credentials</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'authenticator' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">TOTP Authenticator App</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Authenticator enrollment is not connected yet. No QR code or secret is generated until the backend creates a real per-user TOTP secret and audit event.
                </p>
              </div>
              <StateBadge state="BACKEND_REQUIRED" />
            </div>
            <div className="mt-4 rounded-md border border-border bg-surface-1 p-3 text-xs text-muted-foreground">
              Next backend step: add TOTP enrollment, verification, recovery-code handling, and audit logging. This panel will stay read-only until then.
            </div>
            <button disabled className="mt-4 px-3 py-1.5 text-xs font-medium rounded-md border border-border opacity-60 cursor-not-allowed">
              Generate QR code — backend required
            </button>
          </div>
        </div>
      )}

      {tab === 'sms' && (
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            SMS 2FA via Twilio is setup-pending. Credentials must be added through the approved secret path before any test or save action can run.
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Twilio Configuration</h3>
              <StateBadge state="CREDENTIAL_REQUIRED" />
            </div>

            <div className="grid md:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="rounded-md border border-border bg-surface-1 p-3 font-mono">TWILIO_ACCOUNT_SID</div>
              <div className="rounded-md border border-border bg-surface-1 p-3 font-mono">TWILIO_AUTH_TOKEN</div>
              <div className="rounded-md border border-border bg-surface-1 p-3 font-mono">TWILIO_FROM_NUMBER</div>
            </div>

            <div className="pt-2 flex gap-2">
              <button disabled className="px-3 py-1.5 text-xs font-medium rounded-md border border-border opacity-60 cursor-not-allowed">
                Test connection — credential required
              </button>
              <button disabled className="px-3 py-1.5 text-xs font-medium rounded-md border border-border opacity-60 cursor-not-allowed">
                Save — backend required
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'sso' && (
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-surface-1 border border-border text-xs text-muted-foreground">
            SSO buttons stay visible on the login screen. Providers that are not configured must remain disabled/setup-pending and must not fake login behavior.
          </div>

          {ssoError ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">{ssoError}</div>
          ) : !sso ? (
            <div className="text-sm text-muted-foreground">Loading SSO readiness…</div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                {sso.providers.filter(provider => provider.visible).map(provider => (
                  <div key={provider.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{provider.label}</h3>
                        <p className="text-2xs text-muted-foreground mt-1">{provider.login_endpoint || 'No login endpoint'}</p>
                      </div>
                      <StateBadge state={provider.state} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{provider.note}</p>
                    {provider.callback_path ? (
                      <div className="text-2xs text-muted-foreground font-mono break-all">Callback: {provider.callback_path}</div>
                    ) : null}
                    {provider.missing_env_names && provider.missing_env_names.length > 0 ? (
                      <div className="rounded-md bg-surface-1 border border-border p-2">
                        <div className="text-2xs uppercase tracking-wide text-muted-foreground mb-1">Missing setup names</div>
                        <div className="text-2xs font-mono text-amber-300 break-all">{provider.missing_env_names.join(', ')}</div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Invite-only access</h3>
                  <StateBadge state={sso.invite_access.state} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{sso.invite_access.note}</p>
                <div className="grid md:grid-cols-2 gap-3 text-2xs text-muted-foreground font-mono">
                  <div className="rounded-md bg-surface-1 border border-border p-2">Request: {sso.invite_access.request_endpoint}</div>
                  <div className="rounded-md bg-surface-1 border border-border p-2">Review: {sso.invite_access.review_endpoint}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Session policy</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{sso.session_policy.note}</p>
                <div className="grid md:grid-cols-2 gap-3 text-2xs text-muted-foreground">
                  <div className="rounded-md bg-surface-1 border border-border p-2">TKMC login: {sso.canonical_login_url}</div>
                  <div className="rounded-md bg-surface-1 border border-border p-2">MC shared session: {sso.session_policy.shared_session_enabled ? 'enabled' : 'disabled'}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </SettingsShell>
  )
}
