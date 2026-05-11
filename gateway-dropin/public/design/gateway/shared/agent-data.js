/* ============================================================
   Agent Hub mock data — drives Agent Hub.html and Paperclip.html.
   Loaded after gateway-data.js. Read-only mocks; no live calls.

   Architecture order (locked):
   Owner → Gateway → Agent Zero / Pi / Hermes → Paperclip
                  → OpenClaw+ → mini-agents / skills / tools / reports

   Repo grounding: PENDING — public access not available in design
   environment. URLs preserved on each agent so the developer can
   wire them up after handoff.
   ============================================================ */

window.AGENTS = (function () {

  /* -- Agent roster (5) ------------------------------------- */
  const agents = [
    {
      id: 'paperclip',
      name: 'Paperclip',
      role: 'Workforce Control Plane',
      tagline: 'Organizes the workforce. Hands work to OpenClaw+.',
      status: 'yellow',                // planned/gated until localhost/Tailnet works
      marker: 'purple',
      kind: 'workforce',
      bridge: true,
      R: true, W: true, X: false,
      localhost: 'http://paperclip.tail-scale.ts.net',
      iframe_safe: false,              // assumed unsafe until proven; default to "Open in new tab"
      auth: 'tailnet + token',
      repo: 'github.com/paperclipai/paperclip',
      repo_grounding: 'pending',
      caps: ['workforce', 'task-queue', 'co-worker management', 'mini-agent requests', 'budgets', 'heartbeats', 'approvals', 'OpenClaw handoff'],
      models: ['claude-sonnet-4', 'gpt-5-codex'],
      tools: ['task-bus', 'workforce-ledger', 'budget-meter', 'approvals-bus'],
      blocked_reason: null,
      gated_reason: 'Localhost/Tailnet handshake unproven. Bridge required for first run.',
      pulse: { req_per_min: 0, p95_ms: null, error_rate: 0 },
      summary: 'Workforce manager. Sits before OpenClaw+. Owns task queue, budgets, approvals, and handoff to runtime.'
    },

    {
      id: 'agent-zero',
      name: 'Agent Zero',
      role: 'Commander',
      tagline: 'Sole commander. All owner intent lands here.',
      status: 'green',                 // partial GO / commander track
      marker: 'purple',
      kind: 'commander',
      bridge: false,
      R: true, W: true, X: true,
      localhost: 'http://localhost:50001',
      iframe_safe: true,
      auth: 'mission control session',
      repo: 'github.com/Sosastrike/agent-zero',
      repo_grounding: 'pending',
      caps: ['plan', 'delegate', 'execute', 'tony memory R/O', 'multi-tool'],
      models: ['claude-sonnet-4', 'gpt-5', 'openrouter:auto'],
      tools: ['gateway-router', 'plan-composer', 'memory:tony', 'memory:obsidian', 'memory:mempalace'],
      blocked_reason: null,
      gated_reason: null,
      pulse: { req_per_min: 14.2, p95_ms: 940, error_rate: 0.012 },
      summary: 'Commander. Plans, delegates, executes. Inherits Tony memory read-only.'
    },

    {
      id: 'hermes',
      name: 'Hermes',
      role: 'Lieutenant · Skill + Workflow Builder',
      tagline: 'Yellow until hermes_called:true is proven.',
      status: 'yellow',
      marker: 'purple',
      kind: 'lieutenant',
      bridge: true,
      R: true, W: true, X: false,
      localhost: 'http://localhost:7042',
      iframe_safe: true,
      auth: 'mission control session + bridge',
      repo: 'github.com/Sosastrike/To-Knowledge-hermes-agent',
      repo_grounding: 'pending',
      caps: ['skill design', 'workflow design', 'specialist composition'],
      models: ['claude-sonnet-4', 'gpt-5-codex'],
      tools: ['skill-registry', 'workflow-canvas', 'openclaw-handoff'],
      blocked_reason: null,
      gated_reason: 'hermes_called:true not yet proven. Read-only until live chat heartbeat.',
      pulse: { req_per_min: 2.1, p95_ms: 1280, error_rate: 0 },
      summary: 'Lieutenant. Builds skills and workflows. Cannot delegate further. Read-biased until proven.'
    },

    {
      id: 'space-agent',
      name: 'SpaceAgent',
      role: 'Browser · Firecrawl · Playwright MCP · YouTube research',
      tagline: 'Web research specialist. Uses Playwright MCP through Gateway policy.',
      status: 'gray',                  // planned/gated unless installed/live
      marker: 'orange',
      kind: 'specialist',
      bridge: true,
      R: true, W: false, X: false,
      localhost: 'http://localhost:8765',
      iframe_safe: false,
      auth: 'tailnet',
      repo: 'github.com/Sosastrike/To-Knowledge-space-agent',
      repo_grounding: 'pending',
      caps: ['web browse', 'firecrawl scrape', 'playwright automation', 'youtube transcript', 'page summarize', 'screenshot evidence'],
      models: ['claude-haiku-4-5', 'gpt-5-mini'],
      tools: ['firecrawl', 'playwright-mcp', 'youtube-api', 'browser-headless'],
      blocked_reason: null,
      gated_reason: 'Not installed in this environment. Repo grounding pending.',
      pulse: { req_per_min: 0, p95_ms: null, error_rate: 0 },
      summary: 'Browser, Firecrawl, Playwright MCP, and YouTube research. Read-only by design. Playwright MCP is a tool — SpaceAgent is the agent.'
    },

    {
      id: 'pi-mono',
      name: 'Pi-mono',
      role: 'Dispatcher · Route Optimizer (candidate)',
      tagline: 'Recommends routes. Not in execution path yet.',
      status: 'gray',
      marker: 'orange',
      kind: 'dispatcher',
      bridge: false,
      R: true, W: false, X: false,
      localhost: 'http://localhost:5174',
      iframe_safe: true,
      auth: 'mission control session',
      repo: 'github.com/Sosastrike/To-Knowledge-Pi-mono',
      repo_grounding: 'pending',
      caps: ['route recommendation', 'cost estimate', 'engine pick'],
      models: ['claude-haiku-4-5'],
      tools: ['router-cost-table', 'engine-ledger:read'],
      blocked_reason: null,
      gated_reason: 'Candidate. Recommendations only — not yet wired into execution path.',
      pulse: { req_per_min: 0, p95_ms: null, error_rate: 0 },
      summary: 'Dispatcher candidate. Recommends routes by cost/latency/capability.'
    }
  ];

  /* -- Last 10 Gateway requests routed per agent ------------ */
  const gatewayLog = {
    'agent-zero': [
      { ts: '14:18:02', req: 'req_8c41a92f', op: 'plan',         engine: 'claude-sonnet-4',   ms: 940,  result: 'ok',     bridge: false },
      { ts: '14:17:48', req: 'req_8c41a924', op: 'tool:obsidian.read', engine: '—',          ms: 110,  result: 'ok',     bridge: false },
      { ts: '14:17:31', req: 'req_8c41a91d', op: 'tool:wiki.read',     engine: '—',          ms: 88,   result: 'ok',     bridge: false },
      { ts: '14:16:54', req: 'req_8c41a912', op: 'plan',         engine: 'gpt-5',             ms: 1820, result: 'ok',     bridge: false },
      { ts: '14:16:09', req: 'req_8c41a906', op: 'delegate:hermes', engine: '—',              ms: 14,   result: 'gated',  bridge: true  },
      { ts: '14:15:22', req: 'req_8c41a8fa', op: 'plan',         engine: 'claude-sonnet-4',   ms: 1140, result: 'ok',     bridge: false },
      { ts: '14:14:44', req: 'req_8c41a8ee', op: 'tool:mempalace.read', engine: '—',          ms: 220,  result: 'ok',     bridge: false },
      { ts: '14:13:11', req: 'req_8c41a8d0', op: 'plan',         engine: 'openrouter:auto',   ms: 1390, result: 'ok',     bridge: false },
      { ts: '14:12:38', req: 'req_8c41a8c4', op: 'tool:tony.read', engine: '—',               ms: 60,   result: 'ok',     bridge: false },
      { ts: '14:11:07', req: 'req_8c41a8b1', op: 'plan',         engine: 'claude-sonnet-4',   ms: 980,  result: 'ok',     bridge: false }
    ],
    'hermes': [
      { ts: '14:08:54', req: 'req_8c41a8a2', op: 'compose:skill',  engine: 'claude-sonnet-4', ms: 1450, result: 'gated',  bridge: true },
      { ts: '13:54:18', req: 'req_8c41a7e1', op: 'compose:skill',  engine: 'claude-sonnet-4', ms: 1220, result: 'ok',     bridge: true },
      { ts: '13:21:09', req: 'req_8c41a704', op: 'compose:wf',     engine: 'gpt-5-codex',     ms: 2010, result: 'ok',     bridge: true },
      { ts: '12:58:42', req: 'req_8c41a662', op: 'compose:skill',  engine: 'claude-sonnet-4', ms: 1340, result: 'denied', bridge: true },
      { ts: '12:11:08', req: 'req_8c41a514', op: 'compose:skill',  engine: 'claude-sonnet-4', ms: 980,  result: 'ok',     bridge: true }
    ],
    'paperclip': [
      { ts: '11:02:00', req: 'req_8c41a311', op: 'register',       engine: '—',                ms: 12,   result: 'pending', bridge: true }
    ],
    'space-agent': [],
    'pi-mono': [
      { ts: '13:11:22', req: 'req_8c41a611', op: 'recommend',      engine: 'claude-haiku-4-5', ms: 230,  result: 'ok',     bridge: false },
      { ts: '12:52:41', req: 'req_8c41a554', op: 'recommend',      engine: 'claude-haiku-4-5', ms: 280,  result: 'ok',     bridge: false }
    ]
  };

  /* -- Tool calls in flight + last 20 per agent ------------- */
  const toolLog = {
    'agent-zero': [
      { ts: '14:18:02.620', tool: 'obsidian.read', target: 'vault/inbox/q3-marketing-ops.md', ms: 110, result: 'ok' },
      { ts: '14:17:31.122', tool: 'wiki.read',     target: 'reports/q3-marketing-ops',         ms: 88,  result: 'ok' },
      { ts: '14:14:44.503', tool: 'mempalace.read',target: 'episodic/2026-05-06',              ms: 220, result: 'ok' },
      { ts: '14:12:38.118', tool: 'tony.read',     target: 'archive/2024-q4',                  ms: 60,  result: 'ok' },
      { ts: '14:08:01.044', tool: 'gateway.engine.ledger', target: 'engines/all',              ms: 12,  result: 'ok' }
    ],
    'hermes': [
      { ts: '14:08:54.882', tool: 'skill.compose', target: 'skill:q3-marketing-ops-builder', ms: 1450, result: 'gated' },
      { ts: '13:54:18.004', tool: 'workflow.compose', target: 'wf:weekly-build-wiki-digest',  ms: 1220, result: 'ok' }
    ],
    'paperclip': [],
    'space-agent': [],
    'pi-mono': [
      { ts: '13:11:22.014', tool: 'router.recommend', target: 'task:plan-q3', ms: 230, result: 'ok' }
    ]
  };

  /* -- Decision trace (action summary; NOT chain-of-thought) - */
  const decisionTrace = {
    'agent-zero': [
      { ts: '14:18:02', summary: 'Plan q3 marketing ops report', route: 'gateway → agent-zero → claude-sonnet-4', cost_usd: 0.082 },
      { ts: '14:16:09', summary: 'Delegate to Hermes', route: 'gateway → agent-zero → hermes (bridge required)', cost_usd: 0.000 },
      { ts: '14:13:11', summary: 'Compose digest', route: 'gateway → agent-zero → openrouter:auto', cost_usd: 0.041 }
    ],
    'hermes': [
      { ts: '14:08:54', summary: 'Compose skill q3-marketing-ops-builder (gated)', route: 'gateway → hermes (bridge required)', cost_usd: 0.000 }
    ],
    'paperclip': [
      { ts: '11:02:00', summary: 'Register agent paperclip with Gateway (pending bridge)', route: 'gateway ← paperclip', cost_usd: 0.000 }
    ],
    'space-agent': [],
    'pi-mono': [
      { ts: '13:11:22', summary: 'Recommend route claude-sonnet-4 for plan-q3', route: 'pi → agent-zero (advisory)', cost_usd: 0.001 }
    ]
  };

  /* -- Memory state summary (NOT raw memory) ---------------- */
  const memorySummary = {
    'agent-zero': {
      working_set: ['Q3 marketing ops report', 'Gateway design sprint accepted', 'Hermes proof pending'],
      tony_inherited: '237 episodes (R/O)',
      mempalace: '1,402 nodes',
      obsidian_pinned: ['vault/projects/q3-marketing-ops.md']
    },
    'hermes': {
      working_set: ['skill:q3-marketing-ops-builder (draft)', 'wf:weekly-build-wiki-digest'],
      skills_in_progress: 1, workflows_in_progress: 1
    },
    'paperclip': {
      working_set: ['Bootstrap workforce ledger', 'First co-worker registration'],
      co_workers: 0, tasks: 0, work_products: 0
    },
    'space-agent': { working_set: [], note: 'Not installed' },
    'pi-mono': { working_set: ['Engine cost table cache (5m TTL)'], routes_observed: 27 }
  };

  /* -- Persona summary (the SHAPE of the system prompt) ----- */
  const persona = {
    'agent-zero': { id: 'persona:agent-zero@v3.4', tone: 'commander', word_count: 1820, last_edit: '2026-04-29' },
    'hermes':     { id: 'persona:hermes@v1.7',      tone: 'lieutenant · skills', word_count: 1240, last_edit: '2026-05-02' },
    'paperclip':  { id: 'persona:paperclip@v0.2',   tone: 'workforce manager',   word_count: 870,  last_edit: '2026-05-04' },
    'space-agent':{ id: 'persona:space@v0.1',       tone: 'researcher',          word_count: 540,  last_edit: '2026-04-12' },
    'pi-mono':    { id: 'persona:pi@v0.1',          tone: 'dispatcher',          word_count: 410,  last_edit: '2026-04-08' }
  };

  /* -- Token + cost meter (today, since midnight local) ----- */
  const cost = {
    'agent-zero':  { today_usd: 8.42, today_tokens: 1_245_022, day_cap_usd: 25, soft_cap_usd: 18 },
    'hermes':      { today_usd: 0.61, today_tokens:    91_400, day_cap_usd: 10, soft_cap_usd:  7 },
    'paperclip':   { today_usd: 0.00, today_tokens:         0, day_cap_usd:  5, soft_cap_usd:  3 },
    'space-agent': { today_usd: 0.00, today_tokens:         0, day_cap_usd:  3, soft_cap_usd:  2 },
    'pi-mono':     { today_usd: 0.04, today_tokens:    12_400, day_cap_usd:  2, soft_cap_usd:  1 }
  };

  /* -- Errors + retry log ----------------------------------- */
  const errors = {
    'agent-zero': [
      { ts: '13:42:11', code: 'TOOL_TIMEOUT',   target: 'mempalace.read', detail: 'p95 spike (3200ms)', retried: 1, resolved: true }
    ],
    'hermes': [
      { ts: '12:58:42', code: 'BRIDGE_DENIED',  target: 'compose:skill',  detail: 'owner denied bridge prompt', retried: 0, resolved: true }
    ],
    'paperclip':   [],
    'space-agent': [
      { ts: '00:00:00', code: 'NOT_INSTALLED',  target: '—',              detail: 'service not running',     retried: 0, resolved: false }
    ],
    'pi-mono':     []
  };

  /* -- Connections graph (out-edges per agent) -------------- */
  const connections = {
    'agent-zero':  [{to:'gateway',type:'router'}, {to:'hermes',type:'delegate'}, {to:'paperclip',type:'workforce'}, {to:'tony',type:'memory:R'}, {to:'obsidian',type:'memory:RW'}, {to:'mempalace',type:'memory:RW'}],
    'hermes':      [{to:'gateway',type:'router'}, {to:'openclaw',type:'handoff'}, {to:'skill-registry',type:'memory:RW'}],
    'paperclip':   [{to:'gateway',type:'router'}, {to:'openclaw',type:'handoff'}, {to:'agent-zero',type:'reports-up'}, {to:'workforce-ledger',type:'memory:RW'}],
    'space-agent': [{to:'gateway',type:'router'}, {to:'firecrawl',type:'tool'}, {to:'youtube',type:'tool'}],
    'pi-mono':     [{to:'gateway',type:'router'}, {to:'engine-ledger',type:'read'}]
  };

  /* -- Bridge requirement matrix per dangerous action ------- */
  const gatedActions = [
    { id: 'start',    label: 'Start',          danger: 'low',   bridge: false },
    { id: 'stop',     label: 'Stop',           danger: 'high',  bridge: true  },
    { id: 'restart',  label: 'Restart (fresh memory)', danger: 'high', bridge: true },
    { id: 'cmd',      label: 'Send command',   danger: 'med',   bridge: false },
    { id: 'pause',    label: 'Pause queue',    danger: 'low',   bridge: false },
    { id: 'rollback', label: 'Roll back last action', danger: 'high', bridge: true },
    { id: 'open',     label: 'Open localhost', danger: 'low',   bridge: false },
    { id: 'redeploy', label: 'Pull + redeploy',danger: 'high',  bridge: true  },
    { id: 'audit',    label: 'View audit',     danger: 'low',   bridge: false }
  ];

  /* ========== Paperclip-specific drill-down data ========== */
  const paperclip = {
    workforce: {
      co_workers_total: 6,
      co_workers_active: 0,
      mini_agents_max: 24,
      mini_agents_in_flight: 0,
      tasks_today: 0,
      tasks_completed_today: 0,
      tasks_pending: 0,
      budget_today_usd: 0.00,
      budget_cap_usd: 5.00,
      heartbeats_window: '60s',
      heartbeats_missed_today: 0,
      approvals_pending: 1,
      approvals_today: 0
    },
    coWorkers: [
      { id: 'cw_archivist', name: 'Archivist',   role: 'Build-Wiki / Obsidian writer', status: 'gray',   tasks: 0, last_seen: 'never', model: 'claude-haiku-4-5' },
      { id: 'cw_writer',    name: 'Writer',      role: 'Outbound copy + email drafts', status: 'gray',   tasks: 0, last_seen: 'never', model: 'claude-sonnet-4'  },
      { id: 'cw_analyst',   name: 'Analyst',     role: 'Numbers + ledger checks',      status: 'gray',   tasks: 0, last_seen: 'never', model: 'claude-haiku-4-5' },
      { id: 'cw_browser',   name: 'Browser',     role: 'Web research (delegates to SpaceAgent)', status: 'gray', tasks: 0, last_seen: 'never', model: 'claude-haiku-4-5' },
      { id: 'cw_qa',        name: 'QA',          role: 'Output review + redaction',    status: 'gray',   tasks: 0, last_seen: 'never', model: 'claude-haiku-4-5' },
      { id: 'cw_dispatcher',name: 'Dispatcher',  role: 'Internal routing (Pi-mono pair)', status: 'gray', tasks: 0, last_seen: 'never', model: 'claude-haiku-4-5' }
    ],
    taskQueue: [
      { id: 'tk_1001', title: 'Bootstrap workforce ledger',   owner: 'paperclip', assigned_to: '—',         priority: 'P1', state: 'pending', etr_ms: null, blocker: 'awaiting Bridge approval' },
      { id: 'tk_1002', title: 'Register first co-worker',     owner: 'paperclip', assigned_to: 'cw_archivist', priority: 'P2', state: 'pending', etr_ms: null, blocker: 'workforce ledger not yet bootstrapped' },
      { id: 'tk_1003', title: 'Draft co-worker SOP template', owner: 'paperclip', assigned_to: 'cw_writer',  priority: 'P3', state: 'pending', etr_ms: null, blocker: 'awaiting Bridge approval' }
    ],
    approvals: [
      { id: 'ap_1', title: 'Bootstrap workforce ledger',  asked_at: '11:02:00', kind: 'bridge', scopes: ['workforce:write','wiki:write'], ttl_min: 30 }
    ],
    workProducts: [
      // none yet
    ],
    handoffs: [
      // Paperclip → OpenClaw+ handoff log; empty until first co-worker fires
    ],
    auth: {
      chatgpt:   { state: 'ok',     account: 'codex@to-knowledge', last_check: '13:55' },
      anthropic: { state: 'ok',     account: 'mc-mission@to-knowledge', last_check: '13:55' },
      tailnet:   { state: 'pending',account: '—', last_check: '13:55', detail: 'paperclip.tail-scale.ts.net not seen in last 60s' }
    },
    openclawHandoff: {
      contract_version: 'v0.3',
      direction: 'paperclip → openclaw+',
      last_handoff: 'never',
      last_result: '—',
      pending_handoffs: 0,
      schema: ['task_id', 'co_worker', 'budget_usd', 'tools[]', 'memory_scope', 'success_predicate']
    }
  };

  /* ========== SpaceAgent · Browser Automation tools ========
     Playwright MCP is NOT the agent. SpaceAgent is the agent.
     Playwright MCP is the browser automation tool used by
     SpaceAgent through Gateway policy. ====================== */
  const browserAutomation = {
    'space-agent': {
      note: 'Playwright MCP is not the agent. SpaceAgent is the agent. Playwright MCP is the browser automation tool used by SpaceAgent through Gateway policy.',
      primary_tools: [
        {
          id: 'firecrawl',
          name: 'Firecrawl',
          role: 'search / scrape / crawl / extract',
          status: 'gray',                       // not installed in this env
          installed: false,
          endpoint: 'localhost only',
          auth: 'token',
          requires_bridge: false,
          bridge_for_writes: true,
          last_job: null,
          gated_reason: 'Not installed in this environment.',
          blocked_reason: null
        },
        {
          id: 'playwright-mcp',
          name: 'Playwright MCP',
          role: 'live browser automation · UI verification · screenshots · console · network · forms',
          status: 'gray',                       // gray / not installed until developer proves service
          installed: false,
          endpoint: 'localhost only',
          browser_mode: 'headless',             // headless / headed / isolated
          auth: 'token',
          requires_bridge: true,                // interactive actions are Bridge-Session-gated
          bridge_for_writes: true,
          last_job: null,
          last_screenshot: null,
          last_a11y_snapshot: null,
          last_console_capture: null,
          last_network_capture: null,
          gated_reason: 'Service not yet proven. Once installed: interactive browser actions remain yellow/gated until a Bridge Session is open.',
          blocked_reason: null
        },
        {
          id: 'youtube-research',
          name: 'YouTube research',
          role: 'transcript / metadata / summary / evidence packet',
          status: 'gray',
          installed: false,
          endpoint: 'localhost only',
          auth: 'youtube api key',
          requires_bridge: false,
          bridge_for_writes: false,
          last_job: null,
          gated_reason: 'Not installed in this environment.',
          blocked_reason: null
        }
      ],
      // safe owner buttons; UI-only in design — no live calls.
      safe_actions: [
        { id: 'check-mcp',    label: 'Check Playwright MCP status',  danger: 'low',  bridge: false },
        { id: 'open-evidence',label: 'Open last browser evidence packet', danger: 'low', bridge: false },
        { id: 'ui-smoke',     label: 'Run Mission Control UI smoke',  danger: 'low',  bridge: false }
      ],
      gated_actions: [
        { id: 'start-session', label: 'Start browser session',          danger: 'med',  bridge: true,  kind: 'gated' },
        { id: 'interactive',   label: 'Interactive browser action',     danger: 'high', bridge: true,  kind: 'gated' },
        { id: 'authed',        label: 'Authenticated browsing',         danger: 'high', bridge: true,  kind: 'owner-approval' }
      ]
    }
  };

  /* -- helpers ---------------------------------------------- */
  function byId(id) { return agents.find(a => a.id === id); }
  function statusColor(status) {
    return getComputedStyle(document.documentElement).getPropertyValue('--st-' + status).trim() || '#6b7280';
  }

  return {
    agents,
    gatewayLog,
    toolLog,
    decisionTrace,
    memorySummary,
    persona,
    cost,
    errors,
    connections,
    gatedActions,
    paperclip,
    browserAutomation,
    byId,
    statusColor
  };
})();
