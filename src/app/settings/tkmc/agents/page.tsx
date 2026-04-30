'use client'

// TKMC Settings — Agents (status, channels, skills, logs, restart/reconnect)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface AgentRow {
  name: string
  status?: string
  last_heartbeat?: number
  channels?: string[]
  skills?: string[]
  health?: 'healthy' | 'degraded' | 'offline' | 'unknown'
}

export default function AgentsSettingsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAgents(Array.isArray(data) ? data : data.agents ?? [])
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function restart(name: string) {
    setAction(name)
    try {
      await fetch(`/api/agents/${encodeURIComponent(name)}/heartbeat`, { method: 'POST' })
      await load()
    } finally { setAction(null) }
  }

  return (
    <SettingsShell active="agents">
      <SettingsPageHeader categoryId="agents" actions={
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">Refresh</button>
      } />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading agents…</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Agent</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Health</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Last heartbeat</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map(a => {
                const health = healthFrom(a)
                return (
                  <tr key={a.name} className="hover:bg-surface-1/50">
                    <td className="px-4 py-2.5 font-medium text-foreground">{a.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-2xs px-2 py-0.5 rounded-full ${healthColor(health)}`}>
                        {health}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{a.status ?? '—'}</td>
                    <td className="px-4 py-2.5 text-2xs text-muted-foreground">
                      {a.last_heartbeat ? new Date(a.last_heartbeat).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => restart(a.name)}
                        disabled={action === a.name}
                        className="text-xs px-2 py-1 rounded border border-border hover:border-primary/40 disabled:opacity-50"
                      >
                        {action === a.name ? 'Working…' : 'Reconnect'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {agents.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No agents found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SettingsShell>
  )
}

function healthFrom(a: AgentRow): string {
  if (a.health) return a.health
  if (!a.last_heartbeat) return 'unknown'
  const ageMin = (Date.now() - a.last_heartbeat) / 60000
  if (ageMin < 5) return 'healthy'
  if (ageMin < 30) return 'degraded'
  return 'offline'
}

function healthColor(h: string) {
  if (h === 'healthy') return 'bg-emerald-500/15 text-emerald-400'
  if (h === 'degraded') return 'bg-amber-500/15 text-amber-400'
  if (h === 'offline') return 'bg-rose-500/15 text-rose-400'
  return 'bg-muted/20 text-muted-foreground'
}
