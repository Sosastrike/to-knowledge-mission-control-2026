// ============================================================
// MiroFishPage — Prediction & Simulation Lab
//
// First-class Mission Control module. Sits next to Brain Sync.
// Owner-only constraint: Agent 0 is THE runner — Tony / others
// view-only. Backend repo (To-Knowledge-MiroFish) isn't installed
// yet, so the install banner is permanent and the Start button
// is disabled. Streams (feed / cost / confidence) animate from
// client mocks tagged "setup pending".
//
// Sections rendered:
//   1. Header / status strip
//   2. Agent 0 Simulation Console (stage track + meta + thinking)
//   3. Live Simulation Map (canvas graph w/ tooltips + legend)
//   4. Live Simulation Feed (timestamped event stream)
//   5. New Simulation Job panel (Agent 0 locked as runner)
//   6. Data Sources Panel (table)
//   7. Prediction Output card (with disclaimer)
//   8. Reports History
//   9. Control & Safety Panel
//   ─ Empty/install-pending state + Error/degraded state
//     selectable via a small state-preview tab so the developer
//     can see all three live without backend mocking.
//
// Endpoint contract (per spec, all 5 documented in tooltips):
//   GET  /api/mirofish/status
//   GET  /api/mirofish/jobs
//   GET  /api/mirofish/jobs/:id/events  (SSE)
//   GET  /api/mirofish/reports/:id
//   POST /api/mirofish/jobs/:id/cancel
// ============================================================

const MF_STAGES = [
  'Intake',
  'Data Loading',
  'Graph Build',
  'Entity Mapping',
  'Simulation Round 1',
  'Simulation Round 2',
  'Prediction Synthesis',
  'Risk Review',
  'Final Recommendation',
  'Report Ready',
];

// Seeded mock job — enough fidelity to make the console feel alive,
// every value clearly tagged "demo" through the page-wide pill.
const MF_MOCK_JOB = {
  id: 'mf-sim-2041',
  title: 'Reduce Mission Control operational risk — next best move',
  question:
    'What is the next best technical task to reduce Mission Control operational risk over the next 14 days?',
  runner: 'Agent 0',
  stageIdx: 5, // currently in "Simulation Round 2"
  rounds: 2,
  totalRounds: 4,
  progress: 58,
  elapsed: '00:08:32',
  model: 'OpenRouter · anthropic/claude-3.7-sonnet',
  cost: 0.42,
  confidence: 71,
  prediction:
    'Promote the credential live-tester suite to a scheduled job (every 6 h) and gate the dashboard "broadcast" action behind a re-confirmed 2FA challenge.',
  recommendation:
    'Ship the scheduled credential test as the next deploy; queue the 2FA gate as the follow-up task.',
};

const MF_MOCK_INTEGRATIONS = [
  { id: 'agent0',     label: 'Agent 0',          state: 'on',      tip: 'Sole simulation runner' },
  { id: 'lightrag',   label: 'LightRAG',         state: 'on',      tip: 'Source-truth retrieval' },
  { id: 'claudemem',  label: 'Claude-Mem',       state: 'on',      tip: 'Prior workflow recall' },
  { id: 'tools',      label: 'Tools & Skills',   state: 'on',      tip: 'Skills registry' },
  { id: 'n8n',        label: 'n8n',              state: 'warn',    tip: 'Workflow automation — degraded' },
  { id: 'openrouter', label: 'OpenRouter',       state: 'on',      tip: 'Model routing' },
  { id: 'pacman',     label: 'Pac-Man',          state: 'on',      tip: 'Health & safety monitor' },
  { id: 'gov',        label: 'Governance',       state: 'on',      tip: 'Permissions matrix' },
];

const MF_MOCK_SOURCES = [
  { id: 's1', name: 'mc-runbook-2026-q2.md',    type: 'Markdown',  indexed: true,  used: true,  conf: 0.84, trust: 'High',   updated: '12 min ago' },
  { id: 's2', name: 'agent_audit_events.jsonl', type: 'JSONL',     indexed: true,  used: true,  conf: 0.79, trust: 'High',   updated: '4 min ago' },
  { id: 's3', name: 'incident-2025-12-04.md',   type: 'Markdown',  indexed: true,  used: true,  conf: 0.62, trust: 'Medium', updated: '2 d ago'  },
  { id: 's4', name: 'OpenRouter pricing',       type: 'URL',       indexed: true,  used: true,  conf: 0.55, trust: 'Medium', updated: '1 h ago'  },
  { id: 's5', name: 'Claude-Mem prior runs',    type: 'Memory',    indexed: true,  used: true,  conf: 0.48, trust: 'Medium', updated: '23 m ago' },
  { id: 's6', name: 'governance-policy.md',     type: 'Markdown',  indexed: true,  used: false, conf: 0.0,  trust: 'High',   updated: '5 d ago'  },
];

const MF_MOCK_REPORTS = [
  { id: 'mf-2038', title: 'Voice provider fallback strategy',           runner: 'Agent 0', conf: 82, status: 'Complete',  cost: 0.31, date: 'Today, 09:12', next: 'Adopt Deepgram primary; ElevenLabs as TTS' },
  { id: 'mf-2032', title: 'Customer-reply latency reduction',            runner: 'Agent 0', conf: 74, status: 'Complete',  cost: 0.28, date: 'Yesterday',     next: 'Cache last-thread context per agent' },
  { id: 'mf-2027', title: 'Optimal weekly digest send window',           runner: 'Agent 0', conf: 66, status: 'Complete',  cost: 0.19, date: '3 d ago',       next: 'Tue 09:00 local — operators only' },
  { id: 'mf-2018', title: 'Pac-Man heartbeat threshold tuning',          runner: 'Agent 0', conf: 88, status: 'Complete',  cost: 0.22, date: '6 d ago',       next: 'Drop hard threshold from 30s → 18s' },
  { id: 'mf-2011', title: 'Skill-router fallback ranking',                runner: 'Agent 0', conf: 59, status: 'Inconclusive', cost: 0.41, date: '1 w ago',     next: 'Re-run with broader skill corpus' },
];

