'use client'

// TKMC Phase 2 — Priority-only dashboard with 6 modules + Edit Dashboard mode
// Shows only what matters NOW: agents, live meetings, tasks, MC quick actions, system health, scheduled tasks preview

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_MODULES = [
  'agent-status',
  'live-meetings',
  'task-summary',
  'mc-quick-actions',
  'system-health',
  'scheduled-preview',
] as const

type ModuleId = typeof DEFAULT_MODULES[number]

const MODULE_LABELS: Record<ModuleId, string> = {
  'agent-status': 'Agent Status',
  'live-meetings': 'Live Meetings',
  'task-summary': 'Task Summary',
  'mc-quick-actions': 'Mission Control Quick Actions',
  'system-health': 'System Health',
  'scheduled-preview': 'Scheduled Tasks Preview',
}

const STORAGE_KEY = 'tkmc-dashboard-modules'

function getEnabledModules(): Set<ModuleId> {
  if (typeof window === 'undefined') return new Set(DEFAULT_MODULES)
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const arr = JSON.parse(stored) as ModuleId[]
      return new Set(arr)
    }
  } catch {}
  return new Set(DEFAULT_MODULES)
}

export function PriorityDashboard() {
  const [editMode, setEditMode] = useState(false)
  const [enabled, setEnabled] = useState<Set<ModuleId>>(() => getEnabledModules())

  function toggle(m: ModuleId) {
    const next = new Set(enabled)
    if (next.has(m)) next.delete(m)
    else next.add(m)
    setEnabled(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Priority surface — glance first, drill down for depth.
          </p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            editMode
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/40'
          }`}
        >
          {editMode ? '✓ Done' : 'Edit Dashboard'}
        </button>
      </div>

      {editMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Choose visible modules</h3>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_MODULES.map(m => (
              <button
                key={m}
                onClick={() => toggle(m)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  enabled.has(m)
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-surface-1 text-muted-foreground border-border hover:border-primary/30'
                }`}
              >
                {enabled.has(m) ? '✓' : '○'} {MODULE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-2xs text-muted-foreground mt-3">
            Preferences saved locally. Admins can set workspace defaults in Settings.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {enabled.has('agent-status') && <AgentStatusModule />}
        {enabled.has('live-meetings') && <LiveMeetingsModule />}
        {enabled.has('task-summary') && <TaskSummaryModule />}
        {enabled.has('mc-quick-actions') && <QuickActionsModule />}
        {enabled.has('system-health') && <SystemHealthModule />}
        {enabled.has('scheduled-preview') && <ScheduledPreviewModule />}
      </div>
    </div>
  )
}

function ModuleCard({
  title, href, children, accent,
}: { title: string; href?: string; children: React.ReactNode; accent?: string }) {
  const router = useRouter()
  return (
    <div className={`rounded-lg border bg-card overflow-hidden transition-colors ${accent ?? 'border-border'} hover:border-primary/40`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1/50">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {href && (
          <button
            onClick={() => router.push(href)}
            className="text-2xs text-primary hover:underline"
          >
            Open →
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function AgentStatusModule() {
  const [agents, setAgents] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/agents').then(r => r.ok ? r.json() : []).then(d => {
      setAgents(Array.isArray(d) ? d : d.agents ?? [])
    }).catch(() => {})
  }, [])

  const online = agents.filter(a => a.last_heartbeat && Date.now() - a.last_heartbeat < 300000).length

  return (
    <ModuleCard title="Agent Status" href="/settings/tkmc/agents">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-foreground">{online}</span>
        <span className="text-sm text-muted-foreground">/ {agents.length} online</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {agents.slice(0, 12).map(a => {
          const isOnline = a.last_heartbeat && Date.now() - a.last_heartbeat < 300000
          return (
            <span
              key={a.name}
              className={`text-2xs px-2 py-0.5 rounded-full ${
                isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted/20 text-muted-foreground'
              }`}
              title={a.name}
            >
              {a.name}
            </span>
          )
        })}
      </div>
    </ModuleCard>
  )
}

