import { GatewayControlShell, GatewayFact, GatewayMetric } from '@/components/gateway/GatewayControlShell'
import { buildGatewayStatusPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayOverviewPage() {
  const registry = await loadGatewayRegistry()
  const status = buildGatewayStatusPayload(registry)

  return (
    <GatewayControlShell
      active='overview'
      title='Gateway Overview / Nucleus'
      description='Additive Mission Control surface for Gateway routing, policy, registry, health, dispatcher, token governance, and Agent Hub control.'
      badge='Read-only by default'
    >
      <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <GatewayMetric label='status' value={status.status} />
        <GatewayMetric label='nodes' value={String(status.totals.nodes)} />
        <GatewayMetric label='flows' value={String(status.totals.flows)} />
        <GatewayMetric label='blocked / degraded' value={String(status.totals.blocked + status.totals.degraded)} />
      </section>

      <section className='rounded-lg border border-amber-300/25 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100'>
        <strong>Production truth:</strong> Agent Zero is commander. Hermes remains gated until <code>hermes_called:true</code>. Pi is advisory/shadow. SpaceAgent and Paperclip stay honest as pending/partial until live proof is confirmed. OpenClaw+ is runtime/skills/agents layer.
      </section>

      <section className='grid gap-4 lg:grid-cols-2'>
        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Operating Chain</h2>
          <p className='mt-2 text-sm leading-6 text-slate-300'>Owner → Gateway / Nucleus → Agent Zero / Pi / Hermes → Paperclip → OpenClaw+ → mini-agents / tools / reports / approvals.</p>
          <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
            <GatewayFact label='agent zero' value={status.agent_zero.status} />
            <GatewayFact label='hermes' value={status.hermes.status} />
            <GatewayFact label='bridge writes' value={status.safety.bridge_session_required_for_writes ? 'required' : 'not required'} />
            <GatewayFact label='opencloud fork2 / smb' value={status.buildwiki_openclaw.fork2_state || 'blocked'} />
          </dl>
        </article>

        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Owner Entry</h2>
          <p className='mt-2 text-sm leading-6 text-slate-300'>Mission Control now exposes Gateway as its own control surface. Use tabs above to inspect routes, registry, policy/Bridge, health, dispatcher, token governor, and Agent Hub with Paperclip drill-down.</p>
          <div className='mt-4 flex flex-wrap gap-2'>
            <a href='/gateway/agent-hub' className='rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15'>Open Agent Hub</a>
            <a href='/gateway/agent-hub/paperclip' className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Open Paperclip</a>
          </div>
        </article>
      </section>
    </GatewayControlShell>
  )
}

