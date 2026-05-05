// ============================================================
// Agent Registry — live read-only shell backed by the TKMC adapter.
//
// Mock-only. Mirrors the schema the production backend should
// implement (see docs/agent-network-spec.md, now the Gateway handoff spec). Every UI element
// in the Gateway page binds to fields exposed here.
//
// Public surface:
//   window.AgentRegistry = {
//     useRegistry(),                // React hook → snapshot
//     subscribe(fn),                // raw subscription
//     emit(event),                  // emit Brain Sync / Harness event
//
//     // mutations (each returns the resulting record + emits events)
//     createAgent(input),
//     retireAgent(id, reason),
//     restoreAgent(id),
//     promote(id, toTier),
//     setTier(id, tier),
//     setStatus(id, status),
//     connectEngine(agentId, engine),
//     disconnectEngine(agentId, engineId),
//     assignTicket(ticketId, toAgentId, reason),
//     handoff(ticketId, fromId, toId, reason),
//     advanceTicket(ticketId, step),
//     requestApproval(actionId, payload),
//     resolveApproval(approvalId, decision, who),
//     pushBrainSyncEvent(evt),
//     pushHarnessEvent(evt),
//   };
//
// Tiers (data-driven, not hardcoded):
//   commander | lieutenant | specialist | worker | tool
//
// Agent Zero is seeded as commander and Hermes as lieutenant; Tony Legacy is retired. They are not
// special in code — any agent can be promoted to commander via
// promote(id, 'commander') after an owner approval.
// ============================================================

