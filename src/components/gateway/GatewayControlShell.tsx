import type { ReactNode } from 'react'

type GatewayTabId =
  | 'overview'
  | 'routes'
  | 'registry'
  | 'policies'
  | 'health'
  | 'dispatcher'
  | 'token-governor'
  | 'agent-hub'

const TABS: Array<{ id: GatewayTabId; label: string; href: string }> = [
  { id: 'overview', label: 'Overview', href: '/gateway' },
  { id: 'routes', label: 'Routes', href: '/gateway/routes' },
  { id: 'registry', label: 'Registry', href: '/gateway/registry' },
  { id: 'policies', label: 'Policies / Bridge', href: '/gateway/policies' },
  { id: 'health', label: 'Health', href: '/gateway/health' },
  { id: 'dispatcher', label: 'Dispatcher', href: '/gateway/dispatcher' },
  { id: 'token-governor', label: 'Token Governor', href: '/gateway/token-governor' },
  { id: 'agent-hub', label: 'Agent Hub', href: '/gateway/agent-hub' },
]

export function GatewayControlShell(input: {
  active: GatewayTabId
  title: string
  description: string
  children: ReactNode
  badge?: string
}) {
  return (
    <main className='min-h-screen bg-[#070912] px-4 py-6 text-slate-100 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-[1480px] flex-col gap-5'>
        <header className='border-b border-white/10 pb-5'>
          <p className='text-xs font-semibold uppercase text-cyan-300'>Mission Control / Gateway</p>
          <div className='mt-3 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-semibold text-white sm:text-4xl'>{input.title}</h1>
              <p className='mt-2 max-w-4xl text-sm leading-6 text-slate-300'>{input.description}</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <a href='/designer-mission-control/design/gateway/index.html' className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Designer Gateway Pack</a>
              {input.badge && <span className='rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100'>{input.badge}</span>}
            </div>
          </div>
        </header>

        <nav className='flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-2' aria-label='Gateway sections'>
          {TABS.map((tab) => {
            const active = tab.id === input.active
            return (
              <a
                key={tab.id}
                href={tab.href}
                className={
                  'rounded-md border px-3 py-2 text-sm font-semibold transition ' +
                  (active
                    ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-slate-200 hover:border-cyan-300/40')
                }
              >
                {tab.label}
              </a>
            )
          })}
          <a href='/gateway/agent-hub/paperclip' className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Paperclip</a>
        </nav>

        {input.children}
      </div>
    </main>
  )
}

export function GatewayMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-4'>
      <div className='text-xs font-semibold uppercase text-slate-500'>{label}</div>
      <div className='mt-2 text-2xl font-semibold text-white'>{value}</div>
    </div>
  )
}

export function GatewayFact({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border border-white/10 bg-black/20 px-3 py-2'>
      <dt className='text-xs uppercase text-slate-500'>{label}</dt>
      <dd className='mt-1 break-words font-medium text-slate-100'>{value}</dd>
    </div>
  )
}

