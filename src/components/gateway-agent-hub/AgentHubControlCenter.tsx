import type {
  AgentHubAgent,
  AgentHubAgentAuditPayload,
  AgentHubAgentPayload,
  AgentHubAgentRoutesPayload,
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
  return (
    <main className='min-h-screen bg-[#070912] px-6 py-8 text-slate-100'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <header className='border-b border-white/10 pb-5'>
          <p className='text-xs font-semibold uppercase tracking-[0.16em] text-sky-300'>Mission Control / Gateway</p>
          <div className='mt-3 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-semibold tracking-normal text-white'>Agent Hub / Control Center</h1>
              <p className='mt-2 max-w-4xl text-sm leading-6 text-slate-300'>Production roster and route health from the live Gateway registry. Mock design data is not used.</p>
            </div>
            <a href='/gateway/agent-hub/paperclip' className='rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-400/15'>Open Paperclip</a>
          </div>
        </header>

        <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <Metric label='agents' value={String(status.agents_total)} />
          <Metric label='live interfaces proven' value={String(status.live_interfaces_proven)} />
          <Metric label='gated or blocked' value={String(status.gated_or_blocked)} />
          <Metric label='external writes' value='disabled' />
        </section>

        <section className='rounded-lg border border-amber-300/25 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100'>
          <strong>Production truth:</strong> Agent Zero remains partial GO, Hermes is gated until hermes_called:true, Pi-mono is pending, SpaceAgent has Playwright MCP local-only browser evidence, Paperclip is pending until UI proof, Fork 2/SMB is blocked, and Build-Wiki Run Now is scoped only to opencloud-docs-farmer.service.
        </section>

        <section className='grid gap-4 lg:grid-cols-[1.6fr_1fr]'>
          <div className='grid gap-4 md:grid-cols-2'>
            {status.agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
          </div>
          <aside className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
            <h2 className='text-lg font-semibold text-white'>Gateway Chain</h2>
            <ol className='mt-4 space-y-3 text-sm text-slate-300'>
              <li><ChainStep label='Owner' note='final authority' /></li>
              <li><ChainStep label='Gateway' note='routing, policy, audit, registry' /></li>
              <li><ChainStep label='Agent Zero / Pi / Hermes' note='commander, dispatcher candidate, lieutenant' /></li>
              <li><ChainStep label='Paperclip' note='workforce control plane' /></li>
              <li><ChainStep label='OpenClaw+' note='runtime and skills engine' /></li>
              <li><ChainStep label='Mini-agents / specialist agents / skills / tools / reports / approvals' note='execution remains gated' /></li>
            </ol>
            {paperclip && <div className='mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300'>Paperclip state: <strong className='text-white'>{paperclip.status}</strong>. Blocker: {paperclip.blocked_reason || 'none'}.</div>}
          </aside>
        </section>

        {status.space_agent_browser_automation && <SpaceAgentBrowserAutomationPanel payload={status.space_agent_browser_automation} />}

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Supporting Runtime Systems</h2>
              <p className='mt-1 text-sm text-slate-400'>Gateway, Paperclip, OpenClaw+, Build-Wiki/Farmer, Brain, Bridge/MCP, models, tools, skills, and integrations.</p>
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
            <h2 className='text-lg font-semibold text-white'>Design Handoff</h2>
            <p className='mt-3 text-sm leading-6 text-slate-300'>{status.design_handoff.note}</p>
            <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
              <Fact label='expected files present' value={status.design_handoff.expected_files_present ? 'yes' : 'no'} />
              <Fact label='mock data used' value={status.design_handoff.production_uses_mock_data ? 'yes' : 'no'} />
            </dl>
          </article>
        </section>
      </div>
    </main>
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
          <h1 className='mt-3 text-3xl font-semibold tracking-normal text-white'>{agent.name} — {agent.role}</h1>
          <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-300'>{agent.production_truth}</p>
        </header>

        <section className='grid gap-4 md:grid-cols-3'>
          <Metric label='status' value={agent.status} />
          <Metric label='live UI proven' value={agent.live_interface_proven ? 'yes' : 'no'} />
          <Metric label='writes' value='Bridge Session required' />
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
          <h2 className='text-lg font-semibold text-white'>Workforce Chain</h2>
          <p className='mt-3 text-sm leading-6 text-slate-300'>Paperclip sits before OpenClaw+ in the Gateway operating chain. It organizes co-worker agents, mini-agent requests, task queues, budgets, heartbeats, approvals, work products, task status, supervision, and assignment history. OpenClaw+ remains the runtime and execution layer.</p>
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            <Fact label='Gateway route' value='Agent Zero / Pi / Hermes → Paperclip → OpenClaw+' />
            <Fact label='execution enabled' value={agent.execution_enabled ? 'yes' : 'no'} />
            <Fact label='public exposure' value={agent.interface.public_exposure ? 'yes' : 'no'} />
            <Fact label='auth required' value={agent.interface.auth_required ? 'yes' : 'no'} />
            <Fact label='UI mode' value={agent.interface.ui_mode} />
            <Fact label='local UI' value={agent.interface.local_ui_url || 'not proven'} />
            <Fact label='Tailnet UI' value={agent.interface.tailnet_url || 'not proven'} />
            <Fact label='owner access' value={agent.interface.owner_access} />
          </div>
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
  return (
    <article className='rounded-lg border border-white/10 bg-white/[0.03] p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>{agent.role}</p>
          <h2 className='mt-2 text-xl font-semibold text-white'>{agent.name}</h2>
        </div>
        <StatusBadge label={agent.status} status={agent.status} />
      </div>
      <p className='mt-3 text-sm leading-6 text-slate-300'>{agent.production_truth}</p>
      <dl className='mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2'>
        <Fact label='live proven' value={agent.live_interface_proven ? 'yes' : 'no'} />
        <Fact label='called true' value={agent.called_true_proven ? 'yes' : 'no'} />
        <Fact label='UI mode' value={agent.interface.ui_mode} />
        <Fact label='auth required' value={agent.interface.auth_required ? 'yes' : 'no'} />
        <Fact label='iframe allowed' value={agent.interface.iframe_allowed ? 'yes' : 'no'} />
        <Fact label='local UI' value={agent.interface.local_ui_url || 'not proven'} />
        <Fact label='Tailnet UI' value={agent.interface.tailnet_url || 'not proven'} />
        <Fact label='writes' value={agent.write_enabled ? 'enabled' : 'session gated'} />
      </dl>
      <div className='mt-4 flex flex-wrap gap-2'>
        <a href={agent.interface.mission_control_surface} className='rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:border-sky-300/40'>Open surface</a>
        <a href={agent.routes.detail} className='rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-300/40'>API detail</a>
      </div>
      {agent.id === 'spaceagent' && (
        <div className='mt-4 rounded-lg border border-sky-300/20 bg-sky-300/8 p-3 text-xs leading-5 text-sky-100'>
          Playwright MCP: local-only browser automation is connected through SpaceAgent. Read-only evidence packets are available; click/type/form/authenticated actions require Bridge Session scope.
        </div>
      )}
      {agent.blocked_reason && <p className='mt-4 rounded-lg border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100'>Blocker: {agent.blocked_reason}</p>}
    </article>
  )
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
          <p className='mt-1 text-xs uppercase tracking-[0.12em] text-slate-500'>{card.id.replace(/_/g, ' ')}</p>
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
          <p className='mt-1 text-xs uppercase tracking-[0.12em] text-slate-500'>{system.type}</p>
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
      <div className='mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>{label}</div>
    </div>
  )
}

function ChainStep({ label, note }: { label: string; note: string }) {
  return <span><strong className='text-white'>{label}</strong><span className='text-slate-500'> — {note}</span></span>
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-black/20 p-3'>
      <dt className='text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500'>{label}</dt>
      <dd className='mt-1 break-words text-slate-200'>{value}</dd>
    </div>
  )
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const tone = status === 'partial_go' || status === 'read_only' || status === 'connected' || status === 'connected_local_only'
    ? 'border-sky-300/30 bg-sky-300/10 text-sky-100'
    : status === 'gated' || status === 'pending' || status === 'degraded' || status === 'limited_pending'
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
      : status === 'blocked' || status === 'missing'
        ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
        : 'border-white/10 bg-white/5 text-slate-200'
  return <span className={'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ' + tone}>{label.replace(/_/g, ' ')}</span>
}
