'use client'

// TKMC Settings — Security / 2FA (role-based cadence, authenticator QR, optional Twilio SMS)
import { useState } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'
import { TKMC_ROLES, ROLE_LABELS, ROLE_2FA_CADENCE_DAYS } from '@/lib/tkmc-rbac'

export default function SecuritySettingsPage() {
  const [tab, setTab] = useState<'cadence' | 'authenticator' | 'sms'>('cadence')
  const [showQR, setShowQR] = useState(false)

  return (
    <SettingsShell active="security">
      <SettingsPageHeader categoryId="security" />

      <div className="flex gap-1 border-b border-border mb-6">
        {(['cadence', 'authenticator', 'sms'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'cadence' ? '2FA Cadence' : t === 'authenticator' ? 'Authenticator App' : 'SMS (Twilio)'}
          </button>
        ))}
      </div>

      {tab === 'cadence' && (
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-surface-1 border border-border text-xs text-muted-foreground">
            Role-based 2FA frequency. Users will be prompted to re-authenticate after this many days.
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
                      <td className="px-4 py-3 text-xs text-muted-foreground">Authenticator app via QR · Optional SMS</td>
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
            <h3 className="text-sm font-semibold text-foreground mb-2">TOTP Authenticator App</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Use Google Authenticator, Authy, 1Password, or any TOTP-compatible app. Scan the QR code below to enroll.
            </p>

            {!showQR ? (
              <button
                onClick={() => setShowQR(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
              >
                Generate QR code
              </button>
            ) : (
              <div className="space-y-3">
                <div className="w-48 h-48 rounded-md bg-white p-4 flex items-center justify-center">
                  <div className="w-full h-full bg-black grid grid-cols-12 gap-0 p-2" aria-label="QR placeholder">
                    {Array.from({ length: 144 }).map((_, i) => (
                      <div key={i} className={Math.random() > 0.5 ? 'bg-white' : 'bg-black'} />
                    ))}
                  </div>
                </div>
                <p className="text-2xs text-muted-foreground">
                  Secret key: <code className="bg-surface-1 px-1 rounded">JBSWY3DPEHPK3PXP</code>
                </p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Verify with 6-digit code</label>
                  <input
                    maxLength={6}
                    placeholder="000000"
                    className="w-32 px-3 py-1.5 text-sm rounded-md border border-border bg-background font-mono text-center tracking-widest"
                  />
                </div>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground">
                  Activate 2FA
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'sms' && (
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            ⚠️ SMS 2FA via Twilio — placeholder configuration. Add Twilio credentials below to enable.
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Twilio Configuration</h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Account SID</label>
              <input
                placeholder="AC..."
                className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Auth Token</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From Phone Number</label>
              <input
                placeholder="+15551234567"
                className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">
                Test connection
              </button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground">
                Save (disabled — placeholder)
              </button>
            </div>

            <p className="text-2xs text-muted-foreground pt-2 border-t border-border mt-3">
              Env vars: <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM_NUMBER</code>
            </p>
          </div>
        </div>
      )}
    </SettingsShell>
  )
}
