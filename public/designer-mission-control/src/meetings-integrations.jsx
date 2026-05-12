// Meetings integrations — Teams, Zoom, Meet, Webex
// Agents can auto-join new meetings from any connected platform.
// Per correction addendum: mounted inside the existing MC. Card on dashboard + drawer.

const MEETING_PROVIDERS = [
  {
    id: 'teams',
    name: 'Microsoft Teams',
    tenant: 'toknowledge.onmicrosoft.com',
    status: 'connected',        // connected | disconnected | error | pending
    health: 'healthy',           // healthy | degraded | error
    connectedAt: '2025-03-14',
    scopes: ['OnlineMeetings.ReadWrite', 'Calendars.Read', 'Presence.Read.All', 'Chat.ReadWrite'],
    webhook: 'https://claw.io/hooks/teams',
    autoJoin: true,
    defaultAgent: 'atlas',
    joinAs: 'participant',        // participant | transcriber | silent
    calendarWatch: true,
    upcoming: 4,
    joinedToday: 3,
    lastEvent: 'Joined · Weekly ops sync',
    lastEventAt: '14:30',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    tenant: 'toknowledge.zoom.us',
    status: 'connected',
    health: 'healthy',
    connectedAt: '2025-02-02',
    scopes: ['meeting:read', 'meeting:write', 'user:read', 'webhook:write'],
    webhook: 'https://claw.io/hooks/zoom',
    autoJoin: true,
    defaultAgent: 'scribe',
    joinAs: 'transcriber',
    calendarWatch: true,
    upcoming: 2,
    joinedToday: 5,
    lastEvent: 'Transcribed · Customer discovery — Nest',
    lastEventAt: '11:14',
  },
  {
    id: 'meet',
    name: 'Google Meet',
    tenant: 'to-knowledge.com',
    status: 'connected',
    health: 'degraded',
    connectedAt: '2025-03-30',
    scopes: ['calendar.events.readonly', 'meetings.space.created'],
    webhook: 'https://claw.io/hooks/meet',
    autoJoin: false,
    defaultAgent: 'atlas',
    joinAs: 'silent',
    calendarWatch: true,
    upcoming: 1,
    joinedToday: 0,
    lastEvent: 'Calendar polled · 0 upcoming',
    lastEventAt: '14:20',
    warning: 'Token expires in 6 days — re-authorize',
  },
  {
    id: 'webex',
    name: 'Cisco Webex',
    tenant: null,
    status: 'disconnected',
    health: null,
    connectedAt: null,
    scopes: [],
    webhook: null,
    autoJoin: false,
    defaultAgent: null,
    joinAs: 'participant',
    calendarWatch: false,
    upcoming: 0,
    joinedToday: 0,
    lastEvent: '—',
    lastEventAt: null,
  },
];

// Catalog of providers that CAN be added — extensible. To add a new platform in
// the future, append an entry here (or register via the "Add custom platform"
// flow which maps to the same record shape).
const PROVIDER_CATALOG = [
  { id:'teams',      name:'Microsoft Teams', auth:'oauth2',  category:'enterprise', desc:'Auto-join Teams meetings via Graph API' },
  { id:'zoom',       name:'Zoom',            auth:'oauth2',  category:'enterprise', desc:'Transcribe and participate via Zoom Apps SDK' },
  { id:'meet',       name:'Google Meet',     auth:'oauth2',  category:'enterprise', desc:'Calendar-triggered join via Google Meet REST' },
  { id:'webex',      name:'Cisco Webex',     auth:'oauth2',  category:'enterprise', desc:'Join Webex meetings as a participant bot' },
  { id:'slack',      name:'Slack Huddles',   auth:'oauth2',  category:'chat',       desc:'Detect and join ad-hoc huddles from Slack' },
  { id:'discord',    name:'Discord Stage',   auth:'oauth2',  category:'chat',       desc:'Observe and transcribe Discord voice channels' },
  { id:'around',     name:'Around',          auth:'oauth2',  category:'modern',     desc:'Low-bandwidth meeting bot' },
  { id:'whereby',    name:'Whereby',         auth:'apikey',  category:'modern',     desc:'Embeddable browser-based rooms' },
  { id:'livekit',    name:'LiveKit',         auth:'apikey',  category:'realtime',   desc:'Self-hosted WebRTC rooms' },
  { id:'daily',      name:'Daily.co',        auth:'apikey',  category:'realtime',   desc:'Custom video apps via Daily REST' },
  { id:'jitsi',      name:'Jitsi',           auth:'jwt',     category:'selfhost',   desc:'Self-hosted JWT-authenticated rooms' },
  { id:'bluejeans',  name:'BlueJeans',       auth:'oauth2',  category:'enterprise', desc:'Verizon BlueJeans Gateway' },
  { id:'gotomeeting',name:'GoTo Meeting',    auth:'oauth2',  category:'enterprise', desc:'LogMeIn GoTo API' },
  { id:'chime',      name:'Amazon Chime',    auth:'iam',     category:'enterprise', desc:'AWS Chime SDK Meetings' },
  { id:'sip',        name:'SIP / H.323',     auth:'sip',     category:'protocol',   desc:'Generic SIP endpoint — dial in to any conferencing bridge' },
  { id:'custom',     name:'Custom platform', auth:'custom',  category:'extensible', desc:'Define your own: endpoint URL, auth header, webhook secret' },
];

