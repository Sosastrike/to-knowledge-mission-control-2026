// ============================================================
// API client — the layer the UI talks to.
//
// The UI never imports an adapter directly. It calls
// `api.users.list()` / `api.security.setPolicy()` etc. Those
// methods:
//   1. Check the caller's role against ROLE_PERMISSIONS
//   2. Validate the payload against schema invariants (the
//      adapter does the last-mile check; this is early-fail)
//   3. Delegate to the active adapter (local or future real)
//   4. Write an audit event for sensitive/destructive actions
//
// Swap adapters by setting `window.API_ADAPTER` before app
// mount — the UI is unchanged.
// ============================================================

const ADAPTER = () => window.API_ADAPTER || window.LocalAdapter;

// "Who is calling" — in prod this comes from the auth session.
// In prototype it's driven by the persona switcher; fall back to owner.
function _caller(){
  const p = (window.PERSONAS || []).find(x => x.id === (window._currentPersonaId || 'owner'));
  return {
    id: p ? ('u_' + p.id) : 'u_tony',
    role: p?.id || 'owner',
    email: p?.email || 'tony@toknowledge.ai',
  };
}

async function _audit(action, target, meta, level='info'){
  const c = _caller();
  await ADAPTER().append('audit_events', {
    id: 'a_' + Math.random().toString(36).slice(2, 10),
    ts: new Date().toISOString(),
    actor: c.email,
    action, target,
    meta: meta || null,
    level,
    ip: '127.0.0.1',
  });
}

function _requireRole(capability){
  const c = _caller();
  if (!window.permitted(c.role, capability)) {
    const err = new Error(`PERMISSION_DENIED · ${c.role} cannot ${capability}`);
    err.code = 'PERMISSION_DENIED';
    throw err;
  }
  return c;
}

// ─── USERS ────────────────────────────────────────────────
const users = {
  async list(){
    const [u, r, s] = await Promise.all([
      ADAPTER().read('workspace_users'),
      ADAPTER().read('workspace_role_assignments'),
      ADAPTER().read('user_security'),
    ]);
    const byId = Object.fromEntries(r.map(x => [x.user_id, x.role]));
    const sById = Object.fromEntries(s.map(x => [x.user_id, x.twoFA]));
    return u.map(x => ({ ...x, role: byId[x.id] || 'viewer', twoFA: sById[x.id] || 'off' }));
  },

  async invite({ name, email, role }){
    const c = _requireRole('users.invite');
    if (role === 'owner') { const e = new Error('Cannot invite as owner.'); e.code = 'FORBIDDEN'; throw e; }
    const id = 'u_' + Math.random().toString(36).slice(2, 9);
    const row = await ADAPTER().insert('workspace_users', {
      id, name, email, title: null, isTony:false, isAgent:false,
      active:true, invited: new Date().toISOString().slice(0,10), created_by: c.email,
    });
    await ADAPTER().insert('workspace_role_assignments', {
      user_id: id, role, assigned_by: c.email, assigned_at: row.invited,
    });
    await ADAPTER().insert('user_security', {
      user_id: id, twoFA: 'off', twoFA_secret_ref: null, last_reauth_at: null, backup_codes_ref: null,
    });
    await _audit('user.invite', id, { name, email, role }, 'info');
    // POST /api/mail/send — backend-required; scaffolded only.
    await _audit('mail.send.pending', id, { template: 'invite', note:'Email dispatch requires SMTP backend.' }, 'warn');
    return row;
  },

  async update(id, patch){
    _requireRole('users.update');
    const base = await ADAPTER().readOne('workspace_users', id);
    if (!base) throw new Error('User not found');

    // Fields that live in workspace_users
    const userPatch = {};
    if ('name' in patch) userPatch.name = patch.name;
    if ('active' in patch) userPatch.active = patch.active;
    if (Object.keys(userPatch).length) await ADAPTER().update('workspace_users', id, userPatch);

    // Role → role_assignments
    if ('role' in patch) {
      if (patch.role === 'owner') { const e = new Error('Cannot assign owner via UI.'); e.code='FORBIDDEN'; throw e; }
      await ADAPTER().update('workspace_role_assignments', id, { role: patch.role, assigned_at: new Date().toISOString() });
      await _audit('user.role.change', id, { role: patch.role }, 'warn');
    }

    // 2FA → user_security
    if ('twoFA' in patch) {
      await ADAPTER().update('user_security', id, { twoFA: patch.twoFA });
      await _audit('user.2fa.change', id, { twoFA: patch.twoFA }, 'info');
    }

    if ('active' in patch) await _audit(patch.active ? 'user.reactivate' : 'user.suspend', id, null, 'warn');
    return await users.list().then(list => list.find(u => u.id === id));
  },

  async remove(id){
    _requireRole('users.delete');       // Owner-only per permissions matrix
    await ADAPTER().remove('workspace_users', id);
    await ADAPTER().remove('workspace_role_assignments', id);
    await ADAPTER().remove('user_security', id);
    await _audit('user.delete', id, null, 'warn');
  },
};

