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

const TOP_NAV_LINKS = [
  { id: 'mission-control-home', label: 'Mission Control Home', href: '/tkmc' },
  { id: 'dashboard', label: 'Dashboard', href: '/tkmc' },
  { id: 'gateway-overview', label: 'Gateway Overview', href: '/gateway' },
  { id: 'agent-hub', label: 'Agent Hub', href: '/gateway/agent-hub' },
]

export function GatewayControlShell(input: {
  active: GatewayTabId
  title: string
  description: string
  children: ReactNode
  badge?: string
}) {
  const activeTab = TABS.find((tab) => tab.id === input.active) || TABS[0]

  return (
    <main className='h-full overflow-y-auto bg-[#070912] px-4 py-6 text-slate-100 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-[1480px] flex-col gap-5'>
        <section className='rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <nav aria-label='Gateway exits' className='flex flex-wrap gap-2'>
              {TOP_NAV_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <nav aria-label='Breadcrumb' className='text-xs text-slate-300'>
              <a href='/tkmc' className='font-semibold text-cyan-200 hover:text-cyan-100'>Mission Control</a>
              <span className='px-1.5 text-slate-500'>/</span>
              <a href='/gateway' className='font-semibold text-cyan-200 hover:text-cyan-100'>Gateway</a>
              <span className='px-1.5 text-slate-500'>/</span>
              <span className='font-semibold text-white'>{activeTab.label}</span>
            </nav>
          </div>
        </section>

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
