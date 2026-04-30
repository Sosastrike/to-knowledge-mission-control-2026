'use client'

// TKMC Settings — Channels (Telegram, Discord, WhatsApp, X, Instagram, LinkedIn)
import { useState, useEffect } from 'react'
import { SettingsShell, SettingsPageHeader } from '@/components/tkmc/settings-shell'

interface ChannelDef {
  id: string
  name: string
  icon: string
  description: string
  envKey: string
}

const CHANNELS: ChannelDef[] = [
  { id: 'telegram', name: 'Telegram', icon: '📨', description: 'Bot messaging, voice notes', envKey: 'TELEGRAM_BOT_TOKEN' },
  { id: 'discord', name: 'Discord', icon: '💬', description: 'Team channels, bot integration', envKey: 'DISCORD_TOKEN_TONY' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '📱', description: 'Business messaging via Cloud API', envKey: 'WHATSAPP_API_KEY' },
  { id: 'x', name: 'X / Twitter', icon: '🐦', description: 'Social posting and monitoring', envKey: 'X_BEARER_TOKEN' },
  { id: 'instagram', name: 'Instagram', icon: '📷', description: 'Business posting and DMs', envKey: 'INSTAGRAM_ACCESS_TOKEN' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', description: 'Professional posting and messaging', envKey: 'LINKEDIN_ACCESS_TOKEN' },
]

interface ChannelStatus {
  configured: boolean
  enabled: boolean
  assignedAgent?: string
  lastActivity?: number
}

export default function ChannelsSettingsPage() {
  const [status, setStatus] = useState<Record<string, ChannelStatus>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' })
      const map: Record<string, ChannelStatus> = {}
      if (res.ok) {
        const data = await res.json()
        for (const ch of CHANNELS) {
          const match = (data.integrations ?? []).find((i: any) => i.envVars?.includes(ch.envKey))
          map[ch.id] = {
            configured: match?.status === 'connected',
            enabled: match?.status === 'connected',
          }
        }
      }
      setStatus(map)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <SettingsShell active="channels">
      <SettingsPageHeader categoryId="channels" actions={
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">Refresh</button>
      } />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CHANNELS.map(ch => {
          const s = status[ch.id] ?? { configured: false, enabled: false }
          return (
            <div key={ch.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{ch.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{ch.name}</h3>
                    <p className="text-xs text-muted-foreground">{ch.description}</p>
                  </div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${s.configured ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
              </div>

              <div className="space-y-2 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Configured</span>
                  <span className={s.configured ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {s.configured ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Env key</span>
                  <code className="text-muted-foreground">{ch.envKey}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={s.enabled ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  {s.lastActivity ? `Last: ${new Date(s.lastActivity).toLocaleString()}` : 'No recent activity'}
                </span>
                <a href="/settings/tkmc/integrations" className="text-2xs text-primary hover:underline">
                  Configure →
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </SettingsShell>
  )
}
