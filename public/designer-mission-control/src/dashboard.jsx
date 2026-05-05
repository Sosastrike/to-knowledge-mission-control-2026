// Mission Control Dashboard — priority modules

function AgentStrip({ onAgent, onGo }) {
  const agents = window.AGENTS;
  const online = agents.filter(a => a.status === 'live').length;
  return (
    <div className="card col-12">
      <div className="card-head">
        <div className="card-title">
          <span className="live-dot"/>
          Agent status
          <span className="card-subtitle">{online}/{agents.length} online · live</span>
        </div>
        <div className="hstack">
          <span className="tag ok">{online} LIVE</span>
          <span className="tag warn">1 WARN</span>
          <span className="tag err">1 OFFLINE</span>
          <button className="btn ghost sm" onClick={()=>onGo && onGo('settings:agents')}>
            View all <I.ArrowRight/>
          </button>
        </div>
      </div>
      <div className="card-body">
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
          {agents.map(a => (
            <div key={a.id} className="agent-strip-row" onClick={()=>onAgent && onAgent(a)}>
              <Avatar name={a.name} size={28}/>
              <div style={{flex:1, minWidth:0}}>
                <div className="agent-strip-name truncate">{a.name}</div>
                <div className="agent-strip-meta truncate">{a.role}</div>
              </div>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                <StatusDot s={a.status}/>
                <div className="agent-strip-meta">{a.status==='offline'?'—':`${a.load}%`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BridgeProvidersCard({ onGo }) {
  const payload = window.TKMC_LIVE_BRIDGE?.state?.payloads?.providers;
  const providers = payload?.providers || [];
  const summary = payload?.summary?.by_state || {};
  const loadedAt = window.TKMC_LIVE_BRIDGE?.state?.loadedAt;
  const visible = providers.slice(0, 9);

  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Bridge providers <span className="card-subtitle">live read-only</span></div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('gateway')}
          title="Open Gateway"
        >Network <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack" style={{gap:8}}>
        <div className="hstack" style={{gap:8, flexWrap:'wrap'}}>
          <span className="tag ok">{summary.active || 0} active</span>
          <span className="tag">{summary.configured || 0} configured</span>
          <span className="tag warn">{summary.sandbox || 0} sandbox</span>
          <span className="tag">{summary.backup || 0} backup</span>
        </div>
        {visible.length === 0 ? (
          <div className="muted xsmall" style={{padding:'10px 12px', background:'var(--bg-2)', border:'1px dashed var(--line-1)', borderRadius:6}}>
            Loading /api/bridge/providers…
          </div>
        ) : visible.map(p => {
          const status = p.state === 'active' || p.state === 'configured' ? 'ok'
            : p.state === 'sandbox' || p.state === 'backup' ? 'warn'
            : 'err';
          return (
            <div key={p.id} className="agent-strip-row" onClick={() => onGo && onGo('gateway')} title={p.next_action || p.detail?.notes || p.state}>
              <StatusDot s={status}/>
              <div style={{flex:1, minWidth:0}}>
                <div className="agent-strip-name truncate">{p.name}</div>
                <div className="agent-strip-meta truncate">{p.category} · {p.state}</div>
              </div>
              <span className={`tag ${status}`}>{p.state}</span>
            </div>
          );
        })}
        <div className="muted xsmall">
          Source: <span className="mono">/api/bridge/providers</span>{loadedAt ? ` · ${new Date(loadedAt).toLocaleTimeString()}` : ''}
        </div>
      </div>
    </div>
  );
}

function LiveMeetingsCard({ onJoin, onGo }) {
  const meetings = window.MEETINGS;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span className="live-dot"/>Live meetings</div>
        <span
          className="card-link"
          onClick={() => meetings[0] ? onJoin(meetings[0]) : onGo && onGo('meetings')}
          title={meetings[0] ? 'Join the first live meeting' : 'Open the meetings page'}
        >
          {meetings[0]?.status === 'live' ? 'Open room' : 'Open meetings'} <I.External/>
        </span>
      </div>
      <div className="card-body vstack">
        {meetings.map(m => (
          <div key={m.id} className="agent-strip-row" onClick={()=>m.status==='live' && onJoin(m)}>
            <div style={{width:36, height:36, borderRadius:8, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', color: m.status==='live'?'var(--ok)':'var(--fg-2)'}}>
              {m.status==='live' ? <I.Radio/> : <I.Clock/>}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontWeight:500, color:'var(--fg-0)', fontSize:13}}>{m.title}</div>
              <div className="agent-strip-meta">Host {m.host} · {m.participants} in room</div>
            </div>
            {m.status==='live' ? (
              <span className="tag ok">LIVE · {m.duration}</span>
            ) : (
              <span className="tag">{m.started}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskSummaryCard({ onOpenTasks, onTicket }) {
  const tickets = window.TICKETS;
  const byStatus = {
    pending:  tickets.filter(t=>t.status==='pending').length,
    assigned: tickets.filter(t=>t.status==='assigned').length,
    wip:      tickets.filter(t=>t.status==='wip').length,
    complete: tickets.filter(t=>t.status==='complete').length,
  };
  const priority = tickets.filter(t=>t.priority==='high' && t.status!=='complete').slice(0, 3);
  const openFiltered = (status) => onOpenTasks && onOpenTasks({ status });
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Tasks <span className="card-subtitle">today</span></div>
        <span className="card-link" onClick={()=>onOpenTasks && onOpenTasks()}>Open tasks <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
          {Object.entries(byStatus).map(([k,v])=>(
            <div
              key={k}
              className="stat-counter"
              role="button"
              tabIndex={0}
              onClick={()=>openFiltered(k)}
              onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') openFiltered(k); }}
              title={`Open ${k} tasks`}
            >
              <div className="stat-label" style={{fontSize:10}}>{k}</div>
              <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{v}</div>
            </div>
          ))}
        </div>
        <div className="stat-label" style={{marginTop:4}}>Priority tickets</div>
        <div className="vstack" style={{gap:6}}>
          {priority.map(t => (
            <div
              key={t.id}
              onClick={()=>onTicket ? onTicket(t) : (onOpenTasks && onOpenTasks())}
              role="button"
              tabIndex={0}
              onKeyDown={(e)=>{ if(e.key==='Enter') (onTicket ? onTicket(t) : onOpenTasks && onOpenTasks()); }}
              title={`Open ticket ${t.id} · ${t.title}`}
              style={{display:'flex', gap:10, alignItems:'center', padding:'8px 10px', background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:8, cursor:'pointer'}}
            >
              <span className="dot err"/>
              <div style={{flex:1, minWidth:0}}>
                <div className="truncate" style={{fontSize:12, color:'var(--fg-0)'}}>{t.title}</div>
                <div className="mono xsmall muted">{t.id} · {t.deadline}</div>
              </div>
              <div style={{width:60}}><Progress value={t.progress}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionQuickActions({ onGo, onBroadcast, onEscalate }) {
  const actions = [
    { icon: 'Plus',    label: 'New ticket',       go: () => onGo('tasks') },
    { icon: 'Send',    label: 'Broadcast',        go: () => onBroadcast && onBroadcast() },
    { icon: 'Users',   label: 'Invite teammate',  go: () => onGo('settings:users') },
    { icon: 'Restart', label: 'Reconnect agent',  go: () => onGo('settings:agents') },
    { icon: 'Plug',    label: 'Test integration', go: () => onGo('settings:integrations') },
    { icon: 'Flag',    label: 'Escalate',         go: () => onEscalate && onEscalate() },
  ];
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Quick actions</div>
        <span className="card-subtitle">Mission Control</span>
      </div>
      <div className="card-body">
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
          {actions.map(a => {
            const IconCmp = I[a.icon];
            return (
              <div key={a.label} onClick={a.go} style={{padding:'14px 10px', background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', textAlign:'center'}}>
                <IconCmp size={16}/>
                <span style={{fontSize:11, color:'var(--fg-1)'}}>{a.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SystemHealthCard({ onGo }) {
  const h = window.SYS_HEALTH;
  const data = [12,14,13,16,15,17,22,19,18,21,20,18,19,22,24,21,20,22,25,23];
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">System health</div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('health')}
          title="Open System Health page"
        >Incidents <I.ArrowRight/></span>
      </div>
      <div className="card-body">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12}}>
          <div>
            <div className="stat-label">Uptime · 30d</div>
            <div className="stat-big">{h.uptime}<span className="unit">%</span></div>
            <div className="stat-delta up">▲ 0.03 vs last period</div>
          </div>
          <Sparkline data={data} w={110} h={36}/>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:12}}>
          <div><div className="stat-label">p95</div><div className="mono" style={{fontSize:14}}>{h.p95}<span className="muted xsmall"> ms</span></div></div>
          <div><div className="stat-label">QPS</div><div className="mono" style={{fontSize:14}}>{h.qps}</div></div>
          <div><div className="stat-label">Err</div><div className="mono" style={{fontSize:14, color: h.errRate>1?'var(--err)':'var(--ok)'}}>{h.errRate}%</div></div>
          <div><div className="stat-label">Queue</div><div className="mono" style={{fontSize:14}}>{h.queueDepth}</div></div>
        </div>
      </div>
    </div>
  );
}

function ScheduledPreview({ onOpen }) {
  const todays = window.TICKETS.filter(t => t.status!=='archived' && t.status!=='complete').slice(0, 5);
  return (
    <div className="card col-8">
      <div className="card-head">
        <div className="card-title">Scheduled today <span className="card-subtitle">preview</span></div>
        <span className="card-link" onClick={onOpen}>Open schedule <I.ArrowRight/></span>
      </div>
      <div className="card-body">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:80}}>Ticket</th>
              <th>Title</th>
              <th style={{width:140}}>Agent</th>
              <th style={{width:120}}>Progress</th>
              <th style={{width:90}}>Deadline</th>
              <th style={{width:60}}></th>
            </tr>
          </thead>
          <tbody>
            {todays.map(t => {
              const ag = window.AGENTS.find(a => a.id === t.agent);
              return (
                <tr key={t.id} onClick={onOpen} style={{cursor:'pointer'}}>
                  <td className="mono muted xsmall">{t.id}</td>
                  <td className="ellip" style={{color:'var(--fg-0)'}}>
                    <span className={`dot ${t.priority==='high'?'err':t.priority==='med'?'warn':'muted'}`} style={{marginRight:8, display:'inline-block'}}/>
                    {t.title}
                  </td>
                  <td>{ag ? <span className="hstack"><Avatar name={ag.name} size={18}/> <span>{ag.name}</span></span> : <span className="muted">Unassigned</span>}</td>
                  <td><Progress value={t.progress} kind={t.progress===100?'ok':t.progress>60?'': 'warn'}/></td>
                  <td className="mono xsmall">{t.deadline}</td>
                  <td><I.Chevron size={14} style={{color:'var(--fg-3)'}}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HiveCard({ onGo }) {
  const events = [
    { who:'Atlas',    verb:'handed off',   obj:'TKT-4812 to Orion',            t:'1m',  kind:'agent' },
    { who:'Amelia',   verb:'started',      obj:'Weekly ops sync',                t:'8m',  kind:'human' },
    { who:'Lyra',     verb:'flagged',      obj:'anomaly · refund gateway',       t:'12m', kind:'agent' },
    { who:'Rafael',   verb:'replied to',   obj:'@sofia_m on Telegram',           t:'18m', kind:'human' },
    { who:'Archivist',verb:'archived',     obj:'14 memories · Q4 contracts',     t:'24m', kind:'agent' },
    { who:'Orion',    verb:'drafted',      obj:'BluePeak renewal · 78% done',    t:'34m', kind:'agent' },
  ];
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">The Hive <span className="card-subtitle">activity · live</span></div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('settings:audit')}
          title="Open the full audit / activity log"
        >Open <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack" style={{gap:0}}>
        {events.map((e,i)=>(
          <div key={i} className="hive-row">
            <Avatar name={e.who} size={22}/>
            <div style={{flex:1, minWidth:0, fontSize:12}}>
              <span style={{color: e.kind==='agent'?'var(--accent)':'var(--fg-0)', fontWeight:500}}>{e.who}</span>
              <span className="hive-verb"> {e.verb} </span>
              <span style={{color:'var(--fg-1)'}}>{e.obj}</span>
            </div>
            <span className="hive-time">{e.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryCard({ onGo }) {
  const total = 14328;
  const important = 842;
  const recent = [
    { tag:'contract',  text:'BluePeak · auto-renew clause must include 30d opt-out', ago:'2h' },
    { tag:'customer',  text:'@sofia_m prefers email over Telegram for receipts',     ago:'5h' },
    { tag:'policy',    text:'Refunds > $500 require admin approval (Law 3)',         ago:'1d' },
  ];
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Memory <span className="card-subtitle">the archive</span></div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('brain')}
          title="Open Brain Sync to search the memory archive"
        >Search <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{gap:10}}>
          <div style={{flex:1, padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Total entries</div>
            <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{total.toLocaleString()}</div>
          </div>
          <div style={{flex:1, padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Important</div>
            <div className="mono" style={{fontSize:18, color:'var(--accent)'}}>{important.toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-label" style={{marginTop:4}}>Recently surfaced</div>
        <div className="vstack" style={{gap:6}}>
          {recent.map((m,i)=>(
            <div key={i} className="mem-chip">
              <Tag>{m.tag}</Tag>
              <span style={{flex:1, minWidth:0}} className="truncate">{m.text}</span>
              <span className="mono">{m.ago}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TokensCard({ onGo }) {
  const today = 482117;
  const budget = 1500000;
  const pct = Math.round(today / budget * 100);
  const bySrc = [
    { name:'Sonnet 4.5', share: 52, color:'oklch(0.78 0.13 var(--accent-hue))' },
    { name:'Haiku 4.5',  share: 28, color:'oklch(0.78 0.15 155)' },
    { name:'Opus 4.1',   share: 14, color:'oklch(0.82 0.15 78)' },
    { name:'Other',      share: 6,  color:'var(--line-3)' },
  ];
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Tokens today <span className="card-subtitle">cost · burn</span></div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('settings:models')}
          title="Open Models settings"
        >Models <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack" style={{gap:10}}>
        <div className="hstack" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
          <div>
            <div className="stat-label">Consumed</div>
            <div className="stat-big">{(today/1000).toFixed(0)}<span className="unit">k</span></div>
            <div className="stat-delta">{pct}% of daily budget · ${(today * 0.000006).toFixed(2)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="stat-label">Projected</div>
            <div className="mono" style={{fontSize:14, color:'var(--fg-0)'}}>{(budget/1000).toFixed(0)}k</div>
          </div>
        </div>
        <div className="cost-bar">
          {bySrc.map(s => <span key={s.name} style={{width:`${s.share}%`, background:s.color}}/>)}
        </div>
        <div className="hstack" style={{flexWrap:'wrap', gap:10}}>
          {bySrc.map(s => (
            <div key={s.name} className="hstack" style={{fontSize:11, gap:6}}>
              <span style={{width:8, height:8, borderRadius:2, background:s.color}}/>
              <span style={{color:'var(--fg-1)'}}>{s.name}</span>
              <span className="mono muted">{s.share}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsMini({ onGo }) {
  const alerts = window.ALERTS.slice(0,3);
  const ack = (a) => {
    window.api?.audit?.emit?.('alert.acknowledge', a.id, { msg: a.msg, area: a.area, level: a.level });
    try { window.Notifications?.emit?.({ kind:'info', source:'alerts', title:'Alert acknowledged', detail:`${a.area} · ${a.msg}` }); } catch(_) {}
    // Best-effort: remove from the in-memory list so the dashboard reflects it.
    if (window.ALERTS) window.ALERTS = window.ALERTS.filter(x => x.id !== a.id);
    // Force re-render via a tick.
    window.dispatchEvent(new CustomEvent('alerts:changed'));
  };
  // Re-render on alerts:changed
  const [, force] = React.useReducer(x=>x+1, 0);
  React.useEffect(() => {
    const h = () => force();
    window.addEventListener('alerts:changed', h);
    return () => window.removeEventListener('alerts:changed', h);
  }, []);
  return (
    <div className="card col-4">
      <div className="card-head">
        <div className="card-title">Alerts needing review</div>
        <span
          className="card-link"
          onClick={() => onGo && onGo('settings:alerts')}
          title="Open the full alerts list"
        >All <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack" style={{gap:8}}>
        {alerts.length === 0 && (
          <div className="muted xsmall" style={{padding:'10px 12px', background:'var(--bg-2)', border:'1px dashed var(--line-1)', borderRadius:6}}>
            No alerts to review.
          </div>
        )}
        {alerts.map(a => (
          <div key={a.id} style={{display:'flex', gap:10, padding:'8px 10px', background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:8, alignItems:'center'}}>
            <StatusDot s={a.level==='err'?'err': a.level==='warn'?'warn':'ok'}/>
            <div style={{flex:1, minWidth:0}}>
              <div className="truncate" style={{fontSize:12, color:'var(--fg-0)'}}>{a.msg}</div>
              <div className="mono xsmall muted">{a.area} · {a.time}</div>
            </div>
            {a.actionable
              ? <button className="btn sm" onClick={()=>ack(a)} title="Acknowledge · writes audit row">Acknowledge</button>
              : <button className="btn sm disabled-honest" disabled title="Read-only alert · no actionable fix wired">Info</button>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ onGo, onJoin, editMode, setEditMode, modules, toggleModule, onAgent, onTicket, onOpenTasks, onOps }) {
  const has = (id) => modules[id] !== false;
  const [reportOpen,    setReportOpen]    = React.useState(false);
  const [broadcastOpen, setBroadcastOpen] = React.useState(false);
  const [escalateOpen,  setEscalateOpen]  = React.useState(false);
  const openTasks = (filter) => {
    if (onOpenTasks) onOpenTasks(filter || null);
    else onGo('tasks');
  };
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Mission Control</h1>
          <div className="sub">Priority surface · {new Date().toLocaleDateString(undefined,{weekday:'long', month:'short', day:'numeric'})} · Live agent, provider, skill, gateway, task, Brain Sync, and Harness status</div>
        </div>
        <div className="page-actions">
          <button className={`btn ${editMode?'primary':''}`} onClick={()=>setEditMode(!editMode)}>
            <I.Edit/> {editMode ? 'Done editing' : 'Edit dashboard'}
          </button>
          <button className="btn" onClick={()=>setReportOpen(true)} title="Export current ticket data as CSV or JSON"><I.Download/> Report</button>
          <button className="btn primary" onClick={()=>openTasks({ _newTicket: true })} title="Create a new ticket in the task workspace"><I.Plus/> New ticket</button>
        </div>
      </div>
      {reportOpen    && <ReportModal    onClose={()=>setReportOpen(false)}/>}
      {broadcastOpen && <BroadcastModal onClose={()=>setBroadcastOpen(false)}/>}
      {escalateOpen  && <EscalateModal  context={{kind:'general'}} onClose={()=>setEscalateOpen(false)}/>}

      {editMode && (
        <div className="card" style={{marginBottom:14, borderColor:'var(--accent-line)', background:'linear-gradient(0deg, var(--accent-soft), transparent)'}}>
          <div className="card-body hstack" style={{justifyContent:'space-between'}}>
            <div className="hstack">
              <I.Drag style={{color:'var(--accent)'}}/>
              <div>
                <div style={{color:'var(--accent)', fontSize:12, fontWeight:600}}>Edit dashboard</div>
                <div className="muted xsmall">Toggle modules below. Changes are saved per user.</div>
              </div>
            </div>
            <div className="filter-row">
              {['agents','meetings','hive','tasks','quick','schedule','alerts','health','memory','tokens','webops','graphify','obsidian','telemetry','policy','pacman'].map(m => (
                <div key={m} className={`filter-pill ${has(m)?'on':''}`} onClick={()=>toggleModule(m)}>
                  {has(m) ? <I.Check size={12}/> : <I.Plus size={12}/>}
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="dash-grid">
        {has('agents')    && <AgentStrip onAgent={onAgent} onGo={onGo}/>}
        <BridgeProvidersCard onGo={onGo}/>
        {has('meetings')  && <LiveMeetingsCard onJoin={onJoin} onGo={onGo}/>}
        {has('hive')      && <HiveCard onGo={onGo}/>}
        {has('tasks')     && <TaskSummaryCard onOpenTasks={openTasks} onTicket={onTicket}/>}
        {has('graphify')  && <GraphifyCard         onOpen={()=>onOps && onOps('graphify')}/>}
        {has('webops')    && <WebOpsCard            onOpen={()=>onOps && onOps('webops')}/>}
        {has('obsidian')  && <ObsidianSyncCard    onOpen={()=>onOps && onOps('obsidian')}/>}
        {has('telemetry') && <AgentTelemetryCard  onOpen={(tab, skillId)=>onOps && onOps('telemetry', tab, skillId)}/>}
        {has('policy')    && <PolicyHealthCard    onOpen={()=>onOps && onOps('policy')}/>}
        {has('pacman')    && <PacmanOpsCard       onOpen={(t)=>onOps && onOps('pacman', t)}/>}
        {has('schedule')  && <ScheduledPreview onOpen={()=>onGo('schedule')}/>}
        {has('alerts')    && <AlertsMini onGo={onGo}/>}
        {has('quick')     && <MissionQuickActions onGo={onGo} onBroadcast={()=>setBroadcastOpen(true)} onEscalate={()=>setEscalateOpen(true)}/>}
        {has('health')    && <SystemHealthCard onGo={onGo}/>}
        {has('memory')    && <MemoryCard onGo={onGo}/>}
        {has('tokens')    && <TokensCard onGo={onGo}/>}
      </div>
    </>
  );
}

Object.assign(window, { Dashboard });
