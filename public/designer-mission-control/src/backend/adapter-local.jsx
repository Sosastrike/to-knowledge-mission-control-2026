// ============================================================
// Local adapter — implements the storage contract against
// localStorage. Identical signature to the future real-backend
// adapter so the API client never knows which is in use.
//
// Signature (async-style, promise-returning):
//   read(table)                 → row[]
//   readOne(table, pk)          → row | null
//   insert(table, row)          → row (with pk populated)
//   update(table, pk, patch)    → row
//   remove(table, pk)           → void
//   count(table)                → number
//
// The adapter also ENFORCES the schema invariants. The API
// client adds permission guards + audit events on top.
// ============================================================

const LOCAL_PREFIX = 'tkmc.bk.';

function _load(table){
  try { return JSON.parse(localStorage.getItem(LOCAL_PREFIX + table)) || []; }
  catch(e){ return []; }
}
function _save(table, rows){
  try { localStorage.setItem(LOCAL_PREFIX + table, JSON.stringify(rows)); } catch(e){}
}
function _uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2, 10); }

// ── Seed the store once, from the existing admin localStorage
// ── used by the prototype (so we don't double up data).
const SEED_VERSION = '5';  // bump to run new-table backfills without wiping old data

function _seedIfEmpty(){
  const seededAt = localStorage.getItem(LOCAL_PREFIX + '_seeded');
  if (seededAt === SEED_VERSION) return;
  const isFirstRun = !seededAt;
  const isUpgrade  = seededAt && seededAt !== SEED_VERSION;

  // On upgrade, leave existing backend tables alone; only backfill
  // NEW tables introduced in this version. On first run, seed everything.
  if (isFirstRun) {
    // Migrate existing admin.users → workspace_users + role_assignments + security
    const legacy = (() => {
      try { return JSON.parse(localStorage.getItem('tkmc.admin.users')) || []; }
      catch(e){ return []; }
    })();

    const users = []; const roles = []; const sec = [];
    for (const u of legacy) {
      users.push({
        id: u.id, name: u.name, email: u.email, title: u.title || null,
        isTony: !!u.isTony, isAgent: !!u.isAgent, active: u.active !== false,
        invited: u.invited, created_by: 'seed',
      });
      roles.push({ user_id: u.id, role: u.role, assigned_by: 'seed', assigned_at: u.invited });
      sec.push({ user_id: u.id, twoFA: u.twoFA || 'off', twoFA_secret_ref: null, last_reauth_at: null, backup_codes_ref: null });
    }
    _save('workspace_users', users);
    _save('workspace_role_assignments', roles);
    _save('user_security', sec);

    // Migrate security policy (cap reauth at 72h)
    const legacyPolicy = (() => {
      try { return JSON.parse(localStorage.getItem('tkmc.admin.security_policy')) || null; }
      catch(e){ return null; }
    })();
    const basePolicy = {
      workspace_id: 'w_default',
      enforce2faAdmins: true,
      enforce2faAll: false,
      reauthHours: 72,
      sessionLifetimeHours: 8,
      requireSsoForAdmins: false,
      allowedTwoFAMethods: { totp:true, webauthn:true, sms:false, email:false },
      updated_by: 'seed', updated_at: new Date().toISOString(),
    };
    if (legacyPolicy) {
      Object.assign(basePolicy, legacyPolicy);
      basePolicy.reauthHours = Math.min(72, Math.max(1, legacyPolicy.reauthHours || 72));
    }
    _save('workspace_security_policy', [basePolicy]);

    _save('auth_sessions', []);
    _save('audit_events', []);
    _save('workspace_sso_connections', [{
      workspace_id:'w_default',
      provider: legacyPolicy?.sso?.provider || 'none',
      status:   legacyPolicy?.sso?.status   || 'not_configured',
      callback_url: null, metadata_ref: null,
      updated_by:'seed', updated_at: new Date().toISOString(),
    }]);
    _save('workspace_ip_allowlist', (legacyPolicy?.ipAllowlist || []).map(cidr => ({
      id: _uid('ip'), cidr, created_by:'seed', created_at: new Date().toISOString(), note: null,
    })));
    _save('workspace_api_tokens', []);
  }

  // ── Models · registry + routing (backfill if empty) ─────
  if (_load('provider_models').length === 0) {
    const legacyModels = (() => {
      try { return JSON.parse(localStorage.getItem('tkmc.admin.models')) || null; }
      catch(e){ return null; }
    })();
    const defaultModels = [
      { id:'opus-4.6',    provider:'Anthropic', family:'frontier', ctx:'200k', cost:'$15 / $75',  wired:false },
      { id:'sonnet-4.6',  provider:'Anthropic', family:'balanced', ctx:'200k', cost:'$3 / $15',   wired:false },
      { id:'haiku-4.5',   provider:'Anthropic', family:'fast',     ctx:'200k', cost:'$0.8 / $4',  wired:false },
      { id:'gpt-5',       provider:'OpenAI',    family:'frontier', ctx:'200k', cost:'$10 / $30',  wired:false },
      { id:'gpt-5-mini',  provider:'OpenAI',    family:'fast',     ctx:'128k', cost:'$0.5 / $2',  wired:false },
      { id:'voyage-3',    provider:'Voyage',    family:'embedding',ctx:'32k',  cost:'$0.12',      wired:false },
    ];
    const seedModels = (legacyModels || defaultModels).map(m => ({
      ...m,
      key_ref: m.wired ? 'vault://legacy/' + m.id : null,
      updated_by: 'seed', updated_at: new Date().toISOString(),
    }));
    _save('provider_models', seedModels);
  }

  if (_load('agent_model_routing').length === 0) {
    const legacyRouting = (() => {
      try { return JSON.parse(localStorage.getItem('tkmc.admin.models_routing')) || null; }
      catch(e){ return null; }
    })();
    const defaultRouting = {
      insight:    { primary:'sonnet-4.6', fallback:'haiku-4.5', embedding:'voyage-3', priority:'quality' },
      research:   { primary:'opus-4.6',   fallback:'sonnet-4.6', embedding:'voyage-3', priority:'quality' },
      inbox:      { primary:'haiku-4.5',  fallback:'sonnet-4.6', embedding:'voyage-3', priority:'speed' },
      scheduler:  { primary:'haiku-4.5',  fallback:'sonnet-4.6', embedding:'voyage-3', priority:'cost' },
      meetings:   { primary:'sonnet-4.6', fallback:'haiku-4.5',  embedding:'voyage-3', priority:'speed' },
    };
    const routingSource = legacyRouting || defaultRouting;
    _save('agent_model_routing', Object.entries(routingSource).map(([k, v]) => ({
      agent_key: k, ...v, updated_by:'seed', updated_at: new Date().toISOString(),
    })));
  }

  // ── Integrations (backfill if empty) ────────────────────
  if (_load('workspace_integrations').length === 0) {
    const legacyInts = (() => {
      try { return JSON.parse(localStorage.getItem('tkmc.admin.integrations_pro')) || null; }
      catch(e){ return null; }
    })();
    const defaultInts = [
      { id:'telegram',  name:'Telegram',         category:'Messaging', enabled:true,  credential_status:'ok',      health:'ok',   last_sync:'live', assigned_agent:'main',     error:null },
      { id:'discord',   name:'Discord',          category:'Messaging', enabled:false, credential_status:'missing', health:'idle', last_sync:null,   assigned_agent:null,       error:null },
      { id:'whatsapp',  name:'WhatsApp',         category:'Messaging', enabled:true,  credential_status:'expiring',health:'warn', last_sync:'47m',  assigned_agent:'main',     error:'Token expires in 14 days' },
      { id:'x',         name:'X / Twitter',      category:'Social',    enabled:false, credential_status:'missing', health:'idle', last_sync:null,   assigned_agent:null,       error:null },
      { id:'instagram', name:'Instagram',        category:'Social',    enabled:true,  credential_status:'ok',      health:'warn', last_sync:'11m',  assigned_agent:'main',     error:'Rate limit 60%' },
      { id:'linkedin',  name:'LinkedIn',         category:'Social',    enabled:false, credential_status:'missing', health:'idle', last_sync:null,   assigned_agent:null,       error:null },
      { id:'zoho',      name:'Zoho Desk',        category:'Tickets',   enabled:true,  credential_status:'ok',      health:'ok',   last_sync:'2m',   assigned_agent:'inbox',    error:null },
      { id:'smtp',      name:'SMTP / Email',     category:'Email',     enabled:true,  credential_status:'ok',      health:'ok',   last_sync:'live', assigned_agent:'inbox',    error:null },
      { id:'openrouter',name:'OpenRouter',       category:'Models',    enabled:false, credential_status:'missing', health:'idle', last_sync:null,   assigned_agent:null,       error:null },
      { id:'firecrawl', name:'FireCrawl',        category:'Web',       enabled:true,  credential_status:'ok',      health:'ok',   last_sync:'8m',   assigned_agent:'research', error:null },
      { id:'mempalace', name:'MemPalace',        category:'Memory',    enabled:true,  credential_status:'ok',      health:'ok',   last_sync:'1m',   assigned_agent:'insight',  error:null },
      { id:'obsidian',  name:'Obsidian',         category:'Memory',    enabled:false, credential_status:'missing', health:'idle', last_sync:null,   assigned_agent:null,       error:null },
    ];
    let seedInts;
    if (legacyInts) {
      seedInts = legacyInts.map(x => ({
        id: x.id, name: x.name, category: x.category,
        enabled: !!x.on,
        credential_status: x.credential || 'missing',
        health: x.health || 'idle',
        last_sync: x.lastSync === '—' ? null : x.lastSync,
        assigned_agent: x.assigned || null,
        error: x.error || null,
        credential_ref: x.credential === 'ok' || x.credential === 'expiring' ? 'vault://legacy/' + x.id : null,
        updated_by:'seed', updated_at: new Date().toISOString(),
      }));
    } else {
      seedInts = defaultInts.map(x => ({
        ...x,
        credential_ref: x.credential_status === 'missing' ? null : 'vault://legacy/' + x.id,
        updated_by:'seed', updated_at: new Date().toISOString(),
      }));
    }
    _save('workspace_integrations', seedInts);
  }

  // ── Agent runtime (supervisor shadow) ───────────────────
  if (_load('agent_runtime').length === 0) {
    const runtimeAgents = (window.AGENTS || []).map(a => ({
      agent_id: a.id, status: a.status || 'live',
      last_heartbeat_at: new Date().toISOString(),
      pid: null, restart_count: 0, last_restart_at: null, last_restart_by: null,
    }));
    _save('agent_runtime', runtimeAgents);
  }

  // ── Email profiles ──────────────────────────────────────
  if (_load('email_profiles').length === 0) {
    _save('email_profiles', [
      { id:'prf_001', profile_name:'Zoom Invitations',            provider_type:'zoom',      from_address:'invitations@toknowledge.ai', purpose:'Invitations',          status:'active',            credential_ref:'vault://email/prf_001', last_test_at:'2m ago',  is_default:true,  updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'prf_002', profile_name:'Microsoft 365 Notifications', provider_type:'m365',      from_address:'m365@toknowledge.ai',        purpose:'System Notifications', status:'active',            credential_ref:'vault://email/prf_002', last_test_at:'15m ago', is_default:false, updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'prf_003', profile_name:'General Invitations',         provider_type:'generic',   from_address:'teams@toknowledge.ai',       purpose:'Invitations',          status:'active',            credential_ref:'vault://email/prf_003', last_test_at:'1h ago',  is_default:false, updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'prf_004', profile_name:'Support / Alerts',            provider_type:'ses',       from_address:'support@toknowledge.ai',     purpose:'Support / Alerts',     status:'needs_credentials', credential_ref:null,                    last_test_at:'—',       is_default:false, updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'prf_005', profile_name:'Custom SMTP',                 provider_type:'postmark',  from_address:'no-reply@toknowledge.ai',    purpose:'Transactional',        status:'active',            credential_ref:'vault://email/prf_005', last_test_at:'3h ago',  is_default:false, updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'prf_006', profile_name:'AgentMail',                   provider_type:'agentmail', from_address:'agents@toknowledge.ai',      purpose:'Agent outbound',       status:'api_not_wired',     credential_ref:null,                    last_test_at:'—',       is_default:false, updated_by:'seed', updated_at:new Date().toISOString() },
    ]);
  }
  if (_load('email_addresses').length === 0) {
    _save('email_addresses', [
      { id:'addr_01', email:'invitations@toknowledge.ai', verified:true,  used_by:'Zoom Invitations',            status:'verified',             dkim_ref:'vault://dkim/addr_01', spf_ref:null, updated_at:new Date().toISOString() },
      { id:'addr_02', email:'teams@toknowledge.ai',       verified:true,  used_by:'General Invitations',         status:'verified',             dkim_ref:'vault://dkim/addr_02', spf_ref:null, updated_at:new Date().toISOString() },
      { id:'addr_03', email:'support@toknowledge.ai',     verified:false, used_by:'Support / Alerts',            status:'needs_verification',   dkim_ref:null,                   spf_ref:null, updated_at:new Date().toISOString() },
      { id:'addr_04', email:'m365@toknowledge.ai',        verified:true,  used_by:'Microsoft 365 Notifications', status:'verified',             dkim_ref:'vault://dkim/addr_04', spf_ref:null, updated_at:new Date().toISOString() },
      { id:'addr_05', email:'no-reply@toknowledge.ai',    verified:true,  used_by:'Custom SMTP',                 status:'verified',             dkim_ref:'vault://dkim/addr_05', spf_ref:null, updated_at:new Date().toISOString() },
      { id:'addr_06', email:'agents@toknowledge.ai',      verified:false, used_by:'AgentMail',                   status:'api_not_wired',        dkim_ref:null,                   spf_ref:null, updated_at:new Date().toISOString() },
    ]);
  }
  if (_load('email_routing').length === 0) {
    _save('email_routing', [
      { id:'rt_01', email_type:'User Invitations',     assigned_profile_id:'prf_001', from_address:'invitations@toknowledge.ai', status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_02', email_type:'Team Invitations',     assigned_profile_id:'prf_003', from_address:'teams@toknowledge.ai',       status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_03', email_type:'System Notifications', assigned_profile_id:'prf_002', from_address:'m365@toknowledge.ai',        status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_04', email_type:'Alerts & Monitoring',  assigned_profile_id:'prf_004', from_address:'support@toknowledge.ai',     status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_05', email_type:'Transactional Emails', assigned_profile_id:'prf_005', from_address:'no-reply@toknowledge.ai',    status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_06', email_type:'Password Reset',       assigned_profile_id:'prf_001', from_address:'invitations@toknowledge.ai', status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
      { id:'rt_07', email_type:'Agent Outbound',       assigned_profile_id:'prf_006', from_address:'agents@toknowledge.ai',      status:'active', updated_by:'seed', updated_at:new Date().toISOString() },
    ]);
  }

  // ── Channels (seed from window.CHANNELS if unseeded) ─────
  if (_load('workspace_channels').length === 0) {
    const seed = (window.CHANNELS || []).map(c => ({
      id: c.id,
      key: c.key,
      name: (window.CHANNEL_META && window.CHANNEL_META[c.key] && window.CHANNEL_META[c.key].name) || c.key,
      enabled: !!c.enabled,
      health: c.health || 'muted',
      assigned_agent: c.assigned || null,
      routing: c.routing || '',
      rate: c.rate || '—',
      credential_ref: c.enabled ? ('vault://channels/' + c.id) : null,
      credential_status: c.enabled ? 'ok' : 'missing',
      updated_by: 'seed',
      updated_at: new Date().toISOString(),
    }));
    _save('workspace_channels', seed);
  }

  // ── Skills (seed from window.SKILLS if unseeded) ─────────
  if (_load('workspace_skills').length === 0) {
    const seed = (window.SKILLS || []).map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      deps: s.deps || [],
      usage: s.usage || 0,
      status: s.status || 'valid',
      updated: s.updated || '—',
      updated_by: 'seed',
      updated_at: new Date().toISOString(),
    }));
    _save('workspace_skills', seed);
  }

  // ── Alerts (seed from window.ALERTS if unseeded) ─────────
  if (_load('workspace_alerts').length === 0) {
    const seed = (window.ALERTS || []).map(a => ({
      id: a.id,
      level: a.level,
      msg: a.msg,
      time: a.time,
      area: a.area,
      actionable: !!a.actionable,
      ack_at: null,
      ack_by: null,
      resolved_at: null,
      resolved_by: null,
      source: a.area ? a.area.toLowerCase() : 'system',
    }));
    _save('workspace_alerts', seed);
  }

  // ── Meetings — workspace state (one row per workspace) ───
  if (_load('workspace_meeting_state').length === 0) {
    // Migrate legacy `mh.v1` blob if present, else start honest (nothing connected).
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem('mh.v1')); } catch(e){}

    const defaultProviders = {
      zoom:  { state:'not_connected', assignedAgents:[], lastAction:null },
      teams: { state:'not_connected', assignedAgents:[], lastAction:null },
      meet:  { state:'not_connected', assignedAgents:[], lastAction:null },
      webex: { state:'not_connected', assignedAgents:[], lastAction:null },
    };
    const defaultPerms = {
      owner:   { create:true,  join:true,  assign:true,  disconnect:true,  rotate:true  },
      admin:   { create:true,  join:true,  assign:true,  disconnect:true,  rotate:true  },
      manager: { create:true,  join:true,  assign:true,  disconnect:false, rotate:false },
      agent:   { create:false, join:true,  assign:false, disconnect:false, rotate:false },
      viewer:  { create:false, join:false, assign:false, disconnect:false, rotate:false },
    };

    _save('workspace_meeting_state', [{
      workspace_id: 'w_default',
      providers:   { ...defaultProviders, ...((legacy && legacy.providers) || {}) },
      permissions: { ...defaultPerms,     ...((legacy && legacy.permissions) || {}) },
      drafts:      (legacy && legacy.drafts) || [],
      log:         (legacy && legacy.log)    || [],
      updated_by:  'seed',
      updated_at:  new Date().toISOString(),
    }]);
  }

  localStorage.setItem(LOCAL_PREFIX + '_seeded', SEED_VERSION);
}

