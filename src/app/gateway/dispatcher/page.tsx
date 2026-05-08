import { GatewayControlShell, GatewayFact } from '@/components/gateway/GatewayControlShell'
import { buildPiDispatcherStatusPayload, recommendPiGatewayRoute } from '@/lib/gateway-pi-dispatcher'
import { loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

const DISPATCHER_PROBES = [
  'Run web research on public sources and summarize evidence.',
  'Send a Google Drive upload for this report.',
  'Design a workflow and skill plan for this owner request.',
  'Run SMB Fork 2 sync now.',
]

export default async function GatewayDispatcherPage() {
  const registry = await loadGatewayRegistry()
  const status = buildPiDispatcherStatusPayload(registry)
  const probes = DISPATCHER_PROBES.map((ownerRequest) => recommendPiGatewayRoute(registry, { ownerRequest, requester: 'gateway' }))

  return (
    <GatewayControlShell
      active='dispatcher'
      title='Gateway Dispatcher (Pi Shadow)'
      description='Pi remains advisory-only shadow dispatcher. It recommends routes and policy results but cannot execute or write.'
      badge='Advisory only'
    >
      <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
        <h2 className='text-lg font-semibold text-white'>Pi Runtime Status</h2>
        <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4'>
          <GatewayFact label='status' value={status.status} />
          <GatewayFact label='authority' value={status.authority} />
          <GatewayFact label='execution enabled' value={status.execution_enabled ? 'yes' : 'no'} />
          <GatewayFact label='writes enabled' value={status.writes_enabled ? 'yes' : 'no'} />
          <GatewayFact label='runtime mode' value={status.runtime.mode} />
          <GatewayFact label='runtime reachable' value={status.runtime.reachable ? 'yes' : 'no'} />
          <GatewayFact label='blocker' value={status.runtime.blocker} />
          <GatewayFact label='owner summary' value={status.owner_visible_summary} />
        </dl>
      </section>

      <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
        <h2 className='text-lg font-semibold text-white'>Route Recommendation Probes</h2>
        <div className='mt-4 grid gap-3'>
          {probes.map((probe) => (
            <article key={probe.owner_request} className='rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>
              <p className='font-semibold text-white'>{probe.owner_request}</p>
              <p className='mt-2'>Recommended: {probe.selected_route.target} ({probe.recommended_agent || 'none'})</p>
              <p className='mt-1'>Policy: {probe.policy_result}{probe.blocked_reason ? ` · ${probe.blocked_reason}` : ''}</p>
            </article>
          ))}
        </div>
      </section>
    </GatewayControlShell>
  )
}