(function(){
  const TIERS       = ['commander', 'lieutenant', 'specialist', 'worker', 'tool'];
  const KINDS       = ['agent', 'engine', 'tool', 'integration', 'memory', 'channel'];
  const STATUSES    = ['online', 'idle', 'busy', 'degraded', 'offline', 'blocked', 'retired'];
  const TRANSPORTS  = ['local', 'rest', 'mcp', 'webhook', 'queue', 'script', 'cloud'];
  const RISK_LEVELS = ['low', 'medium', 'high'];

  const now = () => new Date().toISOString();
  const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);

  // --------------------------------------------------------
  // SEED — three real systems wired in.
  // 1. Mission Control / Bridge → Agent Zero commander, Hermes lieutenant
  // 2. OpenClaw / Gateway / Skills  → Hermes (proto), Codex,
  //                                   GitHub, Slack, FireCrawl,
  //                                   Browse, Deploy, Pndr, Zapier,
  //                                   n8n, MCP gateway
  // 3. Agent Zero supervisory layer  → already commander above
  //
  // Coords are tier-laned: y derived from tier, x evenly spread.
  // --------------------------------------------------------
  const SEED_AGENTS = [
    { id:'agent_zero', display_name:'Agent Zero', system_name:'agent-zero', kind:'agent',
      tier:'commander', role:'Ecosystem commander',
      description:'Primary command agent for Mission Control, Bridge, Brain, tools, models, skills, integrations, and agents. Executes only through owner-approved Bridge Sessions and registered adapters.',
      owner:'luis@to-knowledge.io', cluster:'Mission Control',
      status:'online', health_score:0.96, current_ticket_id:'agent_zero_cutover',
      current_task_summary:'Commanding the ecosystem through Mission Control / Bridge; production restart and model credential blockers are reported honestly.',
      permissions:['read:all','review:all','request:bridge_session','execute:approved_adapters'],
      capabilities:['command','plan','delegate','review','report','adapter_scoped_execute'],
      engines:['eng_openrouter','eng_mcp_gateway'],
      reports_to:'owner', supervises:['hermes','codex','meridian','eng_openrouter','eng_mcp_gateway','mem_obsidian','mem_mempalace','mem_graphify'],
      handoff_targets:['hermes','codex'],
      cost_today:1.24, token_usage_today:48_900,
      model_provider:'openrouter', default_model:'anthropic/claude-sonnet-4.5',
      risk_level:'medium', approval_required_actions:['open_bridge_session','external_write','memory_write','buildwiki_run_now','connector_execution'],
      memory_access_level:'read', brain_sync_enabled:true, harness_routing_enabled:true,
      source_of_truth:'mission_control_bridge', confidence_level:0.91, sync_state:'synced', last_sync_at:now(),
      created_at:'2025-09-15T00:00:00Z', updated_at:now(),
      color_token:'--cmd-2', icon:'ShieldCheck', badge:'Commander',
      locked:true,
    },
    { id:'tony_legacy', display_name:'Tony Legacy', system_name:'tony-legacy', kind:'agent',
      tier:'worker', role:'Retired commander archive',
      description:'Historical Tony workflow retained for audit and rollback only. Hidden from active owner-facing hierarchy.',
      owner:'luis@to-knowledge.io', cluster:'Archive',
      status:'retired', health_score:0, current_ticket_id:null,
      current_task_summary:'Retired. Must not answer as commander, own Brain Sync, or own new reports.',
      permissions:['read:archive'],
      capabilities:['archive_lookup'],
      engines:[],
      reports_to:null, supervises:[],
      handoff_targets:[],
      cost_today:0, token_usage_today:0,
      model_provider:null, default_model:null,
      risk_level:'low', approval_required_actions:[],
      memory_access_level:'none', brain_sync_enabled:false, harness_routing_enabled:false,
      source_of_truth:'legacy_archive', confidence_level:1, sync_state:'retired', last_sync_at:now(),
      created_at:'2025-09-01T00:00:00Z', updated_at:now(),
      color_token:'--muted', icon:'Archive', badge:'Retired · hidden', notes:'Archived only. Not an active commander.',
      locked:true, hidden:true,
    },
    { id:'meridian', display_name:'Meridian (proto)', system_name:'meridian', kind:'agent',
      tier:'lieutenant', role:'Integrations Commander (proposed)',
      description:'Example integrations commander. Demonstrates that ANY agent can be promoted to commander via tier field.',
      owner:'luis@to-knowledge.io', cluster:'OpenClaw',
      status:'idle', health_score:0.88,
      current_task_summary:'Awaiting integrations queue.',
      permissions:['read:integrations','write:integrations'],
      capabilities:['route','reconnect','probe'],
      engines:['eng_zapier','eng_n8n','eng_mcp_gateway'],
      reports_to:'agent_zero', supervises:['eng_zapier','eng_n8n','eng_github','eng_slack'],
      handoff_targets:['agent_zero','agent_zero','hermes'],
      cost_today:0.32, token_usage_today:11_200,
      model_provider:'openrouter', default_model:'anthropic/claude-haiku-4.5',
      risk_level:'medium', approval_required_actions:['promote_self','disconnect_critical'],
      memory_access_level:'scoped', brain_sync_enabled:true, harness_routing_enabled:true,
      sync_state:'synced', last_sync_at:now(),
      confidence_level:0.78,
      created_at:'2026-03-01T00:00:00Z', updated_at:now(),
      icon:'Compass', badge:'Lieutenant',
      promotable_to:['commander'],
    },
    { id:'hermes', display_name:'Hermes / Hermit', system_name:'hermes', kind:'agent',
      tier:'lieutenant', role:'Lieutenant / Skill and workflow specialist',
      description:'Assists Agent Zero with skills, workflows, integrations, automations, and operational plans. Execution remains Bridge Session gated.',
      owner:'luis@to-knowledge.io', cluster:'OpenClaw',
      status:'degraded', health_score:0.93, current_ticket_id:'tkt_4823',
      current_task_summary:'Drafting workflow: "Reviewed-PR → Slack #releases → Deploy".',
      permissions:['read:skills','write:skills','propose:workflow'],
      capabilities:['propose','compose','draft'],
      engines:['eng_github','eng_slack','eng_mcp_gateway'],
      reports_to:'agent_zero', supervises:['eng_github','eng_slack','eng_pndr'],
      handoff_targets:['agent_zero','codex'],
      cost_today:0.91, token_usage_today:34_100,
      model_provider:'openrouter', default_model:'anthropic/claude-sonnet-4.5',
      risk_level:'low', approval_required_actions:['publish_workflow'],
      memory_access_level:'scoped', brain_sync_enabled:true, harness_routing_enabled:true,
      sync_state:'synced', last_sync_at:now(),
      confidence_level:0.86,
      created_at:'2026-01-10T00:00:00Z', updated_at:now(),
      icon:'Sparkles', badge:'Lieutenant · pending',
      promotable_to:['commander'],
    },
    { id:'codex', display_name:'Codex', system_name:'codex', kind:'agent',
      tier:'specialist', role:'Code review / executor',
      description:'Reads diffs, runs PR-Reviewer, executes Git Essentials skills.',
      owner:'luis@to-knowledge.io', cluster:'OpenClaw',
      status:'online', health_score:0.95, current_ticket_id:'tkt_4824',
      current_task_summary:'Reviewing PR #218 (auth-rate-limit).',
      permissions:['read:repos','write:reviews','comment:pr'],
      capabilities:['review','test','comment','suggest_fix'],
      engines:['eng_github','eng_mcp_gateway'],
      reports_to:'agent_zero', supervises:[],
      handoff_targets:['agent_zero','hermes'],
      cost_today:0.62, token_usage_today:22_800,
      model_provider:'openrouter', default_model:'anthropic/claude-sonnet-4.5',
      risk_level:'low', approval_required_actions:['merge_pr','force_push'],
      memory_access_level:'scoped', brain_sync_enabled:true, harness_routing_enabled:true,
      sync_state:'synced', last_sync_at:now(),
      confidence_level:0.92,
      created_at:'2026-01-22T00:00:00Z', updated_at:now(),
      icon:'Code', badge:'Specialist',
      promotable_to:['lieutenant'],
    },
    { id:'zoom', display_name:'Zoom (planned)', system_name:'zoom', kind:'agent',
      tier:'worker', role:'Synchronized agent (planned)',
      description:'Future synchronized agent. Reserved slot. Disabled until provisioned.',
      owner:'luis@to-knowledge.io', cluster:'OpenClaw',
      status:'offline', health_score:0,
      current_task_summary:null,
      permissions:[], capabilities:[],
      engines:[],
      reports_to:'agent_zero', supervises:[], handoff_targets:[],
      cost_today:0, token_usage_today:0,
      risk_level:'low', approval_required_actions:[],
      memory_access_level:'none', brain_sync_enabled:false, harness_routing_enabled:false,
      sync_state:'unsynced',
      confidence_level:0,
      created_at:'2026-04-01T00:00:00Z', updated_at:now(),
      icon:'Clock', badge:'Planned',
      planned:true,
      promotable_to:['specialist','lieutenant','commander'],
    },

    // ---- Engines / tools / integrations (the bridge layer) ----
    { id:'eng_openrouter', display_name:'OpenRouter', system_name:'openrouter', kind:'engine',
      tier:'tool', role:'LLM gateway',
      description:'Primary LLM provider. All agent completions route through here.',
      cluster:'ClaudeClaw',
      status:'online', health_score:0.99,
      transport:'rest', endpoint:'https://openrouter.ai/api/v1',
      permissions_required:['read:secrets:openrouter'],
      cost_today:7.91, token_usage_today:289_400,
      risk_level:'medium', circuit_breaker:'closed',
      brain_sync_enabled:false, harness_routing_enabled:false,
      icon:'Zap', badge:'REST',
    },
    { id:'eng_mcp_gateway', display_name:'OpenClaw Gateway (MCP)', system_name:'openclaw-mcp', kind:'engine',
      tier:'tool', role:'MCP fan-out',
      description:'Exposes skills/tools over MCP. Bridges agents to OpenClaw skills layer.',
      cluster:'OpenClaw',
      status:'online', health_score:0.97,
      transport:'mcp', endpoint:'mcp://openclaw.local',
      permissions_required:['read:mcp_token'],
      cost_today:0, token_usage_today:0,
      risk_level:'medium', circuit_breaker:'closed',
      icon:'Plug', badge:'MCP',
    },
    { id:'eng_github', display_name:'GitHub', system_name:'github', kind:'integration',
      tier:'tool', role:'Repos · PRs · Reviews',
      description:'GitHub App. Used by Codex + Hermes.',
      cluster:'OpenClaw',
      status:'online', health_score:0.98,
      transport:'rest', endpoint:'https://api.github.com',
      permissions_required:['read:repo','write:reviews'],
      cost_today:0, token_usage_today:0,
      risk_level:'medium', circuit_breaker:'closed',
      icon:'GitBranch', badge:'REST',
    },
    { id:'eng_slack', display_name:'Slack', system_name:'slack', kind:'integration',
      tier:'tool', role:'Channels · DMs',
      description:'Slack Bot. Used by Hermes for #releases broadcast.',
      cluster:'OpenClaw',
      status:'online', health_score:0.99,
      transport:'rest', endpoint:'https://slack.com/api',
      permissions_required:['chat:write','channels:read'],
      risk_level:'low', circuit_breaker:'closed',
      icon:'Hash', badge:'REST',
    },
    { id:'eng_firecrawl', display_name:'FireCrawl', system_name:'firecrawl', kind:'engine',
      tier:'tool', role:'Web scrape · crawl',
      description:'Web Ops scrape provider. Currently rate-limited.',
      cluster:'OpenClaw',
      status:'degraded', health_score:0.62,
      transport:'rest', endpoint:'https://api.firecrawl.dev',
      permissions_required:['read:secrets:firecrawl'],
      cost_today:2.18, token_usage_today:0,
      risk_level:'low', circuit_breaker:'half-open',
      icon:'Globe', badge:'REST · Degraded',
      degraded_reason:'429s from upstream — retry budget 1/4',
    },
    { id:'eng_browse', display_name:'Browse', system_name:'browse', kind:'tool',
      tier:'tool', role:'Headless browser',
      description:'Local headless Chromium. Pages render here.',
      cluster:'OpenClaw',
      status:'idle', health_score:0.94,
      transport:'local', endpoint:'unix:///run/browse.sock',
      permissions_required:['exec:browse'],
      risk_level:'low', circuit_breaker:'closed',
      icon:'Monitor', badge:'Local',
    },
    { id:'eng_deploy', display_name:'Deploy Agent', system_name:'deploy-agent', kind:'tool',
      tier:'tool', role:'Pipeline trigger',
      description:'Triggers prod deploys. PROTECTED — owner approval required.',
      cluster:'OpenClaw',
      status:'idle', health_score:0.97,
      transport:'webhook', endpoint:'https://hooks.to-knowledge.io/deploy',
      permissions_required:['approve:high','exec:deploy'],
      risk_level:'high', circuit_breaker:'closed',
      icon:'Rocket', badge:'Webhook · High Risk',
      protected:true,
    },
    { id:'eng_pndr', display_name:'Pndr', system_name:'pndr', kind:'tool',
      tier:'tool', role:'Pondering / planner',
      description:'Long-context planner used by Hermes for workflow drafts.',
      cluster:'OpenClaw',
      status:'online', health_score:0.92,
      transport:'script', endpoint:'/skills/pndr.py',
      permissions_required:['exec:pndr'],
      risk_level:'low', circuit_breaker:'closed',
      icon:'Brain', badge:'Script',
    },
    { id:'eng_zapier', display_name:'Zapier', system_name:'zapier', kind:'integration',
      tier:'tool', role:'Zap routing',
      description:'Outbound automation routes.',
      cluster:'OpenClaw',
      status:'online', health_score:0.96,
      transport:'webhook', endpoint:'https://hooks.zapier.com/...',
      permissions_required:['exec:zap'],
      risk_level:'medium', circuit_breaker:'closed',
      icon:'Workflow', badge:'Webhook',
    },
    { id:'eng_n8n', display_name:'n8n', system_name:'n8n', kind:'integration',
      tier:'tool', role:'Self-hosted workflows',
      description:'Self-hosted automation runner.',
      cluster:'OpenClaw',
      status:'online', health_score:0.95,
      transport:'queue', endpoint:'amqp://n8n.internal',
      permissions_required:['exec:n8n'],
      risk_level:'medium', circuit_breaker:'closed',
      icon:'Network', badge:'Queue',
    },
    { id:'mem_tony', display_name:'Legacy Memory', system_name:'tony-memory', kind:'memory',
      tier:'tool', role:'Source of truth',
      description:'Legacy commander memory retained as archive; Agent Zero is the active command source.',
      cluster:'ClaudeClaw',
      status:'online', health_score:0.99,
      transport:'local', endpoint:'sqlite://memory/tony.db',
      permissions_required:['read:memory:tony','write:memory:tony'],
      risk_level:'high', circuit_breaker:'closed',
      icon:'Database', badge:'Memory · Locked',
      protected:true,
    },
    { id:'mem_brain_sync', display_name:'Brain Sync Store', system_name:'brain-sync', kind:'memory',
      tier:'tool', role:'Learning ledger',
      description:'Append-only ledger of confidence shifts, source-of-truth claims, memory proposals.',
      cluster:'ClaudeClaw',
      status:'online', health_score:0.97,
      transport:'local', endpoint:'sqlite://memory/brain-sync.db',
      permissions_required:['read:brain-sync','write:brain-sync'],
      risk_level:'medium', circuit_breaker:'closed',
      icon:'BookOpen', badge:'Memory · Append-only',
    },
  ];

  const SEED_TICKETS = [
    { id:'tkt_4821', title:'FireCrawl rate-limit incident', priority:'high',
      step:'In review', steps:['Open','Triage','In review','Fix','Verify','Close'],
      created_by:'agent_zero', current_owner:'tony',
      trail:[
        { at:'09:14', actor:'agent_zero', action:'flagged', note:'Cost spike +312% in 6h' },
        { at:'09:15', actor:'tony',       action:'claimed' },
        { at:'09:18', actor:'tony',       action:'handoff', to:'codex', note:'Investigate retry config' },
        { at:'09:31', actor:'codex',      action:'comment', note:'Retry budget too aggressive — proposing 1/4' },
        { at:'09:46', actor:'tony',       action:'review',  note:'Owner approval needed for prod change' },
      ],
      requires_approval:true, severity:'medium',
    },
    { id:'tkt_4823', title:'Workflow: Reviewed-PR → Slack → Deploy', priority:'medium',
      step:'Drafting', steps:['Open','Drafting','Propose','Approve','Publish'],
      created_by:'hermes', current_owner:'hermes',
      trail:[
        { at:'08:50', actor:'hermes', action:'opened', note:'Compose 3-step workflow' },
      ],
      requires_approval:false, severity:'low',
    },
    { id:'tkt_4824', title:'PR #218 — auth-rate-limit', priority:'medium',
      step:'In review', steps:['Open','In review','Suggested','Approved','Merged'],
      created_by:'codex', current_owner:'codex',
      trail:[
        { at:'09:02', actor:'codex', action:'opened' },
        { at:'09:09', actor:'codex', action:'comment', note:'Found edge case at 1k rps' },
      ],
      requires_approval:false, severity:'low',
    },
  ];

  const SEED_BRAIN_SYNC = [
    { id:uid('bs'), at:'09:46:12', kind:'confidence_shift', actor:'tony', target:'eng_firecrawl', delta:-0.18, note:'Confidence dropped after 3 consecutive 429s' },
    { id:uid('bs'), at:'09:42:01', kind:'memory_proposal',  actor:'agent_zero', target:'tony_memory', note:'Propose: cap FireCrawl retries at 1/4 by default', confidence:0.82 },
    { id:uid('bs'), at:'09:31:48', kind:'source_of_truth',  actor:'codex', target:'tkt_4821', note:'Marked codex as SoT for retry config' },
    { id:uid('bs'), at:'09:18:00', kind:'handoff_recorded', actor:'tony', target:'codex', note:'Ticket tkt_4821 → codex' },
    { id:uid('bs'), at:'09:14:22', kind:'flag',             actor:'agent_zero', target:'eng_firecrawl', note:'Cost spike +312% in 6h', severity:'medium' },
    { id:uid('bs'), at:'09:10:05', kind:'sync',             actor:'tony', target:'mem_brain_sync', note:'Daily sync complete · 41 events' },
  ];

  const SEED_HARNESS = [
    { id:uid('hr'), at:'09:46:13', route:'tony → owner', kind:'approval_request', ticket:'tkt_4821', payload:{ action:'apply_retry_cap', severity:'medium' } },
    { id:uid('hr'), at:'09:31:48', route:'tony → codex', kind:'handoff',          ticket:'tkt_4821' },
    { id:uid('hr'), at:'09:18:00', route:'agent_zero → tony', kind:'escalate',    ticket:'tkt_4821' },
    { id:uid('hr'), at:'09:14:22', route:'eng_firecrawl → agent_zero', kind:'flag', ticket:null, payload:{ reason:'cost_spike' } },
  ];

  const SEED_APPROVALS = [
    { id:'apv_001', at:'09:46:14', severity:'medium', requested_by:'tony',
      action:'apply_retry_cap', target:'eng_firecrawl',
      reason:'Cap retries at 1/4 to prevent further 429 cost spikes',
      ticket:'tkt_4821', status:'pending', resolves_in_min:15,
    },
    { id:'apv_002', at:'09:30:00', severity:'high', requested_by:'meridian',
      action:'promote_self', target:'meridian',
      reason:'Promote Meridian to commander of integrations cluster',
      ticket:null, status:'pending', resolves_in_min:60,
    },
  ];

  const SEED_COST = {
    spend_today: 18.42, budget_today: 50.00,
    by_agent: [
      { id:'agent_zero', spend:1.24, tokens:48_900, severity:'ok' },
      { id:'agent_zero', spend:1.24, tokens:48_900, severity:'ok' },
      { id:'hermes', spend:0.91, tokens:34_100, severity:'ok' },
      { id:'codex', spend:0.62, tokens:22_800, severity:'ok' },
      { id:'meridian', spend:0.32, tokens:11_200, severity:'ok' },
      { id:'eng_openrouter', spend:7.91, tokens:289_400, severity:'warn' },
      { id:'eng_firecrawl', spend:2.18, tokens:0, severity:'crit' },
    ],
    warnings: [
      { id:uid('w'), severity:'crit', target:'eng_firecrawl', note:'Cost +312% vs 7-day avg', at:'09:14' },
      { id:uid('w'), severity:'warn', target:'eng_openrouter', note:'On track to exceed daily budget by 18%', at:'09:50' },
    ],
  };

  // Add tier-based positions for canvas
  const TIER_LANE_Y = { commander: 110, lieutenant: 250, specialist: 380, worker: 500, tool: 620 };
  const positionAgent = (a, idx, perTier) => {
    const y = TIER_LANE_Y[a.tier] ?? 500;
    const cols = perTier[a.tier] || 1;
    const slot = (perTier[`__slot_${a.tier}`] = (perTier[`__slot_${a.tier}`] || 0) + 1);
    const x = (slot / (cols + 1)) * 100; // % across canvas
    return { ...a, x_position: x, y_position: y };
  };

  const seedWithPositions = (() => {
    const perTier = {};
    const visibleSeedAgents = SEED_AGENTS.filter(a => !a.hidden && a.status !== 'retired');
    visibleSeedAgents.forEach(a => { perTier[a.tier] = (perTier[a.tier] || 0) + 1; });
    return visibleSeedAgents.map((a, i) => positionAgent(a, i, perTier));
  })();

  // --------------------------------------------------------
  // STATE
  // --------------------------------------------------------
  let state = {
    agents: seedWithPositions,
    tickets: SEED_TICKETS,
    brain_sync: SEED_BRAIN_SYNC,
    harness: SEED_HARNESS,
    approvals: SEED_APPROVALS,
    cost: SEED_COST,
    activity_pulse: 0,  // tick counter for animated edges
  };

  const listeners = new Set();
  const notify = () => listeners.forEach(fn => { try { fn(state); } catch(_){} });

  // Tick pulse every 1.6s for live edges (purely visual but reads from
  // brain_sync/harness queues; no fake animation).
  setInterval(() => {
    state = { ...state, activity_pulse: state.activity_pulse + 1 };
    notify();
  }, 1600);

  // --------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------
  const update = (patch) => { state = { ...state, ...patch }; notify(); };
  const updateAgent = (id, patch) => {
    state = {
      ...state,
      agents: state.agents.map(a => a.id === id ? { ...a, ...patch, updated_at: now() } : a),
    };
    notify();
  };

  function pushBrainSyncEvent(evt) {
    const e = { id: uid('bs'), at: now().slice(11,19), ...evt };
    state = { ...state, brain_sync: [e, ...state.brain_sync].slice(0, 200) };
    notify();
    return e;
  }
  function pushHarnessEvent(evt) {
    const e = { id: uid('hr'), at: now().slice(11,19), ...evt };
    state = { ...state, harness: [e, ...state.harness].slice(0, 200) };
    notify();
    return e;
  }

  function createAgent(input) {
    const a = {
      id: input.id || uid('agt'),
      display_name: input.display_name || 'New Agent',
      system_name: input.system_name || 'new-agent',
      kind: input.kind || 'agent',
      tier: input.tier || 'specialist',
      role: input.role || '',
      description: input.description || '',
      owner: input.owner || 'luis@to-knowledge.io',
      cluster: input.cluster || 'OpenClaw',
      status: 'idle',
      health_score: 1.0,
      permissions: input.permissions || [],
      capabilities: input.capabilities || [],
      engines: input.engines || [],
      reports_to: input.reports_to || 'agent_zero',
      supervises: [],
      handoff_targets: input.handoff_targets || ['agent_zero'],
      cost_today: 0, token_usage_today: 0,
      model_provider: 'openrouter',
      default_model: input.default_model || 'anthropic/claude-haiku-4.5',
      risk_level: input.risk_level || 'low',
      approval_required_actions: input.approval_required_actions || [],
      memory_access_level: 'scoped',
      brain_sync_enabled: true,
      harness_routing_enabled: true,
      sync_state: 'unsynced',
      confidence_level: 0.5,
      created_at: now(), updated_at: now(),
      icon: input.icon || 'User',
      badge: input.tier ? input.tier[0].toUpperCase()+input.tier.slice(1) : 'New',
      x_position: 50, y_position: TIER_LANE_Y[input.tier || 'specialist'],
      promotable_to: ['commander','lieutenant','specialist','worker','tool'],
    };
    state = { ...state, agents: [...state.agents, a] };
    pushBrainSyncEvent({ kind:'agent_created', actor:input.created_by || 'luis', target:a.id, note:`Created ${a.display_name} as ${a.tier}` });
    pushHarnessEvent({ route:`${input.created_by || 'luis'} → registry`, kind:'create_agent', ticket:null, payload:{ id:a.id }});
    notify();
    return a;
  }

  function retireAgent(id, reason) {
    const a = state.agents.find(x => x.id === id);
    if (!a) return null;
    if (a.locked) {
      pushHarnessEvent({ route:`registry → owner`, kind:'blocked', ticket:null, payload:{ reason:'locked agent', id }});
      return null;
    }
    updateAgent(id, { status:'retired', retired_at:now(), retired_reason:reason });
    pushBrainSyncEvent({ kind:'agent_retired', actor:'luis', target:id, note:reason || 'Retired' });
    pushHarnessEvent({ route:`registry → ${id}`, kind:'retire', ticket:null });
    return state.agents.find(x => x.id === id);
  }

  function restoreAgent(id) {
    updateAgent(id, { status:'idle', retired_at:null, retired_reason:null });
    pushBrainSyncEvent({ kind:'agent_restored', actor:'luis', target:id });
    return state.agents.find(x => x.id === id);
  }

  function setTier(id, tier) {
    if (!TIERS.includes(tier)) return null;
    const a = state.agents.find(x => x.id === id);
    if (!a) return null;
    const oldTier = a.tier;
    updateAgent(id, { tier, y_position: TIER_LANE_Y[tier] });
    pushBrainSyncEvent({ kind:'tier_changed', actor:'luis', target:id, note:`${oldTier} → ${tier}` });
    pushHarnessEvent({ route:`luis → ${id}`, kind:'tier_change', ticket:null, payload:{ from:oldTier, to:tier }});
    return state.agents.find(x => x.id === id);
  }
  // promote/demote are convenience wrappers — UI calls these but they
  // both go through setTier so the data path is uniform.
  const promote = (id, toTier) => setTier(id, toTier || 'commander');
  const demote  = (id, toTier) => setTier(id, toTier || 'worker');

  function setStatus(id, status) {
    if (!STATUSES.includes(status)) return null;
    updateAgent(id, { status });
    pushBrainSyncEvent({ kind:'status_changed', actor:'system', target:id, note:status });
    return state.agents.find(x => x.id === id);
  }

  function connectEngine(agentId, engine) {
    const a = state.agents.find(x => x.id === agentId);
    if (!a) return null;
    const engines = Array.from(new Set([...(a.engines || []), engine.id]));
    updateAgent(agentId, { engines });
    pushBrainSyncEvent({ kind:'engine_connected', actor:'luis', target:agentId, note:`Connected ${engine.id} via ${engine.transport}` });
    pushHarnessEvent({ route:`${agentId} → ${engine.id}`, kind:'connect_engine', ticket:null, payload:{ transport: engine.transport, endpoint: engine.endpoint }});
    return state.agents.find(x => x.id === agentId);
  }

  function disconnectEngine(agentId, engineId) {
    const a = state.agents.find(x => x.id === agentId);
    if (!a) return null;
    updateAgent(agentId, { engines: (a.engines || []).filter(e => e !== engineId) });
    pushBrainSyncEvent({ kind:'engine_disconnected', actor:'luis', target:agentId, note:engineId });
    return state.agents.find(x => x.id === agentId);
  }

  function assignTicket(ticketId, toAgentId, reason) {
    const t = state.tickets.find(x => x.id === ticketId);
    if (!t) return null;
    const trail = [...t.trail, { at:now().slice(11,16), actor:'luis', action:'assign', to:toAgentId, note:reason }];
    state = {
      ...state,
      tickets: state.tickets.map(x => x.id === ticketId ? { ...x, current_owner:toAgentId, trail } : x),
    };
    notify();
    pushHarnessEvent({ route:`luis → ${toAgentId}`, kind:'assign_ticket', ticket:ticketId, payload:{ reason }});
    pushBrainSyncEvent({ kind:'ticket_assigned', actor:'luis', target:toAgentId, note:`${ticketId}: ${reason||'assigned'}` });
    return state.tickets.find(x => x.id === ticketId);
  }

  function handoff(ticketId, fromId, toId, reason) {
    const t = state.tickets.find(x => x.id === ticketId);
    if (!t) return null;
    const trail = [...t.trail, { at:now().slice(11,16), actor:fromId, action:'handoff', to:toId, note:reason }];
    state = {
      ...state,
      tickets: state.tickets.map(x => x.id === ticketId ? { ...x, current_owner:toId, trail } : x),
    };
    notify();
    pushHarnessEvent({ route:`${fromId} → ${toId}`, kind:'handoff', ticket:ticketId, payload:{ reason }});
    pushBrainSyncEvent({ kind:'handoff_recorded', actor:fromId, target:toId, note:`${ticketId}: ${reason||''}` });
    return state.tickets.find(x => x.id === ticketId);
  }

  function advanceTicket(ticketId, step) {
    const t = state.tickets.find(x => x.id === ticketId);
    if (!t) return null;
    const trail = [...t.trail, { at:now().slice(11,16), actor:t.current_owner, action:'advance', note:`→ ${step}` }];
    state = {
      ...state,
      tickets: state.tickets.map(x => x.id === ticketId ? { ...x, step, trail } : x),
    };
    notify();
    pushHarnessEvent({ route:`${t.current_owner} → harness`, kind:'advance', ticket:ticketId, payload:{ to:step }});
    return state.tickets.find(x => x.id === ticketId);
  }

  function requestApproval(actionId, payload) {
    const apv = {
      id: uid('apv'),
      at: now().slice(11,19),
      severity: payload.severity || 'medium',
      requested_by: payload.requested_by || 'tony',
      action: actionId,
      target: payload.target,
      reason: payload.reason,
      ticket: payload.ticket || null,
      status: 'pending',
      resolves_in_min: payload.resolves_in_min || 30,
    };
    state = { ...state, approvals: [apv, ...state.approvals] };
    notify();
    pushHarnessEvent({ route:`${apv.requested_by} → owner`, kind:'approval_request', ticket:apv.ticket, payload:{ action:actionId, severity:apv.severity }});
    pushBrainSyncEvent({ kind:'approval_requested', actor:apv.requested_by, target:apv.target, note:`${actionId} (${apv.severity})` });
    return apv;
  }

  function resolveApproval(approvalId, decision, who) {
    const apv = state.approvals.find(a => a.id === approvalId);
    if (!apv) return null;
    state = {
      ...state,
      approvals: state.approvals.map(a => a.id === approvalId ? { ...a, status: decision, resolved_by: who || 'luis', resolved_at: now() } : a),
    };
    notify();
    pushHarnessEvent({ route:`owner → ${apv.requested_by}`, kind:'approval_'+decision, ticket:apv.ticket, payload:{ action:apv.action }});
    pushBrainSyncEvent({ kind:'approval_'+decision, actor:who || 'luis', target:apv.target, note:apv.action });
    return state.approvals.find(a => a.id === approvalId);
  }

  // --------------------------------------------------------
  // React hook
  // --------------------------------------------------------
  function useRegistry() {
    const [snap, setSnap] = React.useState(state);
    React.useEffect(() => {
      const fn = (s) => setSnap(s);
      listeners.add(fn);
      return () => listeners.delete(fn);
    }, []);
    return snap;
  }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // --------------------------------------------------------
  // Lookups
  // --------------------------------------------------------
  function getAgent(id) { return state.agents.find(a => a.id === id) || null; }
  function getEngines() { return state.agents.filter(a => ['engine','tool','integration','memory'].includes(a.kind)); }
  function getCommanders() { return state.agents.filter(a => a.tier === 'commander' && a.status !== 'retired'); }
  function applyLiveSnapshot(patch) {
    state = {
      ...state,
      ...patch,
      agents: patch.agents || state.agents,
      tickets: patch.tickets || state.tickets,
      brain_sync: patch.brain_sync || state.brain_sync,
      harness: patch.harness || state.harness,
      approvals: patch.approvals || state.approvals,
      cost: patch.cost || state.cost,
      live_source: patch.live_source || 'mission-control-api',
      live_loaded_at: now(),
    };
    notify();
    return state;
  }

  window.AgentRegistry = {
    TIERS, KINDS, STATUSES, TRANSPORTS, RISK_LEVELS,
    useRegistry, subscribe,
    createAgent, retireAgent, restoreAgent,
    promote, demote, setTier, setStatus,
    connectEngine, disconnectEngine,
    assignTicket, handoff, advanceTicket,
    requestApproval, resolveApproval,
    pushBrainSyncEvent, pushHarnessEvent,
    getAgent, getEngines, getCommanders,
    applyLiveSnapshot,
  };
})();
