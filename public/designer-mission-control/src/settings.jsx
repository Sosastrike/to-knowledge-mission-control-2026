// ClaudeClaw settings — mirrors the real right-drawer shape (System, Agents, Meetings, Tasks, Integrations, Channels, About)

function SettingsFrame({ page, setPage, children }) {
  const cur = window.SETTINGS_NAV.find(s => s.id === page) || window.SETTINGS_NAV[0];
  const IconCmp = I[cur.icon];
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><IconCmp size={20} style={{color:'var(--accent)'}}/> Settings · {cur.label}</h1>
          <div className="sub">Admin command center · role-aware · mirrors the right-drawer settings shipped with ClaudeClaw</div>
        </div>
        <div className="page-actions">
          <span className="tag">ADMIN</span>
          <button className="btn" disabled title="Drawer presentation mode — settings are already fullscreen."><I.External size={12}/> Open as drawer</button>
        </div>
      </div>
      {children}
    </>
  );
}

// ─── System ───────────────────────────────────────────────────
function SystemPage() {
  const h = window.SYS_HEALTH;
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
      <div className="card">
        <div className="card-head"><div className="card-title">System health</div><span className="tag ok">HEALTHY</span></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Gateway</div><div className="muted xsmall">localhost:18789 · OpenClaw</div></div>
            <span className="tag ok">HEALTHY</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Uptime</div><span className="mono xsmall">{h.uptime}%</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Version</div><span className="mono xsmall">claudeclaw 2.4.1</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Host</div><span className="mono xsmall">srv1568353</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'6px 0'}}>
            <div style={{color:'var(--fg-0)'}}>Tokens today</div><span className="mono xsmall">482,117</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Actions</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Refresh dashboard</div><div className="muted xsmall">Pull latest agents, tasks, memories</div></div>
            <button className="btn primary">Refresh now</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Reload page</div><div className="muted xsmall">Full reload (clears transient UI state)</div></div>
            <button className="btn">Reload</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Clear local cache</div><div className="muted xsmall">Dashboard state only · does not touch the server</div></div>
            <button className="btn">Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agents ───────────────────────────────────────────────────
