'use client'

// TKMC Phase 5 — Horizontal line-cook style schedule
// Replaces vertical ticket scrolling with horizontal flow: status columns side by side
// Priority tickets for today first. Click a ticket → opens task workspace.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'pending' | 'assigned' | 'in_progress' | 'complete' | 'archived' | 'on_hold'

const STATUS_COLUMNS: { id: Status; label: string; color: string; icon: string }[] = [
  { id: 'pending', label: 'Pending', color: 'border-muted-foreground/30', icon: '⏳' },
  { id: 'assigned', label: 'Assigned', color: 'border-blue-500/40', icon: '📌' },
  { id: 'in_progress', label: 'In Progress', color: 'border-amber-500/40', icon: '⚡' },
  { id: 'complete', label: 'Complete', color: 'border-emerald-500/40', icon: '✓' },
  { id: 'archived', label: 'Archived', color: 'border-muted-foreground/20', icon: '📦' },
  { id: 'on_hold', label: 'On Hold', color: 'border-rose-500/40', icon: '⏸️' },
]

interface Task {
  id: number | string
  title: string
  status: string
  assigned_to?: string | null
  agent?: string
  deadline?: number | null
  due_at?: number | null
  priority?: string
  progress?: number
  completion_percentage?: number
}

function normalizeStatus(s: string): Status {
  const v = s.toLowerCase()
  if (v === 'inbox' || v === 'pending') return 'pending'
  if (v === 'assigned') return 'assigned'
  if (v === 'in_progress' || v === 'review' || v === 'quality_review') return 'in_progress'
  if (v === 'done' || v === 'complete' || v === 'completed') return 'complete'
  if (v === 'archived') return 'archived'
  if (v === 'on_hold' || v === 'blocked' || v === 'paused') return 'on_hold'
  return 'pending'
}

function progressOf(t: Task): number {
  if (typeof t.completion_percentage === 'number') return t.completion_percentage
  if (typeof t.progress === 'number') return t.progress
  const s = normalizeStatus(t.status)
  if (s === 'complete') return 100
  if (s === 'in_progress') return 50
  if (s === 'assigned') return 10
  return 0
}

function deadlineOf(t: Task): number | null {
  return t.deadline ?? t.due_at ?? null
}

function priorityRank(t: Task): number {
  const p = (t.priority ?? '').toLowerCase()
  if (p === 'critical' || p === 'urgent') return 0
  if (p === 'high') return 1
  if (p === 'medium' || p === 'normal') return 2
  return 3
}

export function LineCookSchedule() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [assigning, setAssigning] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [tr, ar] = await Promise.all([
        fetch('/api/tasks', { cache: 'no-store' }),
        fetch('/api/agents', { cache: 'no-store' }),
      ])
      if (tr.ok) {
        const d = await tr.json()
        setTasks(Array.isArray(d) ? d : d.tasks ?? [])
      }
      if (ar.ok) {
        const d = await ar.json()
        const list = Array.isArray(d) ? d : d.agents ?? []
        setAgents(list.map((a: any) => a.name))
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Priority tickets for today (top banner)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todaysPriority = tasks
    .filter(t => {
      const s = normalizeStatus(t.status)
      if (s === 'complete' || s === 'archived') return false
      const dl = deadlineOf(t)
      if (!dl) return priorityRank(t) < 2
      return dl < tomorrow.getTime()
    })
    .sort((a, b) => {
      const pr = priorityRank(a) - priorityRank(b)
      if (pr !== 0) return pr
      const da = deadlineOf(a) ?? Infinity
      const db = deadlineOf(b) ?? Infinity
      return da - db
    })
    .slice(0, 6)

  // Group all tasks by normalized status
  const byStatus: Record<Status, Task[]> = {
    pending: [], assigned: [], in_progress: [], complete: [], archived: [], on_hold: [],
  }
  for (const t of tasks) byStatus[normalizeStatus(t.status)].push(t)

  async function assignTo(task: Task, agent: string) {
    setAssigning(true)
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: agent, status: 'assigned' }),
      })
      await load()
      setSelectedTask(null)
    } finally { setAssigning(false) }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's priority first — horizontal task flow for fast scanning.
          </p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border">
          Refresh
        </button>
      </div>

      {/* Today's priority banner */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-amber-400">🔥</span>
          Today's Priority ({todaysPriority.length})
        </h3>
        {todaysPriority.length === 0 ? (
          <p className="text-xs text-muted-foreground">No urgent tickets for today. Great work.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {todaysPriority.map(t => (
              <TicketCard
                key={t.id}
                task={t}
                onClick={() => setSelectedTask(t)}
                priority
              />
            ))}
          </div>
        )}
      </div>

      {/* Line-cook columns: horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STATUS_COLUMNS.map(col => (
            <div key={col.id} className={`w-72 flex-shrink-0 rounded-lg border-t-2 ${col.color} bg-surface-1/30`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>{col.icon}</span>
                  {col.label}
                </h3>
                <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-1 text-muted-foreground">
                  {byStatus[col.id].length}
                </span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                {loading ? (
                  <div className="text-2xs text-muted-foreground text-center py-4">Loading…</div>
                ) : byStatus[col.id].length === 0 ? (
                  <div className="text-2xs text-muted-foreground text-center py-4">—</div>
                ) : byStatus[col.id].map(t => (
                  <TicketCard key={t.id} task={t} onClick={() => setSelectedTask(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task detail / assign panel */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTask(null)}>
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Task #{selectedTask.id}</h3>
              <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{selectedTask.title}</h2>
                <div className="flex gap-2 mt-2 text-2xs">
                  <span className="px-2 py-0.5 rounded-full bg-surface-1">{normalizeStatus(selectedTask.status)}</span>
                  {selectedTask.priority && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{selectedTask.priority}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned</span>
                  <span>{selectedTask.assigned_to ?? selectedTask.agent ?? 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{progressOf(selectedTask)}%</span>
                </div>
                {deadlineOf(selectedTask) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deadline</span>
                    <span>{new Date(deadlineOf(selectedTask)!).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {normalizeStatus(selectedTask.status) === 'pending' && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold text-foreground mb-2">Assign to agent</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {agents.map(a => (
                      <button
                        key={a}
                        onClick={() => assignTo(selectedTask, a)}
                        disabled={assigning}
                        className="text-2xs px-2 py-1 rounded border border-border hover:border-primary/40 disabled:opacity-50"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => { router.push(`/tasks?id=${selectedTask.id}`); setSelectedTask(null) }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
                >
                  Open full task →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TicketCard({ task, onClick, priority }: { task: Task; onClick: () => void; priority?: boolean }) {
  const progress = progressOf(task)
  const deadline = deadlineOf(task)
  const assignee = task.assigned_to ?? task.agent ?? 'Unassigned'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left ${priority ? 'w-64 flex-shrink-0' : ''} rounded-md border border-border bg-card p-3 hover:border-primary/40 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-xs font-semibold text-foreground line-clamp-2 flex-1">{task.title}</h4>
        {task.priority && task.priority !== 'normal' && (
          <span className="text-2xs px-1.5 py-0 rounded bg-amber-500/15 text-amber-400">
            {task.priority[0].toUpperCase()}
          </span>
        )}
      </div>

      <div className="h-1 rounded-full bg-surface-1 overflow-hidden mb-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-2xs">
        <span className="text-muted-foreground truncate">{assignee}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>

      {deadline && (
        <div className="mt-1 text-2xs text-muted-foreground">
          Due: {new Date(deadline).toLocaleDateString()}
        </div>
      )}
    </button>
  )
}
