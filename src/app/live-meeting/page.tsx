'use client'

// TKMC — Live Meeting Room (workspace overlay)
// Per rules: keep current live meeting structure, open as overlay on top of existing interface

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LiveMeetingRoom() {
  const router = useRouter()
  const [active, setActive] = useState<any[]>([])

  useEffect(() => {
    // Fetch active meetings/sessions
    fetch('/api/sessions').then(r => r.ok ? r.json() : []).then(d => {
      setActive((Array.isArray(d) ? d : d.sessions ?? []).filter((s: any) => s.active || s.status === 'active').slice(0, 6))
    }).catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-1">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h1 className="text-sm font-semibold text-foreground">Live Meeting Room</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            title="Backend required before meeting creation can run."
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-500/40 text-white/70 cursor-not-allowed"
          >
            Start new meeting · backend required
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-border"
          >
            Return to Mission Control
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-surface-1 flex items-center justify-center mb-4">
              <span className="text-4xl">📹</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No active meetings</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start a new meeting above, or wait for scheduled meetings to begin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((m, i) => (
              <div key={m.id ?? i} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="aspect-video bg-black flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">Meeting preview</span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-foreground">{m.title ?? `Session ${m.id}`}</h3>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    {m.participants?.length ?? 0} participants · Started {m.started_at ? new Date(m.started_at).toLocaleTimeString() : '—'}
                  </p>
                  <button
                    disabled
                    title="Live meeting join is locked until the meeting backend is connected."
                    className="w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/40 text-primary-foreground/70 cursor-not-allowed"
                  >
                    Join · backend required
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