// ─── Cost / confidence streams ──────────────────────────────
function useMfStreams(running) {
  const [cost, setCost] = React.useState(MF_MOCK_JOB.cost);
  const [conf, setConf] = React.useState(MF_MOCK_JOB.confidence);
  const [confHistory, setConfHistory] = React.useState(() =>
    Array.from({ length: 36 }, (_, i) => 55 + Math.sin(i * 0.3) * 6 + Math.random() * 4)
  );

  React.useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setCost((c) => +(c + Math.random() * 0.0035).toFixed(4));
      setConf((prev) => {
        const drift = (Math.random() - 0.45) * 1.4;
        const next = Math.max(40, Math.min(94, prev + drift));
        setConfHistory((h) => [...h.slice(-35), next]);
        return next;
      });
    }, 1400);
    return () => clearInterval(tick);
  }, [running]);

  return { cost, conf, confHistory };
}

// ─── Live event feed (mock) ─────────────────────────────────
const MF_FEED_SEED = [
  { t: '12:04:21', stage: 'Intake',                sev: 'info',    msg: 'Agent 0 received simulation goal.' },
  { t: '12:04:34', stage: 'Data Loading',          sev: 'info',    msg: 'Loaded 4 source files via LightRAG.' },
  { t: '12:05:10', stage: 'Graph Build',           sev: 'success', msg: 'Built initial entity graph: 42 nodes, 88 edges.' },
  { t: '12:05:48', stage: 'Entity Mapping',        sev: 'info',    msg: 'Mapped 6 customer segments and 3 decision branches.' },
  { t: '12:06:44', stage: 'Sim Round 1',           sev: 'success', msg: 'Simulation round 1 complete · 124 paths explored.' },
  { t: '12:07:03', stage: 'Confidence',            sev: 'info',    msg: 'Confidence increased from 61% to 69%.' },
  { t: '12:08:20', stage: 'Risk Review',           sev: 'warn',    msg: 'Risk detected: cost estimate exceeds limit on branch 2c.' },
  { t: '12:09:00', stage: 'Recommendation',        sev: 'info',    msg: 'Recommended next move updated.' },
];

function useMfFeed(running) {
  const [feed, setFeed] = React.useState(MF_FEED_SEED);
  React.useEffect(() => {
    if (!running) return;
    let i = 0;
    const generators = [
      () => ({ stage: 'Sim Round 2', sev: 'info',    msg: `Path ${(i % 100) + 60} evaluated · prior weight 0.${(40 + i % 50)}` }),
      () => ({ stage: 'Confidence',  sev: 'info',    msg: 'Confidence delta: +0.4%' }),
      () => ({ stage: 'Sim Round 2', sev: 'success', msg: 'Branch consensus reached on 2 of 4 outcomes.' }),
      () => ({ stage: 'Risk Review', sev: 'warn',    msg: 'Weak evidence on edge: market_condition → cost_estimate.' }),
    ];
    const id = setInterval(() => {
      i++;
      const g = generators[i % generators.length]();
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setFeed((f) => [...f.slice(-40), { t, ...g, _new: true }]);
    }, 3200);
    return () => clearInterval(id);
  }, [running]);
  return feed;
}

