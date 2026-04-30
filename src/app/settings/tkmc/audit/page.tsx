'use client'

// TKMC Settings — Audit / Logs (administrative traceability)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface AuditEntry {
  id: number | string
  timestamp: number
  user?: string
  action: string
  target?: string
  status?: string
  details?: string
}

export default function AuditSettingsPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  async function load() {
    try {
      const res = await fetch('/api/audit', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEntries(Array.isArray(data) ? data : data.entries ?? data.items ?? [])
      } else {
        // fallback: use notifications/activity feed
        const ar = await fetch('/api/notifications?limit=100', { cache: 'no-store' })
        if (ar.ok) {
          const ad = await ar.json()
          setEntries((ad.notifications ?? []).map((n: any) => ({
            id: n.id,
            timestamp: n.created_at,
            user: n.user,
            action: n.action ?? n.event ?? 'event',
            target: n.target,
            status: n.status,
            details: n.message ?? n.detail,
          })))
        }
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = filter
    ? entries.filter(e => `${e.action} ${e.user ?? ''} ${e.target ?? ''} ${e.details ?? ''}`.toLowerCase().includes(filter.toLowerCase()))
    : entries

  return (
    <SettingsShell active="audit">
      <SettingsPageHeader categoryId="audit" actions={
        <>
          <input
            placeholder="Search audit log…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-border bg-background w-48"
          />
          <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">Refresh</button>
        </>
      } />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Timestamp</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">User</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Action</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Target</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading audit log…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                {filter ? 'No entries match filter' : 'No audit entries recorded yet'}
              </td></tr>
            ) : filtered.slice(0, 200).map(e => (
              <tr key={e.id} className="hover:bg-surface-1/50">
                <td className="px-4 py-2 text-2xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs font-medium">{e.user ?? 'system'}</td>
                <td className="px-4 py-2 text-xs text-foreground">{e.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{e.target ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-md">{e.details ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsShell>
  )
}
