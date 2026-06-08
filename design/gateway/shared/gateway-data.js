/* ============================================================
   Gateway shared mock data — used by every page.
   Defines: nodes (registry), edges (routes), bridge sessions,
   audit rows, lanes, status grammar.
   No backend calls. Pure JS literal.
   ============================================================ */

window.GATEWAY = (function () {
  // ---------- Status grammar ----------
  const STATUS = {
    green:   { label: 'Connected',          desc: 'Live, healthy, all enabled flags pass.' },
    yellow:  { label: 'Gated',              desc: 'Bridge Session required, approval pending, or RBAC challenge.' },
    blue:    { label: 'Read-only',          desc: 'Discovery + read OK. Writes refused.' },
    red:     { label: 'Blocked',            desc: 'Credential failure, policy denial, or upstream down.' },
    gray:    { label: 'Not configured',     desc: 'No credentials/config registered yet.' },
    purple:  { label: 'Agent / commander',  desc: 'Agent layer marker. Status grammar applies on top.' },
    orange:  { label: 'Runtime / worker',   desc: 'Worker engine marker. Status grammar applies on top.' },
  };

  // ---------- Lanes (canvas regions) ----------
  const LANES = {
    top_brain:      { label: 'Brain Layer',   y: 0  },
    left_input:     { label: 'Inputs',        x: 0  },
    near_center:    { label: 'Commanders',    x: 1  },
    center:         { label: 'Gateway Core',  x: 2  },
    right_integration: { label: 'Integrations & APIs', x: 3 },
    bottom_model:   { label: 'Models / Runtime', y: 1 },
  };

  // ---------- Nodes (registry) ----------
  // Every node has explicit R/W/X + bridge-session flags.
  // A node renders the LOWEST state across its enabled flags.
  const NODES = [
    /* ===== CENTER ===== */
    { id: 'gateway.core', name: 'Gateway Core', type: 'gateway', lane: 'center',
      status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 0,
      summary: 'Routing, policy, audit, registry, Bridge Session enforcement. The single path every request follows.',
      role: 'Gateway',
      lastSuccess: 'live', cacheAge: '12s', last_checked_at: '12s ago' },

    /* ===== NEAR CENTER ===== */
    { id: 'agent.zero', name: 'Agent Zero', type: 'agent', lane: 'near_center',
      status: 'purple', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1,
      summary: 'Commander. Routes owner intent to specialists, tools, models, and workers via the Gateway. Inherits Tony memory (read-only).',
      role: 'Commander',
      memory_inherited_from: 'tony',
      lastSuccess: '2m ago', cacheAge: '8s' },

    { id: 'agent.hermes', name: 'Hermes', type: 'agent', lane: 'near_center',
      status: 'yellow', connected: 1, configured: 1, R: 1, W: 0, X: 0, bridge: 1,
      summary: 'Lieutenant — skill + workflow specialist. Designs skills, plans workflows. Live chat unproven; gated until hermes_called:true.',
      role: 'Lieutenant',
      blocked_reason: 'Live chat not proven yet. Awaiting hermes_called:true heartbeat.',
      lastSuccess: '14m ago', cacheAge: '32s' },

    /* ===== LEFT — INPUTS ===== */
    { id: 'input.owner',     name: 'Owner Commands', type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 0, summary: 'Owner-issued commands from Mission Control or chat.', lastSuccess: 'live' },
    { id: 'input.telegram',  name: 'Telegram',       type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Owner Telegram bot — bidirectional.', lastSuccess: '1m ago' },
    { id: 'input.email',     name: 'Email Inbound',  type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 0, bridge: 0, summary: 'AgentMail inbound parser → ticket adapter.', lastSuccess: '3m ago' },
    { id: 'input.workflow',  name: 'Workflow Triggers', type: 'input', lane: 'left_input', status: 'blue', connected: 1, configured: 1, R: 1, W: 0, X: 0, bridge: 0, summary: 'Hermes-authored workflow triggers. Read-only until Hermes proven.', lastSuccess: '—', blocked_reason: 'Workflow publisher gated by Hermes proof.' },
    { id: 'input.aiapp',     name: 'AI App Requests', type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Inbound from AI apps (Claude, Copilot, etc.) — owner-authorized.', lastSuccess: '6m ago' },
    { id: 'input.agentreq',  name: 'Agent Requests', type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 0, summary: 'Internal agent → Gateway requests. Discovery + RBAC enforced.', lastSuccess: 'live' },
    { id: 'input.event',     name: 'Events',         type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'System event bus.', lastSuccess: '<1s' },
    { id: 'input.scheduled', name: 'Scheduled Jobs', type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 0, summary: 'Cron / interval triggers.', lastSuccess: '7m ago' },
    { id: 'input.webhook',   name: 'Webhooks',       type: 'input', lane: 'left_input', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Inbound webhooks (Twilio, AgentMail, MCP, Zapier).', lastSuccess: '2m ago' },

    /* ===== TOP — BRAIN ===== */
    { id: 'brain.obsidian',  name: 'Obsidian Vault', type: 'brain', lane: 'top_brain', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 1, summary: 'Owner knowledge vault. Writes Bridge-gated.', lastSuccess: '4m ago' },
    { id: 'brain.mempalace', name: 'MemPalace',      type: 'brain', lane: 'top_brain', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 1, summary: 'Long-horizon associative memory.', lastSuccess: '1m ago' },
    { id: 'brain.graphify',  name: 'Graphify',       type: 'brain', lane: 'top_brain', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 1, summary: 'Graph-of-thought layer.', lastSuccess: '12m ago' },
    { id: 'brain.sync',      name: 'Brain Sync',     type: 'brain', lane: 'top_brain', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Cross-brain replication & diff feed.', lastSuccess: 'live' },
    { id: 'brain.buildwiki', name: 'Build-Wiki',     type: 'brain', lane: 'top_brain', status: 'yellow', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Documentation knowledge base. Run Now scoped to opencloud-docs-farmer.service only.', blocked_reason: 'Bridge Session required for Run Now.', lastSuccess: '21m ago' },

    /* ===== BOTTOM — MODELS ===== */
    { id: 'model.openrouter', name: 'OpenRouter',  type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'Primary model gateway. Whitelisted models only.', lastSuccess: '<1s' },
    { id: 'model.openai',     name: 'OpenAI / Codex', type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'GPT family + Codex.', lastSuccess: '8s ago' },
    { id: 'model.claude',     name: 'Claude',      type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'Anthropic family.', lastSuccess: '<1s' },
    { id: 'model.ollama',     name: 'Ollama',      type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'Local models on workstation.', lastSuccess: '4m ago' },
    { id: 'model.nvidia',     name: 'NVIDIA',      type: 'model', lane: 'bottom_model', status: 'gray', connected: 0, configured: 0, R: 0, W: 0, X: 0, bridge: 0, summary: 'NIM endpoint — not yet configured.', blocked_reason: 'NIM API key not registered.' },
    { id: 'model.gemini',     name: 'Gemini',      type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'Google Gemini family.', lastSuccess: '37m ago' },
    { id: 'model.groq',       name: 'Groq',        type: 'model', lane: 'bottom_model', status: 'green', connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'High-speed inference.', lastSuccess: '12m ago' },
    { id: 'model.openclawplus', name: 'OpenClaw+', type: 'runtime', lane: 'bottom_model', status: 'orange', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Shared skills/adapters/reports/governance runtime.', lastSuccess: '2m ago', role: 'Runtime engine' },
    { id: 'model.miniagents', name: 'Mini-agents', type: 'runtime', lane: 'bottom_model', status: 'orange', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Sandboxed mini-agent runner (MiroFish).', lastSuccess: '15s ago', role: 'Runtime engine' },
    { id: 'oc.parent',        name: 'OpenClaw+ Workers', type: 'opencloud', lane: 'bottom_model', status: 'orange', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Worker engine parent. Children: Build-Wiki, Farmer, Skills, Tools, Forks 1 & 2.', lastSuccess: 'live', role: 'Runtime engine' },

    /* ===== RIGHT — INTEGRATIONS / APIs / TOOLS ===== */
    { id: 'int.apis',         name: 'External APIs',     type: 'api',     lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Registered external API surface.', lastSuccess: '40s ago' },
    { id: 'int.mcp',          name: 'MCP Servers',       type: 'mcp',     lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'MCP discovery + tool execution.', lastSuccess: 'live' },
    { id: 'int.tools',        name: 'Tools Registry',    type: 'tool',    lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Tools surface (CRUD, search, file ops).', lastSuccess: '12s ago' },
    { id: 'int.zapier',       name: 'Zapier',            type: 'tool',    lane: 'right_integration', status: 'yellow', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Zapier write — Bridge-gated, owner-scoped.', blocked_reason: 'Owner pre-approval required per execution scope.', lastSuccess: '4h ago' },
    { id: 'int.firecrawl',    name: 'Firecrawl',         type: 'tool',    lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 0, X: 1, bridge: 0, summary: 'Web crawl + extract.', lastSuccess: '6m ago' },
    { id: 'int.agentmail',    name: 'AgentMail',         type: 'channel', lane: 'right_integration', status: 'green', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'AgentMail ready · approval-gated sending.', blocked_reason: null, lastSuccess: '11m ago' },
    { id: 'int.gdrive',       name: 'Google Drive',      type: 'channel', lane: 'right_integration', status: 'yellow', connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 1, summary: 'Per-user OAuth passthrough. Bridge for uploads.', lastSuccess: '22m ago' },
    { id: 'int.onedrive',     name: 'OneDrive',          type: 'channel', lane: 'right_integration', status: 'yellow', connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 1, summary: 'Per-user OAuth passthrough. Bridge for uploads.', lastSuccess: '1h ago' },
    { id: 'int.heygen',       name: 'HeyGen',            type: 'tool',    lane: 'right_integration', status: 'yellow', connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Video generation. Owner-approved scope only.', blocked_reason: 'Awaiting per-execution scope approval.', lastSuccess: '—' },
    { id: 'int.n8n',          name: 'n8n (future)',      type: 'tool',    lane: 'right_integration', status: 'gray',   connected: 0, configured: 0, R: 0, W: 0, X: 0, bridge: 0, summary: 'Reserved slot — n8n install pending.', blocked_reason: 'Not installed.' },
    { id: 'int.reports',      name: 'Reports',           type: 'tool',    lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 1, X: 1, bridge: 1, summary: 'Report builder + dispatcher.', lastSuccess: '3m ago' },
    { id: 'int.datastores',   name: 'Data Stores',       type: 'data',    lane: 'right_integration', status: 'green',  connected: 1, configured: 1, R: 1, W: 1, X: 0, bridge: 0, summary: 'Internal SQLite + governance vault.', lastSuccess: 'live' },
    { id: 'int.webhooks_out', name: 'Outbound Webhooks', type: 'channel', lane: 'right_integration', status: 'yellow', connected: 1, configured: 1, R: 0, W: 1, X: 1, bridge: 1, summary: 'Outbound webhook dispatcher.', blocked_reason: 'Bridge Session required.', lastSuccess: '17m ago' },
    { id: 'int.external',     name: 'External Systems',  type: 'api',     lane: 'right_integration', status: 'gray',   connected: 0, configured: 0, R: 0, W: 0, X: 0, bridge: 0, summary: 'Reserved — third-party SaaS to onboard.', blocked_reason: 'Per-system onboarding required.' },
  ];

  // ---------- OpenClaw+ children (rendered under oc.parent) ----------
  const OPENCLOUD_CHILDREN = [
    { id: 'oc.buildwiki',   name: 'Build-Wiki',     role: 'docs_builder', status: 'green',  R: 1, W: 1, X: 1, bridge: 1, summary: 'Run Now scope: opencloud-docs-farmer.service only.' },
    { id: 'oc.farmer',      name: 'Farmer Sync',    role: 'farmer',       status: 'green',  R: 1, W: 1, X: 1, bridge: 1, summary: 'Continuous knowledge ingest farmer.' },
    { id: 'oc.skills',      name: 'OpenClaw+ Skills', role: 'skills_host', status: 'green', R: 1, W: 1, X: 1, bridge: 1, summary: 'Skills hosted on OpenClaw+ workers.' },
    { id: 'oc.tools',       name: 'OpenClaw+ Tools', role: 'tools_host',  status: 'green', R: 1, W: 1, X: 1, bridge: 1, summary: 'Tools hosted on OpenClaw+ workers.' },
    { id: 'oc.runtime',     name: 'Agent Runtime',  role: 'agent_runtime', status: 'gray', R: 0, W: 0, X: 0, bridge: 0, summary: 'Future — agent runtime hosting.', blocked_reason: 'Reserved for future cutover.' },
    { id: 'oc.fork1',       name: 'Fork 1 — Local Docs', role: 'fork',  status: 'green',  R: 1, W: 1, X: 1, bridge: 1, summary: 'Local docs farmer.' },
    { id: 'oc.fork2',       name: 'Fork 2 — SMB',   role: 'fork',         status: 'red',    R: 0, W: 0, X: 0, bridge: 0, summary: 'SMB share farmer.', blocked_reason: 'SMB connector unavailable / SMB mount not proven.' },
  ];

  // ---------- Edges (routes) ----------
  const EDGES = [
    // Inputs → Gateway
    { from: 'input.owner',     to: 'gateway.core', relation: 'commands' },
    { from: 'input.telegram',  to: 'gateway.core', relation: 'commands' },
    { from: 'input.email',     to: 'gateway.core', relation: 'commands' },
    { from: 'input.workflow',  to: 'gateway.core', relation: 'commands' },
    { from: 'input.aiapp',     to: 'gateway.core', relation: 'commands' },
    { from: 'input.agentreq',  to: 'gateway.core', relation: 'commands' },
    { from: 'input.event',     to: 'gateway.core', relation: 'notifies' },
    { from: 'input.scheduled', to: 'gateway.core', relation: 'commands' },
    { from: 'input.webhook',   to: 'gateway.core', relation: 'notifies' },

    // Gateway → Commanders
    { from: 'gateway.core', to: 'agent.zero',   relation: 'delegates_to' },
    { from: 'gateway.core', to: 'agent.hermes', relation: 'delegates_to' },

    // Commanders → Brain (read)
    { from: 'agent.zero',   to: 'brain.obsidian',  relation: 'reads_from' },
    { from: 'agent.zero',   to: 'brain.mempalace', relation: 'reads_from' },
    { from: 'agent.zero',   to: 'brain.graphify',  relation: 'reads_from' },
    { from: 'agent.zero',   to: 'brain.sync',      relation: 'reads_from' },
    { from: 'agent.zero',   to: 'brain.buildwiki', relation: 'reads_from' },
    { from: 'agent.hermes', to: 'brain.buildwiki', relation: 'reads_from' },

    // Commanders → Models
    { from: 'agent.zero', to: 'model.openrouter', relation: 'routes_through' },
    { from: 'agent.zero', to: 'model.claude',     relation: 'routes_through' },
    { from: 'agent.zero', to: 'model.openai',     relation: 'routes_through' },
    { from: 'agent.hermes', to: 'model.openrouter', relation: 'routes_through' },

    // Commanders → Right side (integrations)
    { from: 'agent.zero', to: 'int.mcp',       relation: 'routes_through' },
    { from: 'agent.zero', to: 'int.tools',     relation: 'routes_through' },
    { from: 'agent.zero', to: 'int.agentmail', relation: 'writes_to' },
    { from: 'agent.zero', to: 'int.gdrive',    relation: 'writes_to' },
    { from: 'agent.zero', to: 'int.firecrawl', relation: 'reads_from' },
    { from: 'agent.zero', to: 'int.reports',   relation: 'writes_to' },
    { from: 'agent.hermes', to: 'int.tools',   relation: 'routes_through' },

    // Commanders → OpenClaw+ workers
    { from: 'agent.zero',   to: 'oc.parent',         relation: 'delegates_to' },
    { from: 'agent.hermes', to: 'oc.parent',         relation: 'delegates_to' },
    { from: 'agent.zero',   to: 'model.openclawplus', relation: 'routes_through' },
    { from: 'agent.zero',   to: 'model.miniagents',   relation: 'delegates_to' },
  ];

  // ---------- Bridge Sessions ----------
  const BRIDGE_SESSIONS = [
    {
      id: 'bs.current',
      owner_id: 'luis',
      started_at: '14:02 today',
      expires_at: '14:32 today',
      remaining_minutes: 24,
      device_fingerprint: 'macbook-pro-luis-7f3a',
      scope: ['delivery_channel', 'opencloud_worker', 'brain_system'],
      allowed_tools: ['agentmail.send', 'gdrive.upload', 'onedrive.upload', 'oc.buildwiki.run', 'brain.write'],
      duration_minutes: 30,
      extended: false,
    },
  ];

  // ---------- Recent gateway audit (mock) ----------
  const AUDIT = [
    { ts: '14:08:22', actor: 'agent.zero', commander: 'agent.zero', action: 'execute', node: 'int.agentmail', route: ['input.owner','gateway.core','agent.zero','int.agentmail'], result: 'ok',                   bridge: 'bs.current', latency: 412 },
    { ts: '14:08:11', actor: 'agent.zero', commander: 'agent.zero', action: 'discover', node: 'int.mcp',       route: ['agent.zero','gateway.core','int.mcp'],                       result: 'ok',                   bridge: null,         latency: 38  },
    { ts: '14:07:54', actor: 'agent.hermes', commander: 'agent.zero', action: 'discover', node: 'int.tools',  route: ['agent.hermes','gateway.core','int.tools'],                  result: 'ok',                   bridge: null,         latency: 22  },
    { ts: '14:06:40', actor: 'agent.zero', commander: 'agent.zero', action: 'execute',  node: 'int.zapier',   route: ['input.owner','gateway.core','agent.zero','int.zapier'],     result: 'denied_no_bridge',     bridge: null,         latency: 9   },
    { ts: '14:06:31', actor: 'agent.zero', commander: 'agent.zero', action: 'read',     node: 'brain.obsidian', route: ['agent.zero','gateway.core','brain.obsidian'],             result: 'ok',                   bridge: null,         latency: 88  },
    { ts: '14:05:02', actor: 'input.scheduled', commander: 'agent.zero', action: 'execute', node: 'oc.farmer', route: ['input.scheduled','gateway.core','agent.zero','oc.parent','oc.farmer'], result: 'ok',     bridge: 'bs.current', latency: 1450 },
    { ts: '14:04:48', actor: 'agent.zero', commander: 'agent.zero', action: 'execute',  node: 'oc.fork2',     route: ['agent.zero','gateway.core','oc.parent','oc.fork2'],          result: 'denied_node_blocked', bridge: 'bs.current', latency: 4 },
    { ts: '14:04:11', actor: 'agent.hermes', commander: 'agent.zero', action: 'write',  node: 'int.tools',    route: ['agent.hermes','gateway.core','int.tools'],                   result: 'denied_no_permission', bridge: null,        latency: 3  },
  ];

  // ---------- Policies ----------
  const POLICIES = [
    { id: 'p.bridge.outbound',       name: 'Bridge Session required for external writes',  scope: 'all delivery_channel + outbound webhooks + uploads', severity: 'high', state: 'enforced' },
    { id: 'p.discovery.gate',        name: 'Discovery before execute',                    scope: 'all node types',                                       severity: 'high', state: 'enforced' },
    { id: 'p.rbac.passthrough',      name: 'Existing-permission enforcement',             scope: 'every execute',                                        severity: 'high', state: 'enforced' },
    { id: 'p.runnow.scope',          name: 'Build-Wiki Run Now scope',                    scope: 'opencloud-docs-farmer.service only',                   severity: 'high', state: 'enforced' },
    { id: 'p.tony.readonly',         name: 'Tony memory read-only',                       scope: 'all /api/legacy/tony/*',                               severity: 'high', state: 'enforced' },
    { id: 'p.fork2.blocked',         name: 'Fork 2 / SMB blocked',                        scope: 'oc.fork2',                                             severity: 'high', state: 'enforced' },
    { id: 'p.hermes.gated',          name: 'Hermes gated until live chat proven',         scope: 'agent.hermes write/execute',                          severity: 'med',  state: 'enforced' },
    { id: 'p.creds.never_expose',    name: 'Credentials never echoed to UI/logs',         scope: 'all credentials',                                      severity: 'high', state: 'enforced' },
    { id: 'p.audit.append_only',     name: 'gateway_audit append-only + chain hash',      scope: 'audit table',                                          severity: 'high', state: 'enforced' },
    { id: 'p.legacy.flag',           name: 'Legacy Tony routes behind admin flag',        scope: 'LEGACY_TONY_ROUTES_ENABLED',                           severity: 'high', state: 'flag-off' },
  ];

  // ---------- Health ----------
  const HEALTH = {
    summary: { green: 0, yellow: 0, blue: 0, red: 0, gray: 0 },
    checks: NODES.map(n => ({
      id: n.id,
      name: n.name,
      status: n.status === 'purple' || n.status === 'orange' ? 'green' : n.status,
      last_checked_at: n.last_checked_at || '12s ago',
      last_success_at: n.lastSuccess || '—',
      blocked_reason: n.blocked_reason || null,
    })),
  };
  HEALTH.checks.forEach(c => { HEALTH.summary[c.status] = (HEALTH.summary[c.status] || 0) + 1; });

  // ---------- Helpers ----------
  function get(id) { return NODES.find(n => n.id === id); }
  function byLane(lane) { return NODES.filter(n => n.lane === lane); }
  function statusOf(node) {
    // The node's own status field is precomputed (encodes the lowest grammar).
    return node.status;
  }
  function statusColor(status) {
    return ({
      green: 'var(--st-green)', yellow: 'var(--st-yellow)', blue: 'var(--st-blue)',
      red: 'var(--st-red)', gray: 'var(--st-gray)', purple: 'var(--st-purple)', orange: 'var(--st-orange)',
    })[status] || 'var(--st-gray)';
  }

  // ---------- Engines (live token / $ budgets) ----------
  // Each engine is a model or runtime that the Dispatcher can route to.
  // Budgets are owner-scoped per day; the Dispatcher picks based on
  // remaining_tokens, $/1k, latency, and required capability.
  const ENGINES = [
    { id: 'eng.claude.sonnet',   provider: 'claude',     label: 'Claude Sonnet 4.5', tier: 'premium',  caps: ['reason','tool','vision'], remaining_tokens: 412_000, daily_budget_tokens: 600_000, spent_usd: 6.40,  daily_budget_usd: 25, p50_ms: 480, status: 'green'  },
    { id: 'eng.claude.haiku',    provider: 'claude',     label: 'Claude Haiku 4.5',  tier: 'fast',     caps: ['reason','tool'],          remaining_tokens: 1_280_000, daily_budget_tokens: 1_500_000, spent_usd: 0.85,  daily_budget_usd: 8,  p50_ms: 220, status: 'green' },
    { id: 'eng.gpt.4o',          provider: 'openai',     label: 'GPT-4o',            tier: 'premium',  caps: ['reason','tool','vision'], remaining_tokens: 88_000,  daily_budget_tokens: 400_000, spent_usd: 11.20, daily_budget_usd: 15, p50_ms: 540, status: 'yellow', warn: 'budget 75%' },
    { id: 'eng.gpt.codex',       provider: 'openai',     label: 'Codex',             tier: 'code',     caps: ['code'],                   remaining_tokens: 240_000, daily_budget_tokens: 300_000, spent_usd: 1.10,  daily_budget_usd: 4,  p50_ms: 380, status: 'green' },
    { id: 'eng.openrouter',      provider: 'openrouter', label: 'OpenRouter pool',   tier: 'fallback', caps: ['reason','tool','cheap'],  remaining_tokens: 2_400_000, daily_budget_tokens: 3_000_000, spent_usd: 0.42, daily_budget_usd: 5,  p50_ms: 620, status: 'green' },
    { id: 'eng.gemini',          provider: 'gemini',     label: 'Gemini 2.5 Pro',    tier: 'premium',  caps: ['reason','vision','long'], remaining_tokens: 720_000, daily_budget_tokens: 800_000, spent_usd: 1.80,  daily_budget_usd: 10, p50_ms: 510, status: 'green' },
    { id: 'eng.groq',            provider: 'groq',       label: 'Groq · Llama 70B',  tier: 'fast',     caps: ['reason','cheap'],         remaining_tokens: 980_000, daily_budget_tokens: 1_000_000, spent_usd: 0.18, daily_budget_usd: 3,  p50_ms: 90,  status: 'green' },
    { id: 'eng.ollama',          provider: 'ollama',     label: 'Ollama (local)',    tier: 'local',    caps: ['reason','offline'],       remaining_tokens: 1e9,     daily_budget_tokens: 1e9,     spent_usd: 0.00,  daily_budget_usd: 0,  p50_ms: 740, status: 'green' },
    { id: 'eng.nvidia',          provider: 'nvidia',     label: 'NVIDIA NIM',        tier: 'premium',  caps: ['reason','vision'],        remaining_tokens: 0,       daily_budget_tokens: 0,       spent_usd: 0.00,  daily_budget_usd: 0,  p50_ms: 0,   status: 'gray', warn: 'not configured' },
  ];

  // Mini-agents that the Dispatcher can fan out work to.
  // Each carries its own thin token allowance — the point is that the
  // Dispatcher chops a big task into many small ones and gives each
  // worker a tiny budget so token spend stays predictable.
  const MINI_AGENTS = [
    { id: 'mini.researcher',  label: 'Researcher',     role: 'reads + summarizes',  status: 'green',  load: 0.42, allowance: 8000,  used: 3360 },
    { id: 'mini.crawler',     label: 'Crawler',        role: 'fetch + extract',     status: 'green',  load: 0.18, allowance: 4000,  used: 720  },
    { id: 'mini.classifier',  label: 'Classifier',     role: 'tag + route',         status: 'green',  load: 0.07, allowance: 2000,  used: 140  },
    { id: 'mini.writer',      label: 'Writer',         role: 'draft + format',      status: 'green',  load: 0.55, allowance: 12000, used: 6600 },
    { id: 'mini.coder',       label: 'Coder',          role: 'edit + diff',         status: 'green',  load: 0.61, allowance: 16000, used: 9760 },
    { id: 'mini.reviewer',    label: 'Reviewer',       role: 'critique',            status: 'yellow', load: 0.24, allowance: 4000,  used: 960,  warn: 'awaiting Hermes proof' },
    { id: 'mini.archivist',   label: 'Archivist',      role: 'memory write',        status: 'green',  load: 0.11, allowance: 2000,  used: 220  },
    { id: 'mini.dispatcher',  label: 'Sub-dispatcher', role: 'fan-out planner',     status: 'green',  load: 0.33, allowance: 3000,  used: 990  },
  ];

  // Live request stream — each entry is one engine asking the Gateway
  // for data. The nucleus view animates these as they fly to the core,
  // get routed by the Dispatcher, and resolve.
  // (Pre-seeded; the nucleus view also generates new ones in real time.)
  const REQUEST_STREAM = [
    { id: 'r-9182', t: 0,    from: 'agent.zero',    asks: 'brain.obsidian',  op: 'read',     payload: 'project · gateway · todo',          tokens_in: 320,  tokens_out: 180,  engine: 'eng.claude.haiku',  ms: 210, result: 'ok' },
    { id: 'r-9183', t: 220,  from: 'agent.zero',    asks: 'int.firecrawl',   op: 'execute',  payload: 'crawl konghq.com/products/ai-gateway', tokens_in: 0,  tokens_out: 0,    engine: null,                ms: 1820, result: 'ok' },
    { id: 'r-9184', t: 380,  from: 'mini.crawler',  asks: 'gateway.core',    op: 'discover', payload: 'getTools(domain=mail)',              tokens_in: 0,    tokens_out: 0,    engine: null,                ms: 18,  result: 'ok' },
    { id: 'r-9185', t: 460,  from: 'agent.hermes',  asks: 'int.tools',       op: 'discover', payload: 'getSkills(scope=workflow)',          tokens_in: 0,    tokens_out: 0,    engine: null,                ms: 22,  result: 'ok' },
    { id: 'r-9186', t: 720,  from: 'agent.zero',    asks: 'int.agentmail',   op: 'execute',  payload: 'send · status report · weekly',     tokens_in: 1820, tokens_out: 640,  engine: 'eng.claude.sonnet', ms: 540, result: 'ok',     bridge: 'bs.current' },
    { id: 'r-9187', t: 980,  from: 'mini.coder',    asks: 'eng.gpt.codex',   op: 'inference', payload: 'patch · render.js · L88',           tokens_in: 920,  tokens_out: 1200, engine: 'eng.gpt.codex',     ms: 380, result: 'ok' },
    { id: 'r-9188', t: 1240, from: 'agent.zero',    asks: 'int.zapier',      op: 'execute',  payload: 'create row · CRM',                   tokens_in: 0,    tokens_out: 0,    engine: null,                ms: 4,   result: 'denied_no_bridge' },
    { id: 'r-9189', t: 1480, from: 'mini.writer',   asks: 'eng.claude.haiku',op: 'inference', payload: 'rewrite · onboarding email',         tokens_in: 1240, tokens_out: 720,  engine: 'eng.claude.haiku', ms: 230, result: 'ok' },
    { id: 'r-9190', t: 1700, from: 'agent.hermes',  asks: 'int.mcp',         op: 'execute',  payload: 'mcp.firecrawl.crawl',                tokens_in: 0,    tokens_out: 0,    engine: null,                ms: 12,  result: 'denied_no_permission' },
    { id: 'r-9191', t: 1940, from: 'mini.researcher',asks: 'eng.groq',       op: 'inference', payload: 'summarize · 4 docs',                 tokens_in: 6200, tokens_out: 480,  engine: 'eng.groq',          ms: 95,  result: 'ok' },
    { id: 'r-9192', t: 2200, from: 'input.scheduled',asks: 'oc.farmer',      op: 'execute',  payload: 'cron · 10m sync',                    tokens_in: 0,    tokens_out: 0,    engine: null,                ms: 1450, result: 'ok',    bridge: 'bs.current' },
    { id: 'r-9193', t: 2440, from: 'agent.zero',    asks: 'eng.gemini',      op: 'inference', payload: 'vision · screenshot diff',           tokens_in: 8200, tokens_out: 380,  engine: 'eng.gemini',        ms: 510, result: 'ok' },
  ];

  // Dispatcher policy — how the engine inside the core picks a route.
  const DISPATCHER = {
    strategy: 'budget-aware fan-out',
    rules: [
      { id: 'd1', if: 'budget(engine) < 25%',          then: 'route to fallback tier; alert owner' },
      { id: 'd2', if: 'task.size > 4k tokens',         then: 'split into mini-agent fan-out' },
      { id: 'd3', if: 'task.cap = code',               then: 'prefer eng.gpt.codex; fallback eng.claude.sonnet' },
      { id: 'd4', if: 'task.cap = vision',             then: 'prefer eng.gemini; fallback eng.gpt.4o' },
      { id: 'd5', if: 'task.cap = cheap & latency<150ms', then: 'route eng.groq' },
      { id: 'd6', if: 'no network',                    then: 'route eng.ollama (local)' },
      { id: 'd7', if: 'engine.status = yellow',        then: 'shed 50% load to fallback' },
    ],
    last_decisions: [
      { ts: '14:08:24', task: 'patch render.js',     picked: 'eng.gpt.codex',    reason: 'cap=code'                    },
      { ts: '14:08:18', task: 'summarize 4 docs',    picked: 'eng.groq',         reason: 'cheap + low latency'         },
      { ts: '14:08:11', task: 'send weekly report',  picked: 'eng.claude.sonnet',reason: 'reasoning · long context'    },
      { ts: '14:08:02', task: 'rewrite onboarding',  picked: 'eng.claude.haiku', reason: 'sonnet at 31% — shed to haiku' },
      { ts: '14:07:51', task: 'vision · screenshot', picked: 'eng.gemini',       reason: 'cap=vision'                  },
      { ts: '14:07:40', task: 'classify 30 tickets', picked: 'fan-out × 3 mini', reason: 'task.size split'             },
    ],
  };

  // Total token + $ telemetry rolled up across engines (today).
  const TOKEN_LEDGER = {
    daily_budget_usd: ENGINES.reduce((s,e) => s + (e.daily_budget_usd||0), 0),
    spent_usd:        ENGINES.reduce((s,e) => s + (e.spent_usd||0), 0),
    tokens_today:     ENGINES.reduce((s,e) => s + ((e.daily_budget_tokens||0) - (e.remaining_tokens||0)), 0),
    requests_today:   1247,
    fan_out_today:    312,
    denied_today:     18,
  };

  return {
    STATUS, LANES, NODES, OPENCLOUD_CHILDREN, EDGES, BRIDGE_SESSIONS, AUDIT, POLICIES, HEALTH,
    ENGINES, MINI_AGENTS, REQUEST_STREAM, DISPATCHER, TOKEN_LEDGER,
    get, byLane, statusOf, statusColor,
  };
})();
