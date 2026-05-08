import { GatewayControlShell, GatewayFact, GatewayMetric } from '@/components/gateway/GatewayControlShell'
import { buildGatewayStatusPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayHealthPage() {
  const registry = await loadGatewayRegistry()
  const status = buildGatewayStatusPayload(registry)

  return (
    <GatewayControlShell
      active='health'
      title='Gateway Health'
      description='Read-only health snapshot for Gateway, Agent Zero, Hermes, Bridge/MCP, Brain, and OpenClaw+ runtime tracks.'
      badge='Health snapshot'
    >
      <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <GatewayMetric label='overall' value={status.status} />
        <GatewayMetric label='blocked' value={String(status.totals.blocked)} />
        <GatewayMetric label='degraded' value={String(status.totals.degraded)} />
        <GatewayMetric label='generated' value={new Date(status.generated_at).toLocaleTimeString()} />
      </section>

      <section className='grid gap-4 lg:grid-cols-2'>
        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Core Agents</h2>
          <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
            <GatewayFact label='agent zero' value={status.agent_zero.health.summary} />
            <GatewayFact label='hermes' value={status.hermes.health.summary} />
            <GatewayFact label='agent zero blocker' value={status.agent_zero.blockers[0] || 'none'} />
            <GatewayFact label='hermes blocker' value={status.hermes.blockers[0] || 'none'} />
          </dl>
        </article>
        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Safety</h2>
          <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
            <GatewayFact label='auth required' value={status.safety.auth_required ? 'yes' : 'no'} />
            <GatewayFact label='secrets exposed' value={status.safety.secrets_exposed ? 'yes' : 'no'} />
            <GatewayFact label='raw paths exposed' value={status.safety.raw_paths_exposed ? 'yes' : 'no'} />
            <GatewayFact label='writes' value={status.safety.bridge_session_required_for_writes ? 'Bridge required' : 'not required'} />
          </dl>
        </article>
      </section>
    </GatewayControlShell>
  )
}

