import type {
  AgentHubAgent,
  AgentHubAgentAuditPayload,
  AgentHubAgentPayload,
  AgentHubAgentRoutesPayload,
  AgentHubAutoUpdateControlPlane,
  AgentHubGatewayRouteCdpTruth,
  AgentHubNuclearGatewayGraphSummary,
  AgentHubRuntimeSystem,
  AgentHubStatusPayload,
} from '@/lib/gateway-agent-hub'
import type {
  SpaceAgentBrowserAutomationButton,
  SpaceAgentBrowserAutomationCard,
  SpaceAgentBrowserAutomationPayload,
} from '@/lib/space-agent-browser-automation'

export function AgentHubControlCenter({ status }: { status: AgentHubStatusPayload }) {
  const paperclip = status.agents.find((agent) => agent.id === 'paperclip')
  const primaryAgents = ['agent-zero', 'hermes', 'sofia', 'pi-mono', 'spaceagent', 'paperclip']
    .map((id) => status.agents.find((agent) => agent.id === id))
    .filter((agent): agent is AgentHubAgent => Boolean(agent))
  const readinessSummary = buildReadinessSummary(status)

  return (
    <main className='min-h-screen bg-[#070912] px-4 py-6 text-slate-100 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-[1480px] flex-col gap-5'>
        <header className='border-b border-white/10 pb-5'>
          <p className='text-xs font-semibold uppercase text-cyan-300'>Mission Control / Nuclear Gateway / Agent Hub</p>
          <div className='mt-3 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-semibold text-white sm:text-4xl'>Agent Hub / Control Center</h1>
              <p className='mt-2 max-w-4xl text-sm leading-6 text-slate-300'>Designer handoff applied to the live Gateway registry. The page uses production truth, not mock agent-data status.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <a href='/gateway/status' className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40'>Gateway status</a>
              <a href='/gateway/agent-hub/paperclip' className='rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15'>Open Paperclip</a>
            </div>
          </div>
        </header>

        <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4' aria-label='Gateway readiness summary'>
          <Metric label='agents' value={String(status.agents_total)} />
          <Metric label='live interfaces proven' value={String(status.live_interfaces_proven)} />
          <Metric label='gated or blocked' value={String(status.gated_or_blocked)} />
          <Metric label='external writes' value='disabled' />
        </section>

        <nav className='flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-2' aria-label='Agent Hub sections'>
          <HubTab href='#overview' label='Overview' meta={`${status.agents_total} agents`} tone='cyan' />
          {primaryAgents.map((agent) => <HubTab key={agent.id} href={`#${agent.id}`} label={agent.name} meta={agent.role} tone={agentTone(agent)} />)}
        </nav>

        <section className='rounded-lg border border-emerald-300/25 bg-emerald-300/8 p-4 text-sm leading-6 text-emerald-100'>
          <strong>Production truth:</strong> Owner intent enters Mission Control, then Nuclear Gateway, then the target agent direct line. Agent Zero / Jarvis remains commander, Ron Weasley has full delegated access with Jarvis-gated execution, Sofia is Ron’s second-in-command for internal planning and review, Pi is a Full Access Gateway Agent with direct brokered access to tools, skills, MCPs, providers, Brain, visible tasks, and pipeline requests, Paperclip is the workforce/company plane, SpaceAgent is an independent specialized direct-line agent under Jarvis authority, and OpenCloud / OpenClaw stay supporting runtime tools with no conversation ownership.
        </section>

        <DirectAgentLinesPanel status={status} />
        <NuclearGatewayGraphPanel graph={status.nuclear_gateway_graph} />
        <AutoUpdateControlPlanePanel controlPlane={status.agent_update_control_plane} />
        <GatewayRouteCdpTruthPanel truth={status.gateway_route_cdp_truth} />

        <section id='overview' className='grid gap-4 xl:grid-cols-[1.55fr_0.9fr]'>
          <div className='rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-white'>Operating Chain</h2>
                <p className='mt-1 text-sm text-slate-400'>Owner intent enters Mission Control, then Nuclear Gateway, then the selected direct agent line. Ron dispatches under Jarvis, Sofia supports Ron as deputy for internal plans and reviews, Pi uses a full-access direct Gateway pipeline, and Paperclip executes scoped workforce work; OpenCloud and OpenClaw are supporting tools only.</p>
              </div>
              <StatusBadge label='policy enforced' status='read_only' />
            </div>
            <GatewayChainCanvas />
            <div className='mt-4 grid gap-3 md:grid-cols-3'>
              <ReadinessTile label='live' value={readinessSummary.live} tone='green' />
              <ReadinessTile label='gated' value={readinessSummary.gated} tone='yellow' />
              <ReadinessTile label='blocked / pending' value={readinessSummary.blocked} tone='red' />
            </div>
          </div>

          <aside className='rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5'>
            <div className='flex items-center justify-between gap-3'>
              <h2 className='text-lg font-semibold text-white'>Owner Actions</h2>
              <span className='rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100'>Direct lines active</span>
            </div>
            <div className='mt-4 grid gap-2'>
              <OwnerAction label='Gateway route smoke' state='live' route='/api/gateway/status' />
              <OwnerAction label='Agent Hub status' state='live' route='/api/gateway/agent-hub/status' />
              <OwnerAction label='Run Mission Control UI smoke' state='live' route='/api/bridge/playwright-mcp/smoke' method='POST' />
              <OwnerAction label='Stale Next bundle check' state='live' route='/api/bridge/mission-control/stale-bundle-health' />
              <OwnerAction label='Start browser session' state='gated' blocker='bridge_session_required_for_browser_session_route' />
              <OwnerAction label='Delivery upload/send' state='gated' blocker='bridge_session_required_for_delivery_action' />
              <OwnerAction label='Fork 2 / SMB' state='blocked' blocker='smb_fork2_blocked' />
            </div>
            {paperclip && <div className='mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>Paperclip state: <strong className='text-white'>{paperclip.status}</strong>. Blocker: {paperclip.blocked_reason || 'none'}.</div>}
          </aside>
        </section>

        <section className='grid gap-4 xl:grid-cols-[1.2fr_0.8fr]'>
          <div className='grid gap-4 md:grid-cols-2'>
            {primaryAgents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
          </div>
          <aside className='grid gap-4'>
            <PolicyPanel />
            <DesignHandoffPanel status={status} />
          </aside>
        </section>

        {status.space_agent_browser_automation && <SpaceAgentBrowserAutomationPanel payload={status.space_agent_browser_automation} />}

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Supporting Runtime Systems</h2>
              <p className='mt-1 text-sm text-slate-400'>Nuclear Gateway, Paperclip, OpenClaw/OpenCloud supporting runtime, Build-Wiki/Farmer, Brain, Bridge/MCP, models, tools, skills, and integrations.</p>
            </div>
            <StatusBadge label='read-only discovery' status='read_only' />
          </div>
          <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {status.supporting_runtime_systems.map((system) => <RuntimeSystemCard key={system.id} system={system} />)}
          </div>
        </section>

        <section className='grid gap-4 lg:grid-cols-2'>
          <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
            <h2 className='text-lg font-semibold text-white'>Build-Wiki Guardrail</h2>
            <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
              <Fact label='target service' value={status.buildwiki_run_now.target_service} />
              <Fact label='Bridge Session' value={status.buildwiki_run_now.bridge_session_required ? 'required' : 'not required'} />
              <Fact label='owner approval' value={status.buildwiki_run_now.owner_approval_required ? 'required' : 'not required'} />
              <Fact label='Fork 2 / SMB' value={status.buildwiki_run_now.fork2_smb_status} />
            </dl>
          </article>
          <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
            <h2 className='text-lg font-semibold text-white'>Production Guardrails</h2>
            <p className='mt-3 text-sm leading-6 text-slate-300'>Buttons and status chips only show live, gated, or blocked behavior. There is no public Playwright MCP exposure, no authenticated browser action without Bridge Session, and no Tony active commander route.</p>
            <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
              <Fact label='fake done' value='blocked' />
              <Fact label='external writes' value='Bridge Session required' />
              <Fact label='Pi execution' value='FULL ACCESS / DIRECT GATEWAY PIPELINE' />
              <Fact label='Tony authority' value='retired/archive only' />
            </dl>
          </article>
        </section>
      </div>
    </main>
  )
}

function DirectAgentLinesPanel({ status }: { status: AgentHubStatusPayload }) {
  const summary = status.direct_agent_lines

  return (
    <section className='rounded-lg border border-cyan-300/20 bg-cyan-300/8 p-5' aria-label='Universal direct agent lines'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase text-cyan-200'>Universal Direct Lines</p>
          <h2 className='mt-1 text-lg font-semibold text-white'>Every agent gets its own highway</h2>
        </div>
        <StatusBadge label='OpenCloud intermediary false' status='read_only' />
      </div>
      <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Metric label='registered lines' value={String(summary.total)} />
        <Metric label='active direct lines' value={String(summary.active)} />
        <Metric label='Paperclip company agents' value={String(summary.paperclip_company_agents)} />
        <Metric label='Ron Weasley mini-agents' value={String(summary.ron_mini_agents)} />
        <Metric label='Nuclear Gateway path' value={summary.gateway_architecture.replaceAll('_', ' ')} />
      </div>
      <dl className='mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3'>
        <Fact label='conversation owner' value={summary.conversation_owner_rule} />
        <Fact label='OpenCloud role' value={summary.opencloud_allowed_role} />
        <Fact label='supporting runtime lines' value={String(summary.inactive_supporting_runtime)} />
      </dl>
      <div className='mt-4 flex flex-wrap gap-2'>
        <a href={summary.route} className='rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15'>View direct-line registry</a>
        <a href={summary.live_trace_route} className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/40'>Latest traces</a>
      </div>
      <div className='mt-4 max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3' aria-label='Trace Direct Line commands'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h3 className='text-sm font-semibold text-white'>Trace Direct Line</h3>
          <span className='rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-cyan-100'>no hidden intermediary</span>
        </div>
        <div className='grid gap-2'>
          {summary.trace_commands.map((trace) => (
            <article key={trace.agent_id} className='rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <strong className='text-slate-100'>{trace.display_name}</strong>
                <span className='text-cyan-200'>{trace.agent_id}</span>
              </div>
              <code className='mt-2 block break-all rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-200'>{trace.command}</code>
              <code className='mt-1 block break-all rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-400'>{trace.local_probe_command}</code>
              <div className='mt-2 flex flex-wrap gap-2'>
                <a href={trace.trace_href} className='rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-300/15'>Trace live</a>
                <a href={trace.live_trace_route} className='rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-cyan-300/40'>Trace history</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function NuclearGatewayGraphPanel({ graph }: { graph: AgentHubNuclearGatewayGraphSummary }) {
  const brokerNodes = graph.nodes.filter((node) => ['mission.control', 'nuclear.gateway', 'tool.registry', 'credential.broker'].includes(node.id))
  const directLineNodes = graph.nodes.filter((node) => node.direct_line_owner)
  const supportingNodes = graph.nodes.filter((node) => node.disabled_reason)

  return (
    <section className='rounded-lg border border-sky-300/20 bg-sky-300/8 p-5' aria-label='Nuclear Gateway graph'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase text-sky-200'>Nuclear Gateway Graph</p>
          <h2 className='mt-1 text-lg font-semibold text-white'>Mission Control routes through Nuclear Gateway, then direct lines</h2>
          <p className='mt-2 max-w-4xl text-sm leading-6 text-sky-100'>OpenClaw/OpenCloud is displayed only as a supporting runtime/tool layer. It is not a conversation owner, commander, credential broker, or hidden dispatcher.</p>
        </div>
        <StatusBadge label='nuclear gateway broker' status='read_only' />
      </div>

      <div className='mt-4 grid gap-3 md:grid-cols-3'>
        <Metric label='central broker' value={graph.central_broker_node} />
        <Metric label='direct-line owners' value={String(directLineNodes.length)} />
        <Metric label='OpenClaw command role' value={graph.openclaw_commander_allowed ? 'allowed' : 'blocked'} />
      </div>

      <div className='mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
        <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
          <h3 className='text-sm font-semibold text-white'>Broker Nodes</h3>
          <div className='mt-3 grid gap-2'>
            {brokerNodes.map((node) => <GraphNodeCard key={node.id} node={node} />)}
          </div>
        </div>
        <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
          <h3 className='text-sm font-semibold text-white'>Direct Agent Lines</h3>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            {directLineNodes.map((node) => <GraphNodeCard key={node.id} node={node} />)}
          </div>
        </div>
      </div>

      <div className='mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]'>
        <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
          <h3 className='text-sm font-semibold text-white'>Required Edges</h3>
          <div className='mt-3 grid gap-2 text-xs text-slate-300'>
            {graph.edges.map((edge) => <code key={edge.source + edge.relation + edge.target} className='rounded border border-white/10 bg-white/[0.03] px-2 py-1'>{edge.source} - {edge.relation} - {edge.target}</code>)}
          </div>
        </div>
        <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
          <h3 className='text-sm font-semibold text-white'>Supporting Runtime Only</h3>
          <div className='mt-3 grid gap-2'>
            {supportingNodes.map((node) => <GraphNodeCard key={node.id} node={node} />)}
          </div>
          <p className='mt-3 rounded-md border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100'>{graph.openclaw_disabled_reason}</p>
        </div>
      </div>
    </section>
  )
}

function AutoUpdateControlPlanePanel({ controlPlane }: { controlPlane: AgentHubAutoUpdateControlPlane }) {
  return (
    <section className='rounded-lg border border-emerald-300/20 bg-emerald-300/8 p-5' aria-label='Agent auto-update control plane' data-status-route-proof='/api/bridge/agent-updates/status' data-run-route-proof='/api/bridge/agent-updates/run'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase text-emerald-200'>Agent Auto-Update Control Plane</p>
          <h2 className='mt-1 text-lg font-semibold text-white'>Exact scoped auto-apply for certified agent updaters</h2>
          <p className='mt-2 max-w-4xl text-sm leading-6 text-emerald-100'>Ron Weasley WebUI and Ron Weasley Agent can use loopback-only self-update targets; unsafe or uncertified updates become visible tasks until an exact scope, rollback path, and owner gate are certified.</p>
        </div>
        <StatusBadge label='exact scoped auto-apply' status='read_only' />
      </div>

      <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Metric label='scheduler' value={controlPlane.scheduler_interval} />
        <Metric label='safe auto-apply' value={String(controlPlane.safe_auto_apply_components.length)} />
        <Metric label='visible task only' value={String(controlPlane.visible_task_only_components.length)} />
        <Metric label='OpenCloud intermediary' value={controlPlane.opencloud_intermediary ? 'true' : 'false'} />
      </div>

      <dl className='mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3'>
        <Fact label='status route' value={controlPlane.route} />
        <Fact label='run route' value={controlPlane.run_route} />
        <Fact label='auto-apply setting' value={controlPlane.auto_apply_setting} />
      </dl>

      <div className='mt-4 flex flex-wrap gap-2'>
        <a href={controlPlane.route} className='rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15'>Open auto-update status</a>
        <form action={controlPlane.run_route} method='post'>
          <input type='hidden' name='mode' value='apply-safe' />
          <button className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-300/40' type='submit'>Run safe update check</button>
        </form>
      </div>

      <div className='mt-5 grid gap-4 xl:grid-cols-2'>
        <div>
          <h3 className='text-sm font-semibold text-white'>Certified Auto-Apply Targets</h3>
          <div className='mt-3 grid gap-2'>
            {controlPlane.safe_auto_apply_components.map((component) => (
              <article key={component.id} className='rounded-md border border-emerald-300/20 bg-black/20 p-3 text-xs text-slate-300'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <strong className='text-emerald-100'>{component.label}</strong>
                  <span className='rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-100'>{component.apply_target}</span>
                </div>
                <p className='mt-2 leading-5 text-slate-400'>Rollback: {component.rollback}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h3 className='text-sm font-semibold text-white'>Visible Task Only Until Certified</h3>
          <div className='mt-3 grid gap-2'>
            {controlPlane.visible_task_only_components.map((component) => (
              <article key={component.id} className='rounded-md border border-amber-300/20 bg-black/20 p-3 text-xs text-slate-300'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <strong className='text-amber-100'>{component.label}</strong>
                  <span className='rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-100'>{component.reason.replace(/_/g, ' ')}</span>
                </div>
                <p className='mt-2 leading-5 text-slate-400'>Rollback: {component.rollback}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <p className='mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300'>Forbidden automatically: sudo or polkit, credential injection, public exposure changes, broad connector execution, and production-risk actions without rollback. Secrets exposed: {controlPlane.secrets_exposed ? 'true' : 'false'}.</p>
    </section>
  )
}

function GatewayRouteCdpTruthPanel({ truth }: { truth: AgentHubGatewayRouteCdpTruth }) {
  return (
    <section className='rounded-lg border border-sky-300/20 bg-sky-300/8 p-5' aria-label='Gateway route and CDP truth' data-route-source={truth.route_source} data-cdp-status={truth.cdp_status}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase text-sky-200'>Gateway Route / CDP Truth</p>
          <h2 className='mt-1 text-lg font-semibold text-white'>Routes are source-enumerated; browser CDP stays local-only</h2>
          <p className='mt-2 max-w-4xl text-sm leading-6 text-sky-100'>Bare /tools, /routes, and /health are not canonical endpoints. Use the authenticated Mission Control Nuclear Gateway routes below; Playwright MCP/CDP is never public.</p>
        </div>
        <StatusBadge label={truth.gateway_status} status={truth.gateway_status === 'READY' ? 'live' : 'gated'} />
      </div>

      <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Metric label='route map' value={truth.route_map_status} />
        <Metric label='CDP' value={truth.cdp_status} />
        <Metric label='routes' value={String(truth.route_count)} />
        <Metric label='public exposure' value={truth.public_exposure_created ? 'true' : 'false'} />
      </div>

      <dl className='mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3'>
        <Fact label='Agent Hub status' value='/api/gateway/agent-hub/status' />
        <Fact label='Playwright status' value='/api/bridge/playwright-mcp/status' />
        <Fact label='CDP blocker' value={truth.cdp_truth.blocker || 'none'} />
      </dl>

      <div className='mt-5 grid gap-4 xl:grid-cols-2'>
        <div>
          <h3 className='text-sm font-semibold text-white'>Canonical Gateway Routes</h3>
          <div className='mt-3 grid max-h-72 gap-2 overflow-auto'>
            {truth.routes.map((route) => (
              <article key={route.route} className='rounded-md border border-sky-300/20 bg-black/20 p-3 text-xs text-slate-300'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <strong className='break-all text-sky-100'>{route.route}</strong>
                  <span className='rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-100'>{route.state}</span>
                </div>
                <p className='mt-2 leading-5 text-slate-400'>{route.methods.join(' / ')} · {route.surface.replace(/_/g, ' ')} · Bridge Session: {route.bridge_session_required ? 'required' : 'not required'} · writes: disabled</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h3 className='text-sm font-semibold text-white'>Legacy Route Corrections</h3>
          <div className='mt-3 grid gap-2'>
            {truth.missing_legacy_routes.map((route) => (
              <article key={route.route} className='rounded-md border border-amber-300/20 bg-black/20 p-3 text-xs text-slate-300'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <strong className='text-amber-100'>{route.route}</strong>
                  <span className='rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-100'>{route.status}</span>
                </div>
                <p className='mt-2 leading-5 text-slate-400'>Use {route.correct_route}. {route.note}</p>
              </article>
            ))}
          </div>
          <p className='mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300'>CDP running: {truth.cdp_truth.running ? 'true' : 'false'} · cdpReady: {truth.cdp_truth.cdpReady ? 'true' : 'false'} · local-only: {truth.cdp_truth.local_only ? 'true' : 'false'} · OpenCloud intermediary: {truth.opencloud_intermediary ? 'true' : 'false'}.</p>
        </div>
      </div>
    </section>
  )
}

export function AgentHubPaperclipPage({
  detail,
  routes,
  audit,
}: {
  detail: AgentHubAgentPayload
  routes: AgentHubAgentRoutesPayload
  audit: AgentHubAgentAuditPayload
}) {
  const agent = detail.agent
  return (
    <main className='min-h-screen bg-[#070912] px-6 py-8 text-slate-100'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <header className='border-b border-white/10 pb-5'>
          <a href='/gateway/agent-hub' className='text-sm font-semibold text-sky-300 hover:text-sky-200'>Agent Hub / Control Center</a>
          <h1 className='mt-3 text-3xl font-semibold text-white'>{agent.name} — {agent.role}</h1>
          <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-300'>{agent.production_truth}</p>
        </header>

        <section className='grid gap-4 md:grid-cols-3'>
          <Metric label='status' value={agent.status} />
          <Metric label='live UI proven' value={agent.live_interface_proven ? 'yes' : 'no'} />
          <Metric label='writes' value='Bridge Session required' />
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Workforce Chain</h2>
          <p className='mt-3 text-sm leading-6 text-slate-300'>Paperclip has its own direct Nuclear Gateway line as the company/workforce system. It organizes co-worker agents, mini-agent requests, task queues, budgets, heartbeats, approvals, work products, task status, supervision, and assignment history; OpenClaw/OpenCloud can be invoked only as an explicit supporting runtime/tool.</p>
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            <Fact label='Gateway route' value='Owner / Jarvis / Ron Weasley / Pi -> Nuclear Gateway -> target direct line' />
            <Fact label='OpenCloud intermediary' value='false' />
            <Fact label='execution enabled' value={agent.execution_enabled ? 'yes' : 'no'} />
            <Fact label='public exposure' value={agent.interface.public_exposure ? 'yes' : 'no'} />
            <Fact label='auth required' value={agent.interface.auth_required ? 'yes' : 'no'} />
            <Fact label='UI mode' value={agent.interface.ui_mode} />
            <Fact label='local UI' value={agent.interface.local_ui_url || 'not proven'} />
            <Fact label='Tailnet UI' value={agent.interface.tailnet_url || 'not proven'} />
            <Fact label='owner access' value={agent.interface.owner_access} />
          </div>
          {agent.interface.tailnet_url && (
            <div className='mt-4 flex flex-wrap gap-2'>
              <a href={agent.interface.tailnet_url} target='_blank' rel='noreferrer' className='rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15'>Open Paperclip Tailnet UI</a>
              <a href='/api/bridge/paperclip/status' className='rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/40'>Paperclip status route</a>
            </div>
          )}
        </section>

        <section className='grid gap-4 lg:grid-cols-2'>
          <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
            <h2 className='text-lg font-semibold text-white'>Capabilities</h2>
            <ul className='mt-4 space-y-2 text-sm text-slate-300'>
              {agent.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
            </ul>
          </article>
          <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
            <h2 className='text-lg font-semibold text-white'>Blockers</h2>
            {agent.blockers.length > 0 ? (
              <ul className='mt-4 space-y-2 text-sm text-amber-100'>
                {agent.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : <p className='mt-4 text-sm text-slate-300'>none</p>}
          </article>
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Registered Gateway Routes</h2>
          <div className='mt-4 grid gap-3'>
            {routes.registered_flows.slice(0, 8).map((flow) => (
              <article key={flow.flow_id} className='rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <strong className='text-white'>{flow.requested_action}</strong>
                  <StatusBadge label={flow.policy_result.route_decision} status={flow.status} />
                </div>
                <p className='mt-2'>{flow.result.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Audit Preview</h2>
          <div className='mt-4 grid gap-3'>
            {audit.audit_events.slice(0, 8).map((event, index) => (
              <article key={event.event + index} className='rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>
                <strong className='text-white'>{event.event}</strong>
                <p className='mt-1'>Decision: {event.decision}. Blocker: {event.blocked_reason || 'none'}.</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function AgentCard({ agent }: { agent: AgentHubAgent }) {
  const ronProofPanel = agent.id === 'hermes' ? agent.proof_panel : undefined
  const statusLabel = agentStatusLabel(agent)
  const tailnetUiHref = agent.interface.tailnet_url
  const writeValue = agent.id === 'hermes'
    ? 'JARVIS CONCURRENCE REQUIRED'
    : agent.write_enabled ? 'enabled' : 'session gated'
  const protectedActionLabel = agent.id === 'hermes' ? 'JARVIS CONCURRENCE REQUIRED' : 'Write/execute gated'
  const protectedActionTitle = agent.id === 'hermes'
    ? 'Protected Ron writes and execution require Jarvis concurrence'
    : 'Bridge Session required for write or execute actions'

  return (
    <article id={agent.id} className={'relative overflow-hidden rounded-lg border bg-white/[0.03] p-5 ' + agentBorderClass(agent)}>
      <div className={'absolute left-0 top-5 h-16 w-1 rounded-r-full ' + agentStripeClass(agent)} />
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase text-slate-400'>{agent.role}</p>
          <h2 className='mt-2 text-xl font-semibold text-white'>{agent.name}</h2>
        </div>
        <StatusBadge label={statusLabel} status={agent.status} />
      </div>
      <p className='mt-3 text-sm leading-6 text-slate-300'>{agent.production_truth}</p>
      <CapabilityFlags agent={agent} />
      <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
        <Fact label='live proven' value={agent.live_interface_proven ? 'yes' : 'no'} />
        <Fact label='called true' value={agent.called_true_proven ? 'yes' : 'no'} />
        <Fact label='UI mode' value={agent.interface.ui_mode} />
        <Fact label='auth required' value={agent.interface.auth_required ? 'yes' : 'no'} />
        <Fact label='iframe allowed' value={agent.interface.iframe_allowed ? 'yes' : 'no'} />
        <Fact label='local UI' value={agent.interface.local_ui_url || 'not proven'} />
        <Fact label='Tailnet UI' value={agent.interface.tailnet_url || 'not proven'} />
        <Fact label='writes' value={writeValue} />
      </dl>
      {ronProofPanel && <RonProofPanel agent={agent} />}
      <div className='mt-4 flex flex-wrap gap-2'>
        {tailnetUiHref && <a href={tailnetUiHref} target='_blank' rel='noreferrer' className='rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15'>Open Tailnet UI</a>}
        <a href={agent.interface.mission_control_surface} className='rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-300/40'>Open surface</a>
        <a href={agent.routes.detail} className='rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/40'>API detail</a>
        {agent.id === 'spaceagent' && (
          <>
            <a href='/api/bridge/agent-routing/trace/live?agent=spaceagent' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Trace Direct Line</a>
            <a href='/api/bridge/spaceagent/capability-map' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Capability Map</a>
            <a href='/api/bridge/spaceagent/readiness' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Readiness</a>
            <a href='/api/bridge/spaceagent/pipeline-status' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Pipeline</a>
            <a href='/api/bridge/spaceagent/brain-status' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Brain</a>
            <a href='/api/bridge/spaceagent/tool-map' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Tool Map</a>
            <a href='/api/bridge/spaceagent/certification-proof' className='rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/15'>Certification</a>
            <span className='cursor-not-allowed rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-500' title='SpaceAgent report drafts use the authenticated POST route /api/bridge/spaceagent/report-draft and write internal records only.'>Draft Report</span>
            <span className='cursor-not-allowed rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-500' title='SpaceAgent concurrence requests use the authenticated POST route /api/bridge/spaceagent/jarvis-concurrence-request and do not execute production actions.'>Request Jarvis Concurrence</span>
          </>
        )}
        <span className='cursor-not-allowed rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-500' title={protectedActionTitle}>{protectedActionLabel}</span>
      </div>
      {agent.id === 'spaceagent' && (
        <div className='mt-4 rounded-lg border border-sky-300/20 bg-sky-300/8 p-3 text-xs leading-5 text-sky-100'>
          SpaceAgent is a first-class direct-line agent. Playwright MCP, Firecrawl, YouTube, and Brain Bridge are SpaceAgent tools/layers, not SpaceAgent identity; read-only evidence packets, Brain source labels, Gateway-brokered tool map, certification source proof, and internal pipeline templates are available, while click/type/form/authenticated actions require Bridge Session scope.
        </div>
      )}
      {agent.blocked_reason && <p className='mt-4 rounded-lg border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100'>Blocker: {agent.blocked_reason}</p>}
    </article>
  )
}

function RonProofPanel({ agent }: { agent: AgentHubAgent }) {
  const proof = agent.proof_panel
  if (!proof) return null

  return (
    <section className='mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/8 p-4' aria-label='Ron Weasley proof panel'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold text-white'>Ron Weasley Proof Panel</h3>
        <span className='rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-100'>JARVIS-GATED EXECUTION</span>
      </div>
      <dl className='mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2'>
        <Fact label='WebUI' value={proof.webui} />
        <Fact label='WebUI alias' value={proof.webui_alias} />
        <Fact label='Full-access delegation' value={proof.full_access_delegation} />
        <Fact label='Mission Control service' value={proof.mission_control_service} />
        <Fact label='Authenticated Ron routes' value={proof.authenticated_ron_routes} />
        <Fact label='Direct-line chat' value={proof.direct_line_chat} />
        {'direct_line_chat_proof' in proof && <Fact label='Direct-line proof' value={String(proof.direct_line_chat_proof)} />}
        <Fact label='Mission Control proxy' value={proof.mission_control_proxy} />
        <Fact label='Protected writes/execution' value={proof.protected_writes_execution} />
        <Fact label='OpenCloud intermediary' value={proof.opencloud_intermediary ? 'TRUE' : 'FALSE'} />
      </dl>
      {proof.direct_line_chat_blocker !== 'none' ? (
        <div className='mt-3 rounded-md border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100'>
          <p>Mission Control proxy blocker: {proof.direct_line_chat_blocker}</p>
          <p className='mt-1 text-amber-50/80'>Uses the current authenticated Mission Control session to send a safe nonce through the Ron WebUI proxy. Session ids, cookies, tokens, and credentials are not displayed.</p>
          <form method='post' action={proof.proxy_proof_route} className='mt-2'>
            <input type='hidden' name='action' value='run_mission_control_proxy_proof' />
            <button type='submit' className='inline-flex rounded-md border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 font-semibold text-amber-50 hover:bg-amber-300/15'>Run Ron Proxy Proof</button>
          </form>
        </div>
      ) : (
        <div data-certified-state='MISSION_CONTROL_PROXY_CERTIFIED' className='mt-3 rounded-md border border-emerald-300/20 bg-emerald-300/8 p-3 text-xs leading-5 text-emerald-100'>
          <p>Mission Control proxy proof verified. Protected execution remains Jarvis-gated.</p>
          {proof.visible_task_id && <p className='mt-1'>Visible task proof: #{proof.visible_task_id}</p>}
        </div>
      )}
    </section>
  )
}

function HubTab({ href, label, meta, tone }: { href: string; label: string; meta: string; tone: 'cyan' | 'green' | 'yellow' | 'blue' | 'red' | 'gray' }) {
  const toneClass = {
    cyan: 'before:bg-cyan-300',
    green: 'before:bg-emerald-300',
    yellow: 'before:bg-amber-300',
    blue: 'before:bg-sky-300',
    red: 'before:bg-rose-300',
    gray: 'before:bg-slate-500',
  }[tone]

  return (
    <a href={href} className={'relative min-w-[180px] rounded-md border border-white/10 bg-black/20 px-3 py-2 pl-7 text-sm text-slate-200 hover:border-cyan-300/40 before:absolute before:left-3 before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rounded-full ' + toneClass}>
      <span className='block font-semibold text-white'>{label}</span>
      <span className='mt-0.5 block truncate text-xs text-slate-400'>{meta}</span>
    </a>
  )
}

function GatewayChainCanvas() {
  const chain = [
    { label: 'Owner', note: 'final authority', tone: 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' },
    { label: 'Mission Control', note: 'owner-control surface and visible task proof', tone: 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' },
    { label: 'Nuclear Gateway', note: 'policy, routing, registry, audit, credentials', tone: 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' },
    { label: 'Agent Zero / Jarvis', note: 'commander and owner-control layer', tone: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100' },
    { label: 'Ron Weasley', note: 'Nuclear Dispatcher and workflow/skill optimizer', tone: 'border-violet-300/35 bg-violet-300/10 text-violet-100' },
    { label: 'Pi', note: 'Full Access Gateway Agent', tone: 'border-orange-300/35 bg-orange-300/10 text-orange-100' },
    { label: 'Paperclip', note: 'workforce control plane', tone: 'border-amber-300/35 bg-amber-300/10 text-amber-100' },
    { label: 'SpaceAgent / Brain Bridge', note: 'research and memory direct lines', tone: 'border-sky-300/35 bg-sky-300/10 text-sky-100' },
    { label: 'OpenCloud / OpenClaw', note: 'supporting runtime only, not an agent line', tone: 'border-slate-400/25 bg-slate-400/10 text-slate-200' },
  ]

  return (
    <div className='mt-4 grid gap-2 lg:grid-cols-3 xl:grid-cols-9'>
      {chain.map((item, index) => (
        <div key={item.label} className='relative'>
          <div className={'min-h-[104px] rounded-lg border p-3 ' + item.tone}>
            <div className='text-xs font-semibold text-slate-400'>Step {index + 1}</div>
            <div className='mt-2 text-sm font-semibold text-white'>{item.label}</div>
            <div className='mt-1 text-xs leading-5 text-slate-300'>{item.note}</div>
          </div>
          {index < chain.length - 1 && <div className='hidden lg:block absolute right-[-10px] top-1/2 z-10 h-px w-5 bg-white/20' />}
        </div>
      ))}
    </div>
  )
}

function GraphNodeCard({ node }: { node: AgentHubNuclearGatewayGraphSummary['nodes'][number] }) {
  return (
    <article className='rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <strong className='text-slate-100'>{node.label}</strong>
        {node.direct_line_owner && <span className='rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-100'>direct line</span>}
      </div>
      <p className='mt-2 leading-5 text-slate-400'>{node.role}</p>
      {node.disabled_reason && <p className='mt-2 rounded border border-amber-300/20 bg-amber-300/8 px-2 py-1 text-amber-100'>{node.disabled_reason}</p>}
    </article>
  )
}

function ReadinessTile({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'red' }) {
  const toneClass = tone === 'green'
    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
    : tone === 'yellow'
      ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
      : 'border-rose-300/25 bg-rose-300/10 text-rose-100'

  return (
    <div className={'rounded-lg border p-3 ' + toneClass}>
      <div className='text-2xl font-semibold'>{value}</div>
      <div className='mt-1 text-xs font-semibold uppercase'>{label}</div>
    </div>
  )
}

function OwnerAction({ label, state, route, method = 'GET', blocker }: { label: string; state: 'live' | 'gated' | 'blocked'; route?: string; method?: 'GET' | 'POST'; blocker?: string }) {
  if (state === 'live' && route && method === 'POST') {
    return (
      <form action={route} method='post'>
        <button className='w-full rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-left text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15' type='submit'>{label}</button>
      </form>
    )
  }

  if (state === 'live' && route) {
    return <a href={route} className='rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15'>{label}</a>
  }

  const tone = state === 'gated' ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-rose-300/25 bg-rose-300/10 text-rose-100'
  return (
    <div className={'cursor-not-allowed rounded-md border px-3 py-2 text-xs ' + tone} title={blocker}>
      <div className='font-semibold'>{label}</div>
      <div className='mt-1 text-slate-300'>{blocker}</div>
    </div>
  )
}

function PolicyPanel() {
  return (
    <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold text-white'>Gateway Policy</h2>
        <StatusBadge label='enforced' status='read_only' />
      </div>
      <div className='mt-4 grid gap-2 text-sm text-slate-300'>
        <PolicyLine label='Read actions' value='allowed through authenticated routes' />
        <PolicyLine label='Writes' value='Bridge Session required' />
        <PolicyLine label='Execution' value='Agent Zero authority plus Nuclear Gateway policy' />
        <PolicyLine label='Pi' value='Full Access Gateway Agent; tools, skills, MCPs, providers, Brain, visible tasks, and pipeline requests are brokered by Gateway. Production execution remains Jarvis-gated.' />
        <PolicyLine label='Ron Weasley' value='direct Nuclear Gateway line; executes only Jarvis-signed exact scopes' />
        <PolicyLine label='Tony' value='retired/archive only' />
      </div>
    </article>
  )
}

function DesignHandoffPanel({ status }: { status: AgentHubStatusPayload }) {
  return (
    <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold text-white'>Design Handoff</h2>
        <StatusBadge label={status.design_handoff.expected_files_present ? 'imported' : 'pending'} status={status.design_handoff.expected_files_present ? 'read_only' : 'pending'} />
      </div>
      <p className='mt-3 text-sm leading-6 text-slate-300'>{status.design_handoff.note}</p>
      <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
        <Fact label='handoff assets' value={status.design_handoff.expected_files_present ? 'present' : 'missing'} />
        <Fact label='mock data used' value={status.design_handoff.production_uses_mock_data ? 'yes' : 'no'} />
      </dl>
    </article>
  )
}

function PolicyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2'>
      <span className='font-semibold text-slate-200'>{label}</span>
      <span className='text-right text-slate-400'>{value}</span>
    </div>
  )
}

function CapabilityFlags({ agent }: { agent: AgentHubAgent }) {
  return (
    <div className='mt-4 flex flex-wrap gap-2'>
      <Flag label='R' enabled={agent.read_enabled} />
      <Flag label='W' enabled={agent.write_enabled} gated={!agent.write_enabled} />
      <Flag label='X' enabled={agent.execution_enabled} gated={!agent.execution_enabled} />
      {agent.requires_bridge_session && <span className='rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100'>Bridge gated</span>}
    </div>
  )
}

function Flag({ label, enabled, gated }: { label: string; enabled: boolean; gated?: boolean }) {
  const tone = enabled
    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
    : gated
      ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
      : 'border-white/10 bg-white/5 text-slate-500'
  return <span className={'rounded-full border px-2.5 py-1 text-xs font-semibold ' + tone}>{label}</span>
}


function SpaceAgentBrowserAutomationPanel({ payload }: { payload: SpaceAgentBrowserAutomationPayload }) {
  const playwright = payload.cards.find((card) => card.id === 'playwright_mcp')
  return (
    <section className='rounded-lg border border-sky-300/20 bg-sky-300/8 p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold text-white'>SpaceAgent Browser Automation</h2>
          <p className='mt-1 max-w-4xl text-sm leading-6 text-sky-100'>{payload.architecture_rule}</p>
        </div>
        <StatusBadge label={playwright?.status || 'pending'} status={playwright?.status || 'pending'} />
      </div>

      <div className='mt-4 grid gap-3 lg:grid-cols-3'>
        {payload.cards.map((card) => <BrowserAutomationCard key={card.id} card={card} />)}
      </div>

      <div className='mt-5 grid gap-4 lg:grid-cols-2'>
        <BrowserAutomationActions title='Safe Read-Only Actions' buttons={payload.safe_read_only_buttons} />
        <BrowserAutomationActions title='Gated Actions' buttons={payload.gated_buttons} />
      </div>

      <dl className='mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4'>
        <Fact label='last evidence packet' value={payload.last_evidence_packet.status} />
        <Fact label='last snapshot' value={payload.last_snapshot} />
        <Fact label='last console' value={payload.last_console} />
        <Fact label='last network' value={payload.last_network} />
      </dl>
    </section>
  )
}

function BrowserAutomationCard({ card }: { card: SpaceAgentBrowserAutomationCard }) {
  return (
    <article className='rounded-lg border border-white/10 bg-black/20 p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='font-semibold text-white'>{card.title}</h3>
          <p className='mt-1 text-xs uppercase text-slate-500'>{card.id.replace(/_/g, ' ')}</p>
        </div>
        <StatusBadge label={card.status} status={card.status} />
      </div>
      <p className='mt-3 text-sm leading-6 text-slate-300'>{card.summary}</p>
      <dl className='mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300'>
        <Fact label='installed' value={card.installed ? 'yes' : 'no'} />
        <Fact label='configured' value={card.configured ? 'yes' : 'no'} />
        <Fact label='connected' value={card.connected ? 'yes' : 'no'} />
        <Fact label='public' value={card.public_exposure ? 'exposed' : 'blocked'} />
        <Fact label='endpoint' value={card.service_endpoint || 'not proven'} />
        <Fact label='MCP endpoint' value={card.mcp_endpoint || 'not proven'} />
        <Fact label='interactive' value={card.bridge_required_for_interactive ? 'Bridge Session required' : 'read-only'} />
        <Fact label='authenticated' value={card.bridge_required_for_authenticated ? 'Bridge Session required' : 'not required'} />
      </dl>
      <ul className='mt-3 space-y-1 text-xs leading-5 text-slate-400'>
        {card.details.map((detail) => <li key={detail}>{detail}</li>)}
      </ul>
      {card.blocker && <p className='mt-3 rounded-lg border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100'>Blocker: {card.blocker}</p>}
    </article>
  )
}

function BrowserAutomationActions({ title, buttons }: { title: string; buttons: SpaceAgentBrowserAutomationButton[] }) {
  return (
    <article className='rounded-lg border border-white/10 bg-black/20 p-4'>
      <h3 className='font-semibold text-white'>{title}</h3>
      <div className='mt-3 grid gap-2'>
        {buttons.map((button) => <BrowserAutomationButton key={button.id} button={button} />)}
      </div>
    </article>
  )
}

function BrowserAutomationButton({ button }: { button: SpaceAgentBrowserAutomationButton }) {
  const baseClass = 'rounded-lg border px-3 py-2 text-left text-xs font-semibold transition'
  const enabledClass = 'border-sky-300/30 bg-sky-300/10 text-sky-100 hover:bg-sky-300/15'
  const disabledClass = 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'

  if (!button.route || button.state !== 'enabled') {
    return (
      <div className={baseClass + ' ' + disabledClass} title={button.blocker || 'disabled'}>
        <div>{button.label}</div>
        <div className='mt-1 font-normal text-slate-500'>{button.blocker || button.owner_visible_summary}</div>
      </div>
    )
  }

  if (button.method === 'POST') {
    return (
      <form action={button.route} method='post'>
        <button className={baseClass + ' w-full ' + enabledClass} type='submit' title={button.owner_visible_summary}>{button.label}</button>
      </form>
    )
  }

  return <a className={baseClass + ' ' + enabledClass} href={button.route} title={button.owner_visible_summary}>{button.label}</a>
}

function RuntimeSystemCard({ system }: { system: AgentHubRuntimeSystem }) {
  return (
    <article className='rounded-lg border border-white/10 bg-black/20 p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='font-semibold text-white'>{system.name}</h3>
          <p className='mt-1 text-xs uppercase text-slate-500'>{system.type}</p>
        </div>
        <StatusBadge label={system.status} status={system.status} />
      </div>
      <dl className='mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300'>
        <Fact label='read' value={system.read_enabled ? 'yes' : 'no'} />
        <Fact label='write' value={system.write_enabled ? 'yes' : 'no'} />
        <Fact label='execute' value={system.execution_enabled ? 'yes' : 'no'} />
        <Fact label='session' value={system.requires_bridge_session ? 'required' : 'not required'} />
      </dl>
      {system.blocked_reason && <p className='mt-3 text-xs leading-5 text-amber-100'>Blocker: {system.blocked_reason}</p>}
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-4'>
      <div className='text-2xl font-semibold text-white'>{value}</div>
      <div className='mt-1 text-xs font-semibold uppercase text-slate-500'>{label}</div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
      <dt className='text-[10px] font-semibold uppercase text-slate-500'>{label}</dt>
      <dd className='mt-1 break-words text-slate-200'>{value}</dd>
    </div>
  )
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const tone = status === 'full_access_delegated' || status === 'ready' || status === 'active' || status === 'responding' || status === 'configured'
    ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
    : status === 'partial_go' || status === 'read_only' || status === 'connected' || status === 'connected_local_only'
    ? 'border-sky-300/30 bg-sky-300/10 text-sky-100'
    : status === 'gated' || status === 'pending' || status === 'degraded' || status === 'limited_pending'
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
      : status === 'blocked' || status === 'missing'
        ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
        : 'border-white/10 bg-white/5 text-slate-200'
  return <span className={'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ' + tone}>{label.replace(/_/g, ' ')}</span>
}

function agentStatusLabel(agent: AgentHubAgent) {
  if (agent.id === 'hermes' && agent.status === 'full_access_delegated') return 'FULL ACCESS DELEGATED'
  if (agent.id === 'paperclip' && agent.status === 'partial_go') return 'TAILNET UI READY'
  return agent.status
}

function buildReadinessSummary(status: AgentHubStatusPayload) {
  const live = status.agents.filter((agent) => agent.live_interface_proven || agent.status === 'full_access_delegated' || agent.status === 'read_only' || agent.status === 'partial_go').length
  const gated = status.agents.filter((agent) => agent.status === 'gated').length
  const blocked = status.agents.filter((agent) => agent.status === 'pending' || agent.status === 'blocked' || agent.blocked_reason).length
  return { live, gated, blocked }
}

function agentTone(agent: AgentHubAgent): 'cyan' | 'green' | 'yellow' | 'blue' | 'red' | 'gray' {
  if (agent.id === 'agent-zero') return 'green'
  if (agent.id === 'hermes') return 'green'
  if (agent.id === 'sofia') return 'cyan'
  if (agent.id === 'spaceagent') return 'blue'
  if (agent.status === 'gated' || agent.status === 'pending') return 'yellow'
  if (agent.status === 'blocked') return 'red'
  if (agent.status === 'full_access_delegated' || agent.status === 'read_only' || agent.status === 'partial_go') return 'green'
  return 'gray'
}

function agentBorderClass(agent: AgentHubAgent) {
  if (agent.id === 'agent-zero') return 'border-emerald-300/25'
  if (agent.id === 'spaceagent') return 'border-sky-300/25'
  if (agent.id === 'paperclip') return 'border-amber-300/25'
  if (agent.id === 'hermes') return 'border-violet-300/25'
  if (agent.id === 'sofia') return 'border-cyan-300/25'
  if (agent.id === 'pi-mono') return 'border-orange-300/25'
  return 'border-white/10'
}

function agentStripeClass(agent: AgentHubAgent) {
  if (agent.id === 'agent-zero') return 'bg-emerald-300'
  if (agent.id === 'spaceagent') return 'bg-sky-300'
  if (agent.id === 'paperclip') return 'bg-amber-300'
  if (agent.id === 'hermes') return 'bg-violet-300'
  if (agent.id === 'sofia') return 'bg-cyan-300'
  if (agent.id === 'pi-mono') return 'bg-orange-300'
  return 'bg-slate-500'
}
