// ============================================================
// AgentNetworkCanvas — tier-laned canvas wired directly to the
// AgentRegistry. Every node = one record. Every edge = a real
// `engines` link or a recent `harness` event.
//
// Bindings:
//   data-bind="agent.id"        → registry.agents[id]
//   data-bind="agent.tier"      → controls vertical lane (data-tier)
//   data-bind="agent.status"    → status dot color
//   data-bind="agent.health"    → ring opacity
//   data-bind="agent.engines"   → SVG edges to engine nodes
//
// Right-click → context menu (promote/demote/retire/connect/assign)
// Drag between lanes → setTier(id, lane)
// ============================================================

const TIER_LANES = [
  { id:'commander',  label:'Commander',  y: 110 },
  { id:'lieutenant', label:'Lieutenant', y: 250 },
  { id:'specialist', label:'Specialist', y: 380 },
  { id:'worker',     label:'Worker',     y: 500 },
  { id:'tool',       label:'Engine · Tool · Integration · Memory', y: 620 },
];

const ICONS_FOR_AGENT = {
  Crown:       (p) => <I.Shield {...p}/>,         // crown analogue
  ShieldCheck: (p) => <I.Shield {...p}/>,
  Compass:     (p) => <I.Mission {...p}/>,
  Sparkles:    (p) => <I.Sparkle {...p}/>,
  Code:        (p) => <I.Cube {...p}/>,
  Clock:       (p) => <I.Schedule {...p}/>,
  Zap:         (p) => <I.Zap {...p}/>,
  Plug:        (p) => <I.Plug {...p}/>,
  GitBranch:   (p) => <I.Cube {...p}/>,
  Hash:        (p) => <I.Help {...p}/>,
  Globe:       (p) => <I.Globe {...p}/>,
  Monitor:     (p) => <I.Mission {...p}/>,
  Rocket:      (p) => <I.Zap {...p}/>,
  Brain:       (p) => <I.Sparkle {...p}/>,
  Workflow:    (p) => <I.Plug {...p}/>,
  Network:     (p) => <I.Plug {...p}/>,
  Database:    (p) => <I.Database {...p}/>,
  BookOpen:    (p) => <I.Database {...p}/>,
  User:        (p) => <I.User {...p}/>,
};
const iconFor = (name) => ICONS_FOR_AGENT[name] || I.User;

