'use client'

// TKMC Settings — Users
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'
import { TKMC_ROLES, ROLE_LABELS, upgradeLegacyRole, type TKMCRole } from '@/lib/tkmc-rbac'

interface UserRow {
  id: number
  username: string
  display_name: string
  email?: string | null
  role: string
  is_approved?: number
  last_login_at?: number | null
}

export default function UsersPage() {
  const searchParams = useSearchParams()
  const initialAction = searchParams?.get('action') ?? null
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState<'new' | 'invite' | 'csv' | null>(
    initialAction === 'new' ? 'new' : initialAction === 'invite' ? 'invite' : null
  )
  const [feedback, setFeedback] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/users', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : data.users ?? [])
      } else {
        setError('Failed to load users')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  return (
    <SettingsShell active="users">
      <SettingsPageHeader
        categoryId="users"
        actions={
          <>
            <button
              onClick={() => setShowModal('invite')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:border-primary/40 transition-colors"
            >
              Invite via link
            </button>
            <button
              onClick={() => setShowModal('csv')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:border-primary/40 transition-colors"
            >
              CSV import
            </button>
            <button
              onClick={() => setShowModal('new')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Add user
            </button>
          </>
        }
      />

      {feedback && (
        <div className="mb-4 px-4 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading users…</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-1/50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{u.display_name || u.username}</div>
                    <div className="text-2xs text-muted-foreground">@{u.username}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <RoleSelector userId={u.id} role={u.role} onChange={loadUsers} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-2xs px-2 py-0.5 rounded-full ${
                      u.is_approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {u.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-2xs text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserModal
          mode={showModal}
          onClose={() => setShowModal(null)}
          onDone={(msg) => { setShowModal(null); setFeedback(msg); loadUsers(); setTimeout(() => setFeedback(null), 4000) }}
        />
      )}
    </SettingsShell>
  )
}

function RoleSelector({ userId, role, onChange }: { userId: number; role: string; onChange: () => void }) {
  const currentRole = upgradeLegacyRole(role)
  const [value, setValue] = useState<TKMCRole>(currentRole)
  const [saving, setSaving] = useState(false)

  async function save(newRole: TKMCRole) {
    setValue(newRole)
    setSaving(true)
    try {
      await fetch(`/api/auth/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      })
      onChange()
    } catch {
      // silent - revert
      setValue(currentRole)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={value}
      onChange={e => save(e.target.value as TKMCRole)}
      disabled={saving}
      className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
    >
      {TKMC_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  )
}

function UserModal({ mode, onClose, onDone }: { mode: 'new'|'invite'|'csv'; onClose: () => void; onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<TKMCRole>('agent')
  const [csvContent, setCsvContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setBusy(true); setErr(null)
    try {
      if (mode === 'csv') {
        const lines = csvContent.trim().split('\n').slice(1) // skip header
        let count = 0
        for (const line of lines) {
          const [u, d, e, r] = line.split(',').map(s => s.trim())
          if (!u || !e) continue
          await fetch('/api/auth/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, display_name: d || u, email: e, role: r || 'viewer' }),
          })
          count++
        }
        onDone(`Imported ${count} users from CSV`)
        return
      }
      const res = await fetch('/api/auth/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName || username, email, role, invite: mode === 'invite' }),
      })
      if (!res.ok) { setErr('Failed to save'); return }
      onDone(mode === 'invite' ? `Invite link sent/generated for ${email}` : `User ${username} created`)
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'new' ? 'Add User' : mode === 'invite' ? 'Send Invite' : 'CSV Import'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <div className="p-5 space-y-3">
          {mode === 'csv' ? (
            <>
              <p className="text-xs text-muted-foreground">
                Paste CSV with header row: <code className="bg-surface-1 px-1 rounded">username,display_name,email,role</code>
              </p>
              <textarea
                value={csvContent}
                onChange={e => setCsvContent(e.target.value)}
                placeholder="username,display_name,email,role&#10;jsmith,John Smith,j@example.com,agent"
                className="w-full h-40 p-2 text-xs font-mono rounded-md border border-border bg-background text-foreground"
              />
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Display name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value as TKMCRole)} className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background">
                  {TKMC_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </>
          )}
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {busy ? 'Saving…' : mode === 'invite' ? 'Send invite' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
