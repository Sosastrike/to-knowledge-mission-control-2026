import { GatewayControlShell } from '@/components/gateway/GatewayControlShell'
import { buildGatewayNodesPayload, loadGatewayRegistry } from '@/lib/gateway-registry-api'

export const dynamic = 'force-dynamic'

export default async function GatewayRegistryPage() {
  const registry = await loadGatewayRegistry()
  const payload = buildGatewayNodesPayload(registry)

  return (
    <GatewayControlShell
      active='registry'
      title='Gateway Registry'
      description='Registry view for agents, runtimes, models, integrations, and supporting systems with honest R/W/X status.'
      badge={`${payload.nodes.length} nodes`}
    >
      <section className='overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]'>
        <table className='min-w-full divide-y divide-white/10 text-sm'>
          <thead className='bg-black/20 text-left text-xs uppercase text-slate-400'>
            <tr>
              <th className='px-3 py-3'>Node</th>
              <th className='px-3 py-3'>Type</th>
              <th className='px-3 py-3'>Status</th>
              <th className='px-3 py-3'>R</th>
              <th className='px-3 py-3'>W</th>
              <th className='px-3 py-3'>X</th>
              <th className='px-3 py-3'>Bridge</th>
              <th className='px-3 py-3'>Blocker</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-white/10'>
            {payload.nodes.map((node) => (
              <tr key={node.id} className='text-slate-200'>
                <td className='px-3 py-2 font-semibold'>{node.label}</td>
                <td className='px-3 py-2'>{node.type}</td>
                <td className='px-3 py-2'>{node.status}</td>
                <td className='px-3 py-2'>{node.read_enabled ? 'yes' : 'no'}</td>
                <td className='px-3 py-2'>{node.write_enabled ? 'yes' : 'no'}</td>
                <td className='px-3 py-2'>{node.execution_enabled ? 'yes' : 'no'}</td>
                <td className='px-3 py-2'>{node.requires_bridge_session ? 'required' : 'no'}</td>
                <td className='px-3 py-2 text-amber-200'>{node.blocked_reason || 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </GatewayControlShell>
  )
}