const _subs = new Set();
function _emit(){ _subs.forEach(fn => fn()); }

function _checkInvariants(table, row, op){
  if (table === 'workspace_users' && op === 'delete') {
    if (row.isTony || row.isAgent) {
      const e = new Error('Agent Zero is structurally protected and Tony Legacy is archived.');
      e.code = 'INVARIANT_PROTECTED_USER'; throw e;
    }
  }
  if (table === 'workspace_users' && op === 'update') {
    if (row.isTony && row.active === false) {
      const e = new Error('Owner/commander protected record cannot be suspended here.');
      e.code = 'INVARIANT_PROTECTED_USER'; throw e;
    }
    if (row.isAgent && row.active === false) {
      const e = new Error('Agent 0 is a SYSTEM actor and cannot be suspended.');
      e.code = 'INVARIANT_PROTECTED_USER'; throw e;
    }
  }
  if (table === 'workspace_role_assignments' && op === 'update') {
    // protect role of Agent Zero commander and archived legacy records
    const users = _load('workspace_users');
    const u = users.find(x => x.id === row.user_id);
    if (u?.isTony && row.role !== 'owner') {
      const e = new Error('Agent Zero is locked as commander.');
      e.code = 'INVARIANT_PROTECTED_ROLE'; throw e;
    }
    if (u?.isAgent && row.role !== 'system') {
      const e = new Error('Agent 0 is locked to the SYSTEM role.');
      e.code = 'INVARIANT_PROTECTED_ROLE'; throw e;
    }
  }
  if (table === 'workspace_security_policy' && op === 'update') {
    // Hard cap reauth at 72h
    if (typeof row.reauthHours === 'number') {
      row.reauthHours = Math.min(72, Math.max(1, row.reauthHours));
    }
  }
  if (table === 'workspace_integrations' && op === 'update') {
    // Can't enable an integration with no credential
    if (row.enabled === true && row.credential_status === 'missing') {
      const e = new Error('Cannot enable integration without stored credentials.');
      e.code = 'INVARIANT_MISSING_CREDENTIAL'; throw e;
    }
  }
  if (table === 'provider_models' && op === 'update') {
    // `wired` must match presence of key_ref
    if (typeof row.wired === 'boolean') {
      row.wired = !!row.key_ref;
    }
  }
  if (table === 'workspace_channels' && (op === 'insert' || op === 'update')) {
    // enabled=true requires a credential_ref
    if (row.enabled === true && row.credential_status === 'missing') {
      const e = new Error('Cannot enable channel without stored credentials.');
      e.code = 'INVARIANT_MISSING_CREDENTIAL'; throw e;
    }
    // credential_status must match credential_ref presence (except expiring, which is sticky)
    if (row.credential_status !== 'expiring') {
      row.credential_status = row.credential_ref ? 'ok' : 'missing';
    }
  }
  if (table === 'workspace_skills' && op === 'update') {
    // usage is read-only from the admin UI — strip any attempt to write it
    if (typeof row.usage === 'number' && row._caller !== 'gateway') {
      // allow through if already same as on-disk; otherwise admin UI doesn't write it
    }
  }
  if (table === 'workspace_alerts' && op === 'delete') {
    const e = new Error('Alerts are append-only — acknowledge or resolve instead.');
    e.code = 'INVARIANT_ALERT_IMMUTABLE'; throw e;
  }
  if (table === 'email_profiles' && (op === 'insert' || op === 'update')) {
    // status must reflect credential_ref presence, except api_not_wired which is sticky
    if (row.status !== 'api_not_wired' && row.status !== 'disabled') {
      row.status = row.credential_ref ? 'active' : 'needs_credentials';
    }
    // Enforce single default
    if (row.is_default === true) {
      const others = _load('email_profiles');
      for (const o of others) {
        if (o.id !== row.id && o.is_default) {
          o.is_default = false;
        }
      }
      _save('email_profiles', others);
    }
  }
  if (table === 'email_routing' && op === 'update') {
    // When assigned_profile_id is null, status must be "unassigned"
    if (!row.assigned_profile_id) {
      row.status = 'unassigned';
      row.from_address = null;
    } else {
      row.status = 'active';
    }
  }
}

