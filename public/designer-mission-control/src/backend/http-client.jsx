// ============================================================
// src/backend/http-client.jsx
//
// Adapter swap — HTTP edition.
//
// Scope (deliberately narrow): this file ONLY wires namespaces
// the server/ actually exposes today. Everything else keeps the
// localStorage adapter untouched.
//
//   window.api.credentials  → real server (PUT/GET/DELETE /api/credentials…)
//   window.api.health       → real server (GET /api/health)
//   window.api.agents       → real server (supervisor: list/restart/stop/start/logs/stream)
//   window.api.models       → real server (GET models/routing, PUT routing, POST test)
//
// Boots on DOMContentLoaded:
//   1. Probes GET /api/health
//   2. If reachable, installs window.api.credentials + health + agents
//   3. If unreachable, logs once and leaves window.api alone
//      (credentials-page.jsx will render its honest "Backend not wired" card;
//       AgentManagementPage falls back to the window.AGENTS seed and disables
//       real restart/stop actions)
//
// Config (set via <script> inline before this file loads, or via
// URL params for quick overrides):
//   window.API_BASE      — defaults to same-origin Mission Control
//   window.API_BEARER    — dev bearer token (matches server API_BEARER_TOKEN)
//
// URL overrides (useful for preview tweaks):
//   ?api=http://host:3001   → sets API_BASE
//   ?bearer=TOKEN           → sets API_BEARER (NOT persisted; one-shot)
// ============================================================

