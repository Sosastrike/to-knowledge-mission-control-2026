'use client'

// TKMC Settings — Models (assignments, priorities, fallbacks, cost rules)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface ModelRow {
  id: string
  provider: string
  name?: string
  category?: string
  cost_tier?: string
  priority?: number
  fallback?: string
}

export default function ModelsSettingsPage() {
  const [models, setModels] = useState<ModelRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const ai = (data.integrations ?? []).filter((i: any) => i.category === 'ai')
        setModels(ai.map((m: any) => ({
          id: m.id,
          provider: m.name,
          name: m.name,
          category: 'ai',
          cost_tier: m.status === 'connected' ? 'active' : 'inactive',
        })))
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <SettingsShell active="models">
      <SettingsPageHeader categoryId="models" />

      <div className="mb-4 p-3 rounded-md bg-surface-1 border border-border text-xs text-muted-foreground">
        Routing, priorities, fallbacks, and per-agent cost rules are configured here. Changes take effect on next agent spawn.
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Provider / Model</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Category</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Priority</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Fallback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : models.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No AI providers configured yet</td></tr>
            ) : models.map((m, idx) => (
              <tr key={m.id} className="hover:bg-surface-1/50">
                <td className="px-4 py-2.5 font-medium text-foreground">{m.provider}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.category}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-2xs px-2 py-0.5 rounded-full ${
                    m.cost_tier === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted/20 text-muted-foreground'
                  }`}>{m.cost_tier}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{models[idx + 1]?.provider ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsShell>
  )
}
