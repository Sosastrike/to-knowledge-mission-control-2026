// Addendum 02 — Operational Intelligence modules
// Obsidian/Brain sync · Agent telemetry · Policy software health · Pac-Man oversight
// Dashboard preview cards + drill-down drawers, mounted inside the existing MC shell.

/* ============================================================
   DATA (would be served from /api/... in production)
   ============================================================ */
const OBSIDIAN_DATA = {
  status: 'synced',            // synced | syncing | paused | error
  mode: 'bidirectional',        // push | pull | bidirectional
  vault: 'to-knowledge/brain',
  lastSync: '2m ago',
  lastSyncAbs: '14:32:18',
  changes: { today: 142, pending: 3, failed: 1 },
  conflicts: 1,
  events: [
    { dir:'pull', scope:'notes/contracts/BluePeak.md',      changed:1, failed:0, status:'ok',   t:'14:32', dur:'0.4s' },
    { dir:'push', scope:'agents/atlas/playbook.md',         changed:3, failed:0, status:'ok',   t:'14:29', dur:'0.7s' },
    { dir:'pull', scope:'memory/q4/*.md',                    changed:14,failed:0, status:'ok',   t:'14:18', dur:'2.1s' },
    { dir:'push', scope:'skills/refund-flow/v2.4.1.md',     changed:1, failed:0, status:'ok',   t:'14:02', dur:'0.3s' },
    { dir:'pull', scope:'inbox/2025-04/*.md',                changed:8, failed:1, status:'warn', t:'13:48', dur:'1.8s' },
    { dir:'push', scope:'reports/daily-2025-04-19.md',       changed:1, failed:0, status:'ok',   t:'08:00', dur:'0.2s' },
    { dir:'pull', scope:'archive/2023/legal/*',              changed:0, failed:0, status:'ok',   t:'07:12', dur:'0.1s' },
  ],
  conflictList: [
    { path:'notes/ops/weekly-sync.md', local:'Amelia edited 14:31', remote:'Obsidian edited 14:31', size:'4.2kb' },
  ],
};

const TELEMETRY_DATA = {
  trackedHoursToday: 47.2,
  activeSessions: 12,
  topSkills: [
    { id:'refund-flow',   name:'Refund & cancellation flow', uses: 84, trend:+12 },
    { id:'memory-trim',   name:'Memory salience trim',       uses: 47, trend:-4  },
    { id:'brief-weekly',  name:'Weekly ops brief',           uses: 31, trend:+3  },
    { id:'route-handoff', name:'Handoff routing',            uses: 22, trend:+8  },
  ],
  topTools: [
    { name:'mcp.telegram.reply',     uses: 118, policy:'allow' },
    { name:'mcp.gmail.draft',        uses: 94,  policy:'allow' },
    { name:'mcp.calendar.find_slot', uses: 61,  policy:'allow' },
    { name:'mcp.stripe.refund',      uses: 12,  policy:'approval' },
    { name:'mcp.notion.search',      uses: 57,  policy:'allow' },
    { name:'shell.exec',             uses: 3,   policy:'denied' },
  ],
  topModels: [
    { name:'claude-sonnet-4.5', share:52, cost:'$2.14' },
    { name:'claude-haiku-4.5',  share:28, cost:'$0.38' },
    { name:'claude-opus-4.1',   share:14, cost:'$3.47' },
    { name:'other',             share:6,  cost:'$0.11' },
  ],
  sessions: [
    { agent:'Atlas',     project:'BluePeak renewal',      task:'Draft renewal terms',    timer:'32m',   total:'4h 12m', model:'sonnet-4.5', skills:['refund-flow','route-handoff'], state:'active' },
    { agent:'Orion',     project:'Support Tier-2 queue',  task:'@sofia_m · Telegram',    timer:'08m',   total:'2h 48m', model:'haiku-4.5',  skills:['refund-flow'],                 state:'active' },
    { agent:'Research',  project:'Q2 market scan',         task:'Competitor deep-dive',   timer:'—',     total:'7h 04m', model:'opus-4.1',   skills:['brief-weekly'],                state:'paused' },
    { agent:'Scheduler', project:'Team operations',        task:'Reschedule w/ Nest',     timer:'—',     total:'1h 22m', model:'sonnet-4.5', skills:['route-handoff'],               state:'idle' },
    { agent:'Lyra',      project:'Anomaly detection',      task:'Refund gateway probe',   timer:'14m',   total:'3h 51m', model:'sonnet-4.5', skills:['memory-trim'],                 state:'active' },
    { agent:'Archivist', project:'Memory ops',             task:'Fade low-salience <0.3', timer:'—',     total:'2h 02m', model:'haiku-4.5',  skills:['memory-trim'],                 state:'idle' },
  ],
};