const MEETING_UPCOMING = [
  { t:'15:00', title:'Ops war-room · VIP escalations',    provider:'teams', agent:'atlas',    autoJoin:true,  attendees:6,  duration:'45m' },
  { t:'15:30', title:'Customer: Nest · contract review',   provider:'zoom',  agent:'orion',    autoJoin:true,  attendees:3,  duration:'30m' },
  { t:'16:00', title:'Weekly eng standup',                 provider:'teams', agent:'scribe',   autoJoin:true,  attendees:9,  duration:'30m' },
  { t:'16:30', title:'Q4 strategy sync',                    provider:'meet',  agent:'research', autoJoin:false, attendees:4,  duration:'60m' },
  { t:'17:15', title:'1:1 · Amelia / Lyra',                 provider:'teams', agent:'atlas',    autoJoin:true,  attendees:2,  duration:'30m' },
  { t:'18:00', title:'EU vendor call',                      provider:'zoom',  agent:'orion',    autoJoin:true,  attendees:5,  duration:'45m' },
];

/* ------------------------------------------------------------
   Brand glyphs — solid colors, no pixelated logos
   ------------------------------------------------------------ */
function ProviderGlyph({ id, size = 18 }) {
  const s = { width: size, height: size, borderRadius: size/5, display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight: 700, fontSize: size*0.48, color: '#fff', flexShrink:0 };
  const glyphs = {
    teams:       { bg: 'linear-gradient(135deg,#5b5fc7,#464eb8)', txt:'T' },
    zoom:        { bg: '#2d8cff',                                  txt:'Z' },
    meet:        { bg: 'linear-gradient(135deg,#00ac47,#1a73e8)', txt:'M' },
    webex:       { bg: '#00bceb',                                  txt:'W' },
    slack:       { bg: 'linear-gradient(135deg,#611f69,#e01e5a)', txt:'S' },
    discord:     { bg: '#5865f2',                                  txt:'D' },
    around:      { bg: '#ff6a3d',                                  txt:'A' },
    whereby:     { bg: '#3e63dd',                                  txt:'W' },
    livekit:     { bg: 'linear-gradient(135deg,#06b6d4,#0ea5e9)', txt:'L' },
    daily:       { bg: '#1bebb9',                                  txt:'D' },
    jitsi:       { bg: '#1d76ba',                                  txt:'J' },
    bluejeans:   { bg: '#0072c6',                                  txt:'B' },
    gotomeeting: { bg: '#f68d2e',                                  txt:'G' },
    chime:       { bg: 'linear-gradient(135deg,#ff9900,#232f3e)', txt:'C' },
    sip:         { bg: 'var(--bg-3)',                              txt:'§' },
    custom:      { bg: 'var(--bg-3)',                              txt:'+' },
  };
  const g = glyphs[id] || { bg:'var(--bg-3)', txt: (id||'?').charAt(0).toUpperCase() };
  return <span style={{...s, background:g.bg, border: id==='custom' ? '1px dashed var(--line-3)':'none', color: id==='custom' ? 'var(--fg-1)':'#fff'}}>{g.txt}</span>;
}

/* ------------------------------------------------------------
   Dashboard card
   ------------------------------------------------------------ */
