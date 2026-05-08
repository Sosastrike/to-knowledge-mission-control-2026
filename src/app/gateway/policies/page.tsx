import { GatewayControlShell, GatewayFact } from '@/components/gateway/GatewayControlShell'
import { buildGatewayPoliciesPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayPoliciesPage() {
  const registry = await loadGatewayRegistry()
  const payload = buildGatewayPoliciesPayload(registry)

  return (
    <GatewayControlShell
      active='policies'
      title='Gateway Policies / Bridge'
      description='Server-side policy outcomes for auth, Bridge Session gating, protected actions, and external write controls.'
      badge='Policy enforced'
    >
      <section className='grid gap-4 lg:grid-cols-2'>
        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Safety Contract</h2>
          <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
            <GatewayFact label='auth required' value={payload.summary.auth_required ? 'yes' : 'no'} />
            <GatewayFact label='bridge for writes' value={payload.summary.bridge_session_required_for_writes ? 'yes' : 'no'} />
            <GatewayFact label='external writes enabled' value={payload.summary.external_writes_enabled ? 'yes' : 'no'} />
            <GatewayFact label='secret safe' value={payload.summary.secret_safe ? 'yes' : 'no'} />
            <GatewayFact label='raw shell' value={payload.summary.raw_shell_enabled ? 'enabled' : 'blocked'} />
            <GatewayFact label='docker socket' value={payload.summary.docker_socket_enabled ? 'enabled' : 'blocked'} />
          </dl>
        </article>
        <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Bridge Session</h2>
          <p className='mt-2 text-sm leading-6 text-slate-300'>Dangerous actions remain server-side gated. Visibility endpoints can be read-only, but write/execute/send/upload actions require scoped Bridge approval.</p>
          <div className='mt-4 flex flex-wrap gap-2'>
            <a href='/api/bridge/agent-zero/bridge-session' className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Bridge status API</a>
            <a href='/api/bridge/agent-zero/bridge-session/audit' className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Bridge audit API</a>
          </div>
        </article>
      </section>

      <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
        <h2 className='text-lg font-semibold text-white'>Policy Rules</h2>
        <ul className='mt-3 space-y-2 text-sm text-slate-300'>
          {payload.rules.map((rule) => <li key={rule.id}>{rule.id}: {rule.label}</li>)}
        </ul>
      </section>
    </GatewayControlShell>
  )
}
