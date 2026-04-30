'use client'

// TKMC Settings — Integrations (API tokens, health, test, error details)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface IntegrationRow {
  id: string
  name: string
  category: string
  status: 'connected' | 'partial' | 'not_configured'
  envVars: string[]
  testable?: boolean
}

export default function IntegrationsSettingsPage() {
  const [items, setItems] = useState<IntegrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string; time: number }>>({})

  async function load() {
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setItems(data.integrations ?? [])
      }
    } finally { setLoading(false) }
  }

  async function testConnection(id: string) {
    setTesting(id)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', integrationId: id }),
      })
      const data = await res.json()
      setResults(r => ({ ...r, [id]: { ok: res.ok && data.ok !== false, message: data.message ?? data.error ?? 'Tested', time: Date.now() } }))
    } catch {
      setResults(r => ({ ...r, [id]: { ok: false, message: 'Network error', time: Date.now() } }))
    } finally { setTesting(null) }
  }

  useEffect(() => { load() }, [])

  const byCategory: Record<string, IntegrationRow[]> = {}
  for (const i of items) (byCategory[i.category] ||= []).push(i)

  return (
    <SettingsShell active="integrations">
      <SettingsPageHeader categoryId="integrations" actions={
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">Refresh</button>
      } />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading integrations…</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {list.map(i => {
                      const r = results[i.id]
                      return (
                        <tr key={i.id} className="hover:bg-surface-1/50">
                          <td className="px-4 py-3 w-1/3">
                            <div className="font-medium text-foreground">{i.name}</div>
                            <div className="text-2xs text-muted-foreground font-mono">{i.envVars.join(', ')}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-2xs px-2 py-0.5 rounded-full ${
                              i.status === 'connected' ? 'bg-emerald-500/15 text-emerald-400' :
                              i.status === 'partial' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-muted/20 text-muted-foreground'
                            }`}>
                              {i.status.replace('_', ' ')}
                            </span>
                            {r && (
                              <span className={`ml-2 text-2xs ${r.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {r.ok ? '✓' : '✗'} {r.message}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {i.testable && (
                              <button
                                onClick={() => testConnection(i.id)}
                                disabled={testing === i.id}
                                className="text-xs px-2 py-1 rounded border border-border hover:border-primary/40 disabled:opacity-50"
                              >
                                {testing === i.id ? 'Testing…' : 'Test'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsShell>
  )
}
