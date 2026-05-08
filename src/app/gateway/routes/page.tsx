import { GatewayControlShell } from '@/components/gateway/GatewayControlShell'
import { buildGatewayFlowsPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayRoutesPage() {
  const registry = await loadGatewayRegistry()
  const payload = buildGatewayFlowsPayload(registry)

  return (
    <GatewayControlShell
      active='routes'
      title='Gateway Routes'
      description='Read-only visibility into Gateway flow contracts, route decisions, and blocking reasons.'
      badge={`${payload.flows.length} flows`}
    >
      <section className='grid gap-3'>
        {payload.flows.map((flow) => (
          <article key={flow.flow_id} className='rounded-lg border border-white/10 bg-white/[0.03] p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='text-sm font-semibold text-white'>{flow.requested_action}</h2>
              <span className='rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-slate-200'>{flow.status}</span>
            </div>
            <p className='mt-2 text-sm text-slate-300'>{flow.result.summary}</p>
            <dl className='mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4'>
              <div><dt>source</dt><dd className='text-slate-200'>{flow.source}</dd></div>
              <div><dt>target</dt><dd className='text-slate-200'>{flow.target}</dd></div>
              <div><dt>decision</dt><dd className='text-slate-200'>{flow.policy_result.route_decision}</dd></div>
              <div><dt>bridge required</dt><dd className='text-slate-200'>{flow.policy_result.requires_bridge_session ? 'yes' : 'no'}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </GatewayControlShell>
  )
}

