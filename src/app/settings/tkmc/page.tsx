// TKMC Settings home — hybrid overview with drill-down to categories
'use client'

import { SettingsShell, SETTINGS_CATEGORIES } from '@/components/tkmc/settings-shell'
import { useRouter } from 'next/navigation'

export default function TKMCSettingsHome() {
  const router = useRouter()

  return (
    <SettingsShell active="">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Administrative Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Select a category from the sidebar, or jump in using a card below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SETTINGS_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => router.push(`/settings/tkmc/${cat.id}`)}
            className="group text-left rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:bg-card/80 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{cat.icon}</span>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {cat.label}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface-1 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Quick stats</h3>
        <p className="text-xs text-muted-foreground">
          Drill into any category for detailed tables, health status, and controls.
          Your role determines what you can edit — hidden categories won't appear here.
        </p>
      </div>
    </SettingsShell>
  )
}