// ─── SECURITY ────────────────────────────────────────────
const security = {
  async getPolicy(){
    const rows = await ADAPTER().read('workspace_security_policy');
    return rows[0] || null;
  },
  async setPolicy(patch){
    _requireRole('security.policy');
    const cur = await security.getPolicy();
    const next = { ...cur, ...patch, updated_by: _caller().email, updated_at: new Date().toISOString() };
    if ('reauthHours' in next) next.reauthHours = Math.min(72, Math.max(1, next.reauthHours));
    await ADAPTER().update('workspace_security_policy', cur.workspace_id, next);
    await _audit('security.policy.update', 'workspace', Object.keys(patch), 'warn');
    return next;
  },

  async getSSO(){
    const rows = await ADAPTER().read('workspace_sso_connections');
    return rows[0] || { provider:'none', status:'not_configured' };
  },
  async setSSO({ provider }){
    _requireRole('security.sso');
    const cur = await security.getSSO();
    const next = { ...cur, provider, status: provider === 'none' ? 'not_configured' : 'pending_credentials',
                   updated_by: _caller().email, updated_at: new Date().toISOString() };
    await ADAPTER().update('workspace_sso_connections', cur.workspace_id, next);
    await _audit('security.sso.update', provider, null, 'warn');
    return next;
  },

  async listIp(){ return ADAPTER().read('workspace_ip_allowlist'); },
  async addIp(cidr){
    _requireRole('security.ip');
    const row = await ADAPTER().insert('workspace_ip_allowlist', {
      cidr, created_by: _caller().email, created_at: new Date().toISOString(), note: null,
    });
    await _audit('security.ip.add', cidr, null, 'warn');
    return row;
  },
  async removeIp(id){
    _requireRole('security.ip');
    await ADAPTER().remove('workspace_ip_allowlist', id);
    await _audit('security.ip.remove', id, null, 'warn');
  },

  async listTokens(){ return ADAPTER().read('workspace_api_tokens'); },
  async createToken({ name, scope }){
    _requireRole('security.tokens');
    const raw = 'tkmc_live_' + Math.random().toString(36).slice(2, 20);
    const masked = raw.slice(0, 14) + '…' + raw.slice(-4);
    const row = await ADAPTER().insert('workspace_api_tokens', {
      name, scope, hash_ref: null, masked,
      created_by: _caller().email, created_at: new Date().toISOString(),
      last_used_at: null, expires_at: null,
    });
    await _audit('security.token.create', row.id, { name, scope }, 'warn');
    return { ...row, raw };  // raw shown ONCE at creation
  },
  async revokeToken(id){
    _requireRole('security.tokens');
    await ADAPTER().remove('workspace_api_tokens', id);
    await _audit('security.token.revoke', id, null, 'warn');
  },

  // Sessions — server-side only. Local adapter returns [] honestly.
  async listSessions(){
    const rows = await ADAPTER().read('auth_sessions');
    return rows;
  },
  async revokeSession(id){
    _requireRole('security.sessions');
    await ADAPTER().remove('auth_sessions', id);
    await _audit('security.session.revoke', id, null, 'warn');
  },
  async revokeAllSessions(){
    _requireRole('security.sessions');
    const rows = await ADAPTER().read('auth_sessions');
    for (const r of rows) await ADAPTER().remove('auth_sessions', r.id);
    await _audit('security.session.revoke_all', 'workspace', { count: rows.length }, 'warn');
  },

  // SSO callback placeholder — real backend owns the redirect URI.
  async ssoCallback(_payload){
    throw Object.assign(new Error('SSO_CALLBACK_NOT_WIRED'), { code: 'BACKEND_REQUIRED' });
  },
};

