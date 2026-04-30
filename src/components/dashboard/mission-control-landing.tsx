'use client'

import { useEffect, useState } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import { Button } from '@/components/ui/button'

type ProviderSummary = {
  total?: number
  by_state?: Record<string, number>
}

type ProviderPayload = {
  ok?: boolean
  summary?: ProviderSummary
  providers?: Array<{ id: string; name: string; state: string }>
}

export function MissionControlLanding() {
  const navigateToPanel = useNavigateToPanel()
  const [providerCount, setProviderCount] = useState<number | null>(null)
  const [providerStates, setProviderStates] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/providers', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as ProviderPayload
      })
      .then((data) => {
        if (cancelled) return
        setProviderCount(data.summary?.total ?? data.providers?.length ?? null)
        setProviderStates(data.summary?.by_state ?? {})
      })
      .catch(() => {
        if (cancelled) return
        setProviderCount(null)
        setProviderStates({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  const states = Object.entries(providerStates)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${state.replace(/_/g, ' ')} ${count}`)
    .join(' · ')

  return (
    <section className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Official TKMC Interface
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                To-Knowledge Mission Control
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                The old ClaudeClaw static /mc interface is retired. Use this TKMC app for Agent Network, provider visibility, approvals, and the active operations dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigateToPanel('agents')}>Open Agent Network</Button>
              <Button variant="outline" onClick={() => navigateToPanel('settings')}>Settings</Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Primary surface</div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">Agent Network</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Read-only Phase A view for Tony, Agent Zero, Hermes, OpenClaw Gateway, and the ClaudeClaw specialist agents.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => navigateToPanel('agents')}>
              Go to /agents
            </Button>
          </article>

          <article className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Bridge providers</div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{providerCount ?? 'Checking'} providers</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {providerCount == null
                ? 'Provider registry is loading from the authenticated backend.'
                : `The Bridge Provider panel is active with ${providerCount} registered providers.`}
            </p>
            {states && <p className="mt-3 text-xs text-muted-foreground">{states}</p>}
          </article>

          <article className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Retired interface</div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">/mc is disabled</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Old ClaudeClaw Designer SPA links now redirect back to TKMC login so the owner is not sent to the wrong interface.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
