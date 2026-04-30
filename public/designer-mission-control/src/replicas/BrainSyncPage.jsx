// ============================================================
// BrainSyncPage — premium live brain visualization
//
// Design principles (locked per directive):
//   - Dense, small nodes (1-2px cores with soft halos)
//   - Organic oval/football footprint inside the rectangular card
//   - Continuous drift + curl-noise motion (never still)
//   - Particle "traffic" along edges — pulses on events
//   - Category-colored: Tony, Agent Zero, Agents, Memories, Skills,
//     Obsidian, MemPalace, Graphify, External
//   - Visible side legend with live counts
//   - Expand + Pop-out open the SAME live canvas, larger
//
// Production deployment note:
//   The designer visualization is active in production, while protected Brain
//   Sync writes and full backend synchronization remain locked behind future
//   owner-approved schemas/APIs. Live read-only overlays are allowed where
//   existing Mission Control endpoints already provide status.
// ============================================================

// ---------- Category palette (required) ----------
// Tony and Agent 0 are first-class entities with tagline + role. The canvas
// renders them as oversized hubs with persistent labels (see BrainCanvasStage).
// Agent 0 is subordinate to Tony and reserved for the creator/owner's
// special requests — enforced in schema.ROLE_PERMISSIONS['agent_zero.request'].
// Tier drives rendering. "commander" hubs render large with a persistent
// label, ring, and (optionally) a rotating oversight ring. Promoting a new
// agent to commander is therefore a pure data change — add an entry to
// COMMANDERS below (or set tier='commander' on an agent row in the DB) and
// the canvas picks it up. No JSX changes required.
const BRAIN_CATEGORIES = [
  { id:'tony',       name:'Tony',           color:'#6bb3ff', count: 1,       nodes: 1,
    role:'Orchestrator', tagline:'Creator · Owner', special:true, tier:'commander' },
  { id:'agentzero',  name:'Agent 0',        color:'#ff4f8a', count: 1,       nodes: 1,
    role:'Brain Oversight Specialist', tagline:'Owner-only · Subordinate to Tony', special:true, tier:'commander' },
  { id:'meridian',   name:'Meridian',       color:'#ffb547', count: 1,       nodes: 1,
    role:'Integrations Commander', tagline:'Governs FireCrawl · Zapier · n8n · MCP · Skills', special:true, tier:'commander' },
  { id:'agents',     name:'Other agents',   color:'#a16bff', count: 14,      nodes: 14  },
  { id:'memories',   name:'Memories',       color:'#ff9644', count: 87112,   nodes: 280 },
  { id:'skills',     name:'Skills',         color:'#3ddc84', count: 642,     nodes: 120 },
  { id:'obsidian',   name:'Obsidian',       color:'#c084ff', count: 12431,   nodes: 240 },
  { id:'mempalace',  name:'MemPalace',      color:'#ff6a9e', count: 7842,    nodes: 200 },
  { id:'graphify',   name:'Graphify',       color:'#3ec9ff', count: 1180000, nodes: 260 },
  { id:'external',   name:'External sources',color:'#ffd43a',count: 98,      nodes: 80  },
];

// ============================================================
// Live brain graph — builds once per mount, lives inside a canvas
// that fills whatever container wraps it. Exposed via a ref so
// parent components (Expand/Pop-out) can mount the SAME renderer.
// ============================================================