// ─── AUDIT ───────────────────────────────────────────────
// UI surfaces that legitimately write audit rows from the React layer
// must use `audit.emit(action, target, meta)`. Only actions in this
// allow-list are accepted — every other action is rejected so a stray
// caller cannot forge security-grade rows. Severity is forced to 'info'
// for UI emits; security/warn rows still come exclusively from this
// module's own internal _audit() calls.
const _UI_AUDIT_ACTIONS = new Set([
  'meeting.agent.invite',     // Live Meetings invite tab → adds an agent seat
  'meeting.agent.remove',     // Live Meetings invite tab → removes an agent seat
  'meeting.link.copy',        // Live Meetings → copy share link
  'dashboard.escalation.send',// Dashboard → Escalate flow (Agent Zero / Hermes / Pacman)
  'dashboard.broadcast.send', // Dashboard → Broadcast flow
  'escalation.raise',         // Dashboard → Escalate modal real action
  'ticket.create',            // Dashboard → New ticket modal
  'ticket.update',            // Tasks workspace → patch (status/priority/notes)
  'report.export',            // Dashboard → Export CSV / JSON
  'alert.acknowledge',        // Dashboard → Alerts "Acknowledge"
]);

const audit = {
  async list({ limit = 200 } = {}){
    _requireRole('audit.read');
    const rows = await ADAPTER().read('audit_events');
    return rows.slice(-limit).reverse();
  },
  async export(){
    _requireRole('audit.export');
    return JSON.stringify(await ADAPTER().read('audit_events'), null, 2);
  },
  // Controlled UI-side emit. Silently no-ops on unknown actions so call
  // sites can fire-and-forget without try/catch (they live in click
  // handlers that must never throw on a bad audit write).
  async emit(action, target, meta){
    if (!_UI_AUDIT_ACTIONS.has(action)) {
      if (window?.console) console.warn('[audit.emit] rejected action:', action);
      return null;
    }
    try { return await _audit(action, target ?? null, meta ?? {}, 'info'); }
    catch (e) { console.warn('[audit.emit] failed:', e); return null; }
  },
};

// ─── MODELS ──────────────────────────────────────────────
const models = {
  async listModels(){ return ADAPTER().read('provider_models'); },
  async listRouting(){
    const rows = await ADAPTER().read('agent_model_routing');
    return Object.fromEntries(rows.map(r => [r.agent_key, r]));
  },
  async setRouting(agentKey, patch){
    _requireRole('models.routing');
    const existing = await ADAPTER().readOne('agent_model_routing', agentKey);
    if (!existing) {
      const row = await ADAPTER().insert('agent_model_routing', {
        agent_key: agentKey, primary: patch.primary, fallback: patch.fallback,
        embedding: patch.embedding, priority: patch.priority,
        updated_by: _caller().email, updated_at: new Date().toISOString(),
      });
      await _audit('models.routing.set', agentKey, patch, 'warn');
      return row;
    }
    const next = {
      ...existing, ...patch,
      updated_by: _caller().email, updated_at: new Date().toISOString(),
    };
    await ADAPTER().update('agent_model_routing', agentKey, next);
    await _audit('models.routing.change', agentKey, patch, 'warn');
    return next;
  },
  // Provider key rotation — raw key MUST go to vault on real backend.
  // Prototype has no vault, so we do NOT mark the model wired. We record
  // the intent, audit the attempt, and throw BACKEND_REQUIRED so the UI
  // can surface an honest "needs vault" state instead of a green check.
  async setKey(modelId, _rawKey){
    _requireRole('models.keys');
    const model = await ADAPTER().readOne('provider_models', modelId);
    if (!model) throw new Error('Model not found');
    await _audit('models.key.rotate.pending', modelId, {
      provider: model.provider,
      note: 'POST /api/models/:id/key → vault',
    }, 'warn');
    const err = new Error('VAULT_NOT_WIRED');
    err.code = 'BACKEND_REQUIRED';
    err.target = 'vault';
    err.endpoint = 'POST /api/models/' + modelId + '/key';
    throw err;
  },
  async clearKey(modelId){
    _requireRole('models.keys');
    const model = await ADAPTER().readOne('provider_models', modelId);
    if (!model) throw new Error('Model not found');
    await ADAPTER().update('provider_models', modelId, {
      key_ref: null, wired: false, updated_by: _caller().email, updated_at: new Date().toISOString(),
    });
    await _audit('models.key.clear', modelId, { provider: model.provider }, 'warn');
  },
};