const LocalAdapter = {
  kind: 'local',

  async read(table){ _seedIfEmpty(); return _load(table); },
  async readOne(table, pk){
    _seedIfEmpty();
    const rows = _load(table);
    const key = (SCHEMA[table] && SCHEMA[table].pk) || 'id';
    return rows.find(r => r[key] === pk) || null;
  },
  async insert(table, row){
    _seedIfEmpty();
    const rows = _load(table);
    const key = (SCHEMA[table] && SCHEMA[table].pk) || 'id';
    if (!row[key]) row[key] = _uid(table.slice(0, 3));
    _checkInvariants(table, row, 'insert');
    rows.push(row);
    _save(table, rows);
    _emit();
    return row;
  },
  async update(table, pk, patch){
    _seedIfEmpty();
    const rows = _load(table);
    const key = (SCHEMA[table] && SCHEMA[table].pk) || 'id';
    const idx = rows.findIndex(r => r[key] === pk);
    if (idx < 0) throw new Error(`Not found: ${table}/${pk}`);
    const merged = { ...rows[idx], ...patch };
    _checkInvariants(table, merged, 'update');
    rows[idx] = merged;
    _save(table, rows);
    _emit();
    return merged;
  },
  async remove(table, pk){
    _seedIfEmpty();
    const rows = _load(table);
    const key = (SCHEMA[table] && SCHEMA[table].pk) || 'id';
    const target = rows.find(r => r[key] === pk);
    if (!target) return;
    _checkInvariants(table, target, 'delete');
    _save(table, rows.filter(r => r[key] !== pk));
    _emit();
  },
  async count(table){ _seedIfEmpty(); return _load(table).length; },

  // Append-only write for audit_events
  async append(table, row){ return this.insert(table, row); },

  subscribe(fn){ _subs.add(fn); return () => _subs.delete(fn); },
};

Object.assign(window, { LocalAdapter });
