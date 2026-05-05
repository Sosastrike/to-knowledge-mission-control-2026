// ============================================================
// Gateway Map — central routing hub wired to AgentRegistry data.
//
// The Gateway node sits between Owner and downstream systems.
// Agent Zero is the primary command node; Hermes is the secondary
// command node. Brain, model, MCP/tool, API, and event clusters are
// route groups, not execution claims.
// ============================================================

const TIER_LANES = [
  { id:'commander',  label:'Commander',  y: 110 },
  { id:'lieutenant', label:'Lieutenant', y: 250 },
  { id:'specialist', label:'Specialist', y: 380 },
  { id:'worker',     label:'Worker',     y: 500 },
  { id:'tool',       label:'Runtime · Tools · Models · Memory', y: 620 },
];

const GATEWAY_CLUSTERS = [
  {
    id: 'brain',
    label: 'Brain',
    route: 'memory · sync',
    x: 0.22,
    y: 0.68,
    items: ['Obsidian', 'MemPalace', 'Graphify', 'Brain Sync', 'Build-Wiki / Farmer'],
  },
  {
    id: 'models',
    label: 'Models',
    route: 'model-call',
    x: 0.50,
    y: 0.78,
    items: ['OpenRouter', 'OpenAI', 'Claude/Anthropic', 'Codex/ChatGPT', 'Ollama', 'NVIDIA', 'Gemini', 'Groq'],
  },
  {
    id: 'mcp',
    label: 'MCP / Tools',
    route: 'mcp-call · tool-call',
    x: 0.78,
    y: 0.68,
    items: ['MCP servers', 'Zapier', 'Firecrawl', 'AgentMail', 'Tools'],
  },
  {
    id: 'apis',
    label: 'APIs',
    route: 'api route',
    x: 0.82,
    y: 0.35,
    items: ['Google Drive', 'OneDrive', 'AgentMail API', 'External APIs', 'Webhooks'],
  },
  {
    id: 'events',
    label: 'Events',
    route: 'event route',
    x: 0.18,
    y: 0.35,
    items: ['Schedules', 'Incoming email', 'Telegram', 'Webhooks', 'future n8n events'],
  },
];

const ICONS_FOR_AGENT = {
  Crown:       (p) => <I.Shield {...p}/>,
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

function AgentNetworkCanvas({ snap, selectedId, onSelect, onContextMenu }) {
  const wrapRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 1200, h: 720 });

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const agentZero = React.useMemo(() => getAgentLike(snap, 'agent_zero'), [snap]);
  const hermes = React.useMemo(() => getAgentLike(snap, 'hermes'), [snap]);

  const points = React.useMemo(() => {
    const h = Math.max(size.h, 720);
    const w = Math.max(size.w, 920);
    return {
      owner: { id:'owner', x: w * 0.5, y: 70 },
      gateway: { id:'gateway', x: w * 0.5, y: 300 },
      agentZero: { id:'agent_zero', x: w * 0.28, y: 210 },
      hermes: { id:'hermes', x: w * 0.28, y: 390 },
      clusters: Object.fromEntries(GATEWAY_CLUSTERS.map((cluster) => [
        cluster.id,
        { id: cluster.id, x: w * cluster.x, y: h * cluster.y },
      ])),
    };
  }, [size.w, size.h]);

  const routes = React.useMemo(() => [
    { from: points.owner, to: points.gateway, kind: 'command' },
    { from: points.gateway, to: points.agentZero, kind: 'command' },
    { from: points.gateway, to: points.hermes, kind: 'delegation' },
    { from: points.agentZero, to: points.hermes, kind: 'delegation' },
    ...GATEWAY_CLUSTERS.map((cluster) => ({
      from: points.gateway,
      to: points.clusters[cluster.id],
      kind: cluster.route,
    })),
  ], [points]);

  return (
    <div className="an-canvas-wrap gateway-map-wrap" ref={wrapRef}>
      <svg className="an-edges gateway-routes" viewBox={`0 0 ${Math.max(size.w, 920)} ${Math.max(size.h, 720)}`} preserveAspectRatio="none">
        <defs>
          <marker id="gw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" opacity="0.6"/>
          </marker>
        </defs>
        {routes.map((route, index) => (
          <path
            key={`${route.from.id}-${route.to.id}-${index}`}
            d={routePath(route.from, route.to)}
            className={`gateway-route gateway-route-${route.kind.split(/[ ·-]/)[0]}`}
            data-route={`${route.from.id}.${route.to.id}`}
          />
        ))}
      </svg>

      <GatewayNode
        id="owner"
        label="Owner"
        meta="Luis / Antonio / Creator"
        kind="owner"
        point={points.owner}
      />

      <GatewayNode
        id="gateway"
        label="Gateway"
        meta="control · policy · registry · observability"
        kind="gateway"
        point={points.gateway}
      />

      <GatewayNode
        id="agent_zero"
        label="Agent Zero"
        meta="Commander"
        kind="commander"
        point={points.agentZero}
        selected={selectedId === 'agent_zero'}
        agent={agentZero}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />

      <GatewayNode
        id="hermes"
        label="Hermes"
        meta="Lieutenant · skill/workflow"
        kind="lieutenant"
        point={points.hermes}
        selected={selectedId === 'hermes'}
        agent={hermes}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />

      {GATEWAY_CLUSTERS.map((cluster) => (
        <GatewayCluster
          key={cluster.id}
          cluster={cluster}
          point={points.clusters[cluster.id]}
        />
      ))}
    </div>
  );
}