// ─── INTEGRATIONS ────────────────────────────────────────
const integrations = {
  async list(){ return ADAPTER().read('workspace_integrations'); },
  async setEnabled(id, enabled){
    _requireRole('integrations.update');
    const row = await ADAPTER().readOne('workspace_integrations', id);
    if (!row) throw new Error('Integration not found');
    // Adapter will reject enabled=true when credential_status='missing'
    await ADAPTER().update('workspace_integrations', id, {
      enabled: !!enabled,
      updated_by: _caller().email, updated_at: new Date().toISOString(),
    });
    await _audit(enabled ? 'integration.enable' : 'integration.disable', id, null, 'info');
  },
  async setAssignedAgent(id, agentId){
    _requireRole('integrations.update');
    await ADAPTER().update('workspace_integrations', id, {
      assigned_agent: agentId || null,
      updated_by: _caller().email, updated_at: new Date().toISOString(),
    });
    await _audit('integration.assign', id, { agent: agentId }, 'info');
  },
  // Connecting an integration requires vaulting a credential. No vault
  // here → we do NOT flip credential_status to 'ok'. Throw honestly.
  async connect(id, _credentialPayload){
    _requireRole('integrations.keys');
    const row = await ADAPTER().readOne('workspace_integrations', id);
    if (!row) throw new Error('Integration not found');
    await _audit('integration.connect.pending', id, {
      note: 'POST /api/integrations/:id/connect → vault',
    }, 'warn');
    const err = new Error('VAULT_NOT_WIRED');
    err.code = 'BACKEND_REQUIRED';
    err.target = 'vault';
    err.endpoint = 'POST /api/integrations/' + id + '/connect';
    throw err;
  },
  async disconnect(id){
    _requireRole('integrations.keys');
    await ADAPTER().update('workspace_integrations', id, {
      credential_ref: null, credential_status: 'missing', enabled: false, health: 'idle',
      last_sync: null, error: null,
      updated_by: _caller().email, updated_at: new Date().toISOString(),
    });
    await _audit('integration.disconnect', id, null, 'warn');
  },
  // Connection test — in real backend this calls the provider. Here it
  // honestly reports that the test endpoint isn't wired.
  async test(id){
    _requireRole('integrations.test');
    await _audit('integration.test.pending', id, { note: 'POST /api/integrations/:id/test' }, 'info');
    throw Object.assign(new Error('INTEGRATION_TEST_NOT_WIRED'), { code: 'BACKEND_REQUIRED', target: id });
  },
};

// ─── AGENTS (runtime supervisor) ─────────────────────────
const agents = {
  async list(){ return ADAPTER().read('agent_runtime'); },
  async restart(agentId){
    _requireRole('agents.restart');
    // In real backend: POST to supervisor. Here we honestly fail.
    await _audit('agent.restart.pending', agentId, { endpoint: `POST /api/agents/${agentId}/restart` }, 'warn');
    throw Object.assign(new Error('AGENT_SUPERVISOR_NOT_WIRED'), { code: 'BACKEND_REQUIRED', target: agentId });
  },
  async reconnect(agentId){
    _requireRole('agents.reconnect');
    await _audit('agent.reconnect.pending', agentId, { endpoint: `POST /api/agents/${agentId}/reconnect` }, 'warn');
    throw Object.assign(new Error('AGENT_SUPERVISOR_NOT_WIRED'), { code: 'BACKEND_REQUIRED', target: agentId });
  },
  async logs(agentId){
    _requireRole('agents.logs');
    // Real backend streams from GET /api/agents/:id/logs
    await _audit('agent.logs.view', agentId, null, 'info');
    return {
      stream: null, // null = not wired
      endpoint: `GET /api/agents/${agentId}/logs`,
      shadow: [
        `[${new Date().toISOString()}] ${agentId} supervisor · shadow stream (local adapter)`,
        `[${new Date().toISOString()}] real logs require ${agentId} supervisor wiring`,
      ],
    };
  },
};