function LiveMeetingsModule() {
  return (
    <ModuleCard title="Live Meetings" href="/live-meeting" accent="border-rose-500/30">
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-medium text-foreground">No active meetings</span>
        </div>
        <p className="text-2xs text-muted-foreground">Click to open meeting room</p>
      </div>
    </ModuleCard>
  )
}

function TaskSummaryModule() {
  const [counts, setCounts] = useState({ inbox: 0, in_progress: 0, done: 0, failed: 0 })

  useEffect(() => {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => {
      const tasks = Array.isArray(d) ? d : d.tasks ?? []
      const next = { inbox: 0, in_progress: 0, done: 0, failed: 0 }
      for (const t of tasks) {
        if (t.status === 'inbox' || t.status === 'assigned') next.inbox++
        else if (t.status === 'in_progress' || t.status === 'review') next.in_progress++
        else if (t.status === 'done') next.done++
        else if (t.status === 'failed') next.failed++
      }
      setCounts(next)
    }).catch(() => {})
  }, [])

  return (
    <ModuleCard title="Task Summary" href="/tasks">
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Inbox" value={counts.inbox} />
        <Stat label="In Progress" value={counts.in_progress} color="text-amber-400" />
        <Stat label="Done" value={counts.done} color="text-emerald-400" />
        <Stat label="Failed" value={counts.failed} color="text-rose-400" />
      </div>
    </ModuleCard>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-2xs text-muted-foreground">{label}</div>
    </div>
  )
}

function QuickActionsModule() {
  const router = useRouter()
  const actions = [
    { label: 'New Task', href: '/tasks?action=new', icon: '➕' },
    { label: 'Assign Agent', href: '/agents', icon: '🤖' },
    { label: 'View Schedule', href: '/schedule', icon: '📅' },
    { label: 'Send Message', href: '/chat', icon: '💬' },
  ]
  return (
    <ModuleCard title="Mission Control Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => router.push(a.href)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-primary/40 bg-surface-1 hover:bg-surface-1/70 text-xs text-foreground transition-colors"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </ModuleCard>
  )
}

function SystemHealthModule() {
  const [health, setHealth] = useState({ gateway: 'unknown', mc: 'unknown', uptime: '—' })
  useEffect(() => {
    fetch('/api/status?action=health').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setHealth({
        gateway: d.gateway?.status ?? d.gateway ?? 'unknown',
        mc: d.mc?.status ?? 'healthy',
        uptime: d.uptime ?? '—',
      })
    }).catch(() => {})
  }, [])

  return (
    <ModuleCard title="System Health" href="/settings/tkmc/audit">
      <div className="space-y-2">
        <HealthRow label="Gateway" status={health.gateway} />
        <HealthRow label="Mission Control" status={health.mc} />
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <span className="text-muted-foreground">Uptime</span>
          <span className="text-foreground font-mono">{health.uptime}</span>
        </div>
      </div>
    </ModuleCard>
  )
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const ok = ['healthy', 'ok', 'active', 'online'].includes(status.toLowerCase())
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {status}
      </span>
    </div>
  )
}

function ScheduledPreviewModule() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/cron').then(r => r.ok ? r.json() : []).then(d => {
      setItems((Array.isArray(d) ? d : d.jobs ?? d.crons ?? []).slice(0, 5))
    }).catch(() => {})
  }, [])

  return (
    <ModuleCard title="Scheduled Tasks" href="/schedule">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No scheduled tasks</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={it.id ?? i} className="flex items-center justify-between text-xs">
              <span className="text-foreground truncate flex-1">{it.name ?? it.title ?? it.command?.slice(0, 40)}</span>
              <span className="text-2xs text-muted-foreground ml-2">{it.schedule ?? it.cron ?? it.next_run ?? ''}</span>
            </div>
          ))}
        </div>
      )}
    </ModuleCard>
  )
}