function GatewayNode({ id, label, meta, kind, point, selected, agent, onSelect, onContextMenu }) {
  const Icon = kind === 'gateway'
    ? I.Plug
    : kind === 'owner'
      ? I.User
      : iconFor(agent?.icon);
  const status = agent?.status || (kind === 'gateway' || kind === 'owner' ? 'online' : 'idle');
  return (
    <button
      type="button"
      className={`gateway-node gateway-node-${kind} ${selected ? 'selected' : ''}`}
      data-id={id}
      data-status={status}
      style={{ left: point.x, top: point.y }}
      onClick={() => agent && onSelect?.(agent.id)}
      onContextMenu={(e) => {
        if (!agent) return;
        e.preventDefault();
        onContextMenu?.(e, agent);
      }}
      title={`${label} · ${meta}`}
    >
      <span className="gateway-node-disc">
        <Icon size={kind === 'gateway' ? 28 : 20}/>
        <span className="an-status-dot" data-status={status} />
      </span>
      <span className="gateway-node-label">{label}</span>
      <span className="gateway-node-meta">{meta}</span>
    </button>
  );
}

function GatewayCluster({ cluster, point }) {
  return (
    <section className={`gateway-cluster gateway-cluster-${cluster.id}`} style={{ left: point.x, top: point.y }}>
      <header className="gateway-cluster-head">
        <span className="gateway-cluster-title">{cluster.label}</span>
        <span className="gateway-cluster-route">{cluster.route}</span>
      </header>
      <div className="gateway-cluster-items">
        {cluster.items.map((item) => (
          <span key={item} className="gateway-cluster-item">{item}</span>
        ))}
      </div>
    </section>
  );
}

function getAgentLike(snap, id) {
  return (snap.agents || []).find((agent) => agent.id === id) || {
    id,
    display_name: id === 'agent_zero' ? 'Agent Zero' : 'Hermes',
    status: id === 'agent_zero' ? 'online' : 'degraded',
    icon: id === 'agent_zero' ? 'ShieldCheck' : 'Sparkles',
  };
}

function routePath(from, to) {
  const dx = Math.abs(to.x - from.x);
  const bend = Math.max(50, Math.min(140, dx * 0.35));
  const c1x = from.x + (to.x >= from.x ? bend : -bend);
  const c2x = to.x - (to.x >= from.x ? bend : -bend);
  return `M ${from.x} ${from.y} C ${c1x} ${from.y} ${c2x} ${to.y} ${to.x} ${to.y}`;
}

Object.assign(window, { AgentNetworkCanvas, TIER_LANES });