(function () {
  // ── Resolve config ────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const API_BASE =
    qs.get('api') ||
    window.API_BASE ||
    localStorage.getItem('tkmc.api.base') ||
    '';
  const API_BEARER =
    qs.get('bearer') ||
    window.API_BEARER ||
    localStorage.getItem('tkmc.api.bearer') ||
    'dev-bearer-token';

  // Persist a user-supplied ?api=… so reloads keep the override
  if (qs.get('api')) localStorage.setItem('tkmc.api.base', qs.get('api'));

  window.API_BASE = API_BASE;

  // ── Session token ─────────────────────────────────────────
  // When present, it's preferred over the legacy shared bearer. A
  // successful /api/auth/login sets this; /logout clears it.
  // Not in-memory only because a full reload is a normal ops action
  // and we don't want to re-prompt the user every time. The cookie
  // path (credentials: 'include') is the primary auth channel when
  // serving the UI from the same origin; this bearer is for dev
  // where UI and API are on different ports.
  const SESSION_KEY = 'tkmc.api.session_token';
  function getSessionToken() {
    try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
  }
  function setSessionToken(tok) {
    try {
      if (tok) localStorage.setItem(SESSION_KEY, tok);
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }

  // ── Core fetch helper ─────────────────────────────────────
  async function req(method, path, body) {
    const sessionTok = getSessionToken();
    const authValue = sessionTok || API_BEARER;
    const res = await fetch(API_BASE + path, {
      method,
      credentials: 'include', // cookie auth (tkmc_session) when same-origin
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authValue,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      const err = new Error(
        (data && (data.message || data.error)) ||
        `HTTP ${res.status} ${method} ${path}`
      );
      err.status = res.status;
      err.code   = data?.error || 'HTTP_ERROR';
      err.body   = data || text;
      // If the server says our session is bad, drop the stored token
      // so the next request falls back to the legacy bearer / cookie
      // and the UI can prompt for re-login.
      if (res.status === 401 && (data?.error === 'SESSION_INVALID' || data?.error === 'UNAUTHORIZED')) {
        if (sessionTok) {
          setSessionToken(null);
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      }
      throw err;
    }
    return data;
  }

  // ── Health probe ──────────────────────────────────────────
  async function probeHealth() {
    try {
      const h = await req('GET', '/api/health-check');
      return { ok: true, health: h };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  // ── Credentials namespace (maps server shape → page shape) ──
  // Page expects: list() → { services: {svc: [fieldRow]}, catalogue }
  //               update(svc, fieldsObject) → …
  //               remove(svc, field)        → …
  const credentials = {
    async list() {
      return req('GET', '/api/credentials');
    },
    async update(service, fields) {
      return req('PUT', `/api/credentials/${encodeURIComponent(service)}`, { fields });
    },
    async remove(service, field) {
      return req(
        'DELETE',
        `/api/credentials/${encodeURIComponent(service)}/${encodeURIComponent(field)}`
      );
    },
    // Real read-only probe. Returns the server's uniform test-response shape:
    //   { service, ok, status, latency_ms, detail, code?, tested_at }
    async test(service) {
      return req('POST', `/api/credentials/${encodeURIComponent(service)}/test`);
    },
    /**
     * Rotate one field with verify+revert semantics.
     * Returns { ok, reverted, test, prev_last4, new_last4, rotated_at, rotation_id, fields }.
     * If `verify` is false, the server still records the rotation but skips the live probe.
     */
    async rotate(service, field, value, { verify = true } = {}) {
      return req(
        'POST',
        `/api/credentials/${encodeURIComponent(service)}/${encodeURIComponent(field)}/rotate`,
        { value, verify }
      );
    },
    /**
     * Recent rotation history for one (service, field). Pass field='_all'
     * to get every rotation for the service.
     */
    async rotations(service, field, limit = 25) {
      return req(
        'GET',
        `/api/credentials/${encodeURIComponent(service)}/${encodeURIComponent(field)}/rotations?limit=${limit}`
      );
    },
  };

  const health = {
    async get() { return req('GET', '/api/health'); },
  };

  // ── Session namespace — real /api/auth/* wiring ───────────
  // login()   → stores session_token in localStorage and returns the user
  // logout()  → revokes server-side, clears local token
  // whoami()  → current user or throws 401
  // sessions()→ list of this user's sessions (server hides full ids)
  // setPassword() / adminSetPassword() → server-validated rotations
  //
  // Every call runs through req(), so the session token is picked up
  // automatically once login() stores it. The cookie is also set by
  // the server response (HttpOnly, Lax) — whichever channel lands
  // first authenticates the caller.
  const session = {
    async login(email, password) {
      const out = await req('POST', '/api/auth/login', { email, password });
      if (out && out.session_token) {
        setSessionToken(out.session_token);
        window.dispatchEvent(new CustomEvent('auth:logged-in', { detail: { user: out.user } }));
      }
      return out;
    },
    async logout() {
      try { await req('POST', '/api/auth/logout'); }
      finally {
        setSessionToken(null);
        window.dispatchEvent(new CustomEvent('auth:logged-out'));
      }
      return { ok: true };
    },
    async whoami() { return req('GET', '/api/auth/whoami'); },
    async list()   { return req('GET', '/api/auth/sessions'); },
    async revoke(idPrefix) {
      return req('POST', `/api/auth/sessions/${encodeURIComponent(idPrefix)}/revoke`);
    },
    async setPassword(current, next) {
      return req('POST', '/api/auth/set-password', { current, next });
    },
    async adminSetPassword(userId, next) {
      return req('POST', '/api/auth/admin/set-password', { user_id: userId, next });
    },
    // Local-only helpers so UI can read/clear without another round-trip.
    getToken: getSessionToken,
    clearToken() { setSessionToken(null); },
    isAuthenticated() { return !!getSessionToken(); },
  };

  // ── Models namespace (LLM routing + per-model probe) ──────
  // Server routes:
  //   GET  /api/llm/models                 — registered models (with `wired` flag)
  //   GET  /api/llm/routing                — per-agent routing rows
  //   PUT  /api/llm/routing/:agentKey      — patch routing for one agent class
  //   POST /api/llm/test/:modelId          — real 1-token probe through OpenRouter
  //
  // Page shape compat (see ModelsPage):
  //   listModels()                    → [{id, provider, family, cost, ctx, wired}]
  //   listRouting()                   → { [agentKey]: { primary, fallback, embedding, priority } }
  //   setRouting(agentKey, patch)     → updated row
  //   testModel(modelId)              → { ok, status, latency_ms, detail, ... }
  //   setKey / clearKey               → honest throw until credentials-intake UI lands
  const models = {
    async listModels() {
      const rows = await req('GET', '/api/llm/models');
      // Server returns DB rows from provider_models:
      //   {id, provider, model_slug, display_name, context_tokens, key_ref, wired, updated_at}
      // Page shape: {id, provider, family, cost, ctx, wired}
      return (rows || []).map(r => ({
        id:        r.id,
        provider:  r.provider,
        family:    r.display_name || r.model_slug || '—',
        cost:      '—', // real cost not in schema yet; honest dash
        ctx:       r.context_tokens
                     ? (r.context_tokens >= 1_000_000
                         ? `${Math.round(r.context_tokens/1_000_000)}M`
                         : `${Math.round(r.context_tokens/1000)}k`)
                     : '—',
        wired:     !!r.wired,
        modelSlug: r.model_slug,
      }));
    },
    async listRouting() {
      const rows = await req('GET', '/api/llm/routing');
      // Server: [{agent_key, primary_model, backup_model, embed_model, priority}, …]
      // Page:   { [agentKey]: {primary, fallback, embedding, priority} }
      const out = {};
      for (const r of rows || []) {
        out[r.agent_key] = {
          primary:   r.primary_model,
          fallback:  r.backup_model,
          embedding: r.embed_model,
          priority:  r.priority,
        };
      }
      return out;
    },
    async setRouting(agentKey, patch) {
      // Page sends {primary, fallback, embedding, priority};
      // server columns are {primary_model, backup_model, embed_model, priority}.
      const body = {};
      if (patch.primary   !== undefined) body.primary_model = patch.primary;
      if (patch.fallback  !== undefined) body.backup_model  = patch.fallback;
      if (patch.embedding !== undefined) body.embed_model   = patch.embedding;
      if (patch.priority  !== undefined) body.priority      = patch.priority;
      return req('PUT', `/api/llm/routing/${encodeURIComponent(agentKey)}`, body);
    },
    async testModel(modelId) {
      return req('POST', `/api/llm/test/${encodeURIComponent(modelId)}`);
    },
    async setKey(modelId /*, rawKey */) {
      // Per-model keys don't make sense here — OpenRouter is the only provider
      // and its key lives under /api/credentials/openrouter. Fail honestly.
      const e = new Error('Per-model key rotation is not exposed. Store the OpenRouter key under Settings → Credentials → OpenRouter.');
      e.code = 'USE_CREDENTIALS_UI'; e.endpoint = 'PUT /api/credentials/openrouter';
      throw e;
    },
    async clearKey(modelId) {
      const e = new Error('Per-model key rotation is not exposed. Clear the OpenRouter key under Settings → Credentials → OpenRouter.');
      e.code = 'USE_CREDENTIALS_UI'; e.endpoint = 'DELETE /api/credentials/openrouter/api_key';
      throw e;
    },
  };

  // ── Agents namespace (supervisor) ─────────────────────────
  // Server routes:
  //   GET  /api/agents/status        — list
  //   POST /api/agents/:id/restart   — kill + respawn child
  //   POST /api/agents/:id/stop      — SIGTERM + no respawn
  //   POST /api/agents/:id/start     — spawn if not running
  //   GET  /api/agents/:id/logs      — recent log events
  //   GET  /api/agents/stream        — SSE of status snapshots
  //
  // Reconnect is NOT implemented on the server — the page keeps its
  // honest disabled state until a /reconnect route exists.
  const agents = {
    async list() {
      return req('GET', '/api/agents/status');
    },
    async restart(id) {
      return req('POST', `/api/agents/${encodeURIComponent(id)}/restart`);
    },
    async stop(id) {
      return req('POST', `/api/agents/${encodeURIComponent(id)}/stop`);
    },
    async start(id) {
      return req('POST', `/api/agents/${encodeURIComponent(id)}/start`);
    },
    async reconnect(id) {
      // Real endpoint — supervisor IPC RPC to the running child.
      // Response shape: { id, reconnected, durationMs, reconnected_at, channels, error? }
      return req('POST', `/api/agents/${encodeURIComponent(id)}/reconnect`);
    },
    async logs(id) {
      // Page shape is { shadow: string[], endpoint: string, stream: null }
      // Map real log rows → printable lines. Most recent first from server;
      // flip to oldest-first for display.
      const rows = await req('GET', `/api/agents/${encodeURIComponent(id)}/logs?limit=200`);
      const lines = (rows || []).slice().reverse().map(r => {
        const ts    = r.ts || new Date().toISOString();
        const level = (r.level || 'info').toUpperCase();
        const msg   = r.message || r.msg || JSON.stringify(r);
        return `[${ts}] ${level} · ${msg}`;
      });
      return {
        stream: null,   // SSE wiring comes later; null signals snapshot-only
        endpoint: `GET /api/agents/${id}/logs`,
        shadow: lines.length ? lines : [`[${new Date().toISOString()}] ${id} · no recent log events`],
      };
    },
    /** Subscribe to the SSE stream. Returns an unsubscribe fn. */
    subscribeStream(onSnapshot) {
      const url = API_BASE + '/api/agents/stream';
      // EventSource can't send Authorization headers; we pass the token
      // as a URL param. The server accepts ?bearer= for SESSION tokens
      // only (never the legacy shared bearer — see middleware/auth.js).
      const tok = getSessionToken() || API_BEARER;
      const es = new EventSource(url + '?bearer=' + encodeURIComponent(tok), { withCredentials: true });
      es.onmessage = (ev) => {
        try { onSnapshot(JSON.parse(ev.data)); } catch { /* ignore */ }
      };
      es.onerror = () => { /* auto-retries built in */ };
      return () => es.close();
    },
    /**
     * Subscribe to the per-agent LOG stream.
     * handlers: { onBacklog(rows[]), onLog(row), onError(err), onOpen(), onPing() }
     * Returns an unsubscribe fn.
     *
     *   GET /api/agents/:id/logs/stream?backlog=50&bearer=<tok>
     *
     * Emits three named SSE events:
     *   - "backlog" → array of {ts, level, message}, oldest first
     *   - "log"     → one {ts, level, message}
     *   - "ping"    → {at}   // keep-alive
     */
    subscribeLogs(id, handlers = {}) {
      const tok = getSessionToken() || API_BEARER;
      const url =
        API_BASE +
        '/api/agents/' + encodeURIComponent(id) + '/logs/stream' +
        '?backlog=' + encodeURIComponent(handlers.backlog ?? 50) +
        '&bearer=' + encodeURIComponent(tok);
      const es = new EventSource(url, { withCredentials: true });

      es.addEventListener('backlog', (ev) => {
        try { handlers.onBacklog && handlers.onBacklog(JSON.parse(ev.data)); }
        catch (e) { handlers.onError && handlers.onError(e); }
      });
      es.addEventListener('log', (ev) => {
        try { handlers.onLog && handlers.onLog(JSON.parse(ev.data)); }
        catch (e) { handlers.onError && handlers.onError(e); }
      });
      es.addEventListener('ping', (ev) => {
        try { handlers.onPing && handlers.onPing(JSON.parse(ev.data)); }
        catch { /* ignore */ }
      });
      es.addEventListener('open', () => { handlers.onOpen && handlers.onOpen(); });
      es.addEventListener('error', (ev) => {
        // EventSource auto-retries; surface for UI honesty.
        handlers.onError && handlers.onError(
          Object.assign(new Error('SSE error (browser will retry)'), { raw: ev })
        );
      });

      return () => { try { es.close(); } catch { /* ignore */ } };
    },
  };

  // ── Governance namespace (Agent Configuration & Governance) ────
  // Mirrors server/routes/governance.js. Every mutation that touches
  // a locked/protected field sends `x-unlock-token`, which the UI
  // obtains via governance.lock.verify() and stores in memory (never
  // localStorage — unlock tokens are ephemeral by contract).
  let _unlockToken = null;
  let _unlockExpiresAt = null;

  function _isUnlocked() {
    return !!_unlockToken && _unlockExpiresAt && (Date.now() < new Date(_unlockExpiresAt).getTime() - 1000);
  }

  async function _reqLocked(method, path, body) {
    const sessionTok = getSessionToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (sessionTok || API_BEARER),
    };
    if (_unlockToken) headers['x-unlock-token'] = _unlockToken;
    const res = await fetch(API_BASE + path, {
      method, headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data?.error || 'HTTP_ERROR';
      err.body = data || text;
      err.reason = data?.reason || null;
      throw err;
    }
    return data;
  }

  const governance = {
    // Lock
    async lockStatus() { return req('GET', '/api/governance/lock/status'); },
    async lockSet(password) {
      const out = await req('POST', '/api/governance/lock/set', { password });
      return out;
    },
    async lockVerify(password) {
      const out = await req('POST', '/api/governance/lock/verify', { password });
      _unlockToken = out.token;
      _unlockExpiresAt = out.expires_at;
      window.dispatchEvent(new CustomEvent('governance:unlocked', { detail: { expires_at: out.expires_at } }));
      return out;
    },
    async lockRotate(oldPassword, newPassword) {
      const out = await req('POST', '/api/governance/lock/rotate',
        { old_password: oldPassword, new_password: newPassword });
      _unlockToken = null; _unlockExpiresAt = null;
      window.dispatchEvent(new CustomEvent('governance:locked'));
      return out;
    },
    clearUnlock() {
      _unlockToken = null; _unlockExpiresAt = null;
      window.dispatchEvent(new CustomEvent('governance:locked'));
    },
    isUnlocked: _isUnlocked,
    unlockExpiresAt() { return _unlockExpiresAt; },

    // Profiles
    async listProfiles() { return req('GET', '/api/governance/profiles'); },
    async getProfile(agentId) { return req('GET', `/api/governance/profiles/${encodeURIComponent(agentId)}`); },
    async updateProfile(agentId, patch) {
      return _reqLocked('PUT', `/api/governance/profiles/${encodeURIComponent(agentId)}`, patch);
    },

    // Routing
    async listRouting(agentId) { return req('GET', `/api/governance/agents/${encodeURIComponent(agentId)}/routing`); },
    async updateRouting(agentId, channel, patch) {
      return _reqLocked('PUT', `/api/governance/agents/${encodeURIComponent(agentId)}/routing/${encodeURIComponent(channel)}`, patch);
    },

    // Tools
    async toolCatalogue() { return req('GET', '/api/governance/tools/catalogue'); },
    async listTools(agentId) { return req('GET', `/api/governance/agents/${encodeURIComponent(agentId)}/tools`); },
    async updateTool(agentId, toolKey, patch) {
      return _reqLocked('PUT', `/api/governance/agents/${encodeURIComponent(agentId)}/tools/${encodeURIComponent(toolKey)}`, patch);
    },

    // Memory
    async getMemory(agentId) { return req('GET', `/api/governance/agents/${encodeURIComponent(agentId)}/memory`); },
    async putMemory(agentId, body, protectedFlag) {
      return _reqLocked('PUT', `/api/governance/agents/${encodeURIComponent(agentId)}/memory`,
        { body, protected: protectedFlag });
    },
    async snapshotMemory(agentId, label) {
      return req('POST', `/api/governance/agents/${encodeURIComponent(agentId)}/memory/snapshot`, { label });
    },
    async listSnapshots(agentId, limit = 50) {
      return req('GET', `/api/governance/agents/${encodeURIComponent(agentId)}/memory/snapshots?limit=${limit}`);
    },
    async restoreMemory(agentId, snapshotId) {
      return _reqLocked('POST', `/api/governance/agents/${encodeURIComponent(agentId)}/memory/restore/${encodeURIComponent(snapshotId)}`);
    },

    // Audit
    async audit(limit = 100) { return req('GET', `/api/governance/audit?limit=${limit}`); },

    // Behavior tests
    async listTests(agentId, limit = 25) {
      const q = new URLSearchParams();
      if (agentId) q.set('agent_id', agentId);
      q.set('limit', String(limit));
      return req('GET', `/api/governance/tests?${q}`);
    },
    async runTest(agentId, channel) {
      return req('POST', `/api/governance/agents/${encodeURIComponent(agentId)}/test`, { channel });
    },
  };

  // ── Tickets namespace (customer-reply adapter) ────────────
  // Server routes:
  //   GET   /api/tickets                     — list (?status= & ?lane= filters)
  //   POST  /api/tickets                     — create  (manager+)
  //   GET   /api/tickets/:id                 — one + recent replies
  //   PATCH /api/tickets/:id                 — update   (manager+)
  //   POST  /api/tickets/:id/reply           — send to customer via sms/mail
  //
  // reply() returns { ok, reply } where reply.status is 'sent' | 'failed' |
  // 'no_channel' | 'internal'. On server-side refusals (409 NO_CHANNEL /
  // 503 PROVIDER_NOT_CONFIGURED) req() throws — the UI catches err.code
  // to render the honest "not wired" state with the specific reason.
  const tickets = {
    async list(filters = {}) {
      const q = new URLSearchParams();
      if (filters.status) q.set('status', filters.status);
      if (filters.lane)   q.set('lane',   filters.lane);
      if (filters.limit)  q.set('limit',  String(filters.limit));
      const qs = q.toString();
      return req('GET', '/api/tickets' + (qs ? '?' + qs : ''));
    },
    async get(id) {
      return req('GET', `/api/tickets/${encodeURIComponent(id)}`);
    },
    async create(body) {
      return req('POST', '/api/tickets', body);
    },
    async update(id, patch) {
      return req('PATCH', `/api/tickets/${encodeURIComponent(id)}`, patch);
    },
    async reply(id, { body, channel, from } = {}) {
      return req('POST', `/api/tickets/${encodeURIComponent(id)}/reply`,
        { body, channel, from });
    },
  };

  // ── Broadcast namespace (SMS + email fan-out) ─────────────
  // Server routes:
  //   POST /api/broadcast/sms   — { to?, group?, role?, body, from? }
  //   POST /api/broadcast/email — { to?, group?, role?, subject, html|text, from?, replyTo? }
  //   GET  /api/broadcast/:id   — audit trail for one batch
  //
  // Manager+ only. Hard cap of 20 recipients per request. Response
  // shape: { channel, broadcast_id, attempted, sent, skipped[], failures[] }.
  // Per-recipient errors are captured, never aborting the batch.
  const broadcast = {
    async sms({ to, group, role, body, from } = {}) {
      return req('POST', '/api/broadcast/sms', { to, group, role, body, from });
    },
    async email({ to, group, role, subject, html, text, from, replyTo } = {}) {
      return req('POST', '/api/broadcast/email',
        { to, group, role, subject, html, text, from, replyTo });
    },
    async report(broadcast_id) {
      return req('GET', `/api/broadcast/${encodeURIComponent(broadcast_id)}`);
    },
  };

  // ── Install ───────────────────────────────────────────────
  // We don't run React yet at script-tag time; the main app boots
  // on DOMContentLoaded via src/app.jsx. We MUST install before the
  // CredentialsPage renders, so do it at module load. window.api is
  // set by api-client.jsx which loads earlier — we extend it.

  function install(healthPayload) {
    // Defensive: api-client.jsx sets window.api synchronously at load.
    if (!window.api) window.api = {};
    window.api.credentials = credentials;
    window.api.health      = health;
    window.api.agents      = agents;
    window.api.models      = models;
    window.api.governance  = governance;
    window.api.session     = session;
    window.api.tickets     = tickets;
    window.api.broadcast   = broadcast;
    window.API_HTTP_READY  = true;
    window.API_HTTP_HEALTH = healthPayload || null;

    // One-line visible confirmation for operators
    // eslint-disable-next-line no-console
    console.info(
      '[tkmc] HTTP adapter online · API_BASE=' + API_BASE +
      (healthPayload ? ' · wiring=' + JSON.stringify(healthPayload.wiring) : '')
    );

    // Dispatch so any page currently showing "Backend not wired"
    // can re-render. CredentialsPage doesn't listen today, but a
    // manual reload or nav-away/nav-back will pick it up — and this
    // event gives us a hook for the next increment.
    window.dispatchEvent(new CustomEvent('api:http-ready', { detail: healthPayload || null }));
  }

  function installOffline(err) {
    // Leave window.api.credentials undefined so the page renders its
    // honest "Backend not wired" card. Don't throw — this is expected
    // when the operator hasn't started the server yet.
    window.API_HTTP_READY    = false;
    window.API_HTTP_OFFLINE  = true;
    window.API_HTTP_ERROR    = err || null;
    // eslint-disable-next-line no-console
    console.warn(
      '[tkmc] HTTP adapter offline · tried ' + (API_BASE || location.origin) + '/api/health-check · ' +
      (err ? (err.message || err) : 'unreachable') +
      ' · the Credentials page will show "Backend not wired" until the server is running.'
    );
    window.dispatchEvent(new CustomEvent('api:http-offline', { detail: { error: err } }));
  }

  // Probe now (async) — the app will boot regardless. If the server
  // answers before CredentialsPage renders, you get a live page;
  // otherwise the page renders its offline card and a later reload
  // brings it online.
  probeHealth().then(result => {
    if (result.ok) install(result.health);
    else installOffline(result.error);
  });

  // Also expose the helpers for operator use in the console.
  window.tkmcHttp = {
    req, probeHealth, API_BASE,
    setBase(base) { localStorage.setItem('tkmc.api.base', base); location.reload(); },
    setBearer(tok) { localStorage.setItem('tkmc.api.bearer', tok); location.reload(); },
    clearOverrides() {
      localStorage.removeItem('tkmc.api.base');
      localStorage.removeItem('tkmc.api.bearer');
      location.reload();
    },
  };
})();