function AgentNetworkCanvas({ snap, selectedId, onSelect, onContextMenu, onDropToTier }) {
  const wrapRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 1200, h: 720 });
  const [drag, setDrag] = React.useState(null); // { id, x, y }
  const [activePulse, setActivePulse] = React.useState({}); // id → tick

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Light up edges when a recent harness event names them
  React.useEffect(() => {
    const recent = (snap.harness || []).slice(0, 4);
    const m = {};
    recent.forEach(e => {
      const [from, to] = (e.route || '').split(' → ');
      if (from) m[from.trim()] = (m[from.trim()] || 0) + 1;
      if (to)   m[to.trim()]   = (m[to.trim()]   || 0) + 1;
    });
    setActivePulse(m);
  }, [snap.harness, snap.activity_pulse]);

  // Lay out per-lane: re-position x evenly across visible lane members,
  // commits to registry-ish coords for SVG edges.
  const positioned = React.useMemo(() => {
    const groups = {};
    snap.agents.forEach(a => {
      const t = a.tier;
      groups[t] = groups[t] || [];
      groups[t].push(a);
    });
    const out = [];
    Object.keys(groups).forEach(tier => {
      const lane = TIER_LANES.find(l => l.id === tier);
      const members = groups[tier];
      members.forEach((a, i) => {
        const x = ((i + 1) / (members.length + 1)) * size.w;
        const y = (lane?.y ?? 500);
        out.push({ ...a, _x: x, _y: y });
      });
    });
    return out;
  }, [snap.agents, size.w]);

  const byId = React.useMemo(() => {
    const m = {}; positioned.forEach(p => m[p.id] = p); return m;
  }, [positioned]);

  // Build edges: agent → engine for each engines[] entry
  const edges = React.useMemo(() => {
    const out = [];
    positioned.forEach(a => {
      if (a.kind !== 'agent') return;
      (a.engines || []).forEach(eid => {
        const e = byId[eid];
        if (!e) return;
        const hot = (activePulse[a.id] && activePulse[eid]) ? true : false;
        const degraded = e.status === 'degraded';
        out.push({
          from: a.id, to: eid,
          x1: a._x, y1: a._y, x2: e._x, y2: e._y,
          active: hot, degraded,
        });
      });
    });
    // supervises edges (commander → reports)
    positioned.forEach(a => {
      (a.supervises || []).forEach(sid => {
        const s = byId[sid];
        if (!s) return;
        out.push({
          from: a.id, to: sid, kind:'supervise',
          x1: a._x, y1: a._y, x2: s._x, y2: s._y,
        });
      });
    });
    return out;
  }, [positioned, byId, activePulse]);

  // Recent handoff (animated packet)
  const lastHandoff = React.useMemo(() => {
    const h = (snap.harness || []).find(e => e.kind === 'handoff' || e.kind === 'assign_ticket');
    if (!h) return null;
    const [fromName, toName] = (h.route || '').split(' → ');
    const from = byId[(fromName||'').trim()];
    const to   = byId[(toName||'').trim()];
    if (!from || !to) return null;
    return { from, to, ticket: h.ticket };
  }, [snap.harness, byId]);

  // ---- drag handling: drop into a tier lane → setTier
  const onMouseDown = (e, agent) => {
    if (agent.locked) return;
    const r = wrapRef.current.getBoundingClientRect();
    setDrag({ id: agent.id, x: e.clientX - r.left, y: e.clientY - r.top, startTier: agent.tier });
  };
  const onMouseMove = (e) => {
    if (!drag) return;
    const r = wrapRef.current.getBoundingClientRect();
    setDrag({ ...drag, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onMouseUp = (e) => {
    if (!drag) return;
    const r = wrapRef.current.getBoundingClientRect();
    const y = e.clientY - r.top;
    // determine which lane we landed in
    let landed = drag.startTier;
    for (let i = 0; i < TIER_LANES.length; i++) {
      const l = TIER_LANES[i];
      const next = TIER_LANES[i+1];
      const top = i === 0 ? 0 : (l.y + (TIER_LANES[i-1].y)) / 2;
      const bot = next ? (l.y + next.y) / 2 : size.h;
      if (y >= top && y < bot) { landed = l.id; break; }
    }
    if (landed !== drag.startTier) {
      onDropToTier?.(drag.id, landed);
    }
    setDrag(null);
  };

  return (
    <div className="an-canvas-wrap" ref={wrapRef}
         onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={()=>setDrag(null)}>
      {/* tier lanes */}
      {TIER_LANES.map(l => (
        <div key={l.id}
             className={`an-lane ${l.id}`}
             style={{ top: l.y - 70, height: 140 }}
             data-tier={l.id}>
          <span className="an-lane-label">{l.label}</span>
        </div>
      ))}

      {/* edges + animated packet */}
      <svg className="an-edges" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
        <defs>
          <marker id="an-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" opacity="0.45"/>
          </marker>
        </defs>
        {edges.map((e, i) => {
          const cls = ['an-edge'];
          if (e.active) cls.push('active');
          if (e.degraded) cls.push('degraded');
          if (e.kind === 'supervise') cls.push('handoff');
          // gentle bezier
          const mx = (e.x1 + e.x2) / 2;
          const my = (e.y1 + e.y2) / 2 + 20;
          const d = `M ${e.x1} ${e.y1} Q ${mx} ${my} ${e.x2} ${e.y2}`;
          return <path key={i} d={d} className={cls.join(' ')}
                       data-bind={`edge.${e.from}.${e.to}`}/>;
        })}
        {lastHandoff && (
          <Packet from={lastHandoff.from} to={lastHandoff.to}/>
        )}
      </svg>

      {/* nodes */}
      {positioned.map(a => {
        const Icon = iconFor(a.icon);
        const isSel = selectedId === a.id;
        const dragging = drag?.id === a.id;
        const x = dragging ? drag.x : a._x;
        const y = dragging ? drag.y : a._y;
        return (
          <div
            key={a.id}
            className={`an-node ${isSel ? 'selected' : ''} ${a.risk_level==='high'?'an-risk-high':''}`}
            data-bind={`agent.${a.id}`}
            data-tier={a.tier}
            data-status={a.status}
            data-id={a.id}
            data-planned={a.planned ? 'true':'false'}
            style={{ left: x, top: y, transition: dragging ? 'none' : undefined }}
            onClick={() => onSelect(a.id)}
            onMouseDown={(e) => onMouseDown(e, a)}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, a); }}
            title={`${a.display_name} · ${a.tier} · ${a.status}`}
          >
            <div className="an-node-disc">
              {a.tier === 'commander' && <span className="an-crown" title="Commander">★</span>}
              {(a.protected || a.risk_level === 'high') && <span className="an-lock" title="Protected — owner approval required">🔒</span>}
              <Icon size={a.tier === 'commander' ? 28 : a.tier === 'lieutenant' ? 22 : 18}/>
              <span className="an-status-dot" data-status={a.status}
                    title={`status: ${a.status} · health: ${(a.health_score*100|0)}%`}/>
            </div>
            <span className="an-node-label" data-bind={`agent.${a.id}.display_name`}>
              {a.display_name}
            </span>
            <span className="an-node-meta" data-bind={`agent.${a.id}.role`}>
              {a.kind === 'agent' ? a.role : (a.transport || '').toUpperCase()}
            </span>
          </div>
        );
      })}

      {/* drag hint */}
      {drag && (
        <div style={{
          position:'absolute', bottom: 12, left: 12, padding:'6px 10px',
          fontSize:11, color:'var(--fg-2)',
          background:'rgba(0,0,0,0.6)', border:'1px solid var(--line-2)', borderRadius:6,
          pointerEvents:'none',
        }}>
          Drop into lane to <b>change tier</b> — promote/demote
        </div>
      )}
    </div>
  );
}

// Animated packet — a circle that travels from→to along a bezier.
// Pure CSS animation, but the from/to references real registry IDs.
function Packet({ from, to }) {
  const mx = (from._x + to._x) / 2;
  const my = (from._y + to._y) / 2 + 20;
  return (
    <g>
      <path id="pkt-path" d={`M ${from._x} ${from._y} Q ${mx} ${my} ${to._x} ${to._y}`}
            fill="none" stroke="none"/>
      <circle r="4" className="an-packet">
        <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
          <mpath href="#pkt-path"/>
        </animateMotion>
      </circle>
    </g>
  );
}

Object.assign(window, { AgentNetworkCanvas, TIER_LANES });
