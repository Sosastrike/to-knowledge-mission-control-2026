'use client'

// TKMC Settings — Roles & Permissions
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'
import { TKMC_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_CAPABILITIES } from '@/lib/tkmc-rbac'

export default function RolesPage() {
  // Collect all unique capabilities
  const allCapsSet = new Set<string>()
  for (const role of TKMC_ROLES) {
    ROLE_CAPABILITIES[role].forEach(c => allCapsSet.add(c))
  }
  const allCaps = Array.from(allCapsSet).sort()

  // Group caps by prefix
  const groups: Record<string, string[]> = {}
  for (const cap of allCaps) {
    const prefix = cap.split('.')[0]
    ;(groups[prefix] ||= []).push(cap)
  }

  return (
    <SettingsShell active="roles">
      <SettingsPageHeader categoryId="roles" />

      <div className="space-y-4 mb-6">
        {TKMC_ROLES.map(role => (
          <div key={role} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</h3>
              <span className="text-2xs text-muted-foreground px-2 py-0.5 rounded-full bg-surface-1">
                {ROLE_CAPABILITIES[role].size} capabilities
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-1">
          <h3 className="text-sm font-semibold">Capability matrix</h3>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Custom toggles per role — defaults shown below.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Capability</th>
                {TKMC_ROLES.map(r => (
                  <th key={r} className="text-center px-3 py-2 font-semibold text-muted-foreground">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(groups).map(([group, caps]) => (
                <>
                  <tr key={`g-${group}`} className="bg-surface-1/50">
                    <td colSpan={TKMC_ROLES.length + 1} className="px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </td>
                  </tr>
                  {caps.map(cap => (
                    <tr key={cap} className="hover:bg-surface-1/30">
                      <td className="px-3 py-1.5 text-foreground font-mono">{cap}</td>
                      {TKMC_ROLES.map(r => (
                        <td key={r} className="px-3 py-1.5 text-center">
                          {ROLE_CAPABILITIES[r].has(cap) ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-muted-foreground/30">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SettingsShell>
  )
}