// ─── EMAIL / SMTP ──────────────────────────────────────────
const email = {
  // Providers catalog — static, client-safe. Real backend would return the
  // same list with an extra `auth_kind` field for scaffolding credentials.
  PROVIDERS: [
    { id:'zoom',      name:'Zoom',          hint:'OAuth-based invitation sender', auth_kind:'oauth' },
    { id:'m365',      name:'Microsoft 365', hint:'Graph API / OAuth 2.0',         auth_kind:'oauth' },
    { id:'smtp',      name:'Custom SMTP',   hint:'host + port + user + pass',     auth_kind:'smtp' },
    { id:'ses',       name:'AWS SES',       hint:'access key + secret + region',  auth_kind:'api_key' },
    { id:'postmark',  name:'Postmark',      hint:'server token',                  auth_kind:'api_key' },
    { id:'sendgrid',  name:'SendGrid',      hint:'API key',                       auth_kind:'api_key' },
    { id:'agentmail', name:'AgentMail',     hint:'API not wired yet',             auth_kind:'unwired' },
    { id:'generic',   name:'Generic',      hint:'Manual SMTP details',           auth_kind:'smtp' },
  ],

  // ── Profiles ────────────────────────────────────────────
  async listProfiles(){
    _requireRole('email.read');
    return ADAPTER().read('email_profiles');
  },
  async addProfile(payload){
    const c = _requireRole('email.write');
    const isUnwired = payload.provider_type === 'agentmail';
    const row = {
      profile_name: payload.profile_name || 'New profile',
      provider_type: payload.provider_type || 'smtp',
      from_address: payload.from_address || '',
      purpose: payload.purpose || 'Transactional',
      status: isUnwired ? 'api_not_wired' : 'needs_credentials',
      credential_ref: null,  // raw secrets go to vault via keys() endpoint
      last_test_at: '—',
      is_default: false,
      updated_by: c.email,
      updated_at: new Date().toISOString(),
    };
    const saved = await ADAPTER().insert('email_profiles', row);
    await _audit('email.profile.create', saved.id, { name: saved.profile_name, provider: saved.provider_type });
    return saved;
  },
  async updateProfile(id, patch){
    const c = _requireRole('email.write');
    const clean = { ...patch, updated_by: c.email, updated_at: new Date().toISOString() };
    // Never allow raw credentials through this endpoint
    delete clean.password; delete clean.api_key; delete clean.secret;
    const saved = await ADAPTER().update('email_profiles', id, clean);
    await _audit('email.profile.update', id, { keys: Object.keys(patch) });
    return saved;
  },
  async setKeys(id, _rawCreds){
    // Stores the raw creds into the vault and returns an opaque credential_ref.
    // In prototype this is a stub; the adapter flips status → active when ref present.
    const c = _requireRole('email.keys');
    const ref = `vault://email/${id}`;
    const saved = await ADAPTER().update('email_profiles', id, {
      credential_ref: ref,
      updated_by: c.email,
      updated_at: new Date().toISOString(),
    });
    await _audit('email.profile.keys.set', id, { credential_ref: ref }, 'warn');
    return { ok: true, credential_ref: ref, status: saved.status };
  },
  async rotateCredentials(id){
    const c = _requireRole('email.keys');
    await ADAPTER().update('email_profiles', id, {
      credential_ref: null,
      last_test_at: '—',
      updated_by: c.email,
      updated_at: new Date().toISOString(),
    });
    await _audit('email.profile.keys.rotate', id, null, 'warn');
    return { ok: true, message: 'Credentials rotated. Re-enter in profile editor to re-activate.' };
  },
  async deleteProfile(id){
    _requireRole('email.write');
    const prof = await ADAPTER().readOne('email_profiles', id);
    // Unassign from any routing rows
    const routing = await ADAPTER().read('email_routing');
    for (const r of routing.filter(x => x.assigned_profile_id === id)) {
      await ADAPTER().update('email_routing', r.id, {
        assigned_profile_id: null, status: 'unassigned', from_address: null,
      });
    }
    await ADAPTER().remove('email_profiles', id);
    await _audit('email.profile.delete', id, { name: prof?.profile_name }, 'warn');
    return { ok: true };
  },
  async testSend(id){
    _requireRole('email.test');
    const p = await ADAPTER().readOne('email_profiles', id);
    if (!p) return { ok:false, message:'Profile not found' };
    if (p.status === 'api_not_wired') {
      await _audit('email.profile.test', id, { result: 'api_not_wired' }, 'warn');
      return { ok:false, message:'Test not available yet — API not wired', code:'BACKEND_REQUIRED' };
    }
    if (p.status === 'needs_credentials' || !p.credential_ref) {
      await _audit('email.profile.test', id, { result: 'needs_credentials' }, 'warn');
      return { ok:false, message:'Credentials missing — store keys via setKeys()', code:'BACKEND_REQUIRED' };
    }
    // Real send requires SMTP/AgentMail. Prototype has neither → do not
    // fake success. Report the missing endpoint honestly.
    await _audit('email.profile.test.pending', id, {
      note: 'POST /api/email/profiles/:id/test → SMTP / AgentMail',
    }, 'warn');
    return {
      ok: false,
      code: 'BACKEND_REQUIRED',
      endpoint: 'POST /api/email/profiles/' + id + '/test',
      message: 'Test send not wired — needs SMTP or AgentMail transport.',
    };
  },
  async testAll(){
    _requireRole('email.test');
    const profiles = await ADAPTER().read('email_profiles');
    const results = [];
    for (const p of profiles) {
      const r = await this.testSend(p.id);
      results.push({ id:p.id, name:p.profile_name, ...r });
    }
    return results;
  },

  // ── Addresses ──────────────────────────────────────────
  async listAddresses(){
    _requireRole('email.read');
    return ADAPTER().read('email_addresses');
  },
  async addAddress(payload){
    _requireRole('email.write');
    const row = {
      email: payload.email,
      verified: false,
      used_by: '—',
      status: 'needs_verification',
      dkim_ref: null, spf_ref: null,
      updated_at: new Date().toISOString(),
    };
    const saved = await ADAPTER().insert('email_addresses', row);
    await _audit('email.address.create', saved.id, { email: saved.email });
    return saved;
  },
  async verifyAddress(id){
    _requireRole('email.write');
    // Real backend probes DKIM/SPF records via DNS — not implemented in prototype
    await ADAPTER().update('email_addresses', id, { status: 'verification_not_implemented' });
    await _audit('email.address.verify', id, { result: 'not_implemented' }, 'warn');
    return {
      ok: false,
      message: 'Verification not implemented yet — set DKIM/SPF manually',
      code: 'BACKEND_REQUIRED',
    };
  },

  // ── Routing ────────────────────────────────────────────
  async listRouting(){
    _requireRole('email.read');
    return ADAPTER().read('email_routing');
  },
  async updateRouting(id, patch){
    const c = _requireRole('email.write');
    // Denormalize from_address from assigned profile
    const clean = { ...patch, updated_by: c.email, updated_at: new Date().toISOString() };
    if (clean.assigned_profile_id) {
      const prof = await ADAPTER().readOne('email_profiles', clean.assigned_profile_id);
      if (prof) clean.from_address = prof.from_address;
    }
    const saved = await ADAPTER().update('email_routing', id, clean);
    await _audit('email.routing.update', id, { type: saved.email_type, assigned: saved.assigned_profile_id });
    return saved;
  },
};

