// Addendum 03 — Graphify + Brain Sync Visualization
// Dashboard widget + in-app drill-down (same Mission Control, not a separate app).
// Connects: Graphify (graph.html / graph.json / GRAPH_REPORT.md), Obsidian sync,
// MemPalace sync, agent memory telemetry, Pac-Man backup oversight.

/* ============================================================
   DATA — shape mirrors /api/knowledge-graph/* and
   /api/memory-sync/status responses.
   ============================================================ */
const GRAPHIFY_DATA = {
  health: 'healthy',              // healthy | degraded | error
  lastRun: { at:'3m ago',   abs:'14:29:04', result:'ok',    duration:'42s', addedNodes:18, addedEdges:34, touched:'sales/*' },
  snapshot: { version: 'v2025.04.19-1428', nodes: 14_832, edges: 48_217, subgraphs: 6, sizeMB: 38 },
  growth24h: [6,8,7,11,9,12,14,13,17,15,14,16,18,22,19,18,21,24,22,20,19,17,18,23],
  agents: [
    { id:'atlas',     name:'Atlas',    state:'writing',  op:'Writing sales subgraph',          nodes:12, t:'now' },
    { id:'orion',     name:'Orion',    state:'reading',  op:'Querying refund-flow neighbourhood', nodes: 0, t:'1m' },
    { id:'archivist', name:'Archivist',state:'pruning',  op:'Trimming low-salience memories',  nodes:-4, t:'4m' },
    { id:'lyra',      name:'Lyra',     state:'reading',  op:'Anomaly correlation trace',       nodes: 0, t:'6m' },
  ],
  summary: 'Pac-Man rebuilt the sales knowledge graph from Obsidian + MemPalace 3 minutes ago. 18 new nodes, 34 new edges. No sync errors.',
  runs: [
    { id:'RUN-01412', trigger:'pacman',  scope:'sales',       state:'ok',   at:'14:29', dur:'42s',  added:'+18n +34e', removed:'−0',   summary:'Rebuilt sales subgraph from 4 Obsidian vaults + MemPalace.' },
    { id:'RUN-01411', trigger:'manual',  scope:'all',         state:'ok',   at:'13:42', dur:'4m 02s', added:'+214n +488e', removed:'−12', summary:'Full rebuild after skill-registry update (v2.4.1).' },
    { id:'RUN-01410', trigger:'agent',   scope:'refund-flow', state:'ok',   at:'13:18', dur:'11s',  added:'+3n +9e',  removed:'−0',   summary:'Atlas added BluePeak refund clause references.' },
    { id:'RUN-01409', trigger:'schedule',scope:'archive',     state:'warn', at:'12:00', dur:'1m 48s', added:'+0n +0e',  removed:'−0',   summary:'Archive subgraph skipped — Obsidian sync was delayed.' },
    { id:'RUN-01408', trigger:'agent',   scope:'memory',      state:'ok',   at:'11:38', dur:'29s',  added:'+7n +14e', removed:'−2',   summary:'Archivist pruned stale memories (< 0.3 salience).' },
    { id:'RUN-01407', trigger:'pacman',  scope:'nightly',     state:'ok',   at:'04:12', dur:'6m 14s', added:'+1.2k n +3.8k e', removed:'−48', summary:'Nightly full rebuild from snapshot.' },
  ],
};

const BRAIN_SYNC = {
  obsidian:  { status:'synced',  last:'2m',  lag:'—',        size:'38 MB',   note:'Bidirectional, 3 vaults' },
  mempalace: { status:'synced',  last:'1m',  lag:'—',        size:'1.4 GB',  note:'Vector store · 14.3k items' },
  graphify:  { status:'healthy', last:'3m',  lag:'—',        size:'120 MB',  note:'v2025.04.19-1428 · serving' },
  pacman:    { status:'online',  last:'10h', lag:'—',        size:'—',       note:'Nightly 04:12 OK · 1 warn today' },
};