function AgentsPage({ onAgent }) {
  return (
    <>
      <div className="hstack" style={{marginBottom:12, justifyContent:'space-between'}}>
        <div className="muted xsmall">{window.AGENTS.length} agents · managed via Mission Control cards on the dashboard</div>
        <button className="btn primary" disabled title="Use Settings → Agent Management for creating agents (full CRUD + channel assignment)."><I.Plus/> New Agent</button>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr>
            <th>Agent</th><th>Role</th><th>Status</th><th>Channels</th><th>Model</th><th>Turns</th><th>SLA</th><th></th>
          </tr></thead>
          <tbody>
            {window.AGENTS.map(a => (
              <tr key={a.id} onClick={()=>onAgent && onAgent(a)} style={{cursor:'pointer'}}>
                <td><span className="hstack"><Avatar name={a.name} size={24}/> <span style={{color:'var(--fg-0)'}}>{a.name}</span></span></td>
                <td className="muted">{a.role}</td>
                <td><span className="status-pill"><StatusDot s={a.status}/>{a.status}</span></td>
                <td><ChanStack codes={a.channels}/></td>
                <td className="mono xsmall">{a.model}</td>
                <td className="mono xsmall">{a.handled}</td>
                <td className="mono xsmall" style={{color: a.sla>=98?'var(--ok)': a.sla>=95?'var(--warn)':'var(--err)'}}>{a.sla ? a.sla+'%' : '—'}</td>
                <td className="hstack">
                  <button className="btn sm" title="Restart"><I.Restart size={12}/></button>
                  <button className="btn sm" title="Logs"><I.FileLog size={12}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Meetings ─────────────────────────────────────────────────
function MeetingsPage() {
  // Prefer the full-featured, API-wired Meetings Hub when it is loaded.
  // It routes every action through window.api.meetings.* (role guards +
  // audit events). The inline fallback below stays as a minimal placeholder
  // for the case where MeetingsHubPage.jsx failed to load.
  if (typeof window.MeetingsHubPage === 'function') {
    return React.createElement(window.MeetingsHubPage);
  }
  return MeetingsPageFallback();
}

function MeetingsPageFallback() {
  return (
    <>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><div className="card-title">Active sessions</div></div>
        <div className="card-body vstack">
          {window.MEETINGS.filter(m=>m.status==='live').length === 0 ? (
            <div className="muted xsmall" style={{padding:'16px 4px', textAlign:'center'}}>No active sessions.</div>
          ) : window.MEETINGS.filter(m=>m.status==='live').map(m => (
            <div key={m.id} className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
              <div>
                <div style={{color:'var(--fg-0)'}}>{m.title}</div>
                <div className="muted xsmall">{m.modeLabel} · {m.duration}</div>
              </div>
              <button className="btn danger sm">Leave</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card-title" style={{marginBottom:8, fontSize:13}}>Meeting modes</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:14}}>
        {window.MEETING_MODES.map(mm => {
          const Ic = I[mm.icon] || I.Radio;
          return (
            <div key={mm.id} className="card" style={{padding:14}}>
              <div className="hstack" style={{marginBottom:8}}>
                <div style={{width:32, height:32, borderRadius:8, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)'}}>
                  <Ic size={16}/>
                </div>
                <div>
                  <div style={{color:'var(--fg-0)', fontWeight:500}}>{mm.name}</div>
                  <div className="muted xsmall">{mm.vendor} · {mm.cost}</div>
                </div>
              </div>
              <div className="muted xsmall" style={{minHeight:30}}>{mm.desc}</div>
              <div className="hstack" style={{marginTop:8}}>
                <select className="select" style={{flex:1}}>
                  <option>Main</option><option>Research</option><option>Direct</option><option>Hand Up</option>
                </select>
                <button className="btn primary sm">Send</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Defaults</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Auto-brief participants</div><div className="muted xsmall">On join, send a capsule brief from Research memories</div></div>
            <Switch on={true}/>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Record transcripts to memory</div><div className="muted xsmall">High-importance turns get archived automatically</div></div>
            <Switch on={true}/>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tasks ────────────────────────────────────────────────────
function TasksSettingsPage() {
  const t = window.TICKETS;
  const unassigned = t.filter(x => !x.agent).length;
  const active = t.filter(x => x.status === 'wip').length;
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
      <div className="card">
        <div className="card-head"><div className="card-title">Task queue</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Total tasks</div><span className="mono xsmall">{t.length}</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Unassigned</div><span className="mono xsmall">{unassigned}</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>In progress</div><span className="mono xsmall">{active}</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div style={{color:'var(--fg-0)'}}>Completed today</div><span className="mono xsmall">{t.filter(x=>x.status==='complete').length}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Actions</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Auto-assign all</div><div className="muted xsmall">Distribute unassigned tasks to available agents</div></div>
            <button className="btn primary">Auto-assign</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Task history</div><div className="muted xsmall">Review completed tasks</div></div>
            <button className="btn">Open history</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Scheduled tasks</div><div className="muted xsmall">Automated tasks scheduled by the bot</div></div>
            <button className="btn">Open</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Integrations ─────────────────────────────────────────────
function IntegrationsPage() {
  return (
    <>
      <div className="card" style={{marginBottom:14, borderColor:'var(--line-2)'}}>
        <div className="card-body hstack" style={{justifyContent:'space-between'}}>
          <div className="hstack">
            <I.Key style={{color:'var(--accent)'}}/>
            <div>
              <div style={{color:'var(--fg-0)', fontWeight:500}}>Secrets stay here — and only here.</div>
              <div className="muted xsmall">All tokens live in <span className="mono xsmall">~/.openclaw/.env</span> (16 secrets · perms 600). Never exposed in logs or the dashboard.</div>
            </div>
          </div>
          <button className="btn" disabled title="Auto-rotation cadence planner — not wired."><I.Key size={12}/> Rotation checklist</button>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12}}>
        {window.INTEGRATIONS.map(it => (
          <div key={it.id} className="int-card">
            <div className="int-logo">{it.glyph}</div>
            <div style={{flex:1, minWidth:0}}>
              <div className="hstack" style={{justifyContent:'space-between'}}>
                <div style={{color:'var(--fg-0)', fontWeight:500}}>{it.name}</div>
                <StatusDot s={it.status}/>
              </div>
              <div className="muted xsmall">{it.category} · synced {it.lastSync}</div>
              <div className="hstack" style={{marginTop:6, justifyContent:'space-between'}}>
                <span className="mono xsmall muted">token · {it.tokenDays}d</span>
                <button className="btn sm">Test</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Channels ─────────────────────────────────────────────────
function ChannelsPage() {
  return (
    <>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><div className="card-title">Governance · channel policy</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Telegram</div><div className="muted xsmall">Primary conversation channel</div></div>
            <span className="tag accent">PRIMARY</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Slack</div><div className="muted xsmall">Project structure + team collab</div></div>
            <span className="tag">TEAM</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Mission Control (this UI)</div><div className="muted xsmall">Operator dashboard</div></div>
            <span className="tag ok">ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead><tr><th>Channel</th><th>On</th><th>Health</th><th>Assigned agent</th><th>Routing</th><th>Throughput</th><th></th></tr></thead>
          <tbody>
            {window.CHANNELS.map(c => {
              const ag = window.AGENTS.find(a=>a.id===c.assigned);
              const meta = window.CHANNEL_META[c.key];
              return (
                <tr key={c.id}>
                  <td><span className="hstack"><ChanChip code={c.key} size={24}/> <span style={{color:'var(--fg-0)'}}>{meta.name}</span></span></td>
                  <td><Switch on={c.enabled}/></td>
                  <td><span className="status-pill"><StatusDot s={c.health}/>{c.health}</span></td>
                  <td>{ag ? <span className="hstack"><Avatar name={ag.name} size={18}/> <span>{ag.name}</span></span> : <span className="muted">—</span>}</td>
                  <td className="muted">{c.routing}</td>
                  <td className="mono xsmall">{c.rate}</td>
                  <td className="hstack"><button className="btn sm">Credentials</button><button className="icon-btn"><I.More size={14}/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── About ────────────────────────────────────────────────────
function AboutPage() {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
      <div className="card">
        <div className="card-head"><div className="card-title">ClaudeClaw</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Product</div><span className="mono xsmall">ClaudeClaw OS</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Host</div><span className="mono xsmall">srv1568353</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div style={{color:'var(--fg-0)'}}>Deploy</div><span className="mono xsmall">/home/tony/claudeclaw/</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div style={{color:'var(--fg-0)'}}>Gateway</div><span className="mono xsmall">localhost:18789</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Honesty protocol</div></div>
        <div className="card-body vstack">
          <div className="muted xsmall">Calibrated language. No "fixed forever" or "100%" without test. Escalate on risk (Law 6).</div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderTop:'1px solid var(--line-1)', marginTop:6}}>
            <div style={{color:'var(--fg-0)'}}>Policy docs</div><span className="mono xsmall">~/.openclaw/governance/</span>
          </div>
          <div className="muted xsmall" style={{marginTop:6}}>Agents: Tony, Archivist, Atlas, Builder, Echo, Forge, Growth, Loom, Operator, Pacman, QA, Researcher</div>
        </div>
      </div>
    </div>
  );
}

function SettingsRouter({ page, setPage, onAgent }) {
  let content = null;
  if (page==='system') content = <SystemPage/>;
  else if (page==='agents') content = <AgentsPage onAgent={onAgent}/>;
  else if (page==='meetings') content = <MeetingsPage/>;
  else if (page==='tasks') content = <TasksSettingsPage/>;
  else if (page==='integrations') content = <IntegrationsPage/>;
  else if (page==='channels') content = <ChannelsPage/>;
  else if (page==='about') content = <AboutPage/>;
  else content = <SystemPage/>;
  return <SettingsFrame page={page} setPage={setPage}>{content}</SettingsFrame>;
}

Object.assign(window, { SettingsRouter });