const POLICY_DATA = {
  status: 'online',
  version: '3.1.7-policy',
  buildHash: '8f2c91d',
  heartbeat: '4s ago',
  latency: 42,
  uptime: '17d 04h',
  lastSuccess: '4s ago',
  lastFailure: '2d 11h ago',
  recent: [
    { t:'14:32:14', ev:'policy.check',  result:'allow',  subject:'atlas → mcp.gmail.draft',   dur:'38ms' },
    { t:'14:31:58', ev:'policy.check',  result:'allow',  subject:'orion → mcp.telegram.reply',dur:'41ms' },
    { t:'14:29:11', ev:'policy.check',  result:'review', subject:'atlas → mcp.stripe.refund', dur:'52ms' },
    { t:'14:22:09', ev:'policy.update', result:'ok',     subject:'law-3 threshold $500→$750', dur:'—'    },
    { t:'14:02:41', ev:'policy.check',  result:'deny',   subject:'research → shell.exec',     dur:'29ms' },
  ],
};

const PACMAN_DATA = {
  status: 'online',
  current: 'Reviewing nightly-db-2025-04-19.tar.zst',
  backupsToday: { ok: 11, warn: 1, err: 0 },
  lastBackup: { name:'nightly-db', at:'04:12', size:'4.8 GB', status:'ok', duration:'6m 14s' },
  pendingReports: 3,
  flagged: 1,
  queue: [
    { name:'nightly-db',         target:'postgres/prod',      size:'4.8 GB', at:'04:12', status:'ok',    duration:'6m 14s' },
    { name:'agent-memory-snap',  target:'vector/memories',    size:'920 MB', at:'05:00', status:'ok',    duration:'2m 02s' },
    { name:'obsidian-vault',     target:'obsidian/brain',     size:'38 MB',  at:'05:10', status:'ok',    duration:'0m 18s' },
    { name:'logs-rotate',        target:'s3://claw-logs',     size:'1.1 GB', at:'06:00', status:'warn',  duration:'4m 40s', note:'checksum drift — re-run recommended' },
    { name:'media-archive',      target:'s3://claw-media',    size:'12.4 GB',at:'07:00', status:'ok',    duration:'11m 02s' },
  ],
  reports: [
    { id:'RPT-0841', type:'daily-brief',   title:'Daily ops brief · Apr 19',                severity:'info',  state:'ready',     created:'08:00' },
    { id:'RPT-0842', type:'anomaly',       title:'Refund gateway: 3 retries > threshold',    severity:'warn',  state:'needs-fix', created:'12:18', correction:'Clarify the 1pm spike root cause' },
    { id:'RPT-0843', type:'compliance',    title:'Law-3 audit · $500+ refund approvals',     severity:'info',  state:'ready',     created:'13:04' },
    { id:'RPT-0844', type:'weekly-brief',  title:'Weekly ops brief draft (preview)',         severity:'info',  state:'draft',     created:'13:40' },
  ],
};

/* ============================================================
   DASHBOARD CARDS
   ============================================================ */

