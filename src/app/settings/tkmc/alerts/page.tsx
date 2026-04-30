'use client'

// TKMC Settings — Alerts (dashboard, email, Telegram/Discord)
import { useState } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface AlertRule {
  id: string
  name: string
  channel: 'dashboard' | 'email' | 'telegram' | 'discord'
  enabled: boolean
  trigger: string
}

const DEFAULT_RULES: AlertRule[] = [
  { id: 'agent-offline', name: 'Agent goes offline', channel: 'dashboard', enabled: true, trigger: 'agent.health == offline' },
  { id: 'api-fail', name: 'Integration API failure', channel: 'telegram', enabled: true, trigger: 'integration.test_failed' },
  { id: 'quota-80', name: 'API quota 80% reached', channel: 'email', enabled: true, trigger: 'quota.percent >= 80' },
  { id: 'task-fail', name: 'Task failed', channel: 'dashboard', enabled: true, trigger: 'task.status == failed' },
  { id: 'security-audit', name: 'Security audit warning', channel: 'telegram', enabled: true, trigger: 'security.audit == warning' },
  { id: 'disk-full', name: 'Disk > 85%', channel: 'telegram', enabled: true, trigger: 'disk.percent > 85' },
]

export default function AlertsSettingsPage() {
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES)

  function toggle(id: string) {
    setRules(r => r.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule))
  }

  return (
    <SettingsShell active="alerts">
      <SettingsPageHeader categoryId="alerts" actions={
        <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground">
          + New rule
        </button>
      } />

      <div className="mb-4 p-3 rounded-md bg-surface-1 border border-border text-xs text-muted-foreground">
        Alerts fire when a trigger condition is met. Use dashboard for low-priority, telegram/discord for urgent, email for reports.
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Rule</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Trigger</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Channel</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map(r => (
              <tr key={r.id} className="hover:bg-surface-1/50">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-2.5 text-2xs text-muted-foreground font-mono">{r.trigger}</td>
                <td className="px-4 py-2.5">
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-1 text-foreground">
                    {r.channel}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => toggle(r.id)}
                    className={`text-2xs px-2 py-0.5 rounded-full ${
                      r.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsShell>
  )
}
