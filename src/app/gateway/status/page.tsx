import { buildGatewayStatusPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayStatusPage() {
  const registry = await loadGatewayRegistry()
  const status = buildGatewayStatusPayload(registry)

  return (
    <main className='min-h-screen bg-[#070912] px-4 py-6 text-slate-100 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-5'>
        <header className='border-b border-white/10 pb-5'>
          <a href='/gateway/agent-hub' className='text-sm font-semibold text-cyan-300 hover:text-cyan-200'>Agent Hub / Control Center</a>
          <div className='mt-3 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-semibold text-white sm:text-4xl'>Gateway Status</h1>
              <p className='mt-2 max-w-4xl text-sm leading-6 text-slate-300'>Read-only production status for Gateway routing, Bridge/MCP, models, Brain systems, Build-Wiki / Farmer, and OpenClaw+ runtime visibility.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <a href='/api/gateway/status' className='rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15'>Status API</a>
              <a href='/api/bridge/button-contracts' className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Button Contracts</a>
            </div>
          </div>
        </header>

        <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4' aria-label='Gateway status summary'>
          <Metric label='status' value={status.status} />
          <Metric label='nodes' value={String(status.totals.nodes)} />
          <Metric label='capabilities' value={String(status.totals.capabilities)} />
          <Metric label='blocked / degraded' value={String(status.totals.blocked + status.totals.degraded)} />
        </section>

        <section className='rounded-lg border border-amber-300/25 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100'>
          <strong>Button rule:</strong> every visible Mission Control action must be live with route proof, read-only, Bridge Session-gated, credential-blocked, backend-blocked, or disabled with an exact reason. Fake Done and fake live states are not allowed.
        </section>

        <section className='grid gap-4 lg:grid-cols-2'>
          <StatusCard title='Agent Zero' rows={[
            ['status', status.agent_zero.status],
            ['health', status.agent_zero.health.summary],
            ['blocker', status.agent_zero.blockers[0] || 'none'],
          ]} />
          <StatusCard title='Hermes' rows={[
            ['status', status.hermes.status],
            ['health', status.hermes.health.summary],
            ['blocker', status.hermes.blockers[0] || 'none'],
          ]} />
          <StatusCard title='Bridge / MCP' rows={[
            ['providers', String(status.bridge_mcp.providers)],
            ['mcp servers', String(status.bridge_mcp.mcp_servers)],
            ['tool schemas visible', status.bridge_mcp.mcp_tools_visible ? 'yes' : 'no'],
            ['execution', 'disabled'],
          ]} />
          <StatusCard title='OpenClaw+ / Build-Wiki / Farmer' rows={[
            ['OpenClaw+ status', status.buildwiki_openclaw.openclaw_status],
            ['timer', status.buildwiki_openclaw.timer_state || 'unknown'],
            ['service', status.buildwiki_openclaw.service_state || 'unknown'],
            ['run now', 'Bridge Session + owner approval required'],
            ['target service', status.buildwiki_openclaw.run_now_target_service],
          ]} />
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Safety</h2>
              <p className='mt-1 text-sm text-slate-400'>Status only. No write, execution, upload, send, Zapier, HeyGen, SMB, or farmer action is triggered from this page.</p>
            </div>
            <span className='rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100'>read-only</span>
          </div>
          <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4'>
            <Fact label='auth required' value={status.safety.auth_required ? 'yes' : 'no'} />
            <Fact label='secrets exposed' value={status.safety.secrets_exposed ? 'yes' : 'no'} />
            <Fact label='raw paths exposed' value={status.safety.raw_paths_exposed ? 'yes' : 'no'} />
            <Fact label='writes' value='Bridge Session required' />
          </dl>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-4'>
      <div className='text-xs font-semibold uppercase text-slate-500'>{label}</div>
      <div className='mt-2 text-2xl font-semibold text-white'>{value}</div>
    </div>
  )
}

function StatusCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
      <h2 className='text-lg font-semibold text-white'>{title}</h2>
      <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
        {rows.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
      </dl>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border border-white/10 bg-black/20 px-3 py-2'>
      <dt className='text-xs uppercase text-slate-500'>{label}</dt>
      <dd className='mt-1 break-words font-medium text-slate-100'>{value}</dd>
    </div>
  )
}
