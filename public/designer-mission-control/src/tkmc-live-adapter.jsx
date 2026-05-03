// TKMC live adapter.
//
// Purpose: keep the designer-approved Mission Control interface visually intact
// while replacing local-only data with same-origin, auth-gated production
// read APIs. Protected/write buttons are deliberately blocked until their
// backend gates, audit chain, and owner approvals are implemented.
(function () {
  const nowIso = () => new Date().toISOString();
  const clock = () => new Date().toISOString().slice(11, 19);

  const STATUS_MAP = {
    active: 'online',
    configured: 'online',
    backup: 'idle',
    sandbox: 'idle',
    degraded: 'degraded',
    missing: 'blocked',
    missing_credential: 'blocked',
    blocked: 'blocked',
    disabled: 'offline',
    offline: 'offline',
  };

  const PROVIDER_META = {
    tony: {
      tier: 'archive',
      kind: 'agent',
      role: 'Retired commander archive',
      cluster: 'Archive',
      icon: 'Archive',
      badge: 'Retired · hidden',
      locked: true,
      memory: 'none',
      hidden: true,
    },
    tony_legacy: {
      tier: 'archive',
      kind: 'agent',
      role: 'Retired commander archive',
      cluster: 'Archive',
      icon: 'Archive',
      badge: 'Retired · hidden',
      locked: true,
      memory: 'none',
      hidden: true,
    },
    agent_zero: {
      tier: 'commander',
      kind: 'agent',
      role: 'Commander / ecosystem lead',
      cluster: 'Agent Zero',
      icon: 'ShieldCheck',
      badge: 'Commander',
      locked: true,
      memory: 'read',
    },
    hermes: {
      tier: 'lieutenant',
      kind: 'agent',
      role: 'Lieutenant / skill and workflow specialist',
      cluster: 'Hermes/Hermit',
      icon: 'Sparkles',
      badge: 'Lieutenant · pending',
      memory: 'scoped',
    },
    openrouter: {
      tier: 'tool',
      kind: 'engine',
      role: 'Multi-model router candidate',
      cluster: 'Providers',
      icon: 'Zap',
      badge: 'Model router',
    },
    nvidia: {
      tier: 'tool',
      kind: 'engine',
      role: 'NVIDIA / NIM provider candidate',
      cluster: 'Providers',
      icon: 'Cpu',
      badge: 'Provider',
    },
    openai: {
      tier: 'tool',
      kind: 'engine',
      role: 'OpenAI provider candidate',
      cluster: 'Providers',
      icon: 'Bot',
      badge: 'Provider',
    },
    ollama: {
      tier: 'tool',
      kind: 'engine',
      role: 'Local backup model provider',
      cluster: 'Local',
      icon: 'HardDrive',
      badge: 'Local backup',
    },
    claude_cli: {
      tier: 'tool',
      kind: 'engine',
      role: 'Claude CLI text route',
      cluster: 'ClaudeClaw',
      icon: 'Terminal',
      badge: 'CLI',
    },
    openclaw_gateway: {
      tier: 'tool',
      kind: 'integration',
      role: 'OpenClaw integration gateway',
      cluster: 'OpenClaw',
      icon: 'Plug',
      badge: 'Gateway',
    },
  };

  const LIVE_ENDPOINTS = {
    agents: '/api/agents',
    providers: '/api/bridge/providers',
    integrations: '/api/integrations',
    skills: '/api/skills',
    gateways: '/api/gateways',
    tasks: '/api/tasks',
    channels: '/api/channels',
    health: '/api/health-check',
    hermes: '/api/hermes',
    memory: '/api/memory/health',
  };

  const WRITE_BLOCKED_MESSAGE =
    'This control is live read-only right now. Production writes need owner-approved backend gates, audit chain, and rollback wiring.';

  const state = {
    loadedAt: null,
    endpoints: {},
    payloads: {},
    errors: {},
  };

  function normalizeId(value, fallback) {
    return String(value || fallback || 'item')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || String(fallback || 'item');
  }

  async function fetchJson(path) {
    const started = performance.now();
    const res = await fetch(path, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const ms = Math.round(performance.now() - started);

    if (!res.ok) {
      const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status} ${path}`);
      err.status = res.status;
      err.body = data;
      err.latency_ms = ms;
      throw err;
    }
    return { data, status: res.status, latency_ms: ms };
  }

  async function loadAll() {
    const entries = await Promise.all(Object.entries(LIVE_ENDPOINTS).map(async ([key, path]) => {
      try {
        const result = await fetchJson(path);
        return [key, { ok: true, ...result }];
      } catch (error) {
        return [key, {
          ok: false,
          status: error.status || 0,
          error: error.message || String(error),
          latency_ms: error.latency_ms || null,
        }];
      }
    }));

    const endpoints = Object.fromEntries(entries);
    const payloads = {};
    const errors = {};
    for (const [key, result] of entries) {
      if (result.ok) payloads[key] = result.data;
      else errors[key] = result;
    }

    state.loadedAt = nowIso();
    state.endpoints = endpoints;
    state.payloads = payloads;
    state.errors = errors;
    return state;
  }

  function endpointOk(name) {
    return state.endpoints[name]?.ok === true;
  }

  function disabledWrite(action) {
    return async function blockedWrite() {
      const err = new Error(`${action}: ${WRITE_BLOCKED_MESSAGE}`);
      err.code = 'OWNER_APPROVAL_REQUIRED';
      err.status = 423;
      throw err;
    };
  }

  function notifyBlockedWrite(action) {
    const detail = `${action || 'This action'} needs owner-approved backend write gates, audit chain, and rollback wiring before it can run.`;
    window.Notifications?.emit?.({
      kind: 'warn',
      source: 'bridge',
      title: 'Protected action locked',
      detail,
    });
    return null;
  }

  function lockRegistryWrites() {
    if (!window.AgentRegistry || window.AgentRegistry.__tkmcReadOnlyLocked) return;
    const locked = [
      'createAgent',
      'retireAgent',
      'restoreAgent',
      'promote',
      'demote',
      'setTier',
      'setStatus',
      'connectEngine',
      'disconnectEngine',
      'assignTicket',
      'handoff',
      'advanceTicket',
      'requestApproval',
      'resolveApproval',
    ];
    for (const key of locked) {
      window.AgentRegistry[key] = (...args) => notifyBlockedWrite(`Agent Network ${key}`);
    }
    window.AgentRegistry.__tkmcReadOnlyLocked = true;
  }

  function mapProviderStatus(provider) {
    return STATUS_MAP[provider?.state] || STATUS_MAP[provider?.status] || 'idle';
  }

  function mapProviderNode(provider, index, total) {
    const id = normalizeId(provider.id || provider.name, `provider_${index}`);
    const meta = PROVIDER_META[id] || {};
    const status = mapProviderStatus(provider);
    const tier = meta.tier || (provider.category === 'agent' ? 'specialist' : 'tool');
    const kind = meta.kind || (provider.category === 'agent' ? 'agent' : 'engine');
    const laneY = { commander: 14, lieutenant: 33, specialist: 52, worker: 71, tool: 88 }[tier] || 88;
    const slot = total > 1 ? index / Math.max(total - 1, 1) : 0.5;

    return {
      id,
      display_name: provider.name || id,
      system_name: id.replace(/_/g, '-'),
      kind,
      tier,
      role: meta.role || provider.category || 'Provider',
      description: provider.detail?.notes || provider.next_action || 'Live provider registry entry.',
      owner: 'owner',
      cluster: meta.cluster || provider.category || 'Mission Control',
      status,
      health_score: status === 'online' ? 0.98 : status === 'degraded' ? 0.62 : status === 'blocked' ? 0.2 : 0.72,
      current_ticket_id: null,
      current_task_summary: provider.next_action || provider.detail?.notes || null,
      permissions: kind === 'agent' ? ['observe', 'recommend', 'review'] : ['observe'],
      capabilities: kind === 'agent' ? ['observe', 'recommend', 'review'] : ['status', 'health'],
      engines: [],
      reports_to: id === 'agent_zero' ? 'owner' : id === 'hermes' ? 'agent_zero' : id === 'tony' || id === 'tony_legacy' ? null : 'agent_zero',
      supervises: id === 'agent_zero' ? ['hermes'] : [],
      handoff_targets: id === 'agent_zero' ? ['hermes'] : id === 'tony' || id === 'tony_legacy' ? [] : ['agent_zero', 'hermes'],
      cost_today: 0,
      token_usage_today: 0,
      model_provider: provider.category === 'model_provider' ? id : null,
      default_model: provider.detail?.model || provider.detail?.default_model || null,
      risk_level: id === 'agent_zero' ? 'high' : id === 'tony' || id === 'tony_legacy' ? 'low' : provider.next_action ? 'medium' : 'low',
      approval_required_actions: ['credentials', 'memory_write', 'governance_change', 'service_restart', 'deploy', 'external_access'],
      memory_access_level: meta.memory || 'none',
      brain_sync_enabled: id === 'agent_zero' || id === 'hermes',
      harness_routing_enabled: true,
      source_of_truth: 'mission-control-api',
      confidence_level: provider.state === 'active' || provider.state === 'configured' ? 0.95 : 0.72,
      sync_state: endpointOk('providers') ? 'synced' : 'unsynced',
      last_sync_at: provider.last_checked ? new Date(provider.last_checked * 1000).toISOString() : state.loadedAt,
      created_at: state.loadedAt,
      updated_at: state.loadedAt,
      color_token: id === 'agent_zero' ? '--accent' : undefined,
      icon: meta.icon || 'Plug',
      badge: meta.badge || provider.state || 'Provider',
      locked: !!meta.locked,
      hidden: !!meta.hidden,
      archived: id === 'tony' || id === 'tony_legacy',
      endpoint: provider.detail?.endpoint || null,
      x_position: 8 + slot * 84,
      y_position: laneY,
    };
  }

  function mapMissionAgent(agent, index) {
    const id = normalizeId(agent.name || agent.id, `agent_${agent.id || index}`);
    const rawStatus = (agent.runtime_status && agent.runtime_status !== 'unknown')
      ? agent.runtime_status
      : (agent.status || agent.state || 'idle');
    const status = rawStatus === 'running' || rawStatus === 'active' || rawStatus === 'live' ? 'online'
      : rawStatus === 'error' || rawStatus === 'failed' ? 'degraded'
      : rawStatus === 'offline' ? 'offline'
      : 'idle';

    return {
      id,
      name: agent.display_name || agent.name || id,
      role: agent.role || agent.type || 'agent',
      status: status === 'online' ? 'live' : status,
      load: agent.load || 0,
      handled: agent.handled || 0,
      sla: agent.sla || 0,
      channels: agent.channels || [],
      model: agent.model || agent.default_model || '—',
      since: agent.created_at || '—',
    };
  }

  function mapSkill(skill) {
    return {
      id: skill.id,
      name: skill.name || skill.id,
      version: skill.version || '—',
      deps: [skill.source || 'workspace'],
      usage: 0,
      status: skill.security_status === 'blocked' ? 'blocked' : 'valid',
      updated: skill.path || '—',
    };
  }

  function mapIntegration(integration) {
    const configured = integration.status === 'connected' || integration.status === 'ok';
    const warn = integration.status === 'degraded' || integration.status === 'warning';
    const firstVar = integration.envVars ? Object.values(integration.envVars)[0] : null;
    return {
      id: integration.id,
      name: integration.name || integration.id,
      glyph: (integration.name || integration.id || '?').slice(0, 1).toUpperCase(),
      category: integration.categoryLabel || integration.category || 'Integration',
      status: configured ? 'ok' : warn ? 'warn' : 'muted',
      lastSync: integration.lastSync || integration.updatedAt || 'live',
      tokenDays: firstVar?.set ? 365 : 0,
      enabled: configured || warn,
      credential_status: firstVar?.set ? 'configured' : 'missing',
      assigned_agent: integration.assigned_agent || null,
    };
  }

  function mapTask(task) {
    return {
      id: String(task.project_ticket_no || task.id),
      title: task.title || 'Untitled task',
      agent: task.assigned_to || null,
      progress: task.metadata?.progress || (task.status === 'done' ? 100 : 0),
      priority: task.priority || 'med',
      deadline: task.due_date || '—',
      status: task.status || 'pending',
      lane: task.metadata?.lane || 'Mission',
      start: 0.1,
      end: 0.7,
      customer: task.project_name || 'Mission Control',
    };
  }

  function buildChannels(payload) {
    if (payload?.channelOrder?.length) {
      return payload.channelOrder.map((id) => {
        const channel = payload.channels?.[id] || {};
        return {
          id,
          key: id.toUpperCase(),
          enabled: !!channel.enabled,
          health: channel.status || channel.health || 'ok',
          assigned: channel.assigned_agent || null,
          routing: channel.routing || 'Live Mission Control channel',
          rate: channel.rate || '—',
        };
      });
    }
    return window.CHANNELS || [];
  }

  function updateGlobals(payloads) {
    if (payloads.agents?.agents) window.AGENTS = payloads.agents.agents.map(mapMissionAgent);
    if (payloads.skills?.skills) window.SKILLS = payloads.skills.skills.map(mapSkill);
    if (payloads.integrations?.integrations) window.INTEGRATIONS = payloads.integrations.integrations.map(mapIntegration);
    if (payloads.tasks?.tasks) window.TICKETS = payloads.tasks.tasks.map(mapTask);
    if (payloads.channels) window.CHANNELS = buildChannels(payloads.channels);

    const healthChecks = payloads.health?.checks || [];
    if (healthChecks.length) {
      window.ALERTS = healthChecks
        .filter((check) => check.status && check.status !== 'healthy')
        .slice(0, 8)
        .map((check, index) => ({
          id: `live_${index}`,
          level: check.status === 'critical' ? 'err' : 'warn',
          msg: `${check.name}: ${check.message || check.status}`,
          time: 'live',
          area: check.category || 'System',
          actionable: check.status !== 'healthy',
        }));
    }
  }

  function buildRegistrySnapshot(payloads) {
    const providers = payloads.providers?.providers || [];
    const providerNodes = providers
      .map((provider, index) => mapProviderNode(provider, index, providers.length))
      .filter((node) => !node.hidden && node.status !== 'retired' && node.id !== 'tony' && node.id !== 'tony_legacy');

    const health = payloads.health;
    const memory = payloads.memory;
    const gateways = payloads.gateways?.gateways || [];
    const skills = payloads.skills?.skills || [];

    const brainSync = [
      {
        id: 'bs_live_providers',
        at: clock(),
        kind: 'provider_registry',
        actor: 'mission-control',
        target: 'bridge-mode',
        note: `${providers.length} providers loaded from /api/bridge/providers`,
        severity: providers.length ? 'info' : 'medium',
      },
      {
        id: 'bs_live_memory',
        at: clock(),
        kind: 'brain_sync_health',
        actor: 'brain-sync',
        target: 'memory',
        note: memory ? `Memory health ${memory.overall || 'unknown'} (${memory.overallScore ?? '—'})` : 'Memory health endpoint unavailable',
        severity: memory?.overall === 'healthy' ? 'info' : 'medium',
      },
      {
        id: 'bs_live_skills',
        at: clock(),
        kind: 'skills_inventory',
        actor: 'openclaw',
        target: 'skills',
        note: `${skills.length} skills visible from /api/skills`,
        severity: 'info',
      },
    ];

    const harness = [
      ...providers.map((provider) => ({
        id: `hr_${normalizeId(provider.id || provider.name)}`,
        at: clock(),
        route: `Mission Control → ${provider.name || provider.id}`,
        kind: provider.state || 'status',
        ticket: null,
        payload: {
          endpoint: provider.detail?.endpoint || null,
          next_action: provider.next_action || null,
        },
      })),
      ...gateways.map((gateway) => ({
        id: `hr_gateway_${gateway.id}`,
        at: clock(),
        route: `Mission Control → OpenClaw Gateway ${gateway.host}:${gateway.port}`,
        kind: gateway.status || 'gateway',
        ticket: null,
        payload: { token_set: !!gateway.token_set, latency: gateway.latency },
      })),
    ];

    return {
      agents: providerNodes,
      brain_sync: brainSync,
      harness,
      approvals: [
        {
          id: 'apv_bridge_writes_locked',
          at: clock(),
          severity: 'high',
          requested_by: 'mission-control',
          action: 'protected_bridge_writes',
          target: 'bridge-mode',
          reason: 'Read-only Bridge Mode is live. Protected execution needs owner-approved schema, HTTP 423 gates, and audit chain.',
          ticket: null,
          status: 'pending',
          resolves_in_min: 0,
        },
      ],
      cost: {
        budget_today: 25,
        spend_today: providers.reduce((sum, provider) => sum + (provider.detail?.cost_today || 0), 0),
        warnings: [],
        by_agent: providerNodes.map((node) => ({
          id: node.id,
          spend: node.cost_today || 0,
          tokens: node.token_usage_today || 0,
          severity: node.status === 'degraded' || node.status === 'blocked' ? 'warn' : 'ok',
        })),
      },
    };
  }

  function installReadOnlyApi(payloads) {
    if (!window.api) window.api = {};

    const mappedAgents = (payloads.agents?.agents || []).map(mapMissionAgent);
    const mappedIntegrations = (payloads.integrations?.integrations || []).map(mapIntegration);
    const mappedSkills = (payloads.skills?.skills || []).map(mapSkill);
    const mappedTasks = (payloads.tasks?.tasks || []).map(mapTask);
    const mappedChannels = buildChannels(payloads.channels);

    const live = {
      providers: {
        async list() { return payloads.providers || (await fetchJson(LIVE_ENDPOINTS.providers)).data; },
      },
      health: {
        async get() { return payloads.health || (await fetchJson(LIVE_ENDPOINTS.health)).data; },
      },
      agents: {
        async list() {
          if (mappedAgents.length) return mappedAgents;
          return ((await fetchJson(LIVE_ENDPOINTS.agents)).data.agents || []).map(mapMissionAgent);
        },
        restart: disabledWrite('Restart agent'),
        stop: disabledWrite('Stop agent'),
        start: disabledWrite('Start agent'),
        reconnect: disabledWrite('Reconnect agent'),
        async logs(id) {
          return {
            stream: null,
            endpoint: `/api/agents/${id}/logs`,
            shadow: ['Live log streaming is not enabled in this designer shell yet. Use Mission Control diagnostics for full logs.'],
          };
        },
      },
      integrations: {
        async list() {
          if (mappedIntegrations.length) return mappedIntegrations;
          return ((await fetchJson(LIVE_ENDPOINTS.integrations)).data.integrations || []).map(mapIntegration);
        },
        setEnabled: disabledWrite('Toggle integration'),
        setAssignedAgent: disabledWrite('Assign integration'),
        test: disabledWrite('Test integration'),
      },
      skills: {
        async list() {
          if (mappedSkills.length) return mappedSkills;
          return ((await fetchJson(LIVE_ENDPOINTS.skills)).data.skills || []).map(mapSkill);
        },
        setStatus: disabledWrite('Change skill status'),
        retire: disabledWrite('Retire skill'),
        register: disabledWrite('Register skill'),
      },
      gateways: {
        async list() { return (payloads.gateways || (await fetchJson(LIVE_ENDPOINTS.gateways)).data).gateways || []; },
      },
      tasks: {
        async list() {
          if (mappedTasks.length) return mappedTasks;
          return ((await fetchJson(LIVE_ENDPOINTS.tasks)).data.tasks || []).map(mapTask);
        },
        create: disabledWrite('Create task'),
        update: disabledWrite('Update task'),
      },
      channels: {
        async list() {
          if (mappedChannels.length) return mappedChannels;
          return buildChannels((await fetchJson(LIVE_ENDPOINTS.channels)).data);
        },
        setEnabled: disabledWrite('Toggle channel'),
        assignAgent: disabledWrite('Assign channel'),
        setCredentials: disabledWrite('Set channel credentials'),
        test: disabledWrite('Test channel'),
      },
      alerts: {
        async list() { return window.ALERTS || []; },
        acknowledge: disabledWrite('Acknowledge alert'),
        resolve: disabledWrite('Resolve alert'),
        emit: disabledWrite('Emit alert'),
      },
      hermes: {
        async status() { return payloads.hermes || (await fetchJson(LIVE_ENDPOINTS.hermes)).data; },
      },
      memory: {
        async health() { return payloads.memory || (await fetchJson(LIVE_ENDPOINTS.memory)).data; },
      },
      audit: {
        async list() { return []; },
        async export() { return JSON.stringify({ generated_at: nowIso(), note: 'Audit export is blocked in designer read-only mode.' }, null, 2); },
        async emit() { return null; },
      },
    };

    Object.assign(window.api, live);
    window.TKMC_LIVE_API = live;
    window.API_BASE = '';
    window.API_HTTP_READY = true;
    window.API_HTTP_HEALTH = payloads.health || null;
  }

  async function refresh() {
    const snapshot = await loadAll();
    installReadOnlyApi(snapshot.payloads);
    updateGlobals(snapshot.payloads);

    if (window.AgentRegistry?.applyLiveSnapshot) {
      window.AgentRegistry.applyLiveSnapshot(buildRegistrySnapshot(snapshot.payloads));
      lockRegistryWrites();
    }

    window.dispatchEvent(new CustomEvent('tkmc:live-data', {
      detail: {
        loadedAt: snapshot.loadedAt,
        endpoints: snapshot.endpoints,
        errors: snapshot.errors,
      },
    }));
    window.dispatchEvent(new CustomEvent('api:http-ready', { detail: snapshot.payloads.health || null }));
    return snapshot;
  }

  window.TKMC_LIVE_BRIDGE = {
    state,
    endpoints: LIVE_ENDPOINTS,
    refresh,
    blockedWrite: notifyBlockedWrite,
    writeStatus: 'blocked_until_owner_approved_gates',
  };

  refresh().catch((error) => {
    window.API_HTTP_READY = false;
    window.API_HTTP_ERROR = error;
    window.dispatchEvent(new CustomEvent('tkmc:live-data-error', { detail: { error: error.message || String(error) } }));
    console.warn('[tkmc] live adapter failed', error);
  });

  setInterval(() => {
    refresh().catch((error) => console.warn('[tkmc] live refresh failed', error));
  }, 60000);
})();
