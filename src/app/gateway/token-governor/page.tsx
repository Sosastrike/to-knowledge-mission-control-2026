import { GatewayControlShell, GatewayFact } from '@/components/gateway/GatewayControlShell'
import { buildPaperclipTokenGovernorPlan } from '@/lib/paperclip-bridge'

export const dynamic = 'force-dynamic'

export default async function GatewayTokenGovernorPage() {
  const generatedAt = new Date().toISOString()
  const plan = buildPaperclipTokenGovernorPlan({
    generatedAt,
    budgets: [
      { scope: 'company', id: 'to-knowledge', name: 'To-Knowledge', budgetCents: 80000, spentCents: 43000, projectedCents: 9000 },
      { scope: 'agent', id: 'agent-zero', name: 'Agent Zero', budgetCents: 22000, spentCents: 17500, projectedCents: 2500 },
      { scope: 'model_provider', id: 'openai', name: 'OpenAI / Codex', budgetCents: 26000, spentCents: 13200, projectedCents: 3100 },
      { scope: 'model_provider', id: 'firecrawl', name: 'Firecrawl', budgetCents: null, spentCents: 0, projectedCents: 0 },
    ],
  })

  return (
    <GatewayControlShell
      active='token-governor'
      title='Gateway Token Governor'
      description='Dry-run budget governance imported through Paperclip before runtime execution. Visibility is live; enforcement is still Bridge/policy gated.'
      badge='Dry-run governance'
    >
      <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
        <h2 className='text-lg font-semibold text-white'>Governor Summary</h2>
        <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4'>
          <GatewayFact label='mode' value={plan.mode} />
          <GatewayFact label='ok' value={plan.ok ? 'yes' : 'no'} />
          <GatewayFact label='alerts' value={String(plan.alerts.length)} />
          <GatewayFact label='hard stops' value={String(plan.hard_stops.length)} />
          <GatewayFact label='writes enabled' value={plan.writes_enabled ? 'yes' : 'no'} />
          <GatewayFact label='execution enabled' value={plan.execution_enabled ? 'yes' : 'no'} />
          <GatewayFact label='blocked reason' value={plan.blocked_reason || 'none'} />
          <GatewayFact label='owner summary' value={plan.owner_visible_summary} />
        </dl>
      </section>

      <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
        <h2 className='text-lg font-semibold text-white'>Budget Decisions</h2>
        <div className='mt-4 grid gap-3'>
          {plan.budgets.map((budget) => (
            <article key={`${budget.scope}:${budget.id}`} className='rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='font-semibold text-white'>{budget.scope} · {budget.name}</p>
                <span className='rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-100'>{budget.status}</span>
              </div>
              <p className='mt-2'>Decision: {budget.decision}. Usage: {budget.usage_percent === null ? 'n/a' : `${budget.usage_percent}%`}.</p>
              <p className='mt-1 text-xs text-amber-200'>{budget.blocked_reason || 'no blocker'}</p>
            </article>
          ))}
        </div>
      </section>
    </GatewayControlShell>
  )
}