// ─── Confidence sparkline ───────────────────────────────────
function MfSpark({ data, color = '#4dd0c5' }) {
  if (!data?.length) return null;
  const w = 100, h = 38;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return (
    <svg className="mf-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mf-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#mf-spark-grad)" stroke="none"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Confidence ring ────────────────────────────────────────
function MfConfRing({ value }) {
  const r = 62, c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="mf-conf-ring">
      <svg width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
        <circle cx="72" cy="72" r={r} fill="none"
                stroke="url(#mf-conf-grad)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`}
                transform="rotate(-90 72 72)"/>
        <defs>
          <linearGradient id="mf-conf-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4dd0c5"/>
            <stop offset="100%" stopColor="#6bb3ff"/>
          </linearGradient>
        </defs>
      </svg>
      <div className="mf-conf-ring-num">{Math.round(value)}<small>confidence</small></div>
    </div>
  );
}

// ─── Live simulation map ────────────────────────────────────
// Lightweight canvas: 9 typed nodes + curved edges. The active
// path (User goal → Agent 0 → Predicted outcome → Recommended)
// pulses; weak edges are dashed; tooltips on hover.
function MfSimMap() {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const [tip, setTip] = React.useState(null);
  const [hover, setHover] = React.useState(null);

  const NODES = React.useMemo(() => ([
    { id:'goal',     label:'User goal',          kind:'goal',     color:'#6bb3ff', x:0.08, y:0.50 },
    { id:'market',   label:'Market condition',   kind:'context',  color:'#a16bff', x:0.26, y:0.20 },
    { id:'tools',    label:'Tools / API',        kind:'system',   color:'#3ec9ff', x:0.26, y:0.80 },
    { id:'agent0',   label:'Agent 0',            kind:'runner',   color:'#ff4f8a', x:0.45, y:0.50 },
    { id:'segment',  label:'Customer segment',   kind:'context',  color:'#a16bff', x:0.62, y:0.22 },
    { id:'risk',     label:'Risk factor',        kind:'risk',     color:'#ff6478', x:0.62, y:0.78 },
    { id:'cost',     label:'Cost estimate',      kind:'numeric',  color:'#ffb060', x:0.78, y:0.50 },
    { id:'branch',   label:'Decision branch',    kind:'branch',   color:'#3ddc84', x:0.86, y:0.28 },
    { id:'outcome',  label:'Predicted outcome',  kind:'predict',  color:'#4dd0c5', x:0.92, y:0.62 },
    { id:'recommend',label:'Recommended action', kind:'recommend',color:'#4dd0c5', x:0.96, y:0.50 },
  ]), []);

  const EDGES = React.useMemo(() => ([
    { from:'goal',     to:'agent0',   kind:'influences',     strength:1.0 },
    { from:'market',   to:'agent0',   kind:'influences',     strength:0.7 },
    { from:'tools',    to:'agent0',   kind:'depends on',     strength:0.6 },
    { from:'agent0',   to:'segment',  kind:'simulated into', strength:0.8 },
    { from:'agent0',   to:'risk',     kind:'simulated into', strength:0.65 },
    { from:'segment',  to:'cost',     kind:'calculated from',strength:0.55 },
    { from:'risk',     to:'cost',     kind:'conflicts with', strength:0.45, weak:true },
    { from:'cost',     to:'outcome',  kind:'supports',       strength:0.7  },
    { from:'cost',     to:'branch',   kind:'weak evidence',  strength:0.35, weak:true },
    { from:'branch',   to:'outcome',  kind:'supports',       strength:0.6 },
    { from:'outcome',  to:'recommend',kind:'strong evidence',strength:0.95, active:true },
  ]), []);

  // animate: pulses traveling along the active path
  React.useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const fit = () => {
      const r = cvs.parentElement.getBoundingClientRect();
      cvs.width = Math.floor(r.width * dpr);
      cvs.height = Math.floor(r.height * dpr);
      cvs.style.width = r.width + 'px';
      cvs.style.height = r.height + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cvs.parentElement);

    let raf = 0; let t0 = performance.now();
    const draw = (now) => {
      const tt = (now - t0) / 1000;
      const ctx = cvs.getContext('2d');
      const W = cvs.width, H = cvs.height;
      ctx.clearRect(0, 0, W, H);

      // edges first
      EDGES.forEach((e) => {
        const a = NODES.find(n => n.id === e.from);
        const b = NODES.find(n => n.id === e.to);
        const ax = a.x * W, ay = a.y * H;
        const bx = b.x * W, by = b.y * H;
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2 + (Math.sin((a.x + b.x) * 4) * 18 * dpr);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cx, cy, bx, by);
        ctx.lineWidth = (e.active ? 2.0 : 1.0) * dpr;
        if (e.weak) {
          ctx.setLineDash([4 * dpr, 4 * dpr]);
          ctx.strokeStyle = 'rgba(255,176,96,0.45)';
        } else if (e.active) {
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(77,208,197,0.85)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(255,255,255,${0.10 + e.strength * 0.18})`;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // active-path traveling pulse
        if (e.active) {
          const k = (tt * 0.8) % 1;
          const px = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * cx + k * k * bx;
          const py = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * cy + k * k * by;
          ctx.beginPath();
          ctx.arc(px, py, 3.5 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = '#4dd0c5';
          ctx.shadowColor = '#4dd0c5'; ctx.shadowBlur = 12 * dpr;
          ctx.fill(); ctx.shadowBlur = 0;
        }
      });

      // nodes
      NODES.forEach((n) => {
        const x = n.x * W, y = n.y * H;
        const isHover = hover === n.id;
        const r = (n.kind === 'runner' ? 9 : 6.5) * dpr;
        // halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        grad.addColorStop(0, n.color + 'cc');
        grad.addColorStop(1, n.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
        // core
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color; ctx.fill();
        // ring (runner)
        if (n.kind === 'runner') {
          ctx.beginPath(); ctx.arc(x, y, r + 4 * dpr + Math.sin(tt * 2) * 1.2 * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,79,138,0.55)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
        }
        // label
        ctx.fillStyle = isHover ? '#fff' : 'rgba(232,236,247,0.78)';
        ctx.font = `${(n.kind === 'runner' ? 11.5 : 10) * dpr}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.label, x, y + r + 6 * dpr);
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [hover, NODES, EDGES]);

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    let nearest = null, dmin = 0.05;
    NODES.forEach(n => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < dmin) { dmin = d; nearest = n; }
    });
    if (nearest) {
      setHover(nearest.id);
      setTip({ node: nearest, px: e.clientX - rect.left, py: e.clientY - rect.top });
    } else { setHover(null); setTip(null); }
  };

  return (
    <div className="mf-map-stage" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => { setHover(null); setTip(null); }}>
      <canvas ref={canvasRef}/>
      <div className="mf-map-toolbar">
        <button title="Pan · not wired" disabled><I.Move4 size={11}/></button>
        <button title="Zoom in · not wired" disabled><I.Plus size={11}/></button>
        <button title="Zoom out · not wired" disabled><I.Minus size={11}/></button>
        <button title="Fit to view · not wired" disabled><I.Maximize size={11}/></button>
        <button title="Highlight active path"><I.Sparkle size={11}/></button>
      </div>
      <div className="mf-map-legend">
        <div className="mf-legend-row"><span className="mf-legend-dot" style={{background:'#ff4f8a'}}/>Agent 0 (runner)</div>
        <div className="mf-legend-row"><span className="mf-legend-dot" style={{background:'#6bb3ff'}}/>Goal · context</div>
        <div className="mf-legend-row"><span className="mf-legend-dot" style={{background:'#ff6478'}}/>Risk factor</div>
        <div className="mf-legend-row"><span className="mf-legend-dot" style={{background:'#4dd0c5'}}/>Predicted outcome / recommendation</div>
        <div className="mf-legend-row"><span className="mf-edge-legend-bar" style={{background:'#4dd0c5'}}/>Active path</div>
        <div className="mf-legend-row"><span className="mf-edge-legend-bar" style={{background:'rgba(255,176,96,0.6)'}}/>Weak evidence</div>
      </div>
      {tip && (
        <div className="mf-node-tip" style={{ left: tip.px, top: tip.py }}>
          <div className="mf-tip-name">{tip.node.label}</div>
          <div className="mf-tip-row mf-mono">id: {tip.node.id} · kind: {tip.node.kind}</div>
          <div className="mf-tip-row">
            <span className="mf-mock-pill"><span className="mf-mock-dot"/>planned node</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Header / status row ────────────────────────────────────
function MfHeader({ status, runner, queue, lastSuccess, costToday, model }) {
  return (
    <div className="mf-header">
      <div className="mf-titlecard">
        <div className="mf-eyebrow">To Knowledge MiroFish</div>
        <h1>
          Prediction &amp; Simulation Lab
          <span className="mf-mock-pill" title="Backend integration is setup-pending"><span className="mf-mock-dot"/>setup pending</span>
        </h1>
        <div className="mf-sub">Run Agent 0 simulations, map possible outcomes, and watch prediction logic evolve in real time.</div>
        <div className="mf-mini">
          <span><span className={`mf-status-pill is-${status}`}><span className="mf-sp-dot"/>{status === 'running' ? 'Running' : status === 'online' ? 'Online' : status === 'degraded' ? 'Degraded' : status === 'offline' ? 'Offline' : 'Error'}</span></span>
          <span className="mf-owner"><span className="mf-owner-dot"/>Runner · {runner}</span>
          <span className="mf-muted">Tony · request &amp; view · Other agents · view-only</span>
        </div>
      </div>

      <div className="mf-stat">
        <div className="mf-stat-label">Active jobs</div>
        <div className="mf-stat-value">{status === 'running' ? 1 : 0}</div>
        <div className="mf-stat-sub">Queue · {queue}</div>
      </div>

      <div className="mf-stat">
        <div className="mf-stat-label">Last success</div>
        <div className="mf-stat-value">{lastSuccess}</div>
        <div className="mf-stat-sub">Report mf-2038</div>
      </div>

      <div className="mf-stat">
        <div className="mf-stat-label">Cost today</div>
        <div className="mf-stat-value mf-cost-counter">${costToday.toFixed(2)}</div>
        <div className="mf-stat-sub">Limit · $5.00</div>
      </div>

      <div className="mf-stat">
        <div className="mf-stat-label">Model · provider</div>
        <div className="mf-stat-value" style={{fontSize:13, lineHeight:1.3}}>{model}</div>
        <div className="mf-stat-sub">Routed via OpenRouter</div>
      </div>

      <div className="mf-stat">
        <div className="mf-stat-label">Health</div>
        <div className="mf-stat-value" style={{color: status === 'error' ? '#ff6478' : status === 'degraded' ? '#ffb060' : '#3ddc84'}}>
          {status === 'error' ? 'Critical' : status === 'degraded' ? 'Degraded' : 'Good'}
        </div>
        <div className="mf-stat-sub">Pac-Man heartbeat</div>
      </div>
    </div>
  );
}

// ─── Console ────────────────────────────────────────────────
function MfConsole({ job, conf, confHistory, cost }) {
  return (
    <div className="mf-console">
      <div className="mf-console-head">
        <div style={{minWidth:0, flex:1}}>
          <div className="mf-console-title">{job.title}</div>
          <div className="mf-console-id mf-mono">{job.id} · runner {job.runner} · model {job.model}</div>
          <div className="mf-console-question">"{job.question}"</div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end'}}>
          <span className="mf-thinking">
            <span className="mf-thinking-dots"><span/><span/><span/></span>
            Agent 0 is calculating
          </span>
          <span className="mf-mock-pill"><span className="mf-mock-dot"/>setup pending</span>
        </div>
      </div>

      <div className="mf-stage-track">
        {MF_STAGES.map((name, i) => (
          <div key={name}
               className={`mf-stage ${i < job.stageIdx ? 'is-done' : i === job.stageIdx ? 'is-active' : ''}`}>
            <div className="mf-stage-num">STAGE {String(i+1).padStart(2,'0')}</div>
            <div className="mf-stage-name">{name}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--brain-fg-2)', marginBottom:5}}>
          <span>Progress · {job.progress}% · round {job.rounds} of {job.totalRounds}</span>
          <span className="mf-mono">{job.elapsed}</span>
        </div>
        <div className="mf-progress"><div className="mf-progress-fill" style={{width: `${job.progress}%`}}/></div>
      </div>

      <div className="mf-console-meta">
        <div className="mf-meta-cell is-confidence">
          <div className="mf-meta-label">Confidence</div>
          <div className="mf-meta-value">{Math.round(conf)}%</div>
          <MfSpark data={confHistory}/>
        </div>
        <div className="mf-meta-cell is-cost">
          <div className="mf-meta-label">Cost so far</div>
          <div className="mf-meta-value mf-cost-counter">${cost.toFixed(4)}</div>
          <div style={{fontSize:10.5, color:'var(--brain-fg-2)', marginTop:4}}>Limit $1.50 · auto-pause near limit</div>
        </div>
        <div className="mf-meta-cell">
          <div className="mf-meta-label">Current prediction</div>
          <div className="mf-meta-value" style={{fontSize:11.5, lineHeight:1.4, color:'var(--brain-fg-1)', fontWeight:400}}>{job.prediction}</div>
        </div>
        <div className="mf-meta-cell">
          <div className="mf-meta-label">Recommended next move</div>
          <div className="mf-meta-value" style={{fontSize:11.5, lineHeight:1.4, color:'var(--brain-fg-0)', fontWeight:500}}>{job.recommendation}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Live feed ──────────────────────────────────────────────
function MfFeed({ feed }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [feed]);
  return (
    <div className="mf-feed" ref={ref}>
      {feed.map((row, i) => (
        <div key={i} className={`mf-feed-row sev-${row.sev} ${row._new ? 'is-new' : ''}`}>
          <div className="mf-feed-time">{row.t}</div>
          <div className="mf-feed-stage">{row.stage}</div>
          <div className="mf-feed-msg">{row.msg}</div>
        </div>
      ))}
    </div>
  );
}

// ─── New simulation form ────────────────────────────────────
function MfNewJob({ disabled }) {
  const [draft, setDraft] = React.useState({
    title: 'Reduce Mission Control operational risk — next best move',
    question: 'What is the next best technical task to reduce Mission Control operational risk?',
    seed: '',
    horizon: '14 days',
    rounds: 4,
    cost: 1.50,
    priority: 'normal',
    approval: true,
  });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div className="mf-form-grid">
      <div className="mf-field mf-field-full">
        <label>Simulation title</label>
        <input value={draft.title} onChange={e=>set('title', e.target.value)} placeholder="Title…"/>
      </div>
      <div className="mf-field mf-field-full">
        <label>Prediction question</label>
        <textarea value={draft.question} onChange={e=>set('question', e.target.value)} placeholder="What is the next best…"/>
      </div>
      <div className="mf-field mf-field-full">
        <label>Seed information / assumptions</label>
        <textarea value={draft.seed} onChange={e=>set('seed', e.target.value)} placeholder="Constraints, prior knowledge, things Agent 0 should weight…"/>
      </div>
      <div className="mf-field">
        <label>Time horizon</label>
        <select value={draft.horizon} onChange={e=>set('horizon', e.target.value)}>
          <option>24 hours</option><option>3 days</option><option>14 days</option>
          <option>30 days</option><option>90 days</option>
        </select>
      </div>
      <div className="mf-field">
        <label>Simulation rounds</label>
        <input type="number" min="1" max="12" value={draft.rounds} onChange={e=>set('rounds', e.target.value)}/>
      </div>
      <div className="mf-field">
        <label>Cost limit ($)</label>
        <input type="number" step="0.10" value={draft.cost} onChange={e=>set('cost', e.target.value)}/>
      </div>
      <div className="mf-field">
        <label>Priority</label>
        <select value={draft.priority} onChange={e=>set('priority', e.target.value)}>
          <option value="low">Low</option><option value="normal">Normal</option>
          <option value="high">High</option><option value="urgent">Urgent</option>
        </select>
      </div>
      <div className="mf-field mf-field-full">
        <label>Assigned runner</label>
        <div className="mf-field-locked">
          <I.Lock size={13} className="mf-lock-glyph"/>
          <span><b style={{color:'#ff80a8'}}>Agent 0</b> · locked · MiroFish runs only under Agent 0</span>
        </div>
      </div>
      <div className="mf-field mf-field-full" style={{flexDirection:'row', alignItems:'center', gap:10}}>
        <button className={`mf-toggle ${draft.approval ? 'is-on' : ''}`}
                onClick={()=>set('approval', !draft.approval)} aria-label="Require approval"/>
        <span style={{fontSize:11.5, color:'var(--brain-fg-1)'}}>Require approval if cost &gt; ${draft.cost}</span>
      </div>
      <div className="mf-field mf-field-full" style={{flexDirection:'row', gap:8, marginTop:4}}>
        <button className="mf-btn is-primary"
                disabled={disabled}
                title={disabled ? 'Backend not installed yet — endpoint POST /api/mirofish/jobs missing' : 'Start simulation'}>
          <I.Play size={12}/> Start simulation
        </button>
        <button className="mf-btn" disabled={disabled} title="Save draft · backend not wired"><I.Save size={12}/> Save as draft</button>
        <span style={{flex:1}}/>
        <span className="mf-mock-pill"><span className="mf-mock-dot"/>endpoint pending</span>
      </div>
    </div>
  );
}

// ─── Sources table ──────────────────────────────────────────
function MfSources() {
  return (
    <div className="mf-row-table">
      <div className="mf-row-head">
        <div>Source</div><div>Type</div><div>Indexed</div><div>Used</div><div>Conf. contrib.</div><div>Trust</div>
      </div>
      {MF_MOCK_SOURCES.map(s => (
        <div className="mf-row" key={s.id}>
          <div className="mf-src-name">
            <span className="mf-src-icon"><I.FileCode size={12}/></span>
            <span>{s.name}</span>
            <span className="mf-muted" style={{fontSize:10.5}}>· {s.updated}</span>
          </div>
          <div className="mf-mono">{s.type}</div>
          <div>{s.indexed ? <span style={{color:'var(--mf-success)'}}>yes</span> : <span className="mf-muted">no</span>}</div>
          <div>{s.used ? <span style={{color:'var(--mf-accent)'}}>yes</span> : <span className="mf-muted">no</span>}</div>
          <div className="mf-mono">{s.conf > 0 ? `+${s.conf.toFixed(2)}` : '—'}</div>
          <div>{s.trust}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Reports table ──────────────────────────────────────────
function MfReports() {
  return (
    <div className="mf-row-table mf-report-table">
      <div className="mf-row-head">
        <div>Report</div><div>Status</div><div>Conf.</div><div>Cost</div><div>Date</div><div>Actions</div>
      </div>
      {MF_MOCK_REPORTS.map(r => (
        <div className="mf-row" key={r.id}>
          <div>
            <div style={{color:'var(--brain-fg-0)', fontWeight:500}}>{r.title}</div>
            <div className="mf-muted" style={{fontSize:10.5}}>{r.id} · {r.runner} · next: {r.next}</div>
          </div>
          <div>
            <span className="mf-status-pill" style={{
              color: r.status==='Complete' ? '#3ddc84' : '#ffb060',
              borderColor: r.status==='Complete' ? 'rgba(61,220,132,0.30)' : 'var(--mf-warn-line)',
              background: r.status==='Complete' ? 'rgba(61,220,132,0.10)' : 'var(--mf-warn-soft)'
            }}><span className="mf-sp-dot" style={{background: r.status==='Complete' ? '#3ddc84' : '#ffb060'}}/>{r.status}</span>
          </div>
          <div className="mf-mono">{r.conf}%</div>
          <div className="mf-mono">${r.cost.toFixed(2)}</div>
          <div>{r.date}</div>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            <button className="mf-btn sm" disabled title="GET /api/mirofish/reports/:id · pending">View</button>
            <button className="mf-btn sm" disabled title="Export PDF · pending">PDF</button>
            <button className="mf-btn sm" disabled title="Re-run · pending">Re-run</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Prediction output card ─────────────────────────────────
function MfPrediction({ conf, job }) {
  return (
    <div className="mf-prediction">
      <div className="mf-prediction-main">
        <div className="mf-prediction-disclaimer">⚠ Simulation result — not guaranteed outcome.</div>
        <div className="mf-prediction-headline">{job.recommendation}</div>

        <div className="mf-prediction-block">
          <h4>Why this is recommended</h4>
          <p>Two simulation rounds converged on credential reliability as the highest-leverage operational risk. Adding a scheduled tester (every 6 h) catches drift before broadcast / customer-reply paths use a stale key. The 2FA gate on broadcast caps blast radius if a session is hijacked between checks.</p>
        </div>

        <div className="mf-prediction-block">
          <h4>Supporting evidence</h4>
          <ul>
            <li>3 of last 8 incidents traced to expired or rotated credentials (audit_events)</li>
            <li>Broadcast endpoint currently fans out without re-auth — agent_audit shows 2 mis-fires this month</li>
            <li>Cost of credential test job is ~$0.08/day vs ~$2.40 average per incident response</li>
          </ul>
        </div>

        <div className="mf-prediction-block">
          <h4>Risks &amp; assumptions</h4>
          <ul>
            <li>Assumes rotation cadence stays ≤ weekly — invalid if vault sync flips to manual</li>
            <li>Risk: 2FA challenge adds ~6 s to broadcast UX; mitigated by remember-this-device</li>
            <li>Alternative: fold checks into Pac-Man heartbeat (cheaper, less granular)</li>
          </ul>
        </div>
      </div>

      <div className="mf-prediction-side">
        <MfConfRing value={conf}/>
        <div className="mf-prediction-block">
          <h4>Run details</h4>
          <div style={{fontSize:11.5, color:'var(--brain-fg-1)', lineHeight:1.7}}>
            Runner · <b style={{color:'#ff80a8'}}>Agent 0</b><br/>
            Estimated cost · ~$0.42<br/>
            Estimated time · 12 min<br/>
            Rounds · 2 of 4<br/>
            Sources · 5 of 6 used
          </div>
        </div>
        <button className="mf-btn" disabled title="Export report · pending"><I.Download size={12}/> Export report</button>
      </div>
    </div>
  );
}

// ─── Empty (install-pending) state ──────────────────────────
function MfEmptyState() {
  return (
    <div className="mf-empty">
      <h3>MiroFish is not installed yet.</h3>
      <p>Backend repo is queued for setup. Once the service comes online, this surface will switch to live data automatically.</p>
      <div className="mf-empty-grid">
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Install status</div>
          <div className="mf-ec-value"><span className="mf-status-pill is-degraded"><span className="mf-sp-dot"/>Pending</span></div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Repo</div>
          <div className="mf-ec-value mf-mono" style={{fontSize:10.5, wordBreak:'break-all'}}>
            <code>github.com/Sosastrike/To-Knowledge-MiroFish</code>
          </div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Owner agent</div>
          <div className="mf-ec-value"><span className="mf-owner"><span className="mf-owner-dot"/>Agent 0</span></div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Planned services</div>
          <div className="mf-ec-value mf-mono" style={{fontSize:10.5}}>:7400 api · :7401 sim-engine · :7402 graph</div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Setup checklist</div>
          <div className="mf-ec-value" style={{fontSize:11}}>
            ☐ Clone repo &nbsp; ☐ Configure .env<br/>☐ Index sources &nbsp; ☐ Boot Agent 0
          </div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Action</div>
          <div className="mf-ec-value"><button className="mf-btn is-primary" disabled title="Disabled until backend installed"><I.Play size={12}/> Start MiroFish</button></div>
        </div>
      </div>
      <div style={{marginTop:14}}><span className="mf-mock-pill"><span className="mf-mock-dot"/>waiting for backend install</span></div>
    </div>
  );
}

// ─── Error / degraded state ─────────────────────────────────
function MfErrorState() {
  return (
    <div className="mf-empty" style={{borderColor:'rgba(255,100,120,0.32)', background:'radial-gradient(420px 200px at 50% 0%, rgba(255,100,120,0.08), transparent 70%)'}}>
      <h3 style={{color:'#ff8094'}}>MiroFish simulation failed.</h3>
      <p>Last job halted before completion. Agent 0 is currently blocked from running new simulations until the issue is resolved.</p>
      <div className="mf-empty-grid">
        <div className="mf-empty-cell">
          <div className="mf-ec-label">What failed</div>
          <div className="mf-ec-value">Graph build stage — entity mapper threw exception</div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Service status</div>
          <div className="mf-ec-value"><span className="mf-status-pill is-error"><span className="mf-sp-dot"/>Critical</span></div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Last error</div>
          <div className="mf-ec-value mf-mono" style={{fontSize:10.5}}>EntityMapper: source 'incident-2025-12-04.md' returned malformed YAML at line 42</div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Affected job</div>
          <div className="mf-ec-value mf-mono">{MF_MOCK_JOB.id}</div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Agent 0 status</div>
          <div className="mf-ec-value" style={{color:'#ff8094'}}>Blocked — no new sims accepted</div>
        </div>
        <div className="mf-empty-cell">
          <div className="mf-ec-label">Action</div>
          <div className="mf-ec-value" style={{display:'flex', gap:6}}>
            <button className="mf-btn is-primary" disabled title="Retry job · pending"><I.Refresh size={12}/> Retry</button>
            <button className="mf-btn" disabled title="View logs · pending"><I.FileCode size={12}/> Logs</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page shell ─────────────────────────────────────────────
function MiroFishPage() {
  // State preview tabs let the developer / owner see all three
  // surfaces without backend mocking. Default = LIVE preview.
  const [view, setView] = React.useState('live'); // 'live' | 'empty' | 'error'

  // ── Live install probe ───────────────────────────────────
  // Hits GET /api/mirofish/status. If 200 + installed:true the
  // pending-install banner flips to installed and surfaces real
  // counters (active jobs, queue depth, cost today). If the route
  // isn't mounted (404 / network error) we keep the honest "not
  // installed yet" copy — never silently fake green.
  const [probe, setProbe] = React.useState({ checked: false, installed: false, data: null });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/mirofish/status', { credentials: 'include' });
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        if (cancelled) return;
        setProbe({ checked: true, installed: !!j.installed, data: j });
      } catch {
        if (cancelled) return;
        setProbe({ checked: true, installed: false, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const status = view === 'error' ? 'error' : view === 'empty' ? 'offline' : 'running';
  const running = view === 'live';
  const { cost, conf, confHistory } = useMfStreams(running);
  const feed = useMfFeed(running);

  return (
    <div className="brain-page mf-page">
      <BrainTopbar active="brain" onNav={(i)=>{
        // Reuse Brain Sync's topbar — every nav target still routes through window.appGoTo.
        // MiroFish is a sibling page, opened via the workspace rail.
        if (i.target === 'brain-sync' && i.self) return;
        window.appGoTo?.(i.target.startsWith('settings:') ? i.target : i.target);
      }}/>

      <div className="mf-body">
        {/* Install banner — flips green once /api/mirofish/status returns installed:true */}
        <div className={`mf-install-banner ${probe.installed ? 'is-ok' : ''}`}>
          <div className="mf-ib-icon">
            {probe.installed ? <I.CheckCircle2 size={18}/> : <I.AlertCircle size={18}/>}
          </div>
          <div>
            {probe.installed ? (
              <>
                <div className="mf-ib-title">MiroFish backend installed — runner pinned to Agent 0.</div>
                <div className="mf-ib-sub">
                  Active · <b>{probe.data?.active_jobs ?? 0}</b> &nbsp;·&nbsp;
                  Queue · <b>{probe.data?.queue_depth ?? 0}</b> &nbsp;·&nbsp;
                  Cost today · <b>${(probe.data?.cost_today ?? 0).toFixed(2)}</b> / ${(probe.data?.cost_limit_daily ?? 5).toFixed(2)} cap
                  &nbsp;·&nbsp; Last success · <code>{probe.data?.last_success_id || '—'}</code>
                </div>
              </>
            ) : (
              <>
                <div className="mf-ib-title">
                  {probe.checked ? 'MiroFish backend not reachable — using preview data.' : 'Probing /api/mirofish/status…'}
                </div>
                <div className="mf-ib-sub">
                  Repo · <code>github.com/Sosastrike/To-Knowledge-MiroFish</code> &nbsp;·&nbsp;
                  Endpoints: <code>/api/mirofish/status</code>, <code>/api/mirofish/jobs</code>, <code>/api/mirofish/jobs/:id/events</code>, <code>/api/mirofish/reports/:id</code>, <code>/api/mirofish/jobs/:id/cancel</code>
                </div>
              </>
            )}
          </div>
          <div className="mf-state-tabs" role="tablist" aria-label="Preview MiroFish state">
            <button className={`mf-state-tab ${view==='live'?'is-active':''}`}  onClick={()=>setView('live')}>Live preview</button>
            <button className={`mf-state-tab ${view==='empty'?'is-active':''}`} onClick={()=>setView('empty')}>Not installed</button>
            <button className={`mf-state-tab ${view==='error'?'is-active':''}`} onClick={()=>setView('error')}>Error</button>
          </div>
        </div>

        {/* HEADER */}
        <MfHeader
          status={status}
          runner="Agent 0"
          queue={view==='live' ? 3 : 0}
          lastSuccess={view==='live' ? '12 min ago' : view==='error' ? '1 h ago' : '—'}
          costToday={view==='live' ? cost + 0.18 : 0}
          model="claude-3.7-sonnet"
        />

        {/* INTEGRATIONS */}
        <div className="mf-card">
          <div className="mf-card-head">
            <div className="mf-card-title"><span className="mf-ct-glyph"><I.Sitemap size={12}/></span>Connected systems</div>
            <span className="mf-mock-pill"><span className="mf-mock-dot"/>health · pending</span>
          </div>
          <div className="mf-card-body">
            <div className="mf-integrations">
              {MF_MOCK_INTEGRATIONS.map(i => (
                <span key={i.id} className={`mf-int-chip is-${i.state}`} title={i.tip}>
                  <span className="mf-int-dot"/>{i.label}
                </span>
              ))}
            </div>
            <div style={{fontSize:10.5, color:'var(--brain-fg-2)', marginTop:8, fontFamily:'var(--font-mono, "JetBrains Mono", monospace)'}}>
              Agent 0 → LightRAG sources → Claude-Mem prior workflow → MiroFish simulation engine → OpenRouter route → Prediction report → Mission Control task recommendation
            </div>
          </div>
        </div>

        {/* If empty/error: show only the dedicated state and stop. */}
        {view === 'empty' && <MfEmptyState/>}
        {view === 'error' && <MfErrorState/>}

        {view === 'live' && (
          <React.Fragment>
            {/* CONSOLE */}
            <div className="mf-card">
              <div className="mf-card-head">
                <div className="mf-card-title"><span className="mf-ct-glyph"><I.Activity size={12}/></span>Agent 0 simulation console</div>
                <div style={{display:'flex', gap:6}}>
                  <button className="mf-btn sm" title="Pause simulation · pending"><I.Pause size={12}/> Pause</button>
                  <button className="mf-btn sm is-danger" title="POST /api/mirofish/jobs/:id/cancel · pending"><I.X size={12}/> Cancel</button>
                </div>
              </div>
              <div className="mf-card-body">
                <MfConsole job={MF_MOCK_JOB} conf={conf} confHistory={confHistory} cost={cost}/>
              </div>
            </div>

            {/* MAP + FEED side-by-side */}
            <div className="mf-grid-2">
              <div className="mf-card mf-map-card">
                <div className="mf-card-head">
                  <div className="mf-card-title"><span className="mf-ct-glyph"><I.Network size={12}/></span>Live simulation map</div>
                  <span className="mf-mock-pill"><span className="mf-mock-dot"/>Live read-only</span>
                </div>
                <MfSimMap/>
              </div>
              <div className="mf-card">
                <div className="mf-card-head">
                  <div className="mf-card-title"><span className="mf-ct-glyph"><I.Activity size={12}/></span>Live feed</div>
                  <span className="mf-mock-pill"><span className="mf-mock-dot"/>SSE preview</span>
                </div>
                <MfFeed feed={feed}/>
              </div>
            </div>

            {/* PREDICTION */}
            <div className="mf-card">
              <div className="mf-card-head">
                <div className="mf-card-title"><span className="mf-ct-glyph"><I.Sparkle size={12}/></span>Prediction output</div>
                <span className="mf-mock-pill"><span className="mf-mock-dot"/>Prediction · not guarantee</span>
              </div>
              <div className="mf-card-body">
                <MfPrediction conf={conf} job={MF_MOCK_JOB}/>
              </div>
            </div>

            {/* NEW SIM + SOURCES */}
            <div className="mf-grid-2">
              <div className="mf-card">
                <div className="mf-card-head">
                  <div className="mf-card-title"><span className="mf-ct-glyph"><I.Plus size={12}/></span>New simulation</div>
                  <span className="mf-mock-pill"><span className="mf-mock-dot"/>endpoint pending</span>
                </div>
                <div className="mf-card-body"><MfNewJob disabled={true}/></div>
              </div>
              <div className="mf-card">
                <div className="mf-card-head">
                  <div className="mf-card-title"><span className="mf-ct-glyph"><I.Database size={12}/></span>Data sources</div>
                  <span className="mf-mock-pill"><span className="mf-mock-dot"/>indexed · pending</span>
                </div>
                <div className="mf-card-body"><MfSources/></div>
              </div>
            </div>

            {/* REPORTS */}
            <div className="mf-card">
              <div className="mf-card-head">
                <div className="mf-card-title"><span className="mf-ct-glyph"><I.FileCode size={12}/></span>Reports history</div>
                <div style={{display:'flex', gap:6}}>
                  <button className="mf-btn sm" disabled title="Export JSON · pending"><I.Download size={12}/> Export JSON</button>
                  <button className="mf-btn sm" disabled title="Compare runs · pending">Compare</button>
                </div>
              </div>
              <div className="mf-card-body"><MfReports/></div>
            </div>

            {/* CONTROL & SAFETY */}
            <div className="mf-card">
              <div className="mf-card-head">
                <div className="mf-card-title"><span className="mf-ct-glyph"><I.Lock size={12}/></span>Control &amp; safety</div>
                <span className="mf-muted" style={{fontSize:10.5}}>Owner / Admin only</span>
              </div>
              <div className="mf-card-body">
                <div className="mf-control">
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Pause simulation</div>
                      <div className="mf-cc-help">Halt without losing context</div>
                    </div>
                    <button className="mf-btn sm" disabled><I.Pause size={11}/></button>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Cancel simulation</div>
                      <div className="mf-cc-help">Hard stop · audit-logged</div>
                    </div>
                    <button className="mf-btn sm is-danger" disabled><I.X size={11}/></button>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Cost limit</div>
                      <div className="mf-cc-help">Auto-pause when reached</div>
                    </div>
                    <span className="mf-mono" style={{color:'var(--mf-warn)'}}>$5.00 / day</span>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Max rounds per job</div>
                      <div className="mf-cc-help">Hard cap on iterations</div>
                    </div>
                    <span className="mf-mono">12</span>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Approval over $1.50</div>
                      <div className="mf-cc-help">Owner sign-off required</div>
                    </div>
                    <button className="mf-toggle is-on" aria-label="Approval"/>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Lock to Agent 0 only</div>
                      <div className="mf-cc-help">Cannot be disabled</div>
                    </div>
                    <button className="mf-toggle is-on is-disabled" disabled aria-label="Locked"/>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Disable external data access</div>
                      <div className="mf-cc-help">Sandbox simulations</div>
                    </div>
                    <button className="mf-toggle" aria-label="External data"/>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">Clear queue</div>
                      <div className="mf-cc-help">Drop all pending jobs</div>
                    </div>
                    <button className="mf-btn sm is-danger" disabled>Clear</button>
                  </div>
                  <div className="mf-control-cell">
                    <div>
                      <div className="mf-cc-label">View error logs</div>
                      <div className="mf-cc-help">Recent failures</div>
                    </div>
                    <button className="mf-btn sm" disabled><I.FileCode size={11}/></button>
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MiroFishPage });