const AGENT_MEMORY_USAGE = [
  { agent:'Atlas',     project:'BluePeak renewal',     task:'Draft renewal terms',       time:'4h 12m', skill:'refund-flow',   model:'sonnet-4.5', tool:'MemPalace.search', reads:28, writes:12 },
  { agent:'Agent Zero',      project:'Project X',            task:'Stakeholder summary',       time:'14m',    skill:'summarization', model:'haiku-4.5',  tool:'MemPalace.query',  reads:9,  writes:2 },
  { agent:'Orion',     project:'Support tier-2',       task:'@sofia_m · Telegram',       time:'2h 48m', skill:'refund-flow',   model:'haiku-4.5',  tool:'Graphify.query',   reads:14, writes:0 },
  { agent:'Research',  project:'Q2 market scan',       task:'Competitor deep-dive',      time:'7h 04m', skill:'brief-weekly',  model:'opus-4.1',   tool:'Obsidian.read',    reads:52, writes:0 },
  { agent:'Lyra',      project:'Anomaly detection',    task:'Refund gateway probe',      time:'3h 51m', skill:'memory-trim',   model:'sonnet-4.5', tool:'Graphify.query',   reads:47, writes:3 },
  { agent:'Archivist', project:'Memory ops',           task:'Fade low-salience',         time:'2h 02m', skill:'memory-trim',   model:'haiku-4.5',  tool:'MemPalace.write',  reads:0,  writes:84 },
];

const GRAPH_EVENTS = [
  { t:'14:32:18', kind:'read',    agent:'Atlas',     op:'MemPalace.search("renewal clause")',     result:'ok',   note:'3 hits, top @0.91' },
  { t:'14:31:40', kind:'write',   agent:'Atlas',     op:'Graphify.upsert(node:BluePeak.renewal)', result:'ok',   note:'+1 node, +4 edges' },
  { t:'14:29:04', kind:'rebuild', agent:'Pac-Man',   op:'Graphify.rebuild(scope:sales)',          result:'ok',   note:'+18 nodes, +34 edges' },
  { t:'14:22:09', kind:'query',   agent:'Orion',     op:'Graphify.traverse(from:refund-flow, d:2)', result:'ok', note:'returned 12 paths' },
  { t:'14:18:51', kind:'read',    agent:'Research',  op:'Obsidian.read(archive/2023/legal/*)',    result:'ok',   note:'47 files · 2.1s' },
  { t:'14:02:41', kind:'prune',   agent:'Archivist', op:'MemPalace.prune(salience<0.3)',          result:'ok',   note:'−4 items' },
  { t:'13:48:17', kind:'write',   agent:'Lyra',      op:'Graphify.upsert(anomaly:refund-spike)',  result:'warn', note:'partial merge, review' },
  { t:'13:42:02', kind:'rebuild', agent:'Pac-Man',   op:'Graphify.rebuild(scope:all)',            result:'ok',   note:'full rebuild 4m 02s' },
];


/* ============================================================
   GLYPHS & helpers
   ============================================================ */