function ObsidianSyncCard({ onOpen }) {
  const d = OBSIDIAN_DATA;
  const statusKind = d.status === 'synced' ? 'live' : d.status === 'error' ? 'err' : 'warn';
  return (
    <div className="card col-4 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <I.Book/>
          Obsidian sync
          <span className="card-subtitle">the brain</span>
        </div>
        <span className="card-link">Open log <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{justifyContent:'space-between'}}>
          <div>
            <div className="stat-label">Status</div>
            <div className="hstack" style={{gap:6, marginTop:2}}>
              <StatusDot s={statusKind}/>
              <span style={{color:'var(--fg-0)', textTransform:'capitalize', fontSize:13}}>{d.status}</span>
              <span className="tag">{d.mode}</span>
            </div>
            <div className="muted xsmall mono" style={{marginTop:3}}>{d.vault}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="stat-label">Last sync</div>
            <div style={{fontSize:13, color:'var(--fg-0)'}}>{d.lastSync}</div>
            <div className="muted xsmall mono">{d.lastSyncAbs}</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Today</div>
            <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{d.changes.today}</div>
            <div className="muted xsmall">changes</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Pending</div>
            <div className="mono" style={{fontSize:16, color:'var(--warn)'}}>{d.changes.pending}</div>
            <div className="muted xsmall">queued</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Failed</div>
            <div className="mono" style={{fontSize:16, color: d.changes.failed? 'var(--err)':'var(--fg-2)'}}>{d.changes.failed}</div>
            <div className="muted xsmall">needs retry</div>
          </div>
        </div>
        {d.conflicts > 0 && (
          <div className="hstack" style={{padding:'7px 10px', background:'var(--warn-soft)', borderRadius:6, border:'1px solid oklch(0.82 0.15 78 / 0.35)'}}>
            <I.Alert size={13} style={{color:'var(--warn)'}}/>
            <span style={{color:'var(--warn)', fontSize:12, flex:1}}>{d.conflicts} conflict awaiting review</span>
            <button className="btn sm" onClick={(e)=>{e.stopPropagation(); onOpen && onOpen();}}>Resolve</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentTelemetryCard({ onOpen }) {
  const d = TELEMETRY_DATA;
  return (
    <div className="card col-4 hov" onClick={()=>onOpen && onOpen()}>
      <div className="card-head">
        <div className="card-title">
          <I.Clock/>
          Agent telemetry
          <span className="card-subtitle">time · tools · models</span>
        </div>
        <span className="card-link">Drill down <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{gap:10}}>
          <div style={{flex:1, padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Tracked today</div>
            <div className="mono" style={{fontSize:20, color:'var(--fg-0)'}}>{d.trackedHoursToday}<span style={{color:'var(--fg-2)', fontSize:12, marginLeft:2}}>h</span></div>
          </div>
          <div style={{flex:1, padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Active sessions</div>
            <div className="mono" style={{fontSize:20, color:'var(--accent)'}}>{d.activeSessions}</div>
          </div>
        </div>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Top skills</div>
          <div className="vstack" style={{gap:4}}>
            {d.topSkills.slice(0,3).map(s => (
              <div key={s.id} className="hstack row-hov" style={{fontSize:12, cursor:'pointer', padding:'3px 6px', margin:'0 -6px', borderRadius:4}}
                onClick={(e)=>{ e.stopPropagation(); onOpen && onOpen('skills', s.id); }}
                title={`Open ${s.name} in Agent telemetry · Skills tab`}>
                <span style={{color:'var(--fg-1)', flex:1, minWidth:0}} className="truncate">{s.name}</span>
                <span className="mono muted">{s.uses}</span>
                <span className={`mono xsmall ${s.trend>0?'':''}`} style={{color: s.trend>0?'var(--ok)':'var(--err)', width:32, textAlign:'right'}}>{s.trend>0?'+':''}{s.trend}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Model routing</div>
          <div className="cost-bar" style={{marginBottom:6}}>
            {d.topModels.map((m,i)=>(
              <span key={m.name} style={{width:`${m.share}%`, background: i===0?'oklch(0.78 0.13 var(--accent-hue))': i===1?'oklch(0.78 0.15 155)': i===2?'oklch(0.82 0.15 78)':'var(--line-3)'}}/>
            ))}
          </div>
          <div className="hstack" style={{flexWrap:'wrap', gap:8, fontSize:11}}>
            {d.topModels.slice(0,3).map((m,i)=>(
              <span key={m.name} className="hstack" style={{gap:5}}>
                <span style={{width:8, height:8, borderRadius:2, background: i===0?'oklch(0.78 0.13 var(--accent-hue))': i===1?'oklch(0.78 0.15 155)':'oklch(0.82 0.15 78)'}}/>
                <span className="muted mono">{m.name.replace('claude-','')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyHealthCard({ onOpen }) {
  const d = POLICY_DATA;
  const kind = d.status === 'online' ? 'live' : d.status === 'degraded' ? 'warn' : 'err';
  return (
    <div className="card col-4 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <I.Shield/>
          Policy software
          <span className="card-subtitle">law enforcement</span>
        </div>
        <span className="card-link">Health <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{justifyContent:'space-between'}}>
          <div>
            <div className="stat-label">State</div>
            <div className="hstack" style={{gap:6, marginTop:2}}>
              <StatusDot s={kind}/>
              <span style={{color:'var(--fg-0)', fontSize:14, fontWeight:500, textTransform:'capitalize'}}>{d.status}</span>
            </div>
            <div className="muted xsmall" style={{marginTop:2}}>Uptime {d.uptime}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="stat-label">Heartbeat</div>
            <div style={{fontSize:13, color:'var(--fg-0)'}}>{d.heartbeat}</div>
            <div className="muted xsmall mono">{d.latency}ms</div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Version</div>
            <div className="mono" style={{fontSize:13, color:'var(--fg-0)'}}>{d.version}</div>
            <div className="muted xsmall mono">{d.buildHash}</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Last failure</div>
            <div style={{fontSize:13, color:'var(--fg-2)'}}>{d.lastFailure}</div>
          </div>
        </div>
        <div className="hstack">
          <button className="btn sm" onClick={(e)=>{e.stopPropagation(); onOpen && onOpen();}}><I.Activity size={12}/> Run test</button>
          <span className="spacer"/>
          <span className="muted xsmall mono">last success {d.lastSuccess}</span>
        </div>
      </div>
    </div>
  );
}

function PacmanOpsCard({ onOpen }) {
  const d = PACMAN_DATA;
  const kind = d.status === 'online' ? 'live' : 'warn';
  return (
    <div className="card col-4 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <PacmanGlyph/>
          Pac-Man oversight
          <span className="card-subtitle">backups &amp; reports</span>
        </div>
        <span className="card-link">Operations <I.ArrowRight/></span>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="stat-label">Worker</div>
            <div className="hstack" style={{gap:6, marginTop:2}}>
              <StatusDot s={kind}/>
              <span style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>Pac-Man · {d.status}</span>
            </div>
            <div className="muted xsmall truncate" style={{maxWidth:220, marginTop:2}}>{d.current}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="stat-label">Today</div>
            <div className="hstack" style={{gap:6, justifyContent:'flex-end', marginTop:2}}>
              <span className="tag ok">{d.backupsToday.ok} ok</span>
              {d.backupsToday.warn>0 && <span className="tag warn">{d.backupsToday.warn} warn</span>}
              {d.backupsToday.err>0 && <span className="tag err">{d.backupsToday.err} err</span>}
            </div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Last backup</div>
            <div style={{fontSize:12, color:'var(--fg-0)'}} className="truncate">{d.lastBackup.name}</div>
            <div className="muted xsmall mono">{d.lastBackup.at} · {d.lastBackup.size}</div>
          </div>
          <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Report queue</div>
            <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{d.pendingReports}</div>
            <div className="muted xsmall">{d.flagged} flagged · correction needed</div>
          </div>
        </div>
        {d.flagged > 0 && (
          <div className="hstack" style={{padding:'7px 10px', background:'var(--warn-soft)', borderRadius:6, border:'1px solid oklch(0.82 0.15 78 / 0.35)'}}>
            <I.Alert size={13} style={{color:'var(--warn)'}}/>
            <span style={{color:'var(--warn)', fontSize:12, flex:1}}>RPT-0842 needs correction</span>
            <button className="btn sm" onClick={(e)=>{e.stopPropagation(); onOpen && onOpen('reports');}}>Review</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Small SVG Pac-Man glyph used in title/headers
function PacmanGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1 A9 9 0 1 1 10 19 A9 9 0 1 1 10 1 Z M10 10 L20 5 L20 0 A10 10 0 0 1 20 20 L20 15 Z"
            fill="oklch(0.82 0.18 90)" opacity="0.9"/>
      <circle cx="12" cy="6" r="1.1" fill="var(--bg-0)"/>
    </svg>
  );
}

/* ============================================================
   DRILL-DOWN DRAWERS
   ============================================================ */

function ObsidianSyncDrawer({ onClose }) {
  const d = OBSIDIAN_DATA;
  return (
    <WorkspaceOverlay title="Obsidian sync" subtitle={`${d.vault} · ${d.mode}`} onClose={onClose}>
      <div className="dash-grid">
        <div className="card col-4">
          <div className="card-body vstack">
            <div className="stat-label">Connection</div>
            <div className="hstack"><StatusDot s="live"/> <span style={{color:'var(--fg-0)'}}>Healthy</span></div>
            <div className="muted xsmall">Two-way sync · watcher active</div>
          </div>
        </div>
        <div className="card col-4">
          <div className="card-body vstack">
            <div className="stat-label">Changed today</div>
            <div className="mono" style={{fontSize:22, color:'var(--fg-0)'}}>{d.changes.today}</div>
            <div className="muted xsmall">{d.changes.pending} pending · {d.changes.failed} failed</div>
          </div>
        </div>
        <div className="card col-4">
          <div className="card-body vstack">
            <div className="stat-label">Last sync</div>
            <div style={{fontSize:16, color:'var(--fg-0)'}}>{d.lastSync}</div>
            <div className="muted xsmall mono">{d.lastSyncAbs}</div>
            <div className="hstack" style={{marginTop:6}}>
              <button className="btn sm" disabled title="Sync trigger is disabled until the backend queue is available."><I.Refresh size={12}/> Sync now</button>
              <button className="btn sm" disabled title="Pause sync is disabled until the backend queue is available."><I.Pause size={12}/> Pause</button>
            </div>
          </div>
        </div>

        {d.conflictList.length > 0 && (
          <div className="card col-12">
            <div className="card-head"><div className="card-title"><I.Alert style={{color:'var(--warn)'}}/> Conflicts</div></div>
            <div className="card-body">
              {d.conflictList.map((c,i) => (
                <div key={i} className="hstack" style={{padding:'10px 0', borderTop: i?'1px solid var(--line-1)':'none'}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="mono xsmall muted">{c.path}</div>
                    <div className="muted xsmall" style={{marginTop:2}}>Local: {c.local} · Remote: {c.remote} · {c.size}</div>
                  </div>
                  <button className="btn sm">Keep local</button>
                  <button className="btn sm">Keep remote</button>
                  <button className="btn primary sm">Merge</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card col-12">
          <div className="card-head"><div className="card-title">Sync log</div></div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:70}}>Time</th>
                <th style={{width:80}}>Dir</th>
                <th>Scope</th>
                <th style={{width:90}}>Changed</th>
                <th style={{width:70}}>Failed</th>
                <th style={{width:80}}>Status</th>
                <th style={{width:70}}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {d.events.map((e,i) => (
                <tr key={i}>
                  <td className="mono xsmall muted">{e.t}</td>
                  <td>
                    <span className="tag">
                      {e.dir === 'pull' ? <I.Download size={11}/> : <I.Upload size={11}/>}
                      {e.dir}
                    </span>
                  </td>
                  <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.scope}</td>
                  <td className="mono">{e.changed}</td>
                  <td className="mono" style={{color: e.failed? 'var(--err)':'var(--fg-3)'}}>{e.failed}</td>
                  <td><StatusDot s={e.status==='ok'?'ok':'warn'}/> <span style={{textTransform:'capitalize'}}>{e.status}</span></td>
                  <td className="mono xsmall muted">{e.dur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card col-12" style={{background:'var(--bg-1)'}}>
          <div className="card-body hstack" style={{gap:12}}>
            <I.Lock style={{color:'var(--fg-2)'}}/>
            <div style={{flex:1}}>
              <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>Credentials &amp; vault mapping</div>
              <div className="muted xsmall">Obsidian token and vault mappings are managed in Settings → Integrations.</div>
            </div>
            <button className="btn" onClick={()=>window.appGoTo?.('settings:integrations')}><I.External/> Open integrations</button>
          </div>
        </div>
      </div>
    </WorkspaceOverlay>
  );
}

function AgentTelemetryDrawer({ onClose, initialTab, initialSkillId }) {
  const d = TELEMETRY_DATA;
  const [tab, setTab] = React.useState(initialTab || 'sessions');
  const focusRef = React.useRef(null);
  React.useEffect(() => {
    if (initialSkillId && focusRef.current) {
      focusRef.current.scrollIntoView({ block:'center', behavior:'smooth' });
    }
  }, [initialSkillId, tab]);
  return (
    <WorkspaceOverlay title="Agent telemetry" subtitle="Time · skills · tools · models" onClose={onClose} wide>
      <div className="dash-grid" style={{marginBottom:14}}>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Hours today</div><div className="stat-big">{d.trackedHoursToday}<span className="unit">h</span></div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Active sessions</div><div className="stat-big">{d.activeSessions}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Top skill</div><div style={{fontSize:15, color:'var(--fg-0)'}}>{d.topSkills[0].name}</div><div className="muted xsmall mono">{d.topSkills[0].uses} uses</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Top model</div><div style={{fontSize:15, color:'var(--fg-0)'}}>{d.topModels[0].name.replace('claude-','')}</div><div className="muted xsmall mono">{d.topModels[0].share}% · {d.topModels[0].cost}</div></div></div>
      </div>

      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={tab} onChange={setTab} options={[
          {value:'sessions', label:'Active sessions', count:d.sessions.length},
          {value:'skills',   label:'Skills',          count:d.topSkills.length},
          {value:'tools',    label:'Tools',           count:d.topTools.length},
          {value:'models',   label:'Models',          count:d.topModels.length},
        ]}/>
      </div>

      {tab==='sessions' && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Agent</th><th>Project</th><th>Task</th><th style={{width:80}}>Timer</th><th style={{width:80}}>Total</th><th>Model</th><th>Skills</th><th style={{width:90}}>State</th><th style={{width:120}}>Admin</th></tr></thead>
            <tbody>
              {d.sessions.map((s,i)=>(
                <tr key={i}>
                  <td><span className="hstack"><Avatar name={s.agent} size={20}/> <span>{s.agent}</span></span></td>
                  <td className="muted">{s.project}</td>
                  <td style={{color:'var(--fg-1)'}}>{s.task}</td>
                  <td className="mono" style={{color: s.state==='active'?'var(--ok)':'var(--fg-2)'}}>{s.timer}</td>
                  <td className="mono muted">{s.total}</td>
                  <td><Tag>{s.model}</Tag></td>
                  <td>{s.skills.map(k => <Tag key={k}>{k}</Tag>)}</td>
                  <td>
                    <span className="status-pill">
                      <StatusDot s={s.state==='active'?'live':s.state==='paused'?'warn':'muted'}/>
                      <span style={{textTransform:'capitalize'}}>{s.state}</span>
                    </span>
                  </td>
                  <td><button className="btn sm" disabled title="Skill threshold editing is disabled until policy persistence is available."><I.Edit size={11}/> Adjust</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='skills' && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Skill</th><th style={{width:100}}>Uses (24h)</th><th style={{width:100}}>Trend</th><th style={{width:140}}>Status</th></tr></thead>
            <tbody>
              {d.topSkills.map(s => {
                const focused = initialSkillId === s.id;
                return (
                  <tr key={s.id} ref={focused ? focusRef : null} style={focused ? {background:'var(--accent-soft)', outline:'1px solid var(--accent-line)'} : undefined}>
                    <td style={{color:'var(--fg-0)'}}>{s.name}{focused && <span className="tag accent" style={{marginLeft:8}}>focused</span>}</td>
                    <td className="mono">{s.uses}</td>
                    <td className="mono" style={{color: s.trend>0?'var(--ok)':'var(--err)'}}>{s.trend>0?'+':''}{s.trend}</td>
                    <td><Tag>enabled</Tag></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab==='tools' && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Tool</th><th style={{width:100}}>Uses (24h)</th><th style={{width:160}}>Policy</th><th style={{width:200}}>Admin</th></tr></thead>
            <tbody>
              {d.topTools.map(t => (
                <tr key={t.name}>
                  <td className="mono" style={{color:'var(--fg-0)'}}>{t.name}</td>
                  <td className="mono">{t.uses}</td>
                  <td>
                    <select className="select" defaultValue={t.policy} style={{width:160}}>
                      <option value="allow">Allow</option>
                      <option value="approval">Requires approval</option>
                      <option value="denied">Denied</option>
                    </select>
                  </td>
                  <td><button className="btn sm" disabled title="Per-skill call logs require the skills diagnostics backend."><I.Eye size={11}/> View calls</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='models' && (
        <div className="card">
          <div className="card-body vstack">
            <div className="cost-bar" style={{height:12}}>
              {d.topModels.map((m,i)=>(
                <span key={m.name} style={{width:`${m.share}%`, background: i===0?'oklch(0.78 0.13 var(--accent-hue))': i===1?'oklch(0.78 0.15 155)': i===2?'oklch(0.82 0.15 78)':'var(--line-3)'}}/>
              ))}
            </div>
            <table className="tbl">
              <thead><tr><th>Model</th><th style={{width:100}}>Share</th><th style={{width:120}}>Cost (24h)</th><th style={{width:180}}>Routing</th></tr></thead>
              <tbody>
                {d.topModels.map(m => (
                  <tr key={m.name}>
                    <td className="mono" style={{color:'var(--fg-0)'}}>{m.name}</td>
                    <td className="mono">{m.share}%</td>
                    <td className="mono">{m.cost}</td>
                    <td>
                      <select className="select" defaultValue="primary" style={{width:170}}>
                        <option value="primary">Primary</option>
                        <option value="fallback">Fallback</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </WorkspaceOverlay>
  );
}

function PolicyHealthDrawer({ onClose }) {
  const d = POLICY_DATA;
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);
  const runTest = () => {
    setTesting(true); setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult({ ok:true, latency: 38 + Math.round(Math.random()*20), at: new Date().toLocaleTimeString() });
    }, 1400);
  };
  return (
    <WorkspaceOverlay title="Policy software health" subtitle={`${d.version} · build ${d.buildHash}`} onClose={onClose}>
      <div className="dash-grid">
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">State</div><div className="hstack"><StatusDot s="live"/><span style={{color:'var(--fg-0)', textTransform:'capitalize'}}>{d.status}</span></div><div className="muted xsmall">Uptime {d.uptime}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Heartbeat</div><div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.heartbeat}</div><div className="muted xsmall mono">{d.latency}ms</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Last success</div><div style={{fontSize:13, color:'var(--fg-0)'}}>{d.lastSuccess}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Last failure</div><div style={{fontSize:13, color:'var(--fg-2)'}}>{d.lastFailure}</div></div></div>

        <div className="card col-12">
          <div className="card-head"><div className="card-title">Run health test</div></div>
          <div className="card-body hstack" style={{gap:12}}>
            <button className={`btn ${testing?'':'primary'}`} disabled={testing} onClick={runTest}>
              {testing ? <><I.Spinner/> Testing…</> : <><I.Activity size={12}/> Run test now</>}
            </button>
            {testResult && (
              <div className="hstack" style={{gap:8, color:'var(--ok)'}}>
                <I.Check size={13}/>
                <span>OK · {testResult.latency}ms at {testResult.at}</span>
              </div>
            )}
            <span className="spacer"/>
            <span className="muted xsmall">Test sends a dry-run check via <span className="mono">policy.check</span> and waits for ack.</span>
          </div>
        </div>

        <div className="card col-12">
          <div className="card-head"><div className="card-title">Recent policy events</div></div>
          <table className="tbl">
            <thead><tr><th style={{width:100}}>Time</th><th style={{width:140}}>Event</th><th>Subject</th><th style={{width:100}}>Result</th><th style={{width:80}}>Duration</th></tr></thead>
            <tbody>
              {d.recent.map((e,i) => (
                <tr key={i}>
                  <td className="mono xsmall muted">{e.t}</td>
                  <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.ev}</td>
                  <td className="mono xsmall" style={{color:'var(--fg-0)'}}>{e.subject}</td>
                  <td>
                    <span className={`tag ${e.result==='allow'?'ok':e.result==='deny'?'err':'warn'}`}>
                      {e.result}
                    </span>
                  </td>
                  <td className="mono xsmall muted">{e.dur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceOverlay>
  );
}

function PacmanOpsDrawer({ onClose, initialTab }) {
  const d = PACMAN_DATA;
  const [tab, setTab] = React.useState(initialTab || 'backups');
  return (
    <WorkspaceOverlay title="Pac-Man oversight" subtitle="Backups &amp; reports" onClose={onClose} wide>
      <div className="dash-grid" style={{marginBottom:14}}>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Worker</div><div className="hstack"><PacmanGlyph size={16}/><StatusDot s="live"/><span style={{color:'var(--fg-0)', textTransform:'capitalize'}}>{d.status}</span></div><div className="muted xsmall truncate" style={{marginTop:2}}>{d.current}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Backups today</div><div className="hstack" style={{gap:6}}><span className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.backupsToday.ok}</span><span className="tag ok">ok</span>{d.backupsToday.warn>0 && <span className="tag warn">{d.backupsToday.warn} warn</span>}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Last backup</div><div style={{fontSize:14, color:'var(--fg-0)'}} className="truncate">{d.lastBackup.name}</div><div className="muted xsmall mono">{d.lastBackup.at} · {d.lastBackup.size} · {d.lastBackup.duration}</div></div></div>
        <div className="card col-3"><div className="card-body vstack"><div className="stat-label">Reports</div><div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.pendingReports} <span className="muted" style={{fontSize:12}}>pending</span></div>{d.flagged>0 && <div style={{color:'var(--warn)', fontSize:12}}>{d.flagged} flagged</div>}</div></div>
      </div>

      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={tab} onChange={setTab} options={[
          {value:'backups', label:'Backup queue',   count: d.queue.length},
          {value:'reports', label:'Report queue',   count: d.reports.length},
        ]}/>
        <span className="spacer"/>
        <button className="btn" disabled title="Re-scan is disabled until the memory backend is available."><I.Refresh size={12}/> Re-scan</button>
        <button className="btn" disabled title="Manual backup is disabled until the memory backup backend is available."><I.Plus size={12}/> Trigger backup</button>
      </div>

      {tab==='backups' && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Backup</th><th>Target</th><th style={{width:100}}>Size</th><th style={{width:80}}>At</th><th style={{width:100}}>Duration</th><th style={{width:100}}>Status</th><th style={{width:100}}>Actions</th></tr></thead>
            <tbody>
              {d.queue.map((q,i)=>(
                <tr key={i}>
                  <td style={{color:'var(--fg-0)'}}>{q.name}</td>
                  <td className="mono muted xsmall">{q.target}</td>
                  <td className="mono">{q.size}</td>
                  <td className="mono xsmall muted">{q.at}</td>
                  <td className="mono xsmall muted">{q.duration}</td>
                  <td>
                    <span className="status-pill">
                      <StatusDot s={q.status==='ok'?'ok':q.status==='warn'?'warn':'err'}/>
                      <span style={{textTransform:'capitalize'}}>{q.status}</span>
                    </span>
                    {q.note && <div className="muted xsmall" style={{marginTop:2}}>{q.note}</div>}
                  </td>
                  <td>
                    <button className="btn sm" disabled title="Archive download is disabled until backup storage is available."><I.Download size={11}/></button>
                    {q.status !== 'ok' && <button className="btn sm" disabled title="Retry is disabled until backup dispatch is available."><I.Refresh size={11}/> Retry</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='reports' && (
        <div className="card">
          <table className="tbl">
            <thead><tr><th style={{width:90}}>ID</th><th>Title</th><th style={{width:120}}>Type</th><th style={{width:100}}>Severity</th><th style={{width:120}}>State</th><th style={{width:80}}>Created</th><th style={{width:160}}>Action</th></tr></thead>
            <tbody>
              {d.reports.map(r => (
                <tr key={r.id}>
                  <td className="mono xsmall muted">{r.id}</td>
                  <td style={{color:'var(--fg-0)'}}>
                    {r.title}
                    {r.correction && <div className="muted xsmall" style={{marginTop:2}}>→ {r.correction}</div>}
                  </td>
                  <td><Tag>{r.type}</Tag></td>
                  <td><span className={`tag ${r.severity==='warn'?'warn':r.severity==='err'?'err':''}`}>{r.severity}</span></td>
                  <td>
                    <span className="status-pill">
                      <StatusDot s={r.state==='ready'?'ok':r.state==='needs-fix'?'warn':'muted'}/>
                      <span>{r.state}</span>
                    </span>
                  </td>
                  <td className="mono xsmall muted">{r.created}</td>
                  <td>
                    {r.state==='needs-fix'
                      ? <button className="btn primary sm" disabled title="Citation fixes require report editing support before they can run."><I.Edit size={11}/> Correct</button>
                      : r.state==='draft'
                        ? <button className="btn sm" disabled title="Draft preview requires report rendering support before it can run."><I.Eye size={11}/> Preview</button>
                        : <button className="btn sm" disabled title="PDF download requires report delivery support before it can run."><I.Download size={11}/> Download</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkspaceOverlay>
  );
}

Object.assign(window, {
  OBSIDIAN_DATA, TELEMETRY_DATA, POLICY_DATA, PACMAN_DATA,
  ObsidianSyncCard, AgentTelemetryCard, PolicyHealthCard, PacmanOpsCard, PacmanGlyph,
  ObsidianSyncDrawer, AgentTelemetryDrawer, PolicyHealthDrawer, PacmanOpsDrawer,
});