// ─── MEETINGS (provider wire-up · assignments · drafts) ───
const meetings = {
  async getState(){
    _requireRole('meetings.read');
    const rows = await ADAPTER().read('workspace_meeting_state');
    // Single-row table; return the row or a safe skeleton
    return rows[0] || null;
  },
  // Write the whole state blob. The page uses setState(s => {...}) patterns,
  // so we accept a merged snapshot and let the adapter replace the row.
  // For auditable transitions, callers should use the specific methods below.
  async saveState(snapshot){
    const c = _requireRole('meetings.write');
    const current = await ADAPTER().read('workspace_meeting_state');
    const patch = {
      providers:   snapshot.providers,
      permissions: snapshot.permissions,
      drafts:      snapshot.drafts,
      log:         snapshot.log,
      updated_by:  c.email,
      updated_at:  new Date().toISOString(),
    };
    if (current.length === 0) {
      return ADAPTER().insert('workspace_meeting_state', { workspace_id:'w_default', ...patch });
    }
    return ADAPTER().update('workspace_meeting_state', 'w_default', patch);
  },

  // ── Auditable transitions — use these from the UI instead of bulk saveState
  // when a real audit trail matters. They update the blob AND emit an event.

  // providerId ∈ {zoom, teams, meet, webex}
  async connect(providerId){
    _requireRole('meetings.connect');
    // Backend would kick off the OAuth dance here. For the prototype we
    // flip to `auth_required` and leave it there — the page explains what
    // an admin must do server-side.
    await _audit('meeting.provider.connect.start', providerId, null, 'warn');
    return {
      ok: false,
      code: 'BACKEND_REQUIRED',
      message: `OAuth flow for ${providerId} requires server-side wire-up. See /api/oauth/${providerId}/start.`,
      next_state: 'auth_required',
    };
  },
  async disconnect(providerId){
    _requireRole('meetings.connect');
    await _audit('meeting.provider.disconnect', providerId, null, 'warn');
    return { ok: true, next_state: 'not_connected' };
  },
  async rotate(providerId){
    _requireRole('meetings.rotate');
    await _audit('meeting.provider.keys.rotate', providerId, null, 'warn');
    return {
      ok: false,
      code: 'BACKEND_REQUIRED',
      message: `Credential rotation for ${providerId} requires vault + OAuth refresh-token service.`,
    };
  },
  async test(providerId){
    _requireRole('meetings.read');
    // Real backend hits the provider's `/me` or `/ping` endpoint with the stored refresh token.
    await _audit('meeting.provider.test', providerId);
    return {
      ok: false,
      code: 'BACKEND_REQUIRED',
      message: `Test call requires a live ${providerId} OAuth token.`,
    };
  },
  async assignAgent(providerId, agentId){
    _requireRole('meetings.write');
    await _audit('meeting.agent.assign', `${providerId}:${agentId}`);
    return { ok: true };
  },
  async unassignAgent(providerId, agentId){
    _requireRole('meetings.write');
    await _audit('meeting.agent.unassign', `${providerId}:${agentId}`);
    return { ok: true };
  },
  async setPermissions(role, perms){
    _requireRole('meetings.connect');  // permission edits are sensitive
    await _audit('meeting.permissions.update', role, { perms });
    return { ok: true };
  },
  async createDraft(draft){
    _requireRole('meetings.write');
    await _audit('meeting.draft.create', draft.id, { title: draft.title, provider: draft.provider });
    return { ok: true };
  },
  async cancelDraft(draftId){
    _requireRole('meetings.write');
    await _audit('meeting.draft.cancel', draftId, null, 'warn');
    return { ok: true };
  },
};