function GraphGlyph({ size=14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="3"  cy="8"  r="1.8" fill="currentColor" opacity="0.9"/>
      <circle cx="13" cy="4"  r="1.8" fill="currentColor" opacity="0.9"/>
      <circle cx="13" cy="12" r="1.8" fill="currentColor" opacity="0.9"/>
      <circle cx="8"  cy="8"  r="2.4" fill="currentColor"/>
      <path d="M3 8L8 8M8 8L13 4M8 8L13 12" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

function BrainPill({ icon, label, s, last, note, onClick }) {
  // s: healthy | synced | degraded | delayed | error | online
  const kind =
    s==='healthy' || s==='synced' || s==='online' ? 'ok' :
    s==='degraded' || s==='delayed' ? 'warn' : 'err';
  return (
    <div className="hstack" onClick={onClick} style={{
      flex:1, minWidth:0, padding:'8px 10px',
      background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:8,
      gap:8, cursor: onClick ? 'pointer' : 'default',
    }}>
      {icon}
      <div style={{flex:1, minWidth:0}}>
        <div className="hstack" style={{gap:6}}>
          <span style={{fontSize:12, color:'var(--fg-0)', fontWeight:500}}>{label}</span>
          <StatusDot s={kind}/>
        </div>
        <div className="muted xsmall truncate">{note}</div>
      </div>
      <div style={{textAlign:'right', flexShrink:0}}>
        <div className="stat-label">last</div>
        <div className="mono xsmall" style={{color:'var(--fg-1)'}}>{last}</div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD WIDGET — compact preview
   ============================================================ */
function GraphifyCard({ onOpen }) {
  const d = GRAPHIFY_DATA;
  const b = BRAIN_SYNC;
  const kind = d.health==='healthy' ? 'live' : d.health==='degraded' ? 'warn' : 'err';
  const active = d.agents.find(a => a.state==='writing') || d.agents[0];

  return (
    <div className="card col-8 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <GraphGlyph/>
          Knowledge graph · Brain sync
          <span className="card-subtitle">graphify · obsidian · mempalace</span>
        </div>
        <div className="hstack">
          <span className={`tag ${kind==='live'?'ok':kind==='warn'?'warn':'err'}`}>{d.health.toUpperCase()}</span>
          <span className="card-link">Open graph <I.ArrowRight/></span>
        </div>
      </div>
      <div className="card-body vstack">
        {/* Plain-language summary */}
        <div className="hstack" style={{padding:'9px 11px', background:'var(--accent-soft)', borderRadius:8, border:'1px solid var(--accent-line)', gap:10}}>
          <I.Sparkle size={14} style={{color:'var(--accent)', flexShrink:0}}/>
          <span style={{fontSize:12, color:'var(--fg-0)', lineHeight:1.45}}>{d.summary}</span>
        </div>

        {/* KPI row + sparkline */}
        <div className="hstack" style={{gap:10, alignItems:'stretch'}}>
          <div style={{flex:1, padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Nodes</div>
            <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.snapshot.nodes.toLocaleString()}</div>
            <div className="muted xsmall">+{d.lastRun.addedNodes} in last run</div>
          </div>
          <div style={{flex:1, padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Edges</div>
            <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.snapshot.edges.toLocaleString()}</div>
            <div className="muted xsmall">+{d.lastRun.addedEdges} in last run</div>
          </div>
          <div style={{flex:1, padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
            <div className="stat-label">Last rebuild</div>
            <div style={{fontSize:13, color:'var(--fg-0)'}}>{d.lastRun.at}</div>
            <div className="muted xsmall mono">{d.lastRun.duration} · {d.lastRun.touched}</div>
          </div>
          <div style={{flex:1.2, padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <div className="stat-label">Growth · 24h</div>
            <Sparkline data={d.growth24h} w={160} h={28}/>
          </div>
        </div>

        {/* Brain sync strip */}
        <div className="hstack" style={{gap:8}}>
          <BrainPill icon={<I.Book size={14} style={{color:'var(--accent)'}}/>}    label="Obsidian"  s={b.obsidian.status}  last={b.obsidian.last}  note={b.obsidian.note}/>
          <BrainPill icon={<I.Database size={14} style={{color:'var(--accent)'}}/>}label="MemPalace" s={b.mempalace.status} last={b.mempalace.last} note={b.mempalace.note}/>
          <BrainPill icon={<GraphGlyph size={14}/>}                                label="Graphify"  s={b.graphify.status}  last={b.graphify.last}  note={b.graphify.note}/>
        </div>

        {/* Active agent using the brain */}
        <div className="hstack" style={{padding:'7px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)'}}>
          <Avatar name={active.name} size={20}/>
          <span style={{fontSize:12, color:'var(--fg-0)', fontWeight:500}}>{active.name}</span>
          <span style={{fontSize:12, color:'var(--fg-2)'}}>· {active.op}</span>
          <span className="spacer"/>
          <span className="tag">{active.state}</span>
          <span className="mono xsmall muted">{active.t}</span>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   DRILL-DOWN WORKSPACE — expanded view inside MC shell
   ============================================================ */
function GraphifyDrawer({ onClose, initialTab }) {
  const d = GRAPHIFY_DATA;
  const b = BRAIN_SYNC;
  const [tab, setTab] = React.useState(initialTab || 'graph');
  const [filters, setFilters] = React.useState({ agent:'all', scope:'all', status:'all', window:'24h' });

  return (
    <WorkspaceOverlay
      title="Knowledge graph · Brain sync"
      subtitle="Graphify + Obsidian + MemPalace + Pac-Man · unified view"
      onClose={onClose}
      wide
    >
      {/* Header KPI row */}
      <div className="dash-grid" style={{marginBottom:14}}>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Graph health</div>
          <div className="hstack" style={{gap:6}}>
            <GraphGlyph size={16}/>
            <StatusDot s={d.health==='healthy'?'live':'warn'}/>
            <span style={{color:'var(--fg-0)', fontSize:14, fontWeight:500, textTransform:'capitalize'}}>{d.health}</span>
          </div>
          <div className="muted xsmall mono" style={{marginTop:2}}>{d.snapshot.version}</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Nodes · Edges</div>
          <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>{d.snapshot.nodes.toLocaleString()} <span style={{color:'var(--fg-2)'}}>·</span> {d.snapshot.edges.toLocaleString()}</div>
          <div className="muted xsmall">{d.snapshot.subgraphs} subgraphs · {d.snapshot.sizeMB} MB</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Last rebuild</div>
          <div style={{fontSize:14, color:'var(--fg-0)'}}>{d.lastRun.at}</div>
          <div className="muted xsmall mono">{d.lastRun.abs} · {d.lastRun.duration} · +{d.lastRun.addedNodes}n +{d.lastRun.addedEdges}e</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Active agents on brain</div>
          <div className="mono" style={{fontSize:18, color:'var(--accent)'}}>{d.agents.length}</div>
          <div className="muted xsmall">{d.agents.filter(a=>a.state==='writing').length} writing · {d.agents.filter(a=>a.state==='reading').length} reading</div>
        </div></div>
      </div>

      {/* Brain sync bar (persistent header strip) */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head">
          <div className="card-title"><I.Activity/> Brain sync bar</div>
          <div className="hstack">
            <button className="btn sm" disabled title="Bulk source refresh — needs POST /api/brain/resync"><I.Refresh size={11}/> Refresh all</button>
            <button className="btn primary sm" disabled title="Full graph rebuild — expensive, needs backend job queue"><GraphGlyph size={11}/> Rebuild graph</button>
          </div>
        </div>
        <div className="card-body">
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
            <BrainPill icon={<I.Book size={14} style={{color:'var(--accent)'}}/>}    label="Obsidian"  s={b.obsidian.status}  last={b.obsidian.last}  note={b.obsidian.note}/>
            <BrainPill icon={<I.Database size={14} style={{color:'var(--accent)'}}/>}label="MemPalace" s={b.mempalace.status} last={b.mempalace.last} note={b.mempalace.note}/>
            <BrainPill icon={<GraphGlyph size={14}/>}                                label="Graphify"  s={b.graphify.status}  last={b.graphify.last}  note={b.graphify.note}/>
            <BrainPill icon={<PacmanGlyph size={14}/>}                               label="Pac-Man backups" s={b.pacman.status} last={b.pacman.last} note={b.pacman.note}/>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={tab} onChange={setTab} options={[
          {value:'graph',   label:'Graph activity',   count: d.runs.length},
          {value:'events',  label:'Events',           count: GRAPH_EVENTS.length},
          {value:'usage',   label:'Agent memory usage', count: AGENT_MEMORY_USAGE.length},
          {value:'report',  label:'GRAPH_REPORT.md'},
        ]}/>
        <span className="spacer"/>
        <div className="filter-row">
          {['24h','7d','30d'].map(w => (
            <div key={w} className={`filter-pill ${filters.window===w?'on':''}`} onClick={()=>setFilters({...filters, window:w})}>{w}</div>
          ))}
        </div>
      </div>

      {/* GRAPH tab — visual + runs */}
      {tab==='graph' && (
        <div className="dash-grid">
          <div className="card col-5">
            <div className="card-head">
              <div className="card-title">Graph snapshot</div>
              <span className="card-link">Open graph.html <I.External/></span>
            </div>
            <div className="card-body">
              <GraphCanvas/>
              <div className="muted xsmall" style={{marginTop:8}}>
                Preview · rendered from <span className="mono">graph.json</span> · nodes colored by subgraph.
              </div>
            </div>
          </div>

          <div className="card col-7">
            <div className="card-head">
              <div className="card-title">Recent rebuilds</div>
              <span className="muted xsmall">Pac-Man-triggered, manual, agent-triggered, scheduled</span>
            </div>
            <table className="tbl">
              <thead><tr>
                <th style={{width:100}}>ID</th>
                <th style={{width:100}}>Trigger</th>
                <th style={{width:110}}>Scope</th>
                <th style={{width:70}}>At</th>
                <th style={{width:90}}>Duration</th>
                <th style={{width:140}}>Delta</th>
                <th>Summary</th>
                <th style={{width:90}}>State</th>
              </tr></thead>
              <tbody>
                {d.runs.map(r => (
                  <tr key={r.id}>
                    <td className="mono xsmall muted">{r.id}</td>
                    <td><Tag>{r.trigger}</Tag></td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{r.scope}</td>
                    <td className="mono xsmall muted">{r.at}</td>
                    <td className="mono xsmall muted">{r.dur}</td>
                    <td className="mono xsmall" style={{color: r.state==='ok'?'var(--ok)':'var(--warn)'}}>{r.added} <span className="muted">{r.removed}</span></td>
                    <td className="ellip" style={{color:'var(--fg-0)', fontSize:12}}>{r.summary}</td>
                    <td>
                      <span className="status-pill">
                        <StatusDot s={r.state==='ok'?'ok':r.state==='warn'?'warn':'err'}/>
                        <span style={{textTransform:'capitalize'}}>{r.state}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card col-12">
            <div className="card-head"><div className="card-title">Agents currently using the brain</div></div>
            <div className="card-body">
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
                {d.agents.map(a => (
                  <div key={a.id} className="hstack" style={{padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <Avatar name={a.name} size={28}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="hstack" style={{gap:6}}>
                        <span style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{a.name}</span>
                        <span className="tag xsmall">{a.state}</span>
                      </div>
                      <div className="muted xsmall truncate">{a.op}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="mono xsmall" style={{color: a.nodes>0?'var(--ok)':a.nodes<0?'var(--warn)':'var(--fg-2)'}}>{a.nodes>0?'+':''}{a.nodes}n</div>
                      <div className="muted xsmall">{a.t}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS tab */}
      {tab==='events' && (
        <>
          <div className="hstack" style={{marginBottom:10, gap:8}}>
            <select className="select" value={filters.agent} onChange={e=>setFilters({...filters, agent:e.target.value})} style={{width:160}}>
              <option value="all">All agents</option>
              <option value="atlas">Atlas</option>
              <option value="orion">Orion</option>
              <option value="lyra">Lyra</option>
              <option value="archivist">Archivist</option>
              <option value="pacman">Pac-Man</option>
            </select>
            <select className="select" value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})} style={{width:140}}>
              <option value="all">All results</option>
              <option value="ok">OK</option>
              <option value="warn">Warn</option>
              <option value="err">Error</option>
            </select>
            <span className="spacer"/>
            <button className="btn" disabled title="Bulk event export — backend endpoint not wired"><I.Download size={12}/> Export events</button>
          </div>
          <div className="card">
            <table className="tbl">
              <thead><tr>
                <th style={{width:100}}>Time</th>
                <th style={{width:100}}>Kind</th>
                <th style={{width:140}}>Agent</th>
                <th>Operation</th>
                <th style={{width:90}}>Result</th>
                <th style={{width:200}}>Note</th>
              </tr></thead>
              <tbody>
                {GRAPH_EVENTS.map((e,i) => (
                  <tr key={i}>
                    <td className="mono xsmall muted">{e.t}</td>
                    <td>
                      <span className="tag xsmall">
                        {e.kind==='read' && <I.Eye size={10}/>}
                        {e.kind==='write' && <I.Edit size={10}/>}
                        {e.kind==='rebuild' && <I.Refresh size={10}/>}
                        {e.kind==='prune' && <I.Trash size={10}/>}
                        {e.kind==='query' && <I.Search size={10}/>}
                        {e.kind}
                      </span>
                    </td>
                    <td><span className="hstack"><Avatar name={e.agent} size={18}/><span style={{color:'var(--fg-0)'}}>{e.agent}</span></span></td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.op}</td>
                    <td>
                      <span className={`tag ${e.result==='ok'?'ok':e.result==='warn'?'warn':'err'}`}>{e.result}</span>
                    </td>
                    <td className="muted xsmall">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* AGENT MEMORY USAGE tab */}
      {tab==='usage' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Agent memory usage</div>
            <span className="muted xsmall">Who · used what · for what · for how long</span>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:140}}>Agent</th>
              <th>Project / Task</th>
              <th style={{width:100}}>Time</th>
              <th style={{width:140}}>Skill</th>
              <th style={{width:120}}>Model</th>
              <th style={{width:160}}>Tool</th>
              <th style={{width:80}}>Reads</th>
              <th style={{width:80}}>Writes</th>
            </tr></thead>
            <tbody>
              {AGENT_MEMORY_USAGE.map((u,i)=>(
                <tr key={i}>
                  <td><span className="hstack"><Avatar name={u.agent} size={20}/><span style={{color:'var(--fg-0)'}}>{u.agent}</span></span></td>
                  <td>
                    <div style={{color:'var(--fg-0)', fontSize:12}}>{u.project}</div>
                    <div className="muted xsmall">{u.task}</div>
                  </td>
                  <td className="mono">{u.time}</td>
                  <td><Tag>{u.skill}</Tag></td>
                  <td className="mono xsmall muted">{u.model}</td>
                  <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{u.tool}</td>
                  <td className="mono">{u.reads}</td>
                  <td className="mono" style={{color: u.writes>0?'var(--accent)':'var(--fg-2)'}}>{u.writes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GRAPH_REPORT.md tab */}
      {tab==='report' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">GRAPH_REPORT.md <span className="card-subtitle">generated {d.lastRun.at}</span></div>
            <div className="hstack">
              <button
                className="btn sm"
                onClick={()=>{
                  const md = `# GRAPH_REPORT.md\n_generated ${d.lastRun.at}_\n\n(Full report generation requires backend — copied placeholder.)`;
                  navigator.clipboard?.writeText(md);
                  window.Notifications?.emit?.({ kind:'ok', source:'brain', title:'Copied (placeholder)', detail:'Full report needs backend generator.' });
                }}
              ><I.Copy size={11}/> Copy</button>
              <button className="btn sm" disabled title="Report download — needs backend generator"><I.Download size={11}/> Download</button>
              <button className="btn sm" disabled title="Obsidian deep-link — not wired"><I.External size={11}/> Open in Obsidian</button>
            </div>
          </div>
          <div className="card-body">
            <pre style={{
              margin:0, padding:'14px 16px', background:'var(--bg-2)',
              border:'1px solid var(--line-1)', borderRadius:8,
              fontFamily:'var(--mono)', fontSize:12, lineHeight:1.65, color:'var(--fg-1)',
              whiteSpace:'pre-wrap', overflow:'auto', maxHeight:420,
            }}>{`# GRAPH_REPORT · ${d.snapshot.version}
Generated: ${d.lastRun.abs}  (${d.lastRun.at})
Trigger:   pac-man/nightly → scope: sales
Duration:  ${d.lastRun.duration}

## Summary (plain language)
${d.summary}

## Snapshot
- Nodes:      ${d.snapshot.nodes.toLocaleString()}
- Edges:      ${d.snapshot.edges.toLocaleString()}
- Subgraphs:  ${d.snapshot.subgraphs}  (sales, support, policy, memory, contracts, archive)
- Size:       ${d.snapshot.sizeMB} MB

## Delta vs previous run
+ ${d.lastRun.addedNodes} nodes
+ ${d.lastRun.addedEdges} edges
- 0 removed

## Top contributors (last 24h)
1. Atlas        — 12 writes  (BluePeak renewal, sales)
2. Archivist    — 84 writes  (memory pruning)
3. Pac-Man      — 2 rebuilds (nightly + on-demand)

## Source systems
- Obsidian:   synced  (last: 2m ago, 38 MB, 3 vaults)
- MemPalace:  synced  (last: 1m ago, 14.3k items)
- Graphify:   healthy (last: 3m ago, serving v2025.04.19-1428)

## Warnings
- RUN-01409 · archive scope skipped because Obsidian sync was delayed (auto-retry scheduled).
- Lyra · partial merge on anomaly node "refund-spike" — review recommended.

## Suggested next actions
- Review the partial merge on the anomaly node.
- Confirm archive-vault re-sync completes before next nightly rebuild.
`}</pre>
          </div>
        </div>
      )}
    </WorkspaceOverlay>
  );
}


/* ============================================================
   GraphCanvas — small force-directed-ish preview (static SVG)
   ============================================================ */
function GraphCanvas() {
  // Deterministic layout — clusters for 6 subgraphs with inter-cluster edges
  const clusters = [
    { cx:120, cy: 90, hue:'var(--accent-hue)', n:10, label:'sales' },
    { cx:330, cy: 80, hue:155,                  n:9,  label:'support' },
    { cx:470, cy:160, hue: 78,                  n:7,  label:'policy' },
    { cx:400, cy:280, hue:290,                  n:11, label:'memory' },
    { cx:200, cy:300, hue: 30,                  n:8,  label:'contracts' },
    { cx: 80, cy:200, hue:210,                  n:6,  label:'archive' },
  ];
  // Build nodes
  const nodes = [];
  clusters.forEach((c, ci) => {
    for (let i=0; i<c.n; i++) {
      const a = (i / c.n) * Math.PI * 2 + ci;
      const r = 14 + (i%3)*8;
      nodes.push({
        x: c.cx + Math.cos(a)*r,
        y: c.cy + Math.sin(a)*r,
        hue: c.hue, cluster: ci,
        size: 2 + (i%4)*0.6,
      });
    }
  });
  // Intra-cluster edges
  const edges = [];
  clusters.forEach((c, ci) => {
    const cn = nodes.filter(n => n.cluster===ci);
    cn.forEach((n,i) => {
      edges.push({ a:n, b: cn[(i+1)%cn.length], w:1 });
      if (i%2===0) edges.push({ a:n, b: cn[(i+3)%cn.length], w:0.5 });
    });
  });
  // Inter-cluster bridges
  const firstOfCluster = (ci) => nodes.find(n => n.cluster===ci);
  [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3],[1,4]].forEach(([a,b]) =>
    edges.push({ a: firstOfCluster(a), b: firstOfCluster(b), w:0.7, inter:true })
  );
  return (
    <svg viewBox="0 0 560 360" style={{width:'100%', height:290, background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
      {/* grid */}
      <defs>
        <pattern id="g-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line-1)" strokeWidth="1" opacity="0.35"/>
        </pattern>
      </defs>
      <rect width="560" height="360" fill="url(#g-grid)"/>
      {/* edges */}
      {edges.map((e,i) => (
        <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
          stroke={e.inter ? 'var(--line-3)' : `oklch(0.7 0.12 ${e.a.hue} / 0.6)`}
          strokeWidth={e.w} strokeDasharray={e.inter ? '3 3' : '0'}/>
      ))}
      {/* nodes */}
      {nodes.map((n,i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.size}
          fill={`oklch(0.78 0.14 ${n.hue})`}
          stroke="var(--bg-1)" strokeWidth="1"/>
      ))}
      {/* cluster labels */}
      {clusters.map((c,i) => (
        <text key={i} x={c.cx} y={c.cy - 40} textAnchor="middle"
          style={{fontFamily:'var(--mono)', fontSize:9, fill:`oklch(0.78 0.14 ${c.hue})`, letterSpacing:0.5, textTransform:'uppercase'}}>
          {c.label}
        </text>
      ))}
    </svg>
  );
}


Object.assign(window, {
  GRAPHIFY_DATA, BRAIN_SYNC, AGENT_MEMORY_USAGE, GRAPH_EVENTS,
  GraphifyCard, GraphifyDrawer, GraphGlyph, GraphCanvas, BrainPill,
});
