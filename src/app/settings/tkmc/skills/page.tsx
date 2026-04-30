'use client'

// TKMC Settings — Skills (versioning, validation, dependency checks)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface SkillRow {
  id: string
  name: string
  source: string
  description?: string
  security_status?: string
  version?: string
}

export default function SkillsSettingsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/skills', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSkills(data.skills ?? [])
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const sources = [...new Set(skills.map(s => s.source))].sort()

  return (
    <SettingsShell active="skills">
      <SettingsPageHeader categoryId="skills" actions={
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">Refresh</button>
      } />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xs text-muted-foreground">Total Skills</div>
          <div className="text-xl font-bold text-foreground">{skills.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xs text-muted-foreground">Sources</div>
          <div className="text-xl font-bold text-foreground">{sources.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xs text-muted-foreground">Validated</div>
          <div className="text-xl font-bold text-emerald-400">
            {skills.filter(s => s.security_status === 'clean').length}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Skill</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Source</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Version</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : skills.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No skills installed</td></tr>
            ) : skills.map(s => (
              <tr key={s.id} className="hover:bg-surface-1/50">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{s.name}</div>
                  {s.description && <div className="text-2xs text-muted-foreground truncate max-w-md">{s.description}</div>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.source}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.version ?? 'v1'}</td>
                <td className="px-4 py-2.5">
                  <ValidationBadge status={s.security_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsShell>
  )
}

function ValidationBadge({ status }: { status?: string }) {
  if (status === 'clean') return <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">clean</span>
  if (status === 'warning') return <span className="text-2xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">warning</span>
  if (status === 'rejected') return <span className="text-2xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">rejected</span>
  return <span className="text-2xs text-muted-foreground">unchecked</span>
}