// ─── CHANNELS (per-channel routing + credentials) ──────────────
const channels = {
  async list(){
    _requireRole('channels.read');
    return ADAPTER().read('workspace_channels');
  },
  async setEnabled(id, enabled){
    const c = _requireRole('channels.write');
    const row = await ADAPTER().update('workspace_channels', id, {
      enabled, updated_by: c.email, updated_at: new Date().toISOString(),
    });
    await _audit('channel.enabled', id, { enabled }, enabled ? 'info' : 'warn');
    return row;
  },
  async assignAgent(id, agentId){
    const c = _requireRole('channels.assign');
    const row = await ADAPTER().update('workspace_channels', id, {
      assigned_agent: agentId, updated_by: c.email, updated_at: new Date().toISOString(),
    });
    await _audit('channel.agent.assign', id, { agent: agentId });
    return row;
  },
  async updateRouting(id, routing){
    const c = _requireRole('channels.write');
    const row = await ADAPTER().update('workspace_channels', id, {
      routing, updated_by: c.email, updated_at: new Date().toISOString(),
    });
    await _audit('channel.routing.update', id, { routing });
    return row;
  },
  async setCredentials(id /*, raw */){
    _requireRole('channels.keys');
    await _audit('channel.credentials.save.pending', id, null, 'warn');
    const e = new Error('Channel credentials must be written through the vault service.');
    e.code = 'BACKEND_REQUIRED'; throw e;
  },
  async rotateCredentials(id){
    _requireRole('channels.keys');
    await _audit('channel.credentials.rotate.pending', id, null, 'warn');
    const e = new Error('Credential rotation requires the vault service.');
    e.code = 'BACKEND_REQUIRED'; throw e;
  },
  async removeCredentials(id){
    const c = _requireRole('channels.keys');
    const row = await ADAPTER().update('workspace_channels', id, {
      credential_ref: null, enabled: false, credential_status: 'missing',
      updated_by: c.email, updated_at: new Date().toISOString(),
    });
    await _audit('channel.credentials.remove', id, null, 'warn');
    return row;
  },
  async test(id){
    _requireRole('channels.read');
    await _audit('channel.test.pending', id);
    return {
      ok: false,
      code: 'BACKEND_REQUIRED',
      message: `Channel test call requires a live provider adapter for ${id}.`,
    };
  },
};

