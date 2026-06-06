import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AgentMailConnectActions } from './AgentMailConnectActions'
import { AGENTMAIL_CONSOLE_URL, buildAgentMailPayload } from '@/lib/agentmail-local-control'

export const metadata: Metadata = {
  title: 'AgentMail Local Control · Mission Control',
}

export const dynamic = 'force-dynamic'

function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }) {
  return <span className={`am-pill am-pill-${tone}`}>{children}</span>
}

function ActionLink({ children, href, primary = false }: { children: ReactNode; href: string; primary?: boolean }) {
  return <a className={primary ? 'am-button am-button-primary' : 'am-button'} href={href} target="_blank" rel="noreferrer">{children}</a>
}

export default function AgentMailLocalControlPage() {
  const payload = buildAgentMailPayload('overview') as any
  const status = payload.status
  const connect = payload.connect
  const preview = payload.sync_preview
  const sendAccess = payload.send_access
  const stateTone = status.state === 'running' ? 'green' : status.state === 'degraded' ? 'yellow' : 'red'

  return (
    <main className="agentmail-page">
      <style>{`
        .agentmail-page { min-height: 100vh; background: #070b13; color: #e8edf7; padding: 32px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .am-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 1px solid #20283a; padding-bottom: 20px; margin-bottom: 22px; }
        .am-title { margin: 0; font-size: 30px; letter-spacing: 0; }
        .am-subtitle { margin: 8px 0 0; color: #9ca8bd; max-width: 820px; line-height: 1.5; }
        .am-grid { display: grid; gap: 16px; grid-template-columns: repeat(12, minmax(0, 1fr)); }
        .am-panel { background: #101624; border: 1px solid #252f43; border-radius: 8px; padding: 18px; min-height: 160px; }
        .am-panel h2 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; color: #aeb8cc; letter-spacing: .12em; }
        .am-wide { grid-column: span 8; }
        .am-side { grid-column: span 4; }
        .am-full { grid-column: 1 / -1; }
        .am-list { display: grid; gap: 10px; }
        .am-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .am-button { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 12px; border-radius: 7px; border: 1px solid #344056; color: #d7e1f3; text-decoration: none; background: #151d2c; font-size: 13px; }
        .am-button-primary { border-color: #22b5a6; color: #08111b; background: #57e1d4; font-weight: 700; }
        button.am-button { cursor: pointer; }
        .am-action-result { display: grid; gap: 5px; margin-top: 12px; padding: 12px; border-radius: 8px; border: 1px solid #283449; background: #0d1422; color: #aeb8cc; }
        .am-action-result strong { color: #edf4ff; }
        .am-action-running { border-color: #3378bf; }
        .am-action-done { border-color: #20a66b; }
        .am-action-error { border-color: #c6425a; }
        .am-row { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #1e2637; padding-top: 10px; color: #d6deef; }
        .am-row:first-child { border-top: 0; padding-top: 0; }
        .am-muted { color: #8995aa; }
        .am-pill { display: inline-flex; align-items: center; border: 1px solid #3a465e; border-radius: 999px; padding: 4px 9px; font-size: 12px; color: #cbd5e1; white-space: nowrap; }
        .am-pill-green { border-color: #20a66b; color: #7ee6b0; background: #0b2a21; }
        .am-pill-yellow { border-color: #b78320; color: #ffd36b; background: #2f220a; }
        .am-pill-red { border-color: #c6425a; color: #ff8aa0; background: #33111a; }
        .am-pill-blue { border-color: #3378bf; color: #93c5fd; background: #0d2138; }
        .am-empty { color: #748197; border: 1px dashed #2c3548; border-radius: 8px; padding: 18px; text-align: center; }
        .am-tree { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #b8c3d9; line-height: 1.8; white-space: pre-wrap; }
        @media (max-width: 1000px) { .am-wide, .am-side { grid-column: 1 / -1; } .agentmail-page { padding: 20px; } }
      `}</style>

      <section className="am-header">
        <div>
          <h1 className="am-title">AgentMail Local Control</h1>
          <p className="am-subtitle">
            Monitor-first AgentMail control plane for local listener health, inbox registry, Gateway routing preview,
            Bridge queue, approvals, and audit. Outbound email remains disabled until owner approval and Bridge policy are proven.
          </p>
        </div>
        <div className="am-actions">
          <ActionLink href="/gateway">Back to Gateway</ActionLink>
          <ActionLink href="/tkmc">Back to Mission Control</ActionLink>
          <Pill tone={stateTone}>{status.state}</Pill>
        </div>
      </section>

      <section className="am-grid">
        <div className="am-panel am-full">
          <h2>Connect AgentMail</h2>
          <div className="am-list">
            <div className="am-row"><span>Hosted Console</span><Pill tone={connect.status === 'owner_sso_required' ? 'yellow' : 'green'}>{connect.hosted_console.state}</Pill></div>
            <div className="am-row"><span>Google/SSO Status</span><span>{connect.google_sso_status}</span></div>
            <div className="am-row"><span>MCP OAuth Status</span><span>{connect.mcp_oauth_status.state}</span></div>
            <div className="am-row"><span>API Key Fallback</span><span>{connect.api_key_fallback.state}{connect.api_key_fallback.masked_preview ? ` · ${connect.api_key_fallback.masked_preview}` : ''}</span></div>
            <div className="am-row"><span>Last Sync</span><span className="am-muted">{connect.last_sync_attempt?.action || 'none'}</span></div>
            <div className="am-row"><span>Bridge session status</span><Pill tone="yellow">{connect.bridge_session_status}</Pill></div>
            <div className="am-row"><span>Send state</span><Pill tone="yellow">{connect.send_state}</Pill></div>
          </div>
          <AgentMailConnectActions consoleUrl={AGENTMAIL_CONSOLE_URL} />
          <p className="am-muted">
            Waiting for owner Google/SSO sign-in through AgentMail when credentials are missing. Mission Control never collects Google credentials,
            browser cookies, OAuth tokens, or raw AgentMail API keys in this view.
            AgentMail MCP uses the hosted endpoint in supported MCP clients; this page does not open the raw MCP server URL as a browser page.
          </p>
        </div>

        <div className="am-panel am-side">
          <h2>Local Status</h2>
          <div className="am-list">
            <div className="am-row"><span>WebSocket</span><Pill tone={status.local_monitor.websocket_connected ? 'green' : 'red'}>{status.local_monitor.websocket_connected ? 'connected' : 'not connected'}</Pill></div>
            <div className="am-row"><span>Subscribed inboxes</span><span>{status.local_monitor.subscribed_inboxes}</span></div>
            <div className="am-row"><span>Last event</span><span className="am-muted">{status.local_monitor.last_event_at || 'none'}</span></div>
            <div className="am-row"><span>Send state</span><Pill tone="yellow">approval required</Pill></div>
          </div>
        </div>

        <div className="am-panel am-wide">
          <h2>Mission Control Tree</h2>
          <div className="am-tree">{`Mission Control
└── AgentMail
    ├── Connect AgentMail
    │   ├── Hosted Console
    │   ├── Google/SSO Status
    │   ├── MCP OAuth Status
    │   ├── API Key Fallback
    │   └── Last Sync
    ├── Local Monitor
    │   ├── WebSocket Listener
    │   ├── Subscribed Inboxes
    │   └── Last Event
    ├── Inbox Registry
    ├── Send Access
    │   ├── Bridge Session
    │   ├── Agent Send Readiness
    │   ├── Permission Matrix
    │   └── Safe Send Test
    ├── Gateway Route Preview
    ├── Bridge Queue
    ├── Approvals
    └── Audit`}</div>
        </div>


        <div className="am-panel am-full">
          <h2>Send Access</h2>
          <div className="am-list">
            <div className="am-row"><span>Bridge Session</span><Pill tone={sendAccess.global.bridge_session_state === 'active' ? 'green' : 'yellow'}>{sendAccess.global.bridge_session_state}</Pill></div>
            <div className="am-row"><span>Expires at</span><span className="am-muted">{sendAccess.global.expires_at || 'not active'}</span></div>
            <div className="am-row"><span>Sends remaining</span><span>{sendAccess.global.sends_remaining_per_agent}</span></div>
            <div className="am-row"><span>Default send policy</span><Pill tone="yellow">{sendAccess.global.send_default}</Pill></div>
            <div className="am-row"><span>Real Send Adapter</span><Pill tone="blue">{sendAccess.global.real_send_adapter?.state || 'missing'}</Pill></div>
          </div>
          <div className="am-actions">
            <button className="am-button" type="button" disabled>Request Bridge Session</button>
            <button className="am-button" type="button" disabled>Revoke Bridge Session</button>
          </div>
          <p className="am-muted">If Bridge Session is active but sending is still blocked, the next exact blocker is usually scoped AgentMail inbox credential required, message_send permission missing, owner approval required, or Gateway policy blocked.</p>
        </div>

        <div className="am-panel am-full">
          <h2>Agent Send Readiness</h2>
          <div className="am-list">
            {Object.values(sendAccess.agents).map((agent: any) => (
              <div className="am-row" key={agent.agent_id}>
                <span>{agent.display_name}<span className="am-muted"> · {agent.gateway_policy} · {agent.inbox_id || 'inbox missing'} · Scoped Credential: {agent.scoped_credential?.key_masked || agent.credential_status}</span></span>
                <span>
                  <Pill tone={agent.send_ready ? 'green' : 'yellow'}>{agent.send_ready ? 'send-ready' : (agent.blockers[0] || 'blocked')}</Pill>{' '}
                  <Pill tone={agent.credential_status === 'scoped' ? 'green' : 'red'}>{agent.credential_status}</Pill>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="am-panel am-full">
          <h2>Permission Matrix</h2>
          <div className="am-list">
            {Object.values(sendAccess.agents).map((agent: any) => (
              <div className="am-row" key={`${agent.agent_id}-permissions`}>
                <span>{agent.display_name}</span>
                <span>{sendAccess.permission_keys.map((key: string) => <Pill key={key} tone={agent.permission_status[key] ? 'green' : 'gray'}>{key}</Pill>)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="am-panel am-full">
          <h2>Safe Send Test</h2>
          <div className="am-list">
            <div className="am-row"><span>Stage A</span><Pill tone="blue">verify readiness without sending</Pill></div>
            <div className="am-row"><span>Stage B</span><Pill tone="yellow">create draft/preview only</Pill></div>
            <div className="am-row"><span>Stage C</span><Pill tone="yellow">request canonical owner approval</Pill></div>
            <div className="am-row"><span>Stage D</span><Pill tone="red">dispatch blocked until approval and active Bridge Session</Pill></div>
          </div>
        </div>

        <div className="am-panel am-full">
          <h2>Gateway Route Preview</h2>
          <div className="am-list">
            {preview.bridge_routing_preview.map((route: any) => (
              <div className="am-row" key={route.route}>
                <span>{route.agent_id}<span className="am-muted"> · {route.route}</span></span>
                <span><Pill tone="blue">{route.policy_state}</Pill>{' '}<Pill tone="yellow">{route.outbound_send_state}</Pill></span>
              </div>
            ))}
          </div>
        </div>

        <div className="am-panel am-full">
          <h2>Inbox Registry</h2>
          <div className="am-list">
            {payload.inboxes.map((inbox: any) => (
              <div className="am-row" key={inbox.agent_id}>
                <span>{inbox.display_name}<span className="am-muted"> · {inbox.role}</span></span>
                <span>
                  <Pill tone={inbox.provision_state === 'assigned' ? 'green' : 'gray'}>{inbox.inbox_address || 'not provisioned'}</Pill>{' '}
                  <Pill tone={inbox.autonomy_level === 'L0_monitor_only' ? 'blue' : 'yellow'}>{inbox.autonomy_level}</Pill>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="am-panel am-wide">
          <h2>Event Console</h2>
          {payload.events.length ? <div className="am-list">{payload.events.map((event: any) => (
            <div className="am-row" key={event.event_id}>
              <span>{event.subject}<span className="am-muted"> · {event.sender_preview}</span></span>
              <Pill tone="blue">{event.policy_state}</Pill>
            </div>
          ))}</div> : <div className="am-empty">No AgentMail events received yet.</div>}
        </div>

        <div className="am-panel am-side">
          <h2>Bridge Queue</h2>
          {payload.bridge_queue.length ? <div className="am-list">{payload.bridge_queue.map((item: any) => (
            <div className="am-row" key={item.id}>
              <span>{item.task_candidate_state}</span>
              <Pill tone="yellow">{item.policy_state}</Pill>
            </div>
          ))}</div> : <div className="am-empty">Queue empty.</div>}
        </div>

        <div className="am-panel am-side">
          <h2>Approvals</h2>
          {payload.approvals.length ? <div className="am-list">{payload.approvals.map((item: any) => (
            <div className="am-row" key={item.id}>
              <span>{item.action_type}</span>
              <Pill tone="yellow">{item.state}</Pill>
            </div>
          ))}</div> : <div className="am-empty">No approval requests.</div>}
        </div>

        <div className="am-panel am-wide">
          <h2>Audit</h2>
          {payload.audit.length ? <div className="am-list">{payload.audit.map((item: any) => (
            <div className="am-row" key={item.id}>
              <span>{item.action}<span className="am-muted"> · {item.detail || 'no detail'}</span></span>
              <Pill tone={item.result === 'ok' ? 'green' : 'red'}>{item.result}</Pill>
            </div>
          ))}</div> : <div className="am-empty">No audit entries.</div>}
        </div>
      </section>
    </main>
  )
}