function useBrainGraph({ running = true, densityScale = 1.0 } = {}) {
  // ── BRAIN GRAPH MODE PICKER (Path A · 5 modes · 2026-04-29) ─────────
  // Default = 'original' — production look unchanged.
  // Switch in browser console:
  //   localStorage.setItem('mc.brain.graphMode','original');     location.reload();
  //   localStorage.setItem('mc.brain.graphMode','neural-lite');  location.reload();
  //   localStorage.setItem('mc.brain.graphMode','neural-strong');location.reload();
  //   localStorage.setItem('mc.brain.graphMode','neural-live');  location.reload();
  //   localStorage.setItem('mc.brain.graphMode','neural-clean'); location.reload();
  // Backward compat: legacy 'mc.brain.neuralMotion'='1' maps to 'neural-lite'.
  const NM_MODES = {
    'original': {
      label: 'Original',
      isMotion: false,
      starAlphaMul: 1.0, starColorRgb: '220,228,255',
      hubWobble: 0,
      sectorPull: 0, repulsionMinDist: 0, repulsionPush: 0, bulkBudget: 0,
      edgeCurveFactor: 0, edgeCurveMaxPx: 0,
      pulseRate: 0, pulseCap: 0, pulseSpeedBoost: 1.0,
      showLabel: false, labelText: '',
    },
    'neural-lite': {
      label: 'Neural Lite',
      isMotion: true,
      starAlphaMul: 0.30, starColorRgb: '120,150,200',
      hubWobble: 0.005,
      sectorPull: 0.0005, repulsionMinDist: 0.012, repulsionPush: 0.00015, bulkBudget: 80,
      edgeCurveFactor: 0.12, edgeCurveMaxPx: 24,
      pulseRate: 0.50, pulseCap: 30, pulseSpeedBoost: 1.0,
      showLabel: true,
      labelText: 'NEURAL LITE (visual): synaptic motion is illustrative; live signal is read-only counters + pulse beats.',
    },
    'neural-strong': {
      label: 'Neural Strong',
      isMotion: true,
      starAlphaMul: 0.15, starColorRgb: '140,170,210',
      hubWobble: 0.012,
      sectorPull: 0.0015, repulsionMinDist: 0.025, repulsionPush: 0.0006, bulkBudget: 80,
      edgeCurveFactor: 0.22, edgeCurveMaxPx: 48,
      pulseRate: 0.25, pulseCap: 60, pulseSpeedBoost: 1.0,
      showLabel: true,
      labelText: 'NEURAL STRONG (visual): pronounced synaptic motion; live signal is read-only counters + pulse beats.',
    },
    'neural-live': {
      label: 'Neural Live Traffic',
      isMotion: true,
      starAlphaMul: 0.20, starColorRgb: '120,150,200',
      hubWobble: 0.005,
      sectorPull: 0.0008, repulsionMinDist: 0.018, repulsionPush: 0.0003, bulkBudget: 80,
      edgeCurveFactor: 0.18, edgeCurveMaxPx: 36,
      pulseRate: 0.12, pulseCap: 90, pulseSpeedBoost: 1.6,
      showLabel: true,
      labelText: 'NEURAL LIVE TRAFFIC (visual): pulse stream is illustrative; live signal is read-only counters + speak beats.',
    },
    'neural-clean': {
      label: 'Neural Clean',
      isMotion: true,
      starAlphaMul: 0.0, starColorRgb: '0,0,0',
      hubWobble: 0.003,
      sectorPull: 0.0012, repulsionMinDist: 0.022, repulsionPush: 0.0005, bulkBudget: 60,
      edgeCurveFactor: 0.10, edgeCurveMaxPx: 20,
      pulseRate: 0.80, pulseCap: 20, pulseSpeedBoost: 1.0,
      showLabel: true,
      labelText: 'NEURAL CLEAN (visual): minimal decoration, sector-anchored. Live signal is read-only counters.',
    },
  };
  const NM_MODE_KEY = (() => {
    if (typeof window === 'undefined') return 'original';
    if (window.__brainGraphMode && NM_MODES[window.__brainGraphMode]) return window.__brainGraphMode;
    if (window.__brainNeuralMotion === true) return 'neural-lite';
    try {
      const ls = window.localStorage;
      if (ls) {
        const m = ls.getItem('mc.brain.graphMode');
        if (m && NM_MODES[m]) return m;
        const legacy = ls.getItem('mc.brain.neuralMotion');
        if (legacy === '1' || legacy === 'true') return 'neural-lite';
      }
    } catch { /* ignore */ }
    // Owner-approved default 2026-04-30: 'neural-strong' (chosen after
    // testing all 5 modes). Owner can flip back to 'original' via the
    // gear settings or localStorage.removeItem('mc.brain.graphMode').
    return 'neural-strong';
  })();
  const NM = NM_MODES[NM_MODE_KEY] || NM_MODES['original'];
  // Convenience boolean kept so older conditional blocks read cleanly.
  const NEURAL_MOTION = NM.isMotion;
  // Sector centroids — used by ALL non-original modes.
  const NM_SECTOR_CENTROIDS = {
    tony:        { cx: 0.50, cy: 0.50 },
    'agent zero':{ cx: 0.50, cy: 0.32 },
    agents:      { cx: 0.30, cy: 0.45 },
    memories:    { cx: 0.72, cy: 0.45 },
    skills:      { cx: 0.25, cy: 0.70 },
    obsidian:    { cx: 0.40, cy: 0.78 },
    mempalace:   { cx: 0.62, cy: 0.78 },
    graphify:    { cx: 0.78, cy: 0.65 },
    external:    { cx: 0.85, cy: 0.30 },
  };
  // Returns ref to attach to a <canvas>, plus a pulseAt(x,y,color) method.
  const canvasRef = React.useRef(null);
  const graphRef = React.useRef(null);
  const rafRef = React.useRef(0);

  // Build graph ONCE per hook instance
  if (!graphRef.current) {
    const nodes = [];
    const edges = [];
    let idx = 0;

    // Organic oval footprint (football shape), centered at (0.5, 0.5)
    // Aspect ratio: 1.6 wide : 0.9 tall
    const aspectX = 1.6, aspectY = 0.9;

    // Special "hub" nodes for Tony + Agent 0. Tony is the primary orchestrator
    // (larger, warm blue) and Agent 0 is the brain-oversight specialist
    // (slightly smaller, pink, with a persistent ring + always-on label so
    // it's never mistaken for a regular agent node).
    // Hubs are the tier='commander' agents. Adding another commander = one
    // more row here, and a (x,y,r) layout slot. The render path below is
    // entirely driven by `isHub` + `commanderId` — no commander-specific
    // branches except optional flags (oversight ring, governs-list, etc.).
    // Hierarchy:
    //   Tony is the center of the universe — biggest, fixed at exact center.
    //   Agent 0 and Meridian are subordinate commanders — smaller, equal to
    //   each other, and continuously orbit Tony on a slow elliptical path
    //   (opposite phases so they never overlap). Their integration nodes
    //   travel with them.
    const TONY_CX = 0.50, TONY_CY = 0.50;
    const COMMANDER_ORBIT_RX = 0.16;
    const COMMANDER_ORBIT_RY = 0.13;
    const COMMANDER_ORBIT_PERIOD = 60; // seconds for a full lap — calm, not dizzying
    const hubs = [
      { cat: BRAIN_CATEGORIES[0], x: TONY_CX, y: TONY_CY, r: 6.5, isHub: true, label:'TONY',     commanderId:'tony' },
      { cat: BRAIN_CATEGORIES[1], x: TONY_CX, y: TONY_CY - COMMANDER_ORBIT_RY, r: 4.5, isHub: true, label:'AGENT 0',  commanderId:'agentzero', oversight: true,
        orbitsTony: true, orbitPhase: 0,           orbitDir: 1 },
      { cat: BRAIN_CATEGORIES[2], x: TONY_CX, y: TONY_CY + COMMANDER_ORBIT_RY, r: 4.5, isHub: true, label:'MERIDIAN', commanderId:'meridian',  governs: ['firecrawl','zapier','n8n','mcp'],
        orbitsTony: true, orbitPhase: Math.PI,     orbitDir: 1 },
    ];
    const HUB_TONY_INDEX = 0;
    const HUB_A0_INDEX = 1;
    const HUB_MERIDIAN_INDEX = 2;

    // Place hubs
    for (const h of hubs) {
      nodes.push({
        id: idx++, x: h.x, y: h.y,
        vx: 0, vy: 0,
        r: h.r,
        color: h.cat.color,
        cat: h.cat.id,
        isHub: true,
        commanderId: h.commanderId,
        label: h.label,
        oversight: !!h.oversight,
        governs: h.governs || null,
        bright: 1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // ─── Integration nodes (Meridian's domain) ─────────────────
    // These are real entities — each one corresponds to a wired-up
    // integration in patch-v2 (see /api/integrations/{firecrawl,zapier,n8n,mcp}).
    // They render as small named nodes around Meridian, with edges to
    // Meridian so the canvas reflects the actual governance link, and
    // are tagged so traffic particles light them up on real events.
    const INTEGRATION_NODES = [
      { id:'firecrawl', label:'FIRECRAWL', color:'#ff8a3d', dx: +0.055, dy: -0.025 },
      { id:'zapier',    label:'ZAPIER',    color:'#ff5a5f', dx: +0.060, dy: +0.030 },
      { id:'n8n',       label:'n8n',       color:'#ea4b71', dx: +0.025, dy: +0.060 },
      { id:'mcp',       label:'MCP',       color:'#7dd3fc', dx: -0.030, dy: +0.055 },
    ];
    const meridianHub = hubs[2];
    const integrationNodeIds = {};
    for (const ig of INTEGRATION_NODES) {
      const nid = idx++;
      integrationNodeIds[ig.id] = nid;
      nodes.push({
        id: nid,
        x: meridianHub.x + ig.dx,
        y: meridianHub.y + ig.dy,
        vx: 0, vy: 0,
        r: 1.8,
        color: ig.color,
        cat: 'integration',
        integrationId: ig.id,
        isHub: false,
        isIntegration: true,
        parentHubId: HUB_MERIDIAN_INDEX,
        parentDx: ig.dx,
        parentDy: ig.dy,
        label: ig.label,
        bright: 0.9,
        phase: Math.random() * Math.PI * 2,
        speakPeriod: 11 + Math.random() * 4,
        speakPhase:  Math.random() * 9,
      });
      // Solid edge Meridian → integration (governance is direct, not dashed)
      edges.push({ a: HUB_MERIDIAN_INDEX, b: nid, op: 0.32, governance: true });
    }
    // Tony coordinates with Meridian (commander-to-commander link, brighter)
    edges.push({ a: HUB_TONY_INDEX, b: HUB_MERIDIAN_INDEX, op: 0.40, commanderLink: true });
    // Agent 0 oversees Meridian as part of brain-hygiene (dashed, faint)
    edges.push({ a: HUB_A0_INDEX,   b: HUB_MERIDIAN_INDEX, op: 0.18, support: true });

    // ─── Support-agent constellation ──────────────────────────
    // Per design rule: Tony + Agent 0 stay as the two dominant brains.
    // Every other agent in the system shows up here as a *very small*
    // satellite — a tiny nucleus on a slow elliptical orbit between the
    // two hubs, with faint links back to BOTH (it's a governance/support
    // layer, not its own primary). Names match the seeded agent_runtime
    // rows so the universe matches the real system 1:1. Renaming an
    // agent in the backend never changes node identity — only the label.
    //
    // Visual budget (locked):
    //   • core ~1.4px (≈ 22% of Tony's size)
    //   • halo small (×3 of core, vs ×11 for hubs)
    //   • label only visible during a "speak" pulse beat (every 8–14s
    //     per agent, staggered) — keeps the map clean at idle.
    //   • two faint dashed connectors per satellite (one to each hub),
    //     opacity ≈ 0.12 — visibly part of the universe, never loud.
    const SUPPORT_AGENTS = [
      { id:'atlas',     label:'ATLAS',    color:'#7dd3fc' },  // research
      { id:'orion',     label:'ORION',    color:'#a78bfa' },  // inbox
      { id:'lyra',      label:'LYRA',     color:'#fcd34d' },  // meetings
      { id:'research',  label:'RESEARCH', color:'#86efac' },  // research-2
      { id:'scribe',    label:'SCRIBE',   color:'#f9a8d4' },  // (placeholder for future)
      { id:'concierge', label:'CONCIERGE',color:'#fdba74' },  // (placeholder for future)
    ];
    // Satellites encircle the *pair* of hubs as a single grouped constellation,
    // sitting on a wider, shallower ellipse that wraps around both. They never
    // cross the centerline between Tony and Agent 0 — that empty spine stays
    // reserved for the two cores so the eye reads them as the dominant pair.
    const orbitCx = (hubs[0].x + hubs[1].x) / 2;
    const orbitCy = (hubs[0].y + hubs[1].y) / 2;
    const orbitRx = 0.36;  // wide — wraps Tony + commander orbit with breathing room
    const orbitRy = 0.26;  // taller — keeps support agents clear of the commander ring
    SUPPORT_AGENTS.forEach((a, i) => {
      // Bias initial phases AWAY from the horizontal axis (the hub spine) so
      // satellites sit in the upper/lower arcs, not directly between the cores.
      // We sample evenly around the circle then pull each phase 25% toward the
      // nearest vertical pole (π/2 or 3π/2). End result: a soft ring that
      // arcs over and under the two hubs.
      const evenPhase = (i / SUPPORT_AGENTS.length) * Math.PI * 2;
      const nearestPole = Math.sin(evenPhase) >= 0 ? Math.PI/2 : -Math.PI/2;
      const phase0 = evenPhase + (nearestPole - evenPhase) * 0.25;
      const x = orbitCx + Math.cos(phase0) * orbitRx;
      const y = orbitCy + Math.sin(phase0) * orbitRy;
      nodes.push({
        id: idx++,
        x, y, vx: 0, vy: 0,
        r: 1.4,
        color: a.color,
        cat: 'support_agent',
        isHub: false,
        isSupportAgent: true,
        agentId: a.id,
        label: a.label,
        bright: 0.85,
        phase: Math.random() * Math.PI * 2,
        // Orbit params (consumed in the animation loop below)
        orbitCx, orbitCy, orbitRx, orbitRy,
        orbitPhase: phase0,
        // Period in seconds — slow + slightly randomized so the cluster
        // doesn't lockstep around the two hubs.
        orbitPeriod: 90 + i * 7 + Math.random() * 6,
        orbitDir: i % 2 === 0 ? 1 : -1,
        // Each agent has its own "speak" beat — every 9–14s a brief
        // brighten + label flash. Phases are offset so they don't pop
        // simultaneously.
        speakPeriod: 9 + Math.random() * 5,
        speakPhase:  Math.random() * 9,
        // Cache hub indices so the renderer can draw the two faint
        // governance connectors without re-searching every frame.
        linkTonyId: HUB_TONY_INDEX,
        linkA0Id:   HUB_A0_INDEX,
      });
    });
    // Edges from each satellite → both hubs. Stored on the edges array
    // so they participate in normal traffic-particle routing too —
    // Tony pinging a satellite, or Agent 0 acknowledging one, are
    // first-class system events and visible as glints when they happen.
    const supportNodeIds = nodes.filter(n => n.isSupportAgent).map(n => n.id);
    for (const sid of supportNodeIds) {
      edges.push({ a: HUB_TONY_INDEX, b: sid, op: 0.10, support: true });
      edges.push({ a: HUB_A0_INDEX,   b: sid, op: 0.09, support: true });
    }

    // Other categories - distributed in organic clusters INSIDE the oval
    const otherCats = BRAIN_CATEGORIES.slice(2);
    // each cat gets a cluster center somewhere in the oval, non-overlapping-ish
    const clusterSeeds = [
      { x: 0.22, y: 0.38 }, // memories
      { x: 0.24, y: 0.68 }, // skills
      { x: 0.40, y: 0.25 }, // obsidian
      { x: 0.60, y: 0.75 }, // mempalace
      { x: 0.78, y: 0.35 }, // graphify
      { x: 0.78, y: 0.65 }, // external
      { x: 0.50, y: 0.20 }, // agents (on top)
    ];
    // Agents cluster placed separately
    const agentsSeed = clusterSeeds[6];
    const agentsCat = BRAIN_CATEGORIES[2];

    // Place agents cluster (small, close to the hubs)
    for (let i = 0; i < agentsCat.nodes; i++) {
      const theta = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 1.5) * 0.06;
      const x = agentsSeed.x + Math.cos(theta) * rad * aspectX;
      const y = agentsSeed.y + Math.sin(theta) * rad * aspectY;
      nodes.push({
        id: idx++, x, y,
        vx: (Math.random()-0.5)*0.00005, vy: (Math.random()-0.5)*0.00005,
        r: 1.2 + Math.random()*0.8,
        color: agentsCat.color,
        cat: agentsCat.id,
        bright: 0.6 + Math.random()*0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Place other categories
    for (let c = 0; c < otherCats.length - 1; c++) { // exclude agents (already placed)
      const cat = otherCats[c];
      const seed = clusterSeeds[c];
      const count = Math.round(cat.nodes * densityScale);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 1.5) * 0.14;
        // Jitter to make sub-clusters feel organic
        const subX = Math.cos(theta) * rad * aspectX;
        const subY = Math.sin(theta) * rad * aspectY;
        let x = seed.x + subX;
        let y = seed.y + subY;
        // Clamp inside the oval footprint
        const ox = (x - 0.5) / 0.48;
        const oy = (y - 0.5) / 0.42;
        const rOval = Math.sqrt(ox*ox + oy*oy);
        if (rOval > 1) {
          x = 0.5 + (ox/rOval) * 0.48;
          y = 0.5 + (oy/rOval) * 0.42;
        }
        nodes.push({
          id: idx++, x, y,
          vx: (Math.random()-0.5)*0.00008, vy: (Math.random()-0.5)*0.00008,
          r: 0.7 + Math.random()*1.3,
          color: cat.color,
          cat: cat.id,
          bright: 0.5 + Math.random()*0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Edges:
    //   - Hub edges: Tony & Agent Zero each connect to ~120 nodes (dense fan)
    //   - Intra-category: each non-hub connects to 2-3 same-category neighbors
    //   - Cross-category: ~8% of nodes have a bridge to another category
    const nonHubs = nodes.filter(n => !n.isHub);
    for (const hub of nodes.filter(n => n.isHub)) {
      // Connect hub to nearest 140 non-hub nodes (spatial, not color)
      const dists = nonHubs
        .map(n => ({ n, d: Math.hypot(n.x - hub.x, n.y - hub.y) }))
        .sort((a,b) => a.d - b.d)
        .slice(0, 140);
      for (const {n} of dists) {
        edges.push({ a: hub.id, b: n.id, op: 0.14 + Math.random()*0.1, hub: true });
      }
    }
    // Intra-category edges - each non-hub gets 2-3 neighbors in same cat
    const byCat = {};
    for (const n of nonHubs) {
      if (!byCat[n.cat]) byCat[n.cat] = [];
      byCat[n.cat].push(n);
    }
    for (const n of nonHubs) {
      const pool = byCat[n.cat];
      const k = 2 + Math.floor(Math.random()*2);
      for (let i=0;i<k;i++){
        const t = pool[Math.floor(Math.random()*pool.length)];
        if (t && t.id !== n.id) edges.push({ a: n.id, b: t.id, op: 0.06 + Math.random()*0.12 });
      }
      if (Math.random() < 0.08) {
        const t = nonHubs[Math.floor(Math.random()*nonHubs.length)];
        if (t.cat !== n.cat) edges.push({ a: n.id, b: t.id, op: 0.03 + Math.random()*0.05, cross: true });
      }
    }

    // ─── Cosmic starfield backdrop ─────────────────────────────
    // Hundreds of dim points that drift slowly in the background. They are
    // pure decoration (no edges, no events, never participate in particle
    // routing) — their job is to sell the "living universe" feeling without
    // adding any visual weight that could rival Tony / Agent 0. Three depth
    // layers (far / mid / near) for parallax. Generated once per mount.
    const stars = [];
    const STAR_COUNT = 320;
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer = i < STAR_COUNT * 0.55 ? 0      // far — smallest, dimmest
                  : i < STAR_COUNT * 0.85 ? 1      // mid
                  : 2;                              // near — slightly brighter
      stars.push({
        x: Math.random(),
        y: Math.random(),
        layer,
        r: layer === 0 ? 0.4 + Math.random()*0.3
         : layer === 1 ? 0.6 + Math.random()*0.4
         :               0.9 + Math.random()*0.5,
        baseAlpha: layer === 0 ? 0.18 + Math.random()*0.12
                 : layer === 1 ? 0.28 + Math.random()*0.14
                 :                0.40 + Math.random()*0.18,
        // Parallax drift speed — far stars move slower, near stars faster.
        // Direction is mostly horizontal with tiny vertical wobble; reads as
        // a slow rotation of the whole intelligence field.
        vx: (layer === 0 ? 0.0010 : layer === 1 ? 0.0018 : 0.0028) * (Math.random() < 0.5 ? -1 : 1),
        vy: (Math.random() - 0.5) * 0.0006,
        // Twinkle — only ~25% of stars twinkle, and slowly. Most just sit.
        twinkle: Math.random() < 0.25,
        twinklePhase: Math.random() * Math.PI * 2,
        twinklePeriod: 4 + Math.random() * 6,
      });
    }

    graphRef.current = {
      nodes,
      edges,
      stars,
      particles: [],   // traffic packets in flight
      pulses: [],      // node event rings
      // Hover state — set by a pointermove listener on the canvas. Kept on
      // the graph object (not React state) so the animation loop reads it
      // every frame without triggering re-renders. Only support agents and
      // hubs are hoverable; bulk category nodes stay anonymous by design.
      hoverNodeId: null,
      t0: performance.now(),
      lastSpawn: 0,
    };
  }

  // Spawn a particle on a random edge at event rate
  const spawnTraffic = React.useCallback((count = 1) => {
    const g = graphRef.current; if (!g) return;
    for (let k = 0; k < count; k++) {
      const edge = g.edges[Math.floor(Math.random() * g.edges.length)];
      if (!edge) continue;
      g.particles.push({
        edge, t: 0,
        speed: 0.25 + Math.random() * 0.4,  // progress per second
        color: g.nodes[edge.a].color,
      });
    }
  }, []);

  // Activity pulse at a node (used by external events)
  const pulseAt = React.useCallback((catId) => {
    const g = graphRef.current; if (!g) return;
    const pool = g.nodes.filter(n => n.cat === catId);
    if (!pool.length) return;
    const n = pool[Math.floor(Math.random()*pool.length)];
    g.pulses.push({ x: n.x, y: n.y, color: n.color, r: 0, life: 0 });
  }, []);

  // Animation loop
  React.useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stopped = false;
    let rafId = 0;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.__dpr = dpr;
      canvas.__w = rect.width;
      canvas.__h = rect.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    // ─── Pointer hover → satellite/hub label tooltip ───────────────────────────
    // Cheap hit-test: only checks hubs + support agents (≤8 nodes typically),
    // never the bulk constellation. The hover id is read each frame inside
    // the loop and rendered as a small tooltip; React state is untouched so
    // we don't trigger a re-render on every mouse move.
    const onPointerMove = (ev) => {
      const g = graphRef.current; if (!g) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      let best = null;
      let bestD = Infinity;
      for (const n of g.nodes) {
        if (!n.isHub && !n.isSupportAgent) continue;
        const px = n.x * w, py = n.y * h;
        const d = Math.hypot(mx - px, my - py);
        // Hubs use a generous radius; satellites a tighter one. Both stay
        // small enough that hovering over the bulk field never accidentally
        // labels a hub.
        const hit = n.isHub ? 22 : 12;
        if (d < hit && d < bestD) { bestD = d; best = n; }
      }
      g.hoverNodeId = best ? best.id : null;
      canvas.style.cursor = best ? 'pointer' : '';
    };
    const onPointerLeave = () => {
      const g = graphRef.current; if (!g) return;
      g.hoverNodeId = null;
      canvas.style.cursor = '';
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    window.__brainTickStarted = (window.__brainTickStarted||0)+1;
    let last = performance.now();
    let frameCount = 0;
    const tick = (now) => {
      if (stopped) return;
      frameCount++;
      window.__brainTickFrames = (window.__brainTickFrames||0)+1;
      const g = graphRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = canvas.__w || canvas.clientWidth;
      const h = canvas.__h || canvas.clientHeight;
      const t = (now - g.t0) / 1000;

      // Background: dark radial trail (semi-opaque so motion leaves faint trails)
      ctx.fillStyle = 'rgba(8, 11, 22, 0.3)';
      ctx.fillRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.55);
      bg.addColorStop(0, 'rgba(20, 30, 60, 0.08)');
      bg.addColorStop(1, 'rgba(6, 9, 22, 0)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // ─── Starfield (drawn before edges/nodes so everything else floats above) ───
      // Update positions, wrap at edges, render with twinkle. We don't ever
      // let a star be loud enough to compete with hubs/satellites — the cap
      // is hard-coded by baseAlpha.
      for (const s of g.stars) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < -0.02) s.x = 1.02; else if (s.x > 1.02) s.x = -0.02;
        if (s.y < -0.02) s.y = 1.02; else if (s.y > 1.02) s.y = -0.02;
        let a = s.baseAlpha;
        if (s.twinkle) {
          const u = ((t + s.twinklePhase) % s.twinklePeriod) / s.twinklePeriod;
          // Smooth peak around the middle of the cycle
          a = s.baseAlpha * (0.6 + 0.4 * Math.sin(u * Math.PI * 2));
        }
        const _nmA = a * NM.starAlphaMul;
        ctx.fillStyle = NEURAL_MOTION
          ? `rgba(${NM.starColorRgb},${_nmA.toFixed(3)})`
          : `rgba(220,228,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI*2);
        ctx.fill();
      }

      // Drift + curl noise (cheap)
      for (const n of g.nodes) {
        if (n.isHub) {
          // Tony stays fixed dead-center. Agent 0 and Meridian orbit Tony
          // closely and energetically — tight radius (~20 units in screen
          // space at the default canvas size) and a fast 12-second lap so
          // the motion reads as constant urgent activity, not drift.
          if (n.orbitsTony) {
            // Wide orbit so commanders never crowd Tony, each other, or the
            // support-agent ring. Agent 0 and Meridian sit on opposite
            // sides of Tony at all times (180° phase). Radius is tuned so
            // the commander hubs + their satellite tools never touch Tony
            // and never reach the outer support orbit.
            const orbitT = (t / 14) * Math.PI * 2 * n.orbitDir + n.orbitPhase;
            const _baseNx = 0.50 + Math.cos(orbitT) * 0.20;
            const _baseNy = 0.50 + Math.sin(orbitT) * 0.15;
            if (NEURAL_MOTION && NM.hubWobble > 0) {
              // Synaptic wobble — keeps hubs from feeling like
              // perfectly orbital satellites. Amplitude per mode.
              n.x = _baseNx + NM.hubWobble * Math.sin(t * 0.4 + n.phase);
              n.y = _baseNy + NM.hubWobble * Math.cos(t * 0.7 + n.phase);
            } else {
              n.x = _baseNx;
              n.y = _baseNy;
            }
          }
          continue;
        }
        // Integration nodes (FireCrawl/Zapier/n8n/MCP) travel with Meridian —
        // they're Meridian's satellites, computed every frame relative to
        // Meridian's CURRENT position so the cluster moves as a unit.
        if (n.isIntegration) {
          const meridian = g.nodes[n.parentHubId];
          n.x = meridian.x + n.parentDx;
          n.y = meridian.y + n.parentDy;
          continue;
        }
        // Support agents follow a deterministic slow orbit between the
        // two hubs — not curl noise, so the constellation feels intentional
        // rather than random. They also keep a tiny radial "breathing"
        // wobble so they don't look frozen at idle.
        if (n.isSupportAgent) {
          const orbitT = (t / n.orbitPeriod) * Math.PI * 2 * n.orbitDir + n.orbitPhase;
          const breathe = 1 + 0.04 * Math.sin(t * 0.6 + n.phase);
          n.x = n.orbitCx + Math.cos(orbitT) * n.orbitRx * breathe;
          n.y = n.orbitCy + Math.sin(orbitT) * n.orbitRy * breathe;
          // No velocity — orbit is positional. Reset so the bound clamp
          // below doesn't accidentally bounce them off the oval edge.
          n.vx = 0; n.vy = 0;
          continue;
        }
        // Curl-ish drift
        const a = Math.sin(n.x*12 + t*0.15) + Math.cos(n.y*10 - t*0.12);
        n.vx += Math.cos(a*2.2) * 0.0000025;
        n.vy += Math.sin(a*2.2) * 0.0000025;
        // Attractor towards initial cluster center (gentle)
        n.vx *= 0.99; n.vy *= 0.99;
        n.x += n.vx; n.y += n.vy;

        // Reflect inside oval bound
        const ox = (n.x - 0.5) / 0.48;
        const oy = (n.y - 0.5) / 0.42;
        const rOval = Math.sqrt(ox*ox + oy*oy);
        if (rOval > 1) {
          const f = 1 / rOval;
          n.x = 0.5 + ox * f * 0.48;
          n.y = 0.5 + oy * f * 0.42;
          n.vx *= -0.3; n.vy *= -0.3;
        }
      }

      // ── NEURAL MOTION: sector anchoring + bulk repulsion ──────────
      // Strength per active mode. Bounded by NM.bulkBudget so even
      // dense networks stay O(N^2) at N <= 80.
      if (NEURAL_MOTION && NM.bulkBudget > 0) {
        const _bulk = [];
        for (const n of g.nodes) {
          if (n.isHub || n.isSupportAgent || n.isIntegration) continue;
          _bulk.push(n);
          if (_bulk.length >= NM.bulkBudget) break;
        }
        if (NM.sectorPull > 0) {
          for (const n of _bulk) {
            const c = NM_SECTOR_CENTROIDS[n.cat];
            if (c) {
              n.vx += (c.cx - n.x) * NM.sectorPull;
              n.vy += (c.cy - n.y) * NM.sectorPull;
            }
          }
        }
        if (NM.repulsionMinDist > 0 && NM.repulsionPush > 0) {
          for (let i = 0; i < _bulk.length; i++) {
            const a = _bulk[i];
            for (let j = i + 1; j < _bulk.length; j++) {
              const b = _bulk[j];
              const dx = b.x - a.x, dy = b.y - a.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < NM.repulsionMinDist && d > 0.0001) {
                const f = (NM.repulsionMinDist - d) / d;
                a.vx -= dx * f * NM.repulsionPush;
                a.vy -= dy * f * NM.repulsionPush;
                b.vx += dx * f * NM.repulsionPush;
                b.vy += dy * f * NM.repulsionPush;
              }
            }
          }
        }
        // Re-clamp into the oval after repulsion
        for (const n of _bulk) {
          n.x += n.vx; n.y += n.vy;
          n.vx *= 0.99; n.vy *= 0.99;
          const ox = (n.x - 0.5) / 0.48;
          const oy = (n.y - 0.5) / 0.42;
          const rOval = Math.sqrt(ox * ox + oy * oy);
          if (rOval > 1) {
            const f = 1 / rOval;
            n.x = 0.5 + ox * f * 0.48;
            n.y = 0.5 + oy * f * 0.42;
          }
        }
      }

      // Edges - render first (behind nodes)
      ctx.lineWidth = 0.6;
      for (let i = 0; i < g.edges.length; i++) {
        const e = g.edges[i];
        const A = g.nodes[e.a], B = g.nodes[e.b];
        // Support-agent governance connectors (Tony↔satellite,
        // AgentZero↔satellite) get a softer dashed treatment so they
        // read as "supporting / governance link" rather than data flow.
        if (e.support) {
          ctx.save();
          ctx.setLineDash([1.5, 4]);
          ctx.lineWidth = 0.5;
          // Subtle breathing opacity, modulated by the satellite's own
          // speak phase so the link brightens with the agent.
          const sat = B; // by construction edge.a is the hub
          const speakT = ((t + sat.speakPhase) % sat.speakPeriod) / sat.speakPeriod;
          const speakBoost = speakT < 0.18
            ? Math.sin(speakT / 0.18 * Math.PI) * 0.5
            : 0;
          const op = e.op + speakBoost * 0.25;
          ctx.strokeStyle = hexWithAlpha(B.color, op);
          ctx.beginPath();
          ctx.moveTo(A.x * w, A.y * h);
          ctx.lineTo(B.x * w, B.y * h);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        const op = e.op * (e.hub ? 0.9 : (0.7 + 0.3 * Math.sin(t + i)));
        ctx.strokeStyle = hexWithAlpha(A.color, op);
        ctx.beginPath();
        const _ax = A.x * w, _ay = A.y * h;
        const _bx = B.x * w, _by = B.y * h;
        if (NEURAL_MOTION && NM.edgeCurveFactor > 0) {
          // Synapse-like bezier. Sign of perpendicular offset is
          // deterministic from edge index so curves don't all bend
          // the same way. Curvature per mode.
          const _dx = _bx - _ax, _dy = _by - _ay;
          const _len = Math.sqrt(_dx * _dx + _dy * _dy);
          const _sign = (i % 2) ? 1 : -1;
          const _off = _sign * Math.min(_len * NM.edgeCurveFactor, NM.edgeCurveMaxPx);
          const _mx = (_ax + _bx) / 2 + (-_dy / (_len || 1)) * _off;
          const _my = (_ay + _by) / 2 + (_dx / (_len || 1)) * _off;
          ctx.moveTo(_ax, _ay);
          ctx.quadraticCurveTo(_mx, _my, _bx, _by);
        } else {
          ctx.moveTo(_ax, _ay);
          ctx.lineTo(_bx, _by);
        }
        ctx.stroke();
      }

      // Nodes with halos
      for (const n of g.nodes) {
        const px = n.x * w, py = n.y * h;
        // Support-agent: small nucleus, low halo, "speak" beat brightens
        // it briefly + flashes its label. Renders inline so we keep one
        // pass over g.nodes and avoid extra branching for the common case.
        if (n.isSupportAgent) {
          // Speak beat: rises 0→1 over the first 18% of speakPeriod, then
          // decays. Outside that window it's silent (still alive — the
          // core remains visible at base brightness).
          const speakT = ((t + n.speakPhase) % n.speakPeriod) / n.speakPeriod;
          const speakBoost = speakT < 0.18
            ? Math.sin(speakT / 0.18 * Math.PI)
            : 0;
          const breathe = 0.85 + 0.15 * Math.sin(t * 1.2 + n.phase);
          const bright = (n.bright * breathe) + speakBoost * 0.6;

          // Halo (compact — ×3 vs ×11 for hubs)
          const haloR = n.r * 3;
          const grd = ctx.createRadialGradient(px, py, 0, px, py, haloR);
          grd.addColorStop(0, hexWithAlpha(n.color, Math.min(0.6, 0.35 * bright + speakBoost * 0.25)));
          grd.addColorStop(1, hexWithAlpha(n.color, 0));
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(px, py, haloR, 0, Math.PI*2); ctx.fill();

          // Core (white center on speak, color otherwise — tiny, never loud)
          ctx.fillStyle = speakBoost > 0.6
            ? '#ffffff'
            : hexWithAlpha(n.color, 0.85);
          ctx.beginPath(); ctx.arc(px, py, n.r, 0, Math.PI*2); ctx.fill();

          // Label only on speak peak — keeps idle map clean per design rule.
          if (speakBoost > 0.55) {
            ctx.font = '500 8px -apple-system, Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            const labelY = py - n.r - 6;
            const labelW = ctx.measureText(n.label).width + 6;
            ctx.fillStyle = hexWithAlpha('#0a0f1f', 0.7 * speakBoost);
            ctx.fillRect(px - labelW/2, labelY - 7, labelW, 9);
            ctx.fillStyle = hexWithAlpha(n.color, Math.min(1, 0.55 + speakBoost * 0.45));
            ctx.fillText(n.label, px, labelY);
          }
          continue;
        }

        // Integration nodes (FireCrawl, Zapier, n8n, MCP) — Meridian's domain.
        // Always-on label so the user can see exactly what's wired in.
        if (n.isIntegration) {
          const speakT = ((t + n.speakPhase) % n.speakPeriod) / n.speakPeriod;
          const speakBoost = speakT < 0.22 ? Math.sin(speakT / 0.22 * Math.PI) : 0;
          const breathe = 0.85 + 0.15 * Math.sin(t * 1.0 + n.phase);
          const haloR = n.r * 5;
          const grd2 = ctx.createRadialGradient(px, py, 0, px, py, haloR);
          grd2.addColorStop(0, hexWithAlpha(n.color, Math.min(0.7, 0.40 * breathe + speakBoost * 0.30)));
          grd2.addColorStop(1, hexWithAlpha(n.color, 0));
          ctx.fillStyle = grd2;
          ctx.beginPath(); ctx.arc(px, py, haloR, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = speakBoost > 0.6 ? '#ffffff' : n.color;
          ctx.beginPath(); ctx.arc(px, py, n.r, 0, Math.PI*2); ctx.fill();
          ctx.font = '600 8.5px -apple-system, Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          const labelY = py - n.r - 8;
          const labelW = ctx.measureText(n.label).width + 8;
          ctx.fillStyle = 'rgba(8, 11, 22, 0.78)';
          ctx.fillRect(px - labelW/2, labelY - 7, labelW, 10);
          ctx.fillStyle = hexWithAlpha(n.color, 0.95);
          ctx.fillText(n.label, px, labelY + 1);
          continue;
        }

        const pulse = 0.85 + 0.15 * Math.sin(t*2 + n.phase);
        const radius = n.r;
        const haloR = radius * (n.isHub ? 11 : 5);
        const grd = ctx.createRadialGradient(px, py, 0, px, py, haloR);
        grd.addColorStop(0, hexWithAlpha(n.color, (n.isHub?0.95:0.55) * n.bright * pulse));
        grd.addColorStop(1, hexWithAlpha(n.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py, haloR, 0, Math.PI*2); ctx.fill();
        // Core
        ctx.fillStyle = n.isHub ? '#ffffff' : n.color;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI*2); ctx.fill();
        if (n.isHub) {
          // Outer ring
          ctx.strokeStyle = n.color; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(px, py, radius+4, 0, Math.PI*2); ctx.stroke();
          // Agent 0 gets a second, rotating "oversight" ring so it's
          // unmistakably a different kind of entity from Tony.
          if (n.oversight) {
            const rr = radius + 10 + Math.sin(t*1.6 + n.phase) * 1.2;
            ctx.strokeStyle = hexWithAlpha(n.color, 0.55);
            ctx.lineWidth = 0.9;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
          }
          // Persistent label above the hub
          ctx.font = '600 10px -apple-system, Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          const labelY = py - radius - 14;
          // Label background chip for legibility
          const labelW = ctx.measureText(n.label).width + 10;
          ctx.fillStyle = 'rgba(8, 11, 22, 0.75)';
          ctx.fillRect(px - labelW/2, labelY - 8, labelW, 12);
          ctx.fillStyle = n.color;
          ctx.fillText(n.label, px, labelY + 1);
        }
      }

      // Traffic spawn regulated by time (feels alive)
      g.lastSpawn += dt;
      if (g.lastSpawn > 0.07) {
        g.lastSpawn = 0;
        spawnTraffic(3 + Math.floor(Math.random()*3));
      }

      // Commander comms — Tony is in constant active conversation with
      // Agent 0 and Meridian. We spawn dedicated bidirectional particles
      // along those two specific edges every ~250-450ms so the user can
      // literally see them talking to him. This is in addition to the
      // ambient traffic above (which scatters across the whole graph).
      g.lastCommanderComm = (g.lastCommanderComm || 0) + dt;
      const commInterval = 0.25 + Math.random() * 0.20;
      if (g.lastCommanderComm > commInterval) {
        g.lastCommanderComm = 0;
        // Find Tony↔Agent0 and Tony↔Meridian edges, fire particles in
        // alternating directions so it reads as conversation.
        for (let i = 0; i < g.edges.length; i++) {
          const e = g.edges[i];
          if (!e.commanderLink && !(e.support && e.b === 2)) continue;
          // Pick direction: roughly half the time Tony→commander, half
          // commander→Tony, so the dialogue feels two-way.
          const reversed = Math.random() < 0.5;
          const startNode = g.nodes[reversed ? e.b : e.a];
          g.particles.push({
            edge: reversed ? { a: e.b, b: e.a, op: e.op } : e,
            t: 0,
            speed: 0.6 + Math.random() * 0.3, // faster than ambient — urgent
            color: startNode.color,
          });
        }
      }

      // Particles
      // ── NEURAL MOTION: continuous low-rate pulse seeder ──────────
      // Rate + cap + speed boost per active mode.
      if (NEURAL_MOTION && NM.pulseRate > 0 && NM.pulseCap > 0) {
        if (!g._nmLastPulseSeed) g._nmLastPulseSeed = 0;
        if (t - g._nmLastPulseSeed > NM.pulseRate && g.particles.length < NM.pulseCap && g.edges.length > 0) {
          g._nmLastPulseSeed = t;
          const _e = g.edges[Math.floor(Math.random() * g.edges.length)];
          if (_e) {
            g.particles.push({
              edge: _e, t: 0,
              speed: (0.25 + Math.random() * 0.4) * NM.pulseSpeedBoost,
              color: g.nodes[_e.a].color,
            });
          }
        }
      }
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.t += p.speed * dt;
        if (p.t >= 1) {
          // arrive - pulse
          const end = g.nodes[p.edge.b];
          g.pulses.push({ x: end.x, y: end.y, color: p.color, r: 0, life: 0 });
          g.particles.splice(i, 1);
          continue;
        }
        const A = g.nodes[p.edge.a], B = g.nodes[p.edge.b];
        const px = (A.x + (B.x - A.x) * p.t) * w;
        const py = (A.y + (B.y - A.y) * p.t) * h;
        // particle glow
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 4);
        grd.addColorStop(0, hexWithAlpha(p.color, 1));
        grd.addColorStop(1, hexWithAlpha(p.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();
      }

      // Pulses
      for (let i = g.pulses.length - 1; i >= 0; i--) {
        const p = g.pulses[i];
        p.life += dt;
        if (p.life > 1.2) { g.pulses.splice(i, 1); continue; }
        const prog = p.life / 1.2;
        const r = 2 + prog * 18;
        ctx.strokeStyle = hexWithAlpha(p.color, (1 - prog) * 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r, 0, Math.PI*2); ctx.stroke();
      }

      // ─── Hover tooltip ───────────────────────────────────────────
      // Drawn last so it floats on top. Only ever shown for hubs and
      // support agents — never for bulk nodes — keeping the design rule
      // that the universe stays clean at idle.
      if (g.hoverNodeId != null) {
        const n = g.nodes[g.hoverNodeId];
        if (n) {
          const px = n.x * w, py = n.y * h;
          const lines = n.isHub
            ? [n.label, n.oversight ? 'Brain Oversight Specialist' : 'Orchestrator · Owner']
            : [n.label, 'Support agent'];
          ctx.font = '600 11px -apple-system, Inter, system-ui, sans-serif';
          const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
          const padX = 8, padY = 6, lineH = 13;
          const boxW = widest + padX * 2;
          const boxH = lines.length * lineH + padY * 2 - 2;
          // Position above the node; flip below if too close to top edge.
          const offset = (n.isHub ? n.r + 18 : n.r + 12);
          let bx = px - boxW / 2;
          let by = py - offset - boxH;
          if (by < 6) by = py + offset;
          // Background chip
          ctx.fillStyle = 'rgba(8, 11, 22, 0.92)';
          ctx.strokeStyle = hexWithAlpha(n.color, 0.55);
          ctx.lineWidth = 1;
          const r8 = 6;
          ctx.beginPath();
          ctx.moveTo(bx + r8, by);
          ctx.lineTo(bx + boxW - r8, by);
          ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r8);
          ctx.lineTo(bx + boxW, by + boxH - r8);
          ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r8, by + boxH);
          ctx.lineTo(bx + r8, by + boxH);
          ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r8);
          ctx.lineTo(bx, by + r8);
          ctx.quadraticCurveTo(bx, by, bx + r8, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Text
          ctx.textAlign = 'left';
          ctx.fillStyle = n.color;
          ctx.font = '600 11px -apple-system, Inter, system-ui, sans-serif';
          ctx.fillText(lines[0], bx + padX, by + padY + 9);
          if (lines[1]) {
            ctx.fillStyle = 'rgba(220,228,255,0.75)';
            ctx.font = '500 10px -apple-system, Inter, system-ui, sans-serif';
            ctx.fillText(lines[1], bx + padX, by + padY + 9 + lineH);
          }
        }
      }

      // ── GRAPH MODE: honest visual-only label ────────────────────
      // Always renders a tiny "Graph mode: <label>" footer when a non-
      // original mode is active; original mode renders nothing here.
      if (NEURAL_MOTION && NM.showLabel) {
        ctx.save();
        ctx.font = '500 9px -apple-system, Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(150,170,200,0.55)';
        ctx.fillText(NM.labelText, w / 2, h - 18);
        ctx.fillStyle = 'rgba(180,200,225,0.75)';
        ctx.font = '600 9px -apple-system, Inter, system-ui, sans-serif';
        ctx.fillText('Graph mode: ' + NM.label, w / 2, h - 6);
        ctx.restore();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Fallback for hidden-iframe RAF throttling (preview sandbox).
    // Only runs if no frame has been produced after 250ms.
    const fallback = setTimeout(() => {
      if (stopped || frameCount > 0) return;
      const interval = setInterval(() => {
        if (stopped) { clearInterval(interval); return; }
        tick(performance.now());
      }, 40);
      fallback._int = interval;
    }, 250);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      clearTimeout(fallback);
      if (fallback._int) clearInterval(fallback._int);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [running, spawnTraffic]);

  return { canvasRef, pulseAt, spawnTraffic };
}

function hexWithAlpha(hex, a) {
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;
}

// ---------- Renderable brain component ----------
function BrainCanvasStage({ running = true, className = '' }) {
  const { canvasRef } = useBrainGraph({ running });
  return (
    <div className={`brain-stage-inner ${className}`}>
      <canvas ref={canvasRef} className="brain-map-canvas"/>
    </div>
  );
}

// ---------- Legend ----------
function BrainLegend({ compact = false }) {
  return (
    <div className={`brain-legend-card ${compact?'compact':''}`}>
      <div className="brain-legend-title">CATEGORIES</div>
      {BRAIN_CATEGORIES.map(c => (
        <div key={c.id} className={`brain-legend-row ${c.special?'special':''}`}>
          <span className="brain-legend-swatch" style={{background: c.color, boxShadow:`0 0 6px ${c.color}AA`}}/>
          <div className="brain-legend-textcol">
            <span className="brain-legend-name">{c.name}</span>
            {c.tagline && <span className="brain-legend-tagline">{c.tagline}</span>}
          </div>
          <span className="spacer"/>
          <span className="brain-legend-count">{c.count.toLocaleString()}</span>
        </div>
      ))}
      <div className="brain-legend-hint">Live · pulses show activity</div>
    </div>
  );
}

// ---------- KPI strip (unchanged — matches the reference mock) ----------
function KpiSpark({ data, color='#6bb3ff' }) {
  const w = 240, h = 32;
  if (!data?.length) return null;
  const mn = Math.min(...data), mx = Math.max(...data);
  const r = Math.max(1, mx - mn);
  const step = w / (data.length - 1);
  const pts = data.map((v,i)=>`${i*step},${h - ((v-mn)/r)*(h-6) - 3}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id="kspark-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#kspark-grad)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function HealthRing({ pct, size=56, color='#3ddc84' }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct/100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line-1)" strokeWidth="4"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle"
            fill="var(--fg-0)" fontSize="13" fontWeight="600" fontFamily="var(--font-sans)">{pct}%</text>
    </svg>
  );
}

function ObsidianGlyph({ size=18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2 L20 9 L17 20 L7 20 L4 9 Z" stroke="#c084ff" strokeWidth="1.3" fill="rgba(192,132,255,0.22)"/>
    <path d="M12 2 L9 12 L17 20" stroke="#c084ff" strokeWidth="1" opacity="0.8"/>
  </svg>;
}
function MemPalaceGlyph({ size=18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="8" width="18" height="13" rx="1" stroke="#ff6a9e" strokeWidth="1.3" fill="rgba(255,106,158,0.15)"/>
    <path d="M3 8 L12 3 L21 8" stroke="#ff6a9e" strokeWidth="1.3" fill="none"/>
    <path d="M8 21 V14 M16 21 V14 M3 14 H21" stroke="#ff6a9e" strokeWidth="1" opacity="0.7"/>
  </svg>;
}
function GraphifyGlyphBig({ size=18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="6" r="2.2" fill="#3ec9ff"/>
    <circle cx="18" cy="6" r="2.2" fill="#3ec9ff"/>
    <circle cx="12" cy="18" r="2.2" fill="#3ec9ff"/>
    <circle cx="12" cy="12" r="1.8" fill="#3ec9ff"/>
    <path d="M6 6 L12 12 L18 6 M12 12 L12 18" stroke="#3ec9ff" strokeWidth="1"/>
  </svg>;
}
function PacmanIcon({ size=18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2a10 10 0 1 0 8.66 15L12 12l8.66-5A10 10 0 0 0 12 2z" fill="#ffcc3a"/>
  </svg>;
}

function usePulseStream() {
  const [pulse, setPulse] = React.useState(2847);
  const [history, setHistory] = React.useState(() =>
    Array.from({length:120}, (_,i) => 2800 + Math.sin(i*0.3)*30 + (Math.random()*40-20))
  );
  React.useEffect(() => {
    const stop = window.MockApi.streamBrainPulses(({ pulses_per_min }) => {
      setPulse(pulses_per_min);
      setHistory(h => [...h.slice(-119), pulses_per_min]);
    });
    return stop;
  }, []);
  return { pulse, history };
}

function BrainTopbar({ active='brain', onNav }) {
  // Every tab routes to a REAL destination. "Brain sync" (this page) and
  // "Knowledge graph" share this surface because the live graph IS the
  // knowledge graph view; the rest delegate via window.appGoTo so we're
  // never faking tab state.
  const items = [
    { id:'overview',  label:'Overview',        target:'mission',              wired:true },
    { id:'graph',     label:'Knowledge graph', target:'brain-sync',           wired:true, self:true },
    { id:'brain',     label:'Brain sync',      target:'brain-sync',           wired:true, self:true },
    { id:'sources',   label:'Sources',         target:'settings:integrations',wired:true },
    { id:'activity',  label:'Activity',        target:'settings:readiness',   wired:true },
    { id:'settings',  label:'Settings',        target:'settings:system',      wired:true },
  ];
  return (
    <div className="brain-topbar">
      <div className="brain-topbar-brand">
        <div className="brain-brand-mark"/>
        <span>To-Knowledge Mission Control</span>
      </div>
      <div className="brain-topbar-nav">
        {items.map(i => (
          <button
            key={i.id}
            className={`brain-tab ${active===i.id?'active':''}`}
            title={i.self ? 'You are here' : `Opens ${i.target.replace(':',' → ')}`}
            onClick={()=>onNav?.(i)}>{i.label}</button>
        ))}
      </div>
      <div className="brain-topbar-right">
        <div className="brain-sys-pill demo" title="Production read-only Brain Sync status. Full backend sync remains approval-gated.">
          <span className="demo-dot"/>
          <div>
            <div style={{fontSize:12, color:'var(--fg-0)', fontWeight:500}}>Production read-only</div>
            <div className="muted xsmall">Memory health connected</div>
          </div>
        </div>
        {/* Bell is intentionally disabled: no notification event source is wired.
            Replacing a "nothing happens" toast with honest disabled state per
            directive. Will re-enable when /api/notifications/stream exists. */}
        <button
          className="icon-btn is-disabled"
          disabled
          aria-disabled="true"
          title="Notifications · disabled — no event source wired. Requires /api/notifications/stream + SSE.">
          <I.Bell size={15}/>
          <span className="icon-btn-off-dot" aria-hidden="true"/>
        </button>
        <button
          className="icon-btn is-disabled"
          disabled
          aria-disabled="true"
          title="Help center · disabled — no help backend wired.">
          <I.Help size={15}/>
        </button>
        <div className="brain-user">TK</div>
      </div>
    </div>
  );
}

function KpiStrip({ pulse, history }) {
  const live = window.TKMC_LIVE_BRIDGE?.state?.payloads || {};
  const memory = live.memory || null;
  const healthScore = memory?.overallScore ?? 98;
  const healthLabel = memory ? `${memory.overall || 'unknown'} · ${memory.categories?.length || 0} checks` : 'Loading live memory health';
  return (
    <div className="brain-kpi-strip">
      <div className="brain-kpi">
        <div className="brain-kpi-head">
          <span className="brain-kpi-ico" style={{background:'rgba(107,179,255,0.16)'}}><GraphifyGlyphBig size={14}/></span>
          <span className="brain-kpi-label">GRAPH CORPUS</span>
        </div>
        <div className="hstack" style={{gap:14, marginTop:6, alignItems:'flex-end'}}>
          <div><div className="brain-kpi-big" style={{color:'#6bb3ff'}}>1.24M</div><div className="brain-kpi-sub">Total nodes</div></div>
          <div><div className="brain-kpi-big" style={{color:'#a16bff'}}>8.74M</div><div className="brain-kpi-sub">Total edges</div></div>
        </div>
      </div>

      <div className="brain-kpi wide">
        <div className="brain-kpi-head">
          <span className="brain-kpi-ico" style={{background:'rgba(107,179,255,0.16)'}}><I.Activity size={12} style={{color:'#6bb3ff'}}/></span>
          <span className="brain-kpi-label">BRAIN SYNC</span>
          <span className="brain-mock-pill" title="Live read-only — UI can read live status but cannot write/sync protected brain data yet. Memory writes go through Tony \u2192 Telegram approval (not wired yet)."><span className="mock-dot"/>Live read-only</span>
          <span className="spacer"/>
          <span className="mono xsmall" style={{color:'var(--fg-0)'}}>{pulse.toLocaleString()} pulses / min</span>
        </div>
        <div style={{marginTop:6}}>
          <KpiSpark data={history} color="#6bb3ff"/>
          <div className="muted xsmall" style={{marginTop:2}}>Syncing continuously</div>
        </div>
      </div>

      <div className="brain-kpi">
        <div className="brain-kpi-head"><span className="brain-kpi-label">SYNC HEALTH</span></div>
        <div className="hstack" style={{gap:10, marginTop:4, alignItems:'center'}}>
          <HealthRing pct={healthScore} color={healthScore >= 80 ? '#3ddc84' : '#ffb060'}/>
          <div>
            <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{healthLabel}</div>
            <div className="muted xsmall">/api/memory/health</div>
          </div>
        </div>
      </div>

      <SourceKpi icon={<ObsidianGlyph/>}      name="OBSIDIAN"  value="12,431 files"     ago="2m ago"/>
      <SourceKpi icon={<MemPalaceGlyph/>}     name="MEMPALACE" value="7,842 memories"   ago="1m ago"/>
      <SourceKpi icon={<GraphifyGlyphBig/>}   name="GRAPHIFY"  value="1.18M entities"   ago="30s ago"/>
      <SourceKpi icon={<PacmanIcon/>}         name="PAC-MAN"   value="Real-time events" ago="Now"/>
    </div>
  );
}

function SourceKpi({ icon, name, value, ago }) {
  return (
    <div className="brain-kpi">
      <div className="brain-kpi-head"><span className="brain-kpi-ico">{icon}</span><span className="brain-kpi-label">{name}</span></div>
      <div className="brain-mock-pill" style={{marginTop:6}} title="Designer source value. Backend mapping is pending.">
        <span className="mock-dot"/>Backend required
      </div>
      <div style={{fontSize:13, color:'var(--fg-0)', marginTop:4}}>{value}</div>
      <div className="muted xsmall">{ago} <span className="muted xsmall" style={{opacity:0.7}}>· read-only</span></div>
    </div>
  );
}

function MapToolbar() {
  const toast = (t) => window.pushToast?.('warn', `${t} · not wired yet`);
  const btns = [
    { i: <I.Move4 size={11}/>, t:'Pan', a:()=>toast('Pan') },
    { i: <I.Plus size={11}/>, t:'Zoom in', a:()=>toast('Zoom in') },
    { i: <I.Minus size={11}/>, t:'Zoom out', a:()=>toast('Zoom out') },
    { i: <I.Maximize size={11}/>, t:'Fit to view', a:()=>toast('Fit to view') },
    { i: <I.Gear size={11}/>, t:'View settings', a:()=>toast('View settings') },
    { i: <I.Sparkle size={11}/>, t:'Highlight activity', a:()=>toast('Highlight activity') },
  ];
  return (
    <div className="brain-map-toolbar">
      {btns.map((b,i) => (
        <button key={i} className="brain-tool-btn" title={b.t} onClick={b.a}>{b.i}</button>
      ))}
    </div>
  );
}

// ---------- Expand (fullscreen overlay) ----------
function BrainExpandOverlay({ onClose, pulse, history }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="brain-expand-overlay">
      <div className="brain-expand-topbar">
        <div className="hstack" style={{gap:10}}>
          <div className="brain-map-title"><span className="brain-radar-glyph"><span/><span/><span/></span>LIVE BRAIN MAP · Expanded</div>
          <span className="brain-mock-pill" title="Live read-only — status surface only. Real-time updates require the Brain Sync backend, event stream, and approval-gated write layer (not wired yet)."><span className="mock-dot"/>Live read-only</span>
          <span className="mono xsmall" style={{color:'var(--fg-1)'}}>{pulse.toLocaleString()} pulses / min</span>
        </div>
        <button className="btn sm" onClick={onClose}><I.X size={11}/> Close</button>
      </div>
      <div className="brain-expand-body">
        <BrainCanvasStage running className="fullsize"/>
        <div className="brain-expand-legend">
          <BrainLegend/>
        </div>
      </div>
    </div>
  );
}

// ---------- Pop-out (separate window) ----------
function openPopout(){
  const w = window.open('', 'brainSyncPopout', 'width=1280,height=820');
  if (!w) {
    window.pushToast?.('err', 'Pop-up blocked — allow pop-ups to open the live graph in a separate window.');
    return;
  }
  // Build a self-contained HTML that references the same live brain renderer —
  // simplest: reuse the main page at #popout so the same code runs standalone.
  // But since we can't share React state across windows, we launch the page
  // on the special Pop-out hash, which renders only the canvas.
  const href = new URL(window.location.href);
  href.hash = '#brain-popout';
  w.location.href = href.toString();
}

// ---------- Pop-out standalone view ----------
function BrainPopoutView(){
  const { pulse, history } = usePulseStream();
  return (
    <div className="brain-popout-shell">
      <div className="brain-expand-topbar" style={{borderRadius:0}}>
        <div className="hstack" style={{gap:10}}>
          <div className="brain-brand-mark" style={{width:18, height:18}}/>
          <div className="brain-map-title" style={{fontSize:11}}><span className="brain-radar-glyph"><span/><span/><span/></span>LIVE BRAIN MAP · Pop-out</div>
          <span className="brain-mock-pill" title="Live read-only — status surface only. Real-time updates require the Brain Sync backend, event stream, and approval-gated write layer (not wired yet)."><span className="mock-dot"/>Live read-only</span>
          <span className="mono xsmall" style={{color:'var(--fg-1)'}}>{pulse.toLocaleString()} pulses / min</span>
        </div>
        <button className="btn sm" onClick={()=>window.close()}><I.X size={11}/> Close window</button>
      </div>
      <div className="brain-expand-body">
        <BrainCanvasStage running className="fullsize"/>
        <div className="brain-expand-legend"><BrainLegend/></div>
      </div>
    </div>
  );
}

// ---------- Main page ----------

// ── Agent 0 surface ─────────────────────────────────────────
// Agent 0 must be unmistakable in Brain Sync. These two components make it
// a first-class entity in the page chrome (banner) and in the inspector
// rail (card with role, scope, owner-only gate). The owner-only rule is
// enforced by schema.ROLE_PERMISSIONS['agent_zero.request']; the UI reads
// that permission so non-owners see the card but cannot invoke Agent 0.

function useIsOwner(){
  const [isOwner, setIsOwner] = React.useState(false);
  React.useEffect(() => {
    const compute = () => {
      const pid = window._currentPersonaId || 'owner';
      const p = (window.PERSONAS || []).find(x => x.id === pid);
      setIsOwner(p?.id === 'owner');
    };
    compute();
    const i = setInterval(compute, 500); // pick up persona switcher changes
    return () => clearInterval(i);
  }, []);
  return isOwner;
}

function AgentZeroBanner(){
  const isOwner = useIsOwner();
  return (
    <div className={`agent-zero-banner ${isOwner?'is-owner':'is-locked'}`}>
      <div className="a0b-glyph" aria-hidden="true">
        <span className="a0b-core"/>
        <span className="a0b-ring a0b-ring-1"/>
        <span className="a0b-ring a0b-ring-2"/>
      </div>
      <div className="a0b-text">
        <div className="a0b-title">
          <span className="a0b-badge">AGENT 0</span>
          <span className="a0b-role">Brain Oversight Specialist</span>
          <span className={`a0b-access ${isOwner?'ok':'denied'}`}>
            {isOwner ? '● Owner access' : '● Owner-only'}
          </span>
        </div>
        <div className="a0b-sub">
          Subordinate to Tony · Keeps the brain organized, audits knowledge &amp; tool-use, and assists Tony with higher-order coordination.
          {!isOwner && <> <b>Not available for your role</b> — switch to the creator/owner persona to interact.</>}
        </div>
      </div>
      <div className="a0b-spacer"/>
      <button
        className="btn sm"
        disabled={!isOwner}
        title={isOwner
          ? 'Opens the Agent 0 request flow — backend endpoint POST /api/agent-zero/request is not wired yet.'
          : 'Disabled — Agent 0 is reserved for the creator/owner.'}
        onClick={()=>{
          if (!isOwner) return;
          window.pushToast?.('warn', 'Agent 0 request flow · backend endpoint not wired yet. Enforced server-side via schema.agent_zero.request.');
        }}>
        Request Agent 0 <I.ArrowRight size={11}/>
      </button>
    </div>
  );
}

function AgentZeroCard(){
  const isOwner = useIsOwner();
  return (
    <div className="card brain-side-card agent-zero-card">
      <div className="card-head">
        <div className="card-title" style={{fontSize:11, letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:8}}>
          <span className="a0-dot"/>AGENT 0 · OVERSIGHT
          <span className="spacer"/>
          <span className={`tag xsmall ${isOwner?'ok':'warn'}`}>{isOwner?'Unlocked':'Owner-only'}</span>
        </div>
      </div>
      <div className="card-body vstack" style={{gap:10}}>
        <div className="a0c-grid">
          <div><div className="muted xsmall">Role</div><div className="a0c-val">Brain-management specialist</div></div>
          <div><div className="muted xsmall">Reports to</div><div className="a0c-val">Tony (creator · owner)</div></div>
          <div><div className="muted xsmall">Scope</div><div className="a0c-val">Knowledge graph hygiene, tool-use discipline, higher-order coordination</div></div>
          <div><div className="muted xsmall">Access</div><div className="a0c-val">Creator/owner special requests only</div></div>
        </div>

        <div className="a0c-rule">
          <div className="a0c-rule-label">ENFORCEMENT</div>
          <div className="muted xsmall">
            Permission <code>agent_zero.request</code> is <b>true</b> only for role <code>owner</code>{' '}
            (<code>src/backend/schema.jsx</code> · <code>ROLE_PERMISSIONS</code>).
            UI surfaces above read this live; server-side gate still needs{' '}
            <code>POST /api/agent-zero/request</code> to honor the same capability.
          </div>
        </div>

        <div className="hstack" style={{gap:6}}>
          <button
            className="btn sm"
            disabled={!isOwner}
            title={isOwner ? 'Open Agent 0 request flow' : 'Reserved for owner'}
            onClick={()=>{
              if (!isOwner) return;
              window.pushToast?.('warn', 'Agent 0 request flow · endpoint not wired');
            }}>
            Request task <I.ArrowRight size={11}/>
          </button>
          <button
            className="btn sm ghost"
            onClick={()=>window.appGoTo?.('settings:users')}
            title="View role matrix in Settings → Users & Roles">
            View role matrix
          </button>
        </div>
      </div>
    </div>
  );
}

function BrainSyncReadinessBanner(){
  return (
    <div className="card" style={{
      margin:"12px 16px 0 16px", padding:"12px 14px",
      borderLeft:"3px solid #ff8088", background:"rgba(255,128,136,0.06)"
    }}>
      <div className="hstack" style={{gap:8, marginBottom:6}}>
        <span className="brain-mock-pill" style={{background:"rgba(255,128,136,0.12)", borderColor:"rgba(255,128,136,0.4)", color:"#ffb8bc"}}>
          <span className="mock-dot" style={{background:"#ff8088"}}/>BACKEND_REQUIRED
        </span>
        <span style={{fontSize:13, fontWeight:600, color:"var(--fg-0)"}}>Brain Sync — read-only</span>
      </div>
      <p className="muted" style={{fontSize:12, lineHeight:1.5, margin:"4px 0"}}>
        Brain Sync is currently <strong style={{color:"#ffb8bc"}}>live read-only</strong>. Real-time brain
        updates require the Brain Sync / Harness backend, event stream, and approval-gated memory write
        layer. Until then, this page shows status and read-only health data only.
      </p>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:10, fontSize:11.5, lineHeight:1.5}}>
        <div>
          <div style={{color:"#3ddc84", fontWeight:600, marginBottom:4}}>What is live today</div>
          <ul style={{paddingLeft:16, margin:0, color:"var(--fg-1)"}}>
            <li>Memory health / status indicators</li>
            <li>Read-only counters (Obsidian / MemPalace / Graphify / Pac-Man)</li>
            <li>Vault file counts (when the vault is reachable)</li>
          </ul>
        </div>
        <div>
          <div style={{color:"#ff8088", fontWeight:600, marginBottom:4}}>What is not fully wired yet</div>
          <ul style={{paddingLeft:16, margin:0, color:"var(--fg-1)"}}>
            <li>Real-time Obsidian UI updates</li>
            <li>MemPalace live sync</li>
            <li>Graphify live graph updates</li>
            <li>Pac-Man real-time event feed</li>
            <li>Brain Sync write events</li>
            <li>Memory write approvals (gated through Tony → Telegram)</li>
          </ul>
        </div>
      </div>
      <div className="muted xsmall" style={{marginTop:8, lineHeight:1.5}}>
        <strong style={{color:"var(--fg-1)"}}>Live read-only</strong> = the UI can read some live status
        data, but cannot write/sync/update protected brain data yet. {" "}
        <strong style={{color:"var(--fg-1)"}}>BACKEND_REQUIRED</strong> = the visual panel exists, but
        the live sync backend / event stream is not connected yet.
      </div>
    </div>
  );
}


// ============================================================
// Brain Graph Settings — gear popover for in-UI visual mode picker
// (Owner directive 2026-04-30 — replaces DevTools-only flag flow.)
// All 5 modes available; selection persists in mc.brain.graphMode and
// reloads the page so useBrainGraph re-reads the flag cleanly.
// ============================================================
function BrainGraphSettings({ open, currentMode, onSelect, onClose }) {
  if (!open) return null;
  const modes = [
    { id: 'original',      name: 'Original',            desc: 'Existing production look.' },
    { id: 'neural-lite',   name: 'Neural Lite',         desc: 'Subtle neural movement.' },
    { id: 'neural-strong', name: 'Neural Strong',       desc: 'Stronger neural layout and separation.', isDefault: true },
    { id: 'neural-live',   name: 'Neural Live Traffic', desc: 'Stronger traffic/pulse visualization.' },
    { id: 'neural-clean',  name: 'Neural Clean',        desc: 'Clean readable layout with minimal background.' },
  ];
  return (
    <div
      className="brain-settings-backdrop"
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 90,
        background: 'rgba(6,9,22,0.35)', cursor: 'default',
      }}
    >
      <div
        className="brain-settings-popover"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Brain Graph Settings"
        style={{
          position: 'absolute', top: 56, right: 14, zIndex: 100,
          background: 'var(--bg-2, #0f1422)',
          border: '1px solid var(--line-1, rgba(255,255,255,0.08))',
          borderRadius: 10, padding: 14, width: 340,
          boxShadow: '0 16px 50px rgba(0,0,0,0.55)',
        }}
      >
        <div className="hstack" style={{justifyContent:'space-between', marginBottom:10}}>
          <span style={{fontSize:13, fontWeight:600, color:'var(--fg-0)'}}>Brain Graph Settings</span>
          <button className="btn sm" onClick={onClose} aria-label="Close" style={{padding:'2px 8px'}}>✕</button>
        </div>
        <div style={{fontSize:11, color:'var(--fg-2)', marginBottom:8, letterSpacing:'0.04em', textTransform:'uppercase'}}>Visualization mode</div>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {modes.map((m) => {
            const active = currentMode === m.id;
            return (
              <label
                key={m.id}
                className="hstack"
                style={{
                  padding:'8px 10px',
                  borderRadius:8,
                  cursor:'pointer',
                  alignItems:'flex-start',
                  background: active ? 'rgba(107,179,255,0.10)' : 'transparent',
                  border: '1px solid ' + (active ? 'rgba(107,179,255,0.45)' : 'var(--line-1, rgba(255,255,255,0.08))'),
                }}
              >
                <input
                  type="radio" name="graphMode" value={m.id}
                  checked={active}
                  onChange={() => onSelect(m.id)}
                  style={{accentColor:'#6bb3ff', marginTop:3}}
                />
                <div style={{flex:1, marginLeft:10, minWidth:0}}>
                  <div className="hstack" style={{gap:6}}>
                    <span style={{fontSize:12.5, color:'var(--fg-0)', fontWeight:500}}>{m.name}</span>
                    {m.isDefault && (
                      <span
                        className="brain-mock-pill"
                        style={{fontSize:9, padding:'1px 6px', background:'rgba(61,220,132,0.12)', borderColor:'rgba(61,220,132,0.4)', color:'#3ddc84'}}
                      >
                        default
                      </span>
                    )}
                  </div>
                  <div className="muted xsmall" style={{marginTop:2, lineHeight:1.4}}>{m.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="hstack" style={{gap:6, marginTop:12}}>
          <button className="btn sm" onClick={() => onSelect('neural-strong')} style={{flex:1}}>Reset to Default</button>
          <button className="btn sm" onClick={() => onSelect('original')} style={{flex:1}}>Reset to Original</button>
        </div>
        <div className="muted xsmall" style={{marginTop:10, lineHeight:1.4}}>
          Selection persists in <code className="mono" style={{fontSize:10}}>localStorage.mc.brain.graphMode</code>.
          Page reloads automatically so the canvas re-initializes cleanly.
          Future updates may unlock per-knob controls (spacing, pulse intensity, traffic speed, sector separation, label density, line curvature, background intensity, live-data overlays).
        </div>
      </div>
    </div>
  );
}

function BrainGearGlyph({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function BrainSyncPage(){
  const { pulse, history } = usePulseStream();
  const [tab, setTab] = React.useState('overview');
  const [q, setQ] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);
  // ── Brain Graph Settings (gear) ───────────────────────────────────
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [currentMode, setCurrentMode] = React.useState(() => {
    if (typeof window === 'undefined') return 'neural-strong';
    try {
      const ls = window.localStorage;
      if (ls) {
        const v = ls.getItem('mc.brain.graphMode');
        if (v) return v;
        const legacy = ls.getItem('mc.brain.neuralMotion');
        if (legacy === '1' || legacy === 'true') return 'neural-lite';
      }
    } catch { /* ignore */ }
    return 'neural-strong';
  });
  const handleModeSelect = (mode) => {
    try {
      if (mode === 'neural-strong') {
        // The default — clearing the key keeps fallback behavior tidy.
        window.localStorage.removeItem('mc.brain.graphMode');
      } else {
        window.localStorage.setItem('mc.brain.graphMode', mode);
      }
    } catch { /* ignore */ }
    setCurrentMode(mode);
    // Reload so useBrainGraph re-reads the flag cleanly. The owner approved
    // auto-reload-on-change as the simplest reliable apply path.
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 50);
    }
  };

  const handleRebuild = () => window.pushToast?.('warn', 'Rebuild graph · endpoint not wired (prototype).');
  const handleExpand  = () => setExpanded(true);
  const handlePopOut  = () => openPopout();
  // Tabs route through the app-level goTo bridge. If the bridge is missing
  // (page loaded standalone), we fall back to an honest toast and stay put
  // instead of pretending the tab switched.
  const handleNav     = (item) => {
    if (item.self) return; // Already here
    const go = window.appGoTo;
    if (!go) {
      window.pushToast?.('warn', `"${item.label}" requires the main shell — open from Mission Control.`);
      return;
    }
    go(item.target);
  };

  return (
    <div className="brain-page">
      {typeof ToastHost !== 'undefined' && <ToastHost/>}

      <BrainTopbar active="brain" onNav={handleNav}/>

      <AgentZeroBanner/>
      <BrainSyncReadinessBanner/>

      <div className="brain-body">
        <KpiStrip pulse={pulse} history={history}/>

        <div className="brain-main-grid">
          <div className="card brain-map-card">
            <div className="brain-map-head">
              <div className="hstack" style={{gap:10}}>
                <div className="brain-map-title">
                  <span className="brain-radar-glyph"><span/><span/><span/></span>
                  LIVE BRAIN MAP
                </div>
                <span className="brain-mock-pill" title="Live read-only — status surface only. Real-time updates require the Brain Sync backend, event stream, and approval-gated write layer (not wired yet)."><span className="mock-dot"/>Live read-only</span>
                <span className="mono xsmall" style={{color:'var(--fg-1)'}}>{pulse.toLocaleString()} pulses / min</span>
                <span className="muted xsmall">Last updated: just now</span>
              </div>
              <div className="hstack" style={{gap:6}}>
                <button className="btn sm" onClick={handleRebuild}><I.Refresh size={11}/> Rebuild</button>
                <button className="btn sm" onClick={handleExpand}><I.Maximize size={11}/> Expand</button>
                <button className="btn sm" onClick={handlePopOut}><I.External size={11}/> Pop out</button>
                <button
                  className="btn sm"
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-label="Brain Graph Settings"
                  title="Brain Graph Settings"
                >
                  <BrainGearGlyph size={11}/> Settings
                </button>
              </div>
            </div>

            <div className="brain-map-tabs">
              {['Overview','Communities','Flow','Timeline','Layers'].map(t => {
                const id = t.toLowerCase();
                return <button key={id} className={`brain-map-tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{t}</button>;
              })}
            </div>

            <div className="brain-map-stage" style={{position:'relative'}}>
              <BrainCanvasStage running={tab==='overview' || tab==='communities'}/>
              {/* Inline legend — on top of canvas, subtle */}
              <div className="brain-legend-overlay">
                <BrainLegend compact/>
              </div>
              <BrainGraphSettings
                open={settingsOpen}
                currentMode={currentMode}
                onSelect={handleModeSelect}
                onClose={() => setSettingsOpen(false)}
              />
              {tab !== 'overview' && tab !== 'communities' && (
                <div className="brain-map-overlay-msg">
                  <div style={{color:'var(--fg-0)', fontWeight:500, marginBottom:4}}>
                    {tab[0].toUpperCase() + tab.slice(1)} view
                  </div>
                  <div className="muted xsmall">Endpoint not wired yet — switch to Overview for the live map.</div>
                </div>
              )}
            </div>

            <div className="brain-map-footer">
              <div className="hstack" style={{gap:12}}>
                <span className="brain-legend"><span className="brain-legend-dot" style={{background:'#a16bff'}}/>Live pulses</span>
                <span className="brain-legend"><span className="brain-legend-dot" style={{background:'#3ddc84'}}/>Streams</span>
                <div style={{width:120}}><KpiSpark data={history.slice(-40)} color="#6bb3ff"/></div>
              </div>
              <MapToolbar/>
              <div className="hstack" style={{gap:14}}>
                <span className="mono xsmall muted">1.24M nodes</span>
                <span className="mono xsmall muted">8.74M edges</span>
                <span className="mono xsmall muted">98 communities</span>
              </div>
            </div>
          </div>

          <div className="brain-side vstack" style={{gap:10}}>
            <div className="brain-search">
              <I.Search size={13}/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search nodes, concepts, or IDs…"/>
              <button className="icon-btn" title="Filter" onClick={()=>window.pushToast?.('warn','Advanced filter · not wired yet')}><I.Filter size={13}/></button>
            </div>

            <AgentZeroCard/>

            <div className="card brain-side-card">
              <div className="card-head"><div className="card-title" style={{fontSize:11, letterSpacing:'0.1em'}}>NODE INFO</div></div>
              <div className="card-body vstack" style={{gap:12}}>
                <div className="muted xsmall">Select a node to inspect details <NotWiredBadge label="click not wired"/></div>
                <div className="brain-node-preview">
                  <svg viewBox="0 0 80 60" width="80" height="60">
                    <circle cx="40" cy="30" r="6" fill="var(--fg-3)" opacity="0.7"/>
                    {[[14,14],[66,14],[14,46],[66,46]].map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="3" fill="var(--fg-3)" opacity="0.5"/>))}
                    <g stroke="var(--fg-3)" strokeWidth="0.6" opacity="0.4">
                      {[[14,14],[66,14],[14,46],[66,46]].map(([x,y],i)=>(<line key={i} x1="40" y1="30" x2={x} y2={y}/>))}
                    </g>
                  </svg>
                  <div className="vstack" style={{gap:8, flex:1}}>
                    <div><div className="muted xsmall">Connections</div><div className="brain-stat-bar"><span style={{width:'0%'}}/></div></div>
                    <div><div className="muted xsmall">Centrality</div><div className="brain-stat-bar"><span style={{width:'0%'}}/></div></div>
                  </div>
                </div>
                <button className="btn" disabled title="No node selected" style={{alignSelf:'flex-start'}}>View full details <I.ArrowRight size={11}/></button>
              </div>
            </div>

            <div className="card brain-side-card">
              <div className="card-head"><div className="card-title" style={{fontSize:11, letterSpacing:'0.1em'}}>COMMUNITIES <span className="muted" style={{marginLeft:6}}>({BRAIN_CATEGORIES.length})</span></div></div>
              <div className="card-body vstack" style={{gap:6}}>
                {BRAIN_CATEGORIES.map(c => (
                  <div key={c.id} className="brain-community-row" onClick={()=>window.pushToast?.('warn', `Focus on ${c.name} · not wired yet`)}>
                    <span className="brain-community-dot" style={{background:c.color, boxShadow:`0 0 8px ${c.color}AA`}}/>
                    <span className="brain-community-name">{c.name}</span>
                    <span className="spacer"/>
                    <span className="mono xsmall muted">{c.count.toLocaleString()}</span>
                  </div>
                ))}
                <button className="btn" style={{marginTop:6, alignSelf:'flex-start'}}
                        onClick={()=>window.pushToast?.('warn','Full community explorer · not wired yet')}>
                  View all communities <I.ArrowRight size={11}/>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && <BrainExpandOverlay onClose={()=>setExpanded(false)} pulse={pulse} history={history}/>}
    </div>
  );
}

// ---------- Small shared pieces ----------
function NotWiredBadge({ label = 'not wired' }) {
  return <span className="not-wired-badge" title="Prototype only — no backend">{label}</span>;
}
Object.assign(window, { NotWiredBadge });

// ---------- Pop-out hash route: if the URL hash is #brain-popout,
//           mount ONLY the popout view at document.body.
// ----------
(function mountPopoutIfRequested(){
  if (typeof window === 'undefined') return;
  if (window.__brainPopoutMounted) return;
  const isPopout = () => window.location.hash === '#brain-popout';
  const mount = () => {
    if (!isPopout() || window.__brainPopoutMounted) return;
    window.__brainPopoutMounted = true;
    // Hide the main app
    document.documentElement.classList.add('brain-popout-mode');
    const host = document.createElement('div');
    host.id = 'brain-popout-root';
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(<BrainPopoutView/>);
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(mount, 0);
  } else {
    window.addEventListener('DOMContentLoaded', mount);
  }
})();

Object.assign(window, {
  BrainSyncPage, BrainPopoutView, BrainCanvasStage, BrainLegend,
  BRAIN_CATEGORIES, useBrainGraph,
});