// ─── SKILLS (versioned capability registry) ───────────────────
const skills = {
  async list(){
    _requireRole('skills.read');
    return ADAPTER().read('workspace_skills');
  },
  async setStatus(id, status){
    const c = _requireRole('skills.write');
    if (!['valid','review','retired'].includes(status)) {
      const e = new Error('Invalid skill status.'); e.code = 'INVALID_STATUS'; throw e;
    }
    if (status === 'retired') _requireRole('skills.retire');   // owner-only
    const row = await ADAPTER().update('workspace_skills', id, {
      status, updated_by: c.email, updated_at: new Date().toISOString(),
    });
    await _audit('skill.status.change', id, { status }, status === 'retired' ? 'warn' : 'info');
    return row;
  },
  async retire(id){
    return skills.setStatus(id, 'retired');
  },
  async register(/* payload */){
    _requireRole('skills.write');
    await _audit('skill.register.pending', 'new', null, 'warn');
    const e = new Error('New skills are registered via the skill host (not the admin UI).');
    e.code = 'BACKEND_REQUIRED'; throw e;
  },
};

// ─── ALERTS (append-only · ACK / resolve) ──────────────────────
const alerts = {
  async list({ includeResolved = false } = {}){
    _requireRole('alerts.read');
    const rows = await ADAPTER().read('workspace_alerts');
    return includeResolved ? rows : rows.filter(r => !r.resolved_at);
  },
  async acknowledge(id){
    const c = _requireRole('alerts.ack');
    const row = await ADAPTER().update('workspace_alerts', id, {
      ack_at: new Date().toISOString(), ack_by: c.email,
    });
    await _audit('alert.ack', id);
    return row;
  },
  async resolve(id, { resolution } = {}){
    const c = _requireRole('alerts.resolve');
    const row = await ADAPTER().update('workspace_alerts', id, {
      resolved_at: new Date().toISOString(), resolved_by: c.email, ack_at: null,
    });
    await _audit('alert.resolve', id, { resolution: resolution || null });
    return row;
  },
  async emit({ level = 'info', msg, area = 'system', actionable = false, source = 'ui' }){
    _requireRole('alerts.read');
    const row = await ADAPTER().insert('workspace_alerts', {
      id: 'A' + Math.random().toString(36).slice(2, 7).toUpperCase(),
      level, msg, time: 'just now', area, actionable,
      ack_at: null, ack_by: null, resolved_at: null, resolved_by: null, source,
    });
    await _audit('alert.emit', row.id, { level, area, source });
    return row;
  },
};

// ─── API root ────────────────────────────────────────────
const api = { users, security, audit, models, integrations, agents, email, meetings, channels, skills, alerts };

// Keep UI in sync when adapter mutates
function subscribe(fn){
  return ADAPTER().subscribe ? ADAPTER().subscribe(fn) : (() => {});
}

Object.assign(window, { api, apiSubscribe: subscribe });