function MeetingIntegrationsCard({ onOpen }) {
  const connected = MEETING_PROVIDERS.filter(p => p.status==='connected');
  const upcomingTotal = connected.reduce((a,p) => a + p.upcoming, 0);
  const joinedToday = connected.reduce((a,p) => a + p.joinedToday, 0);
  const autoJoinOn = connected.filter(p => p.autoJoin).length;
  const hasWarn = MEETING_PROVIDERS.some(p => p.health==='degraded' || p.warning);

  return (
    <div className="card col-4 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <I.Link/>
          Meeting integrations
          <span className="card-subtitle">Teams · Zoom · Meet</span>
        </div>
        <span className="card-link">Manage <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{justifyContent:'space-between'}}>
          <div>
            <div className="stat-label">Connected platforms</div>
            <div className="hstack" style={{gap:6, marginTop:4}}>
              {MEETING_PROVIDERS.map(p => (
                <span key={p.id} className="hstack" style={{
                  gap:4,
                  padding:'3px 8px 3px 4px',
                  borderRadius:999,
                  background: p.status==='connected' ? 'var(--bg-2)' : 'transparent',
                  border: p.status==='connected' ? '1px solid var(--line-1)' : '1px dashed var(--line-2)',
                  opacity: p.status==='connected' ? 1 : 0.45,
                  fontSize: 11,
                }}>
                  <ProviderGlyph id={p.id} size={14}/>
                  <span style={{color:'var(--fg-1)'}}>{p.name.split(' ')[0]}</span>
                  {p.status==='connected' && <StatusDot s={p.health==='healthy'?'ok':'warn'}/>}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Upcoming</div>
            <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{upcomingTotal}</div>
            <div className="muted xsmall">next 24h</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Auto-join</div>
            <div className="mono" style={{fontSize:16, color:'var(--accent)'}}>{autoJoinOn}/{connected.length}</div>
            <div className="muted xsmall">platforms on</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Joined today</div>
            <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{joinedToday}</div>
            <div className="muted xsmall">by agents</div>
          </div>
        </div>
        {hasWarn && (
          <div className="hstack" style={{padding:'7px 10px', background:'var(--warn-soft)', borderRadius:6, border:'1px solid oklch(0.82 0.15 78 / 0.35)'}}>
            <I.Alert size={13} style={{color:'var(--warn)'}}/>
            <span style={{color:'var(--warn)', fontSize:12, flex:1}}>Google Meet token expires in 6 days</span>
            <button className="btn sm" onClick={(e)=>{e.stopPropagation(); onOpen && onOpen();}}>Renew</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Drill-down drawer
   ------------------------------------------------------------ */
function MeetingIntegrationsDrawer({ onClose, initialTab }) {
  const [tab, setTab] = React.useState(initialTab || 'platforms');
  const [providers, setProviders] = React.useState(MEETING_PROVIDERS);
  const [connectModal, setConnectModal] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const addProvider = (catalogItem, extra = {}) => {
    // Map a catalog entry (or a custom one) to a provider record.
    const record = {
      id: extra.id || catalogItem.id + '-' + Math.random().toString(36).slice(2,6),
      name: extra.name || catalogItem.name,
      tenant: extra.tenant || null,
      status: 'pending',
      health: null,
      connectedAt: null,
      scopes: extra.scopes || [],
      webhook: extra.webhook || null,
      autoJoin: false,
      defaultAgent: extra.defaultAgent || null,
      joinAs: 'participant',
      calendarWatch: false,
      upcoming: 0, joinedToday: 0,
      lastEvent: 'Pending authorization',
      lastEventAt: null,
      auth: catalogItem.auth,
      category: catalogItem.category,
    };
    setProviders(prev => [...prev, record]);
    setAddOpen(false);
    setConnectModal(record.id);
  };

  const toggleProvider = (id, field) => {
    setProviders(prev => prev.map(p => p.id === id ? {...p, [field]: !p[field]} : p));
  };
  const setProviderField = (id, field, value) => {
    setProviders(prev => prev.map(p => p.id === id ? {...p, [field]: value} : p));
  };
  const connectedCount = providers.filter(p=>p.status==='connected').length;

  return (
    <WorkspaceOverlay title="Meeting integrations" subtitle="Teams · Zoom · Google Meet · Webex" onClose={onClose} wide>
      <div className="dash-grid" style={{marginBottom:14}}>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Connected</div><div className="stat-big">{connectedCount}<span className="unit">/ {providers.length}</span></div><div className="muted xsmall">platforms</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Agents deployable</div><div className="stat-big">{providers.filter(p=>p.autoJoin && p.status==='connected').length}</div><div className="muted xsmall">with auto-join on</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Upcoming (24h)</div><div className="stat-big">{providers.reduce((a,p)=>a+p.upcoming,0)}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Joined today</div><div className="stat-big">{providers.reduce((a,p)=>a+p.joinedToday,0)}</div></div></div>
      </div>

      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={tab} onChange={setTab} options={[
          {value:'platforms', label:'Platforms',    count: providers.length},
          {value:'upcoming',  label:'Upcoming',     count: MEETING_UPCOMING.length},
          {value:'agents',    label:'Agent routing',count: providers.filter(p=>p.status==='connected').length},
          {value:'log',       label:'Activity log'},
        ]}/>
        <span className="spacer"/>
        <button className="btn primary" onClick={()=>setAddOpen(true)}><I.Plus size={12}/> Add platform</button>
      </div>

      {tab === 'platforms' && (
        <div className="vstack" style={{gap:12}}>
          {providers.map(p => (
            <div key={p.id} className="card" style={{margin:0}}>
              <div className="card-body">
                <div className="hstack" style={{alignItems:'flex-start', gap:14}}>
                  <ProviderGlyph id={p.id} size={36}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="hstack" style={{gap:8}}>
                      <div style={{fontSize:15, color:'var(--fg-0)', fontWeight:600}}>{p.name}</div>
                      {p.status==='connected' ? (
                        <span className={`tag ${p.health==='healthy'?'ok':'warn'}`}>
                          <StatusDot s={p.health==='healthy'?'ok':'warn'}/>
                          {p.health}
                        </span>
                      ) : (
                        <span className="tag">disconnected</span>
                      )}
                      {p.autoJoin && p.status==='connected' && <span className="tag" style={{color:'var(--accent)'}}>auto-join</span>}
                    </div>
                    <div className="muted xsmall mono" style={{marginTop:2}}>{p.tenant || 'not authorized'}</div>
                    {p.warning && (
                      <div className="hstack" style={{marginTop:6, padding:'6px 10px', background:'var(--warn-soft)', borderRadius:6, fontSize:12, color:'var(--warn)', gap:6}}>
                        <I.Alert size={12}/> {p.warning}
                      </div>
                    )}

                    {p.status === 'connected' ? (
                      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginTop:10}}>
                        <div>
                          <div className="stat-label">Auto-join new meetings</div>
                          <div style={{marginTop:6}}>
                            <Switch on={p.autoJoin} onToggle={()=>toggleProvider(p.id, 'autoJoin')}/>
                          </div>
                        </div>
                        <div>
                          <div className="stat-label">Default agent</div>
                          <select className="select" value={p.defaultAgent || ''} onChange={e=>setProviderField(p.id, 'defaultAgent', e.target.value)} style={{marginTop:4, width:'100%'}}>
                            {window.AGENTS.filter(a=>a.status!=='offline').map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="stat-label">Join as</div>
                          <select className="select" value={p.joinAs} onChange={e=>setProviderField(p.id, 'joinAs', e.target.value)} style={{marginTop:4, width:'100%'}}>
                            <option value="participant">Participant</option>
                            <option value="transcriber">Transcriber only</option>
                            <option value="silent">Silent observer</option>
                          </select>
                        </div>
                        <div>
                          <div className="stat-label">Calendar watch</div>
                          <div style={{marginTop:6}}>
                            <Switch on={p.calendarWatch} onToggle={()=>toggleProvider(p.id, 'calendarWatch')}/>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{marginTop:10, fontSize:12, color:'var(--fg-2)'}}>
                        Connect to let agents detect and join {p.name} meetings automatically.
                      </div>
                    )}

                    {p.status === 'connected' && (
                      <div className="hstack" style={{marginTop:10, flexWrap:'wrap', gap:6}}>
                        <span className="stat-label" style={{marginRight:4}}>Scopes:</span>
                        {p.scopes.map(s => <span key={s} className="tag mono xsmall">{s}</span>)}
                      </div>
                    )}
                  </div>

                  <div className="vstack" style={{gap:6, alignItems:'flex-end', minWidth:200}}>
                    {p.status === 'connected' ? (
                      <>
                        <div className="muted xsmall">Connected {p.connectedAt}</div>
                        <div className="hstack" style={{gap:6}}>
                          <button className="btn sm" disabled title="Provider test is disabled until the meeting connector backend is available."><I.Activity size={12}/> Test</button>
                          <button className="btn sm" disabled title="OAuth re-auth is disabled until the meeting connector backend is available."><I.Refresh size={12}/> Re-auth</button>
                        </div>
                        <button className="btn sm" style={{color:'var(--err)'}} disabled title="Disconnect is disabled until the meeting connector backend is available.">Disconnect</button>
                      </>
                    ) : (
                      <>
                        <button className="btn primary" onClick={()=>setConnectModal(p.id)}>
                          <I.Link size={12}/> Connect {p.name}
                        </button>
                        <div className="muted xsmall" style={{textAlign:'right'}}>OAuth via Integrations</div>
                      </>
                    )}
                  </div>
                </div>

                {p.status === 'connected' && (
                  <div className="hstack" style={{marginTop:12, paddingTop:12, borderTop:'1px solid var(--line-1)', fontSize:12, gap:20}}>
                    <div className="hstack" style={{gap:6}}>
                      <span className="muted">Upcoming</span>
                      <span className="mono" style={{color:'var(--fg-0)'}}>{p.upcoming}</span>
                    </div>
                    <div className="hstack" style={{gap:6}}>
                      <span className="muted">Joined today</span>
                      <span className="mono" style={{color:'var(--fg-0)'}}>{p.joinedToday}</span>
                    </div>
                    <div className="hstack" style={{gap:6, flex:1, minWidth:0}}>
                      <span className="muted">Last event</span>
                      <span style={{color:'var(--fg-1)'}} className="truncate">{p.lastEvent}</span>
                      {p.lastEventAt && <span className="mono xsmall muted">{p.lastEventAt}</span>}
                    </div>
                    <button className="btn sm" disabled title="Webhook inspection is disabled until connector diagnostics are available."><I.External size={11}/> Webhook</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:70}}>Time</th>
                <th style={{width:130}}>Platform</th>
                <th>Meeting</th>
                <th style={{width:90}}>Attendees</th>
                <th style={{width:90}}>Duration</th>
                <th style={{width:180}}>Agent</th>
                <th style={{width:120}}>Auto-join</th>
                <th style={{width:120}}></th>
              </tr>
            </thead>
            <tbody>
              {MEETING_UPCOMING.map((m,i) => {
                const prov = providers.find(p => p.id === m.provider);
                const ag = window.AGENTS.find(a => a.id === m.agent);
                return (
                  <tr key={i}>
                    <td className="mono xsmall" style={{color:'var(--fg-0)'}}>{m.t}</td>
                    <td>
                      <span className="hstack" style={{gap:6}}>
                        <ProviderGlyph id={m.provider} size={16}/>
                        <span style={{color:'var(--fg-1)'}}>{prov?.name.split(' ')[0]}</span>
                      </span>
                    </td>
                    <td style={{color:'var(--fg-0)'}} className="truncate">{m.title}</td>
                    <td className="mono xsmall muted">{m.attendees}</td>
                    <td className="mono xsmall muted">{m.duration}</td>
                    <td>{ag ? <span className="hstack"><Avatar name={ag.name} size={18}/> <span>{ag.name}</span></span> : <span className="muted">—</span>}</td>
                    <td>
                      <Switch on={m.autoJoin && prov?.autoJoin}/>
                    </td>
                    <td>
                      <button className="btn sm" disabled title="Join link requires the meeting connector backend; use the Meetings card for the local lobby."><I.Play size={11}/> Join now</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'agents' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Agent ↔ platform routing</div>
            <span className="muted xsmall">Which agent covers new meetings on each platform by default</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:200}}>Platform</th>
                <th>Default agent</th>
                <th style={{width:160}}>Join behavior</th>
                <th style={{width:120}}>Auto-join</th>
                <th style={{width:120}}>Recording</th>
                <th style={{width:120}}>Transcript</th>
              </tr>
            </thead>
            <tbody>
              {providers.filter(p=>p.status==='connected').map(p => {
                const ag = window.AGENTS.find(a=>a.id===p.defaultAgent);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="hstack" style={{gap:8}}>
                        <ProviderGlyph id={p.id} size={20}/>
                        <span style={{color:'var(--fg-0)'}}>{p.name}</span>
                      </span>
                    </td>
                    <td>
                      <select className="select" value={p.defaultAgent||''} onChange={e=>setProviderField(p.id,'defaultAgent',e.target.value)} style={{width:220}}>
                        {window.AGENTS.filter(a=>a.status!=='offline').map(a => (
                          <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="select" value={p.joinAs} onChange={e=>setProviderField(p.id,'joinAs',e.target.value)} style={{width:150}}>
                        <option value="participant">Participant</option>
                        <option value="transcriber">Transcriber</option>
                        <option value="silent">Silent</option>
                      </select>
                    </td>
                    <td><Switch on={p.autoJoin} onToggle={()=>toggleProvider(p.id,'autoJoin')}/></td>
                    <td><Switch on={true}/></td>
                    <td><Switch on={true}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'log' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:80}}>Time</th>
                <th style={{width:110}}>Platform</th>
                <th style={{width:130}}>Event</th>
                <th>Detail</th>
                <th style={{width:120}}>Agent</th>
                <th style={{width:100}}>Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t:'14:32', pv:'teams', ev:'meeting.joined',   detail:'Weekly ops sync · 6 participants', agent:'atlas',  ok:true },
                { t:'14:30', pv:'teams', ev:'calendar.event',   detail:'Detected new meeting (15:00) · scheduled auto-join', agent:'atlas',  ok:true },
                { t:'14:22', pv:'meet',  ev:'token.refresh',    detail:'Refreshed OAuth access token', agent:null, ok:true },
                { t:'14:14', pv:'zoom',  ev:'webhook.received', detail:'meeting.started · 87442019312', agent:'scribe', ok:true },
                { t:'14:14', pv:'zoom',  ev:'meeting.joined',   detail:'Customer discovery — Nest · transcriber', agent:'scribe', ok:true },
                { t:'13:48', pv:'meet',  ev:'token.warn',       detail:'Access token expires in 6 days', agent:null, ok:false },
                { t:'13:12', pv:'teams', ev:'meeting.ended',    detail:'VIP escalation huddle · 22m', agent:'atlas', ok:true },
                { t:'12:10', pv:'teams', ev:'presence.updated', detail:'Amelia: available → in a meeting', agent:null, ok:true },
                { t:'11:14', pv:'zoom',  ev:'meeting.ended',    detail:'Customer discovery — Nest · 26m', agent:'scribe', ok:true },
              ].map((e,i) => {
                const prov = providers.find(p => p.id === e.pv);
                const ag = e.agent ? window.AGENTS.find(a=>a.id===e.agent) : null;
                return (
                  <tr key={i}>
                    <td className="mono xsmall muted">{e.t}</td>
                    <td><span className="hstack" style={{gap:6}}><ProviderGlyph id={e.pv} size={14}/> <span style={{color:'var(--fg-1)'}}>{prov?.name.split(' ')[0]}</span></span></td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.ev}</td>
                    <td style={{color:'var(--fg-1)'}} className="truncate">{e.detail}</td>
                    <td>{ag ? <span className="hstack"><Avatar name={ag.name} size={16}/> <span className="xsmall">{ag.name}</span></span> : <span className="muted xsmall">—</span>}</td>
                    <td>
                      <span className={`tag ${e.ok?'ok':'warn'}`}>
                        <StatusDot s={e.ok?'ok':'warn'}/>
                        {e.ok?'ok':'warn'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card col-12" style={{marginTop:14, background:'var(--bg-1)'}}>
        <div className="card-body hstack" style={{gap:12}}>
          <I.Lock style={{color:'var(--fg-2)'}}/>
          <div style={{flex:1}}>
            <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>Credentials &amp; secrets</div>
            <div className="muted xsmall">OAuth tokens and webhook secrets are managed in Settings → Integrations. This page only surfaces status and routing.</div>
          </div>
          <button className="btn" onClick={()=>window.appGoTo?.('settings:integrations')}><I.External/> Open integrations</button>
        </div>
      </div>

      {connectModal && (
        <ConnectModal provider={providers.find(p=>p.id===connectModal)} onClose={()=>setConnectModal(null)} />
      )}
      {addOpen && (
        <AddPlatformModal onClose={()=>setAddOpen(false)} onAdd={addProvider}/>
      )}
    </WorkspaceOverlay>
  );
}

function ConnectModal({ provider, onClose }) {
  const [step, setStep] = React.useState(1);
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:100}}/>
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'var(--bg-1)', border:'1px solid var(--line-2)', borderRadius:12,
        boxShadow:'var(--shadow-pop)', width: 480, zIndex:101,
      }}>
        <div className="hstack" style={{padding:'14px 18px', borderBottom:'1px solid var(--line-1)'}}>
          <ProviderGlyph id={provider.id} size={24}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14, color:'var(--fg-0)', fontWeight:600}}>Connect {provider.name}</div>
            <div className="muted xsmall">Step {step} of 3</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.X size={16}/></button>
        </div>
        <div style={{padding:18}}>
          {step===1 && (
            <div className="vstack">
              <div style={{color:'var(--fg-0)', fontSize:13}}>Authorize ClaudeClaw with your workspace</div>
              <div className="muted xsmall">You'll be redirected to {provider.name} to grant:</div>
              <ul style={{margin:'6px 0 0 18px', padding:0, fontSize:12, color:'var(--fg-1)'}}>
                <li>Read calendar events &amp; meeting metadata</li>
                <li>Create, join, and transcribe online meetings</li>
                <li>Subscribe to webhook notifications</li>
              </ul>
            </div>
          )}
          {step===2 && (
            <div className="vstack">
              <div style={{color:'var(--fg-0)', fontSize:13}}>Choose default agent</div>
              <select className="select" defaultValue="atlas" style={{width:'100%'}}>
                {window.AGENTS.filter(a=>a.status!=='offline').map(a => (
                  <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
                ))}
              </select>
              <div className="muted xsmall">This agent will be the default participant for new meetings on {provider.name}. You can override per-meeting later.</div>
            </div>
          )}
          {step===3 && (
            <div className="vstack" style={{alignItems:'center', padding:'8px 0'}}>
              <I.Check size={36} style={{color:'var(--ok)'}}/>
              <div style={{color:'var(--fg-0)', fontSize:14, fontWeight:600}}>Ready to connect</div>
              <div className="muted xsmall" style={{textAlign:'center'}}>You'll be redirected to {provider.name}. Webhook will be provisioned automatically.</div>
            </div>
          )}
        </div>
        <div className="hstack" style={{padding:'12px 18px', borderTop:'1px solid var(--line-1)'}}>
          <button className="btn" onClick={()=>step>1?setStep(step-1):onClose()}>{step>1?'Back':'Cancel'}</button>
          <span className="spacer"/>
          {step<3 ? (
            <button className="btn primary" onClick={()=>setStep(step+1)}>Continue <I.ArrowRight size={12}/></button>
          ) : (
            <button className="btn primary" onClick={onClose}><I.External size={12}/> Open {provider.name}</button>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  MEETING_PROVIDERS, MEETING_UPCOMING, PROVIDER_CATALOG,
  MeetingIntegrationsCard, MeetingIntegrationsDrawer, ProviderGlyph, ConnectModal, AddPlatformModal,
});

/* ------------------------------------------------------------
   AddPlatformModal — browse catalog + build custom platform
   ------------------------------------------------------------ */
function AddPlatformModal({ onClose, onAdd }) {
  const [mode, setMode] = React.useState('browse'); // browse | custom
  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [customForm, setCustomForm] = React.useState({
    name: '',
    endpoint: '',
    auth: 'oauth2',
    webhookSecret: '',
    notes: '',
  });

  const catalog = PROVIDER_CATALOG.filter(p => {
    if (category !== 'all' && p.category !== category) return false;
    if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:100}}/>
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'var(--bg-1)', border:'1px solid var(--line-2)', borderRadius:12,
        boxShadow:'var(--shadow-pop)', width: 720, maxWidth:'92vw',
        maxHeight:'86vh', display:'flex', flexDirection:'column', zIndex:101,
      }}>
        <div className="hstack" style={{padding:'14px 18px', borderBottom:'1px solid var(--line-1)'}}>
          <I.Plus/>
          <div style={{flex:1}}>
            <div style={{fontSize:14, color:'var(--fg-0)', fontWeight:600}}>Add meeting platform</div>
            <div className="muted xsmall">Extensible — connect any conferencing platform, now or later.</div>
          </div>
          <ButtonGroup value={mode} onChange={setMode} options={[
            {value:'browse', label:'Catalog'},
            {value:'custom', label:'Custom'},
          ]}/>
          <button className="icon-btn" onClick={onClose} style={{marginLeft:8}}><I.X size={16}/></button>
        </div>

        {mode==='browse' && (
          <>
            <div className="hstack" style={{padding:'10px 18px', borderBottom:'1px solid var(--line-1)', gap:8}}>
              <div className="topbar-search" style={{flex:1}}>
                <I.Search size={13}/>
                <input placeholder="Search 15+ platforms…" value={q} onChange={e=>setQ(e.target.value)}/>
              </div>
              <select className="select" value={category} onChange={e=>setCategory(e.target.value)} style={{width:160}}>
                <option value="all">All categories</option>
                <option value="enterprise">Enterprise</option>
                <option value="chat">Chat-native</option>
                <option value="modern">Modern</option>
                <option value="realtime">Realtime SDK</option>
                <option value="selfhost">Self-hosted</option>
                <option value="protocol">Protocol</option>
                <option value="extensible">Extensible</option>
              </select>
            </div>
            <div style={{overflow:'auto', padding:14}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {catalog.map(p => (
                  <div key={p.id} className="card hov" style={{margin:0, cursor:'pointer'}} onClick={()=>p.id==='custom' ? setMode('custom') : onAdd(p)}>
                    <div className="card-body hstack" style={{alignItems:'flex-start', gap:10}}>
                      <ProviderGlyph id={p.id} size={28}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div className="hstack" style={{gap:6}}>
                          <span style={{color:'var(--fg-0)', fontSize:13, fontWeight:600}}>{p.name}</span>
                          <span className="tag xsmall">{p.category}</span>
                          <span className="tag xsmall mono">{p.auth}</span>
                        </div>
                        <div className="muted xsmall" style={{marginTop:2}}>{p.desc}</div>
                      </div>
                      <I.ArrowRight size={14} style={{color:'var(--fg-3)', alignSelf:'center'}}/>
                    </div>
                  </div>
                ))}
              </div>
              {catalog.length===0 && (
                <div style={{padding:'40px 0', textAlign:'center'}}>
                  <div className="muted">No matches — try <button className="btn sm" onClick={()=>setMode('custom')}><I.Plus size={11}/> Custom</button></div>
                </div>
              )}
            </div>
          </>
        )}

        {mode==='custom' && (
          <div style={{padding:18, overflow:'auto'}}>
            <div className="muted xsmall" style={{marginBottom:12}}>
              Register any conferencing system that exposes a webhook or REST endpoint. ClaudeClaw will call it when agents need to join, listen, or post transcripts.
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div>
                <label className="stat-label">Platform name</label>
                <input className="input" placeholder="e.g. Internal SIP bridge" value={customForm.name} onChange={e=>setCustomForm({...customForm, name:e.target.value})} style={{width:'100%'}}/>
              </div>
              <div>
                <label className="stat-label">Auth method</label>
                <select className="select" value={customForm.auth} onChange={e=>setCustomForm({...customForm, auth:e.target.value})} style={{width:'100%'}}>
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="apikey">API key</option>
                  <option value="jwt">JWT / shared secret</option>
                  <option value="basic">Basic auth</option>
                  <option value="sip">SIP / H.323</option>
                  <option value="mtls">mTLS</option>
                </select>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label className="stat-label">Endpoint URL (or SIP URI)</label>
                <input className="input mono" placeholder="https://api.example.com/v1/meetings  or  sip:bridge@example.com" value={customForm.endpoint} onChange={e=>setCustomForm({...customForm, endpoint:e.target.value})} style={{width:'100%'}}/>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label className="stat-label">Webhook secret (optional)</label>
                <input className="input mono" type="password" placeholder="whsec_…" value={customForm.webhookSecret} onChange={e=>setCustomForm({...customForm, webhookSecret:e.target.value})} style={{width:'100%'}}/>
                <div className="muted xsmall" style={{marginTop:4}}>
                  <I.Lock size={10}/> Stored encrypted in Settings → Integrations vault.
                </div>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label className="stat-label">Notes</label>
                <textarea className="input" rows="2" placeholder="Any context for future maintainers…" value={customForm.notes} onChange={e=>setCustomForm({...customForm, notes:e.target.value})} style={{width:'100%', resize:'vertical'}}/>
              </div>
            </div>
            <div className="card" style={{marginTop:14, background:'var(--bg-2)'}}>
              <div className="card-body vstack" style={{gap:6}}>
                <div className="stat-label">Capabilities detected</div>
                <div className="filter-row">
                  <div className="filter-pill on"><I.Check size={11}/> Auto-join new meetings</div>
                  <div className="filter-pill on"><I.Check size={11}/> Calendar watcher</div>
                  <div className="filter-pill on"><I.Check size={11}/> Transcript capture</div>
                  <div className="filter-pill"><I.Plus size={11}/> Recording</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="hstack" style={{padding:'12px 18px', borderTop:'1px solid var(--line-1)'}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <span className="spacer"/>
          {mode==='custom' ? (
            <button className="btn primary" disabled={!customForm.name || !customForm.endpoint} onClick={()=>onAdd(
              { id: 'custom', name: customForm.name, auth: customForm.auth, category:'extensible' },
              { name: customForm.name, scopes:[customForm.auth], webhook: customForm.endpoint }
            )}>
              <I.Plus size={12}/> Register platform
            </button>
          ) : (
            <span className="muted xsmall">{catalog.length} platforms available</span>
          )}
        </div>
      </div>
    </>
  );
}
