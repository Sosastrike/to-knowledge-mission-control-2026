// ============================================================
// MeetingsHubPage — full-page Meetings & Integrations surface.
//
// HONESTY CONTRACT (read before editing):
//   - Provider OAuth, token refresh, and test calls are ADMIN WIRE-UP.
//     We do NOT simulate a Zoom or Teams authorization. Clicking Connect
//     opens a modal that explains exactly what an admin must do server-side
//     and what redirect URIs + scopes are expected.
//   - Every button is either:
//       (a) fully functional against app-owned state (agent assignment,
//           permissions, meeting drafts that live in this session), OR
//       (b) labeled `ADMIN WIRE-UP` with a short hover description.
//   - Meeting creation yields a draft meeting with a fake join URL
//     that is clearly marked as a prototype identifier.
//
// State persistence:
//   - Provider connection state, agent assignments, and permissions
//     persist to localStorage under 'mh.*' keys so refreshes feel real.
//   - This is a UX fidelity aid, NOT a live integration.
// ============================================================

const MH_STORAGE_KEY = 'mh.v1';

const MH_PROVIDER_CATALOG = [
  {
    id: 'zoom',
    name: 'Zoom',
    tagline: 'Zoom Meetings & Webinars',
    accent: '#2d8cff',
    glyph: 'Z',
    gradient: 'linear-gradient(135deg, #2d8cff 0%, #0b5ed7 100%)',
    capabilities: ['Create meetings', 'Auto-join', 'Transcribe', 'Webhooks'],
    scopes: ['meeting:read', 'meeting:write', 'user:read', 'webhook:write'],
    redirectUri: 'https://mission.to-knowledge.com/oauth/zoom/callback',
    docs: 'https://marketplace.zoom.us/docs/api-reference',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    tagline: 'Teams & Microsoft Graph',
    accent: '#5b5fc7',
    glyph: 'T',
    gradient: 'linear-gradient(135deg, #5b5fc7 0%, #3b3fa7 100%)',
    capabilities: ['Create meetings', 'Calendar sync', 'Presence', 'Transcribe'],
    scopes: ['OnlineMeetings.ReadWrite', 'Calendars.Read', 'Presence.Read.All'],
    redirectUri: 'https://mission.to-knowledge.com/oauth/teams/callback',
    docs: 'https://learn.microsoft.com/graph/api/resources/onlinemeeting',
  },
  {
    id: 'meet',
    name: 'Google Meet',
    tagline: 'Google Meet via Calendar',
    accent: '#00ac47',
    glyph: 'G',
    gradient: 'linear-gradient(135deg, #00ac47 0%, #1a73e8 100%)',
    capabilities: ['Create via Calendar', 'Recording', 'Captions'],
    scopes: ['calendar.events', 'meetings.space.created'],
    redirectUri: 'https://mission.to-knowledge.com/oauth/google/callback',
    docs: 'https://developers.google.com/meet/api',
  },
  {
    id: 'webex',
    name: 'Cisco Webex',
    tagline: 'Webex Meetings',
    accent: '#00bceb',
    glyph: 'W',
    gradient: 'linear-gradient(135deg, #00bceb 0%, #0067a0 100%)',
    capabilities: ['Create meetings', 'Webhooks', 'Recording'],
    scopes: ['meeting:write', 'meeting:read', 'webhook:write'],
    redirectUri: 'https://mission.to-knowledge.com/oauth/webex/callback',
    docs: 'https://developer.webex.com/docs',
  },
];

// Honest provider states — these are the only values used anywhere.
const MH_STATE = {
  NOT_CONNECTED:    'not_connected',
  AUTH_REQUIRED:    'auth_required',      // user initiated connect, awaiting admin wire-up
  CONNECTED_NEW:    'connected_new',      // connected but no successful test call yet
  CONNECTED:        'connected',          // connected and last test passed
  TOKEN_EXPIRED:    'token_expired',      // was connected, credentials lapsed
  TEST_FAILED:      'test_failed',        // connected but last test returned error
};

const MH_ROLES = [
  { id: 'owner',   label: 'Owner'   },
  { id: 'admin',   label: 'Admin'   },
  { id: 'manager', label: 'Manager' },
  { id: 'agent',   label: 'Agent'   },
  { id: 'viewer',  label: 'Viewer'  },
];

const MH_PERMS = [
  { id: 'create',     label: 'Create meetings'   },
  { id: 'join',       label: 'Join meetings'     },
  { id: 'assign',     label: 'Assign agents'     },
  { id: 'disconnect', label: 'Disconnect provider' },
  { id: 'rotate',     label: 'Rotate credentials' },
];

const MH_DEFAULT_PERMS = {
  owner:   { create:true,  join:true,  assign:true,  disconnect:true,  rotate:true  },
  admin:   { create:true,  join:true,  assign:true,  disconnect:true,  rotate:true  },
  manager: { create:true,  join:true,  assign:true,  disconnect:false, rotate:false },
  agent:   { create:false, join:true,  assign:false, disconnect:false, rotate:false },
  viewer:  { create:false, join:false, assign:false, disconnect:false, rotate:false },
};

// Initial state — nothing is faked as Connected. All providers start honest.
function mhDefaultState() {
  return {
    providers: {
      zoom:  { state: MH_STATE.NOT_CONNECTED, assignedAgents: [],            lastAction: null },
      teams: { state: MH_STATE.NOT_CONNECTED, assignedAgents: [],            lastAction: null },
      meet:  { state: MH_STATE.NOT_CONNECTED, assignedAgents: [],            lastAction: null },
      webex: { state: MH_STATE.NOT_CONNECTED, assignedAgents: [],            lastAction: null },
    },
    permissions: MH_DEFAULT_PERMS,
    drafts: [],     // meetings created via this UI (all prototype UUIDs)
    log: [],        // audit log of user actions
  };
}

// ─── Backend-backed persistence ─────────────────────────────────
// Migrated (Priority 1): state now lives in workspace_meeting_state via
// window.api.meetings.{getState,saveState}. The page still uses a single
// setState(s => ...) pattern; we just route the read/write through the API
// layer so role guards + audit events fire correctly. Legacy `mh.v1`
// localStorage payloads are migrated automatically by the adapter's seeder.
const MH_LEGACY_KEY = 'mh.v1';

function mhLoadState() {
  try {
    // Synchronous hydration fallback — React.useState initializer must be sync.
    // The api layer is async, so on first render we dip straight into the
    // adapter's localStorage backing store. Writes still go through the api.
    const base = mhDefaultState();
    if (window.LocalAdapter) {
      try {
        const rows = JSON.parse(localStorage.getItem('tkmc.bk.workspace_meeting_state')) || [];
        const row = rows[0];
        if (row) return {
          providers:   { ...base.providers,   ...(row.providers   || {}) },
          permissions: { ...base.permissions, ...(row.permissions || {}) },
          drafts:      row.drafts || [],
          log:         row.log    || [],
        };
      } catch(e){}
    }
    // Legacy fallback — older installs that still have mh.v1 but no adapter row yet
    const raw = localStorage.getItem(MH_LEGACY_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      providers:   { ...base.providers,   ...(parsed.providers   || {}) },
      permissions: { ...base.permissions, ...(parsed.permissions || {}) },
      drafts:      parsed.drafts || [],
      log:         parsed.log    || [],
    };
  } catch(e) { return mhDefaultState(); }
}
function mhSaveState(s) {
  // Route through the API client — role guards + audit events fire there.
  // Fire-and-forget; UI already reflects the new state optimistically.
  if (window.api && window.api.meetings) {
    window.api.meetings.saveState(s).catch(err => {
      if (err && err.code === 'PERMISSION_DENIED') {
        mhToast?.('err', err.message);
      }
    });
    return;
  }
  // Fallback if api hasn't loaded yet
  try { localStorage.setItem(MH_LEGACY_KEY, JSON.stringify(s)); } catch(e) {}
}

// ─── Status rendering ──────────────────────────────────────────
function mhStatusMeta(state) {
  switch(state) {
    case MH_STATE.NOT_CONNECTED: return { label:'Not connected',          color:'muted',  dot:'muted',   icon:'Plug',    detail:'No credentials on file. Click Connect to begin authorization.' };
    case MH_STATE.AUTH_REQUIRED: return { label:'Requires authorization', color:'warn',   dot:'warn',    icon:'Key',     detail:'Authorization started but OAuth redirect has not been configured on the server yet.' };
    case MH_STATE.CONNECTED_NEW: return { label:'Connected · untested',   color:'accent', dot:'warn',    icon:'Link',    detail:'Credentials stored, but no API call has been validated yet. Run a test call.' };
    case MH_STATE.CONNECTED:     return { label:'Connected',              color:'ok',     dot:'ok',      icon:'Check',   detail:'Credentials valid. Last test call succeeded.' };
    case MH_STATE.TOKEN_EXPIRED: return { label:'Token expired',          color:'err',    dot:'err',     icon:'Alert',   detail:'OAuth refresh token is no longer valid. Re-authorize to restore access.' };
    case MH_STATE.TEST_FAILED:   return { label:'Test failed',            color:'err',    dot:'err',     icon:'Alert',   detail:'Last provider test call returned an error. Review logs or re-authorize.' };
    default:                     return { label:state,                    color:'muted',  dot:'muted',   icon:'Info',    detail:'' };
  }
}

// ─── Glyph tile ────────────────────────────────────────────────
function MhGlyph({ provider, size=44 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.26,
      background: provider.gradient,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontWeight:700, fontSize: size*0.48,
      letterSpacing: '-0.02em',
      boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 8px 20px ${provider.accent}33`,
      flexShrink: 0,
    }}>
      {provider.glyph}
    </div>
  );
}

// ─── Little amber "ADMIN WIRE-UP" badge ────────────────────────
function MhWireup({ what }) {
  return (
    <span className="mh-wireup" title={what || 'Requires server-side configuration before this action can execute.'}>
      ADMIN WIRE-UP
    </span>
  );
}

// ─── Toast (tiny, self-contained, reused pattern) ──────────────
const _mhToastEvt = new EventTarget();
function mhToast(kind, message){ _mhToastEvt.dispatchEvent(new CustomEvent('t', { detail:{ kind, message, id: Math.random() } })); }
function MhToastHost(){
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    const h = (e) => {
      const t = e.detail;
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3800);
    };
    _mhToastEvt.addEventListener('t', h);
    return () => _mhToastEvt.removeEventListener('t', h);
  }, []);
  return (
    <div className="mh-toast-host">
      {toasts.map(t => (
        <div key={t.id} className={`mh-toast mh-toast-${t.kind}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ─── API call helper ───────────────────────────────────────────
// Every Meetings mutation routes through window.api.meetings.* — that layer
// enforces role permissions (schema.jsx ROLE_PERMISSIONS) and emits audit
// events into `audit_events`. We fire-and-forget but surface PERMISSION_DENIED
// and other real errors as toasts so the UI stays honest about what succeeded.
function mhApi(method, ...args) {
  if (!(window.api && window.api.meetings && typeof window.api.meetings[method] === 'function')) {
    return Promise.resolve({ ok: false, reason: 'api_unavailable' });
  }
  return window.api.meetings[method](...args).catch(err => {
    if (err && err.code === 'PERMISSION_DENIED') {
      mhToast('err', err.message || 'Permission denied');
    } else if (err && err.message) {
      mhToast('err', err.message);
    }
    return { ok: false, error: err };
  });
}

// ─── Main page ─────────────────────────────────────────────────
function MeetingsHubPage() {
  const [state, setState] = React.useState(mhLoadState);
  const [tab, setTab]     = React.useState('providers');  // providers | agents | permissions | meetings | log
  const [connectModal, setConnectModal] = React.useState(null);   // provider id
  const [detailsModal, setDetailsModal] = React.useState(null);   // provider id
  const [disconnectModal, setDisconnectModal] = React.useState(null); // provider id
  const [createMeetingModal, setCreateMeetingModal] = React.useState(false);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => { mhSaveState(state); }, [state]);

  const addLog = (entry) => {
    setState(s => ({
      ...s,
      log: [{
        id: Math.random().toString(36).slice(2, 9),
        t: new Date().toISOString(),
        ...entry,
      }, ...s.log].slice(0, 200),
    }));
  };

  const setProvider = (id, patch, logEntry) => {
    setState(s => {
      const nextProviders = {
        ...s.providers,
        [id]: { ...s.providers[id], ...patch, lastAction: new Date().toISOString() },
      };
      const nextLog = logEntry
        ? [{ id: Math.random().toString(36).slice(2, 9), t: new Date().toISOString(), ...logEntry }, ...s.log].slice(0, 200)
        : s.log;
      return { ...s, providers: nextProviders, log: nextLog };
    });
  };

  const filtered = MH_PROVIDER_CATALOG.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  );

  const counts = React.useMemo(() => {
    const c = { connected: 0, needsAttention: 0, notConnected: 0 };
    for (const p of MH_PROVIDER_CATALOG) {
      const st = state.providers[p.id]?.state || MH_STATE.NOT_CONNECTED;
      if (st === MH_STATE.CONNECTED) c.connected++;
      else if (st === MH_STATE.TOKEN_EXPIRED || st === MH_STATE.TEST_FAILED || st === MH_STATE.AUTH_REQUIRED) c.needsAttention++;
      else if (st === MH_STATE.CONNECTED_NEW) c.connected++; // still counts as provisioned
      else c.notConnected++;
    }
    return c;
  }, [state]);

  return (
    <div className="mh-page">
      {/* HEADER */}
      <div className="mh-header">
        <div className="mh-header-left">
          <div className="mh-header-icon">
            <I.Meeting size={20}/>
          </div>
          <div>
            <h1 className="mh-title">Meetings &amp; Integrations</h1>
            <div className="mh-subtitle">
              Manage conferencing providers, assign agents, and create meetings from one place.
            </div>
          </div>
        </div>
        <div className="mh-header-right">
          <div className="mh-stat">
            <span className="mh-stat-num">{counts.connected}</span>
            <span className="mh-stat-label">Connected</span>
          </div>
          <div className="mh-stat mh-stat-warn">
            <span className="mh-stat-num">{counts.needsAttention}</span>
            <span className="mh-stat-label">Need attention</span>
          </div>
          <div className="mh-stat mh-stat-muted">
            <span className="mh-stat-num">{counts.notConnected}</span>
            <span className="mh-stat-label">Not connected</span>
          </div>
          <div className="mh-header-divider"/>
          <button
            className={`mh-btn-primary ${counts.connected === 0 ? 'is-disabled' : ''}`}
            disabled={counts.connected === 0}
            title={counts.connected === 0 ? 'Connect a provider first' : 'Compose a new meeting'}
            onClick={() => setCreateMeetingModal(true)}>
            <I.Plus size={13}/> Create meeting
          </button>
        </div>
      </div>

      {/* HONESTY BANNER — permanent, on brand */}
      <div className="mh-honesty">
        <I.Info size={13}/>
        <span>
          This Mission Control manages the UX and role-based access for meeting providers. Provider API calls
          (<span className="mh-ik">OAuth</span>, <span className="mh-ik">Create meeting</span>, <span className="mh-ik">Test</span>)
          require server-side wire-up — buttons flagged <MhWireup/> explain what an admin must configure.
        </span>
      </div>

      {/* TABS */}
      <div className="mh-tabs">
        {[
          { id:'providers',   label:'Providers',     icon:'Plug' },
          { id:'agents',      label:'Agent assignment', icon:'Agents' },
          { id:'permissions', label:'Permissions',   icon:'Shield' },
          { id:'meetings',    label:'Meetings',      icon:'Meeting', count: state.drafts.length },
          { id:'log',         label:'Activity log',  icon:'FileLog', count: state.log.length },
        ].map(t => {
          const IconCmp = I[t.icon] || I.Plug;
          return (
            <button key={t.id} className={`mh-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              <IconCmp size={13}/> {t.label}
              {t.count > 0 && <span className="mh-tab-count">{t.count}</span>}
            </button>
          );
        })}
        <div className="mh-tab-spacer"/>
        {tab === 'providers' && (
          <div className="mh-search">
            <I.Search size={12}/>
            <input placeholder="Search providers…" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="mh-body">
        {tab === 'providers' && (
          <div className="mh-providers-grid">
            {filtered.map(p => {
              const ps = state.providers[p.id];
              return (
                <MhProviderCard
                  key={p.id}
                  provider={p}
                  pstate={ps}
                  onConnect={() => setConnectModal(p.id)}
                  onReconnect={() => setConnectModal(p.id)}
                  onDisconnect={() => setDisconnectModal(p.id)}
                  onTest={async () => {
                    // Route through api.meetings.test → fires audit `meeting.provider.test`.
                    // Real server call would hit the provider /me endpoint; local adapter
                    // returns ok:false with a wire-up reason.
                    const res = await mhApi('test', p.id);
                    if (res && res.ok) {
                      mhToast('ok', `${p.name} test call succeeded.`);
                    } else {
                      mhToast('warn', `Test call for ${p.name} requires server-side wire-up. UI surfaces the result only.`);
                    }
                    addLog({ kind:'test_attempted', providerId: p.id, detail:'Test call requires server-side wire-up.' });
                  }}
                  onDetails={() => setDetailsModal(p.id)}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="mh-empty">
                <I.Search size={18}/>
                <div>No providers match "{query}"</div>
              </div>
            )}
          </div>
        )}

        {tab === 'agents' && (
          <MhAgentsPanel
            state={state}
            setProvider={setProvider}
          />
        )}

        {tab === 'permissions' && (
          <MhPermissionsPanel
            state={state}
            onChange={async (role, perm, value) => {
              // api.meetings.setPermissions → audit `meeting.permissions.update`.
              // Requires meetings.connect (owner/admin only).
              const nextPerms = { ...state.permissions[role], [perm]: value };
              const res = await mhApi('setPermissions', role, nextPerms);
              if (res && res.error && res.error.code === 'PERMISSION_DENIED') return;
              setState(s => ({
                ...s,
                permissions: {
                  ...s.permissions,
                  [role]: { ...s.permissions[role], [perm]: value },
                },
              }));
              addLog({ kind:'permission_changed', detail: `${role}.${perm} → ${value ? 'allowed' : 'denied'}` });
            }}
            onReset={() => {
              setState(s => ({ ...s, permissions: MH_DEFAULT_PERMS }));
              addLog({ kind:'permissions_reset', detail:'Reset to defaults' });
              mhToast('ok', 'Permissions restored to defaults');
            }}
          />
        )}

        {tab === 'meetings' && (
          <MhMeetingsPanel
            state={state}
            onCreate={() => setCreateMeetingModal(true)}
            onCancel={async (id) => {
              // api.meetings.cancelDraft → audit `meeting.draft.cancel` (warn).
              const res = await mhApi('cancelDraft', id);
              if (res && res.error && res.error.code === 'PERMISSION_DENIED') return;
              setState(s => ({ ...s, drafts: s.drafts.filter(d => d.id !== id) }));
              addLog({ kind:'meeting_cancelled', detail:`Draft ${id} cancelled` });
              mhToast('ok', 'Meeting cancelled');
            }}
          />
        )}

        {tab === 'log' && <MhLogPanel state={state} onClear={() => setState(s => ({ ...s, log: [] }))}/>}
      </div>

      {/* MODALS */}
      {connectModal && (
        <MhConnectModal
          provider={MH_PROVIDER_CATALOG.find(p => p.id === connectModal)}
          pstate={state.providers[connectModal]}
          onClose={() => setConnectModal(null)}
          onConfirm={async () => {
            // Gate against the role permission matrix BEFORE we touch local state.
            // api.meetings.connect() throws PERMISSION_DENIED on manager/agent/viewer.
            const prevState = state.providers[connectModal]?.state;
            const isReauth = prevState === MH_STATE.CONNECTED || prevState === MH_STATE.CONNECTED_NEW || prevState === MH_STATE.TOKEN_EXPIRED;
            const res = isReauth
              ? await mhApi('rotate', connectModal)     // requires meetings.rotate (owner/admin)
              : await mhApi('connect', connectModal);   // requires meetings.connect (owner/admin)
            if (res && res.error && res.error.code === 'PERMISSION_DENIED') {
              setConnectModal(null);
              return;
            }
            setProvider(connectModal,
              { state: MH_STATE.AUTH_REQUIRED },
              { kind:'connect_initiated', providerId: connectModal, detail: isReauth ? 'Token rotation requested · awaiting OAuth wire-up' : 'Awaiting server-side OAuth wire-up' }
            );
            mhToast('warn', `${MH_PROVIDER_CATALOG.find(p=>p.id===connectModal).name}: OAuth redirect is not configured on the server. Share the redirect URI with your admin.`);
            setConnectModal(null);
          }}
        />
      )}
      {detailsModal && (
        <MhDetailsModal
          provider={MH_PROVIDER_CATALOG.find(p => p.id === detailsModal)}
          pstate={state.providers[detailsModal]}
          onClose={() => setDetailsModal(null)}
        />
      )}
      {disconnectModal && (
        <MhDisconnectModal
          provider={MH_PROVIDER_CATALOG.find(p => p.id === disconnectModal)}
          onClose={() => setDisconnectModal(null)}
          onConfirm={async () => {
            // api.meetings.disconnect → audit `meeting.provider.disconnect` (warn).
            const res = await mhApi('disconnect', disconnectModal);
            if (res && res.error && res.error.code === 'PERMISSION_DENIED') {
              setDisconnectModal(null);
              return;
            }
            setProvider(disconnectModal,
              { state: MH_STATE.NOT_CONNECTED, assignedAgents: [] },
              { kind:'disconnected', providerId: disconnectModal, detail:'User disconnected (app-side credentials cleared)' }
            );
            mhToast('ok', `${MH_PROVIDER_CATALOG.find(p=>p.id===disconnectModal).name} disconnected. Provider-side app uninstall must be done in the provider console.`);
            setDisconnectModal(null);
          }}
        />
      )}
      {createMeetingModal && (
        <MhCreateMeetingModal
          providers={MH_PROVIDER_CATALOG.filter(p => {
            const st = state.providers[p.id]?.state;
            return st === MH_STATE.CONNECTED || st === MH_STATE.CONNECTED_NEW;
          })}
          onClose={() => setCreateMeetingModal(false)}
          onCreate={async (draft) => {
            // api.meetings.createDraft → audit `meeting.draft.create` with title + provider.
            const res = await mhApi('createDraft', draft);
            if (res && res.error && res.error.code === 'PERMISSION_DENIED') {
              setCreateMeetingModal(false);
              return;
            }
            setState(s => ({
              ...s,
              drafts: [draft, ...s.drafts],
              log: [{
                id: Math.random().toString(36).slice(2,9),
                t: new Date().toISOString(),
                kind:'meeting_created',
                providerId: draft.providerId,
                detail: `Draft meeting "${draft.title}" created (provider setup pending)`,
              }, ...s.log].slice(0, 200),
            }));
            mhToast('ok', 'Meeting drafted. Real join URL requires provider API setup.');
            setCreateMeetingModal(false);
            setTab('meetings');
          }}
        />
      )}

      <MhToastHost/>
    </div>
  );
}

// ─── Provider card ─────────────────────────────────────────────
function MhProviderCard({ provider, pstate, onConnect, onReconnect, onDisconnect, onTest, onDetails }) {
  const meta = mhStatusMeta(pstate.state);
  const isConnected = pstate.state === MH_STATE.CONNECTED || pstate.state === MH_STATE.CONNECTED_NEW;
  const needsAuth   = pstate.state === MH_STATE.AUTH_REQUIRED || pstate.state === MH_STATE.TOKEN_EXPIRED;
  const StatusIcon  = I[meta.icon] || I.Info;

  return (
    <div className={`mh-card mh-card-${meta.color}`} style={{'--mh-accent': provider.accent}}>
      <div className="mh-card-top">
        <MhGlyph provider={provider}/>
        <div className="mh-card-head">
          <div className="mh-card-title">{provider.name}</div>
          <div className="mh-card-tag">{provider.tagline}</div>
        </div>
        <button className="mh-icon-btn" onClick={onDetails} title="Details &amp; OAuth info">
          <I.Info size={14}/>
        </button>
      </div>

      <div className={`mh-status-row mh-status-${meta.color}`}>
        <StatusIcon size={13}/>
        <span className="mh-status-label">{meta.label}</span>
        {pstate.lastAction && (
          <span className="mh-status-when" title={pstate.lastAction}>
            {mhRelativeTime(pstate.lastAction)}
          </span>
        )}
      </div>

      <div className="mh-status-detail">{meta.detail}</div>

      <div className="mh-caps">
        {provider.capabilities.map(c => (
          <span key={c} className="mh-cap">{c}</span>
        ))}
      </div>

      <div className="mh-card-actions">
        {pstate.state === MH_STATE.NOT_CONNECTED && (
          <>
            <button className="mh-btn-primary flex" onClick={onConnect}>
              <I.Link size={12}/> Connect
            </button>
            <button className="mh-btn-ghost" onClick={onDetails}>
              Requirements
            </button>
          </>
        )}
        {pstate.state === MH_STATE.AUTH_REQUIRED && (
          <>
            <button className="mh-btn-warn flex" onClick={onReconnect}>
              <I.Key size={12}/> Resume authorization
            </button>
            <button className="mh-btn-ghost" onClick={onDisconnect}>Cancel</button>
          </>
        )}
        {(isConnected) && (
          <>
            <button className="mh-btn-ghost" onClick={onTest} title="Sends a minimal API call to verify credentials">
              <I.Activity size={12}/> Test
              <MhWireup what="A real test call requires server-side OAuth credentials."/>
            </button>
            <button className="mh-btn-ghost" onClick={onReconnect} title="Re-authorize to refresh scopes or tokens">
              <I.Refresh size={12}/> Reconnect
            </button>
            <button className="mh-btn-danger" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        )}
        {pstate.state === MH_STATE.TOKEN_EXPIRED && (
          <>
            <button className="mh-btn-primary flex" onClick={onReconnect}>
              <I.Refresh size={12}/> Re-authorize
            </button>
            <button className="mh-btn-ghost" onClick={onDisconnect}>Disconnect</button>
          </>
        )}
        {pstate.state === MH_STATE.TEST_FAILED && (
          <>
            <button className="mh-btn-primary flex" onClick={onReconnect}>
              <I.Refresh size={12}/> Reconnect
            </button>
            <button className="mh-btn-ghost" onClick={onDetails}>View error</button>
            <button className="mh-btn-ghost" onClick={onDisconnect}>Disconnect</button>
          </>
        )}
      </div>

      {pstate.assignedAgents && pstate.assignedAgents.length > 0 && (
        <div className="mh-card-agents">
          <span className="mh-card-agents-label">Agents</span>
          <div className="mh-agent-stack">
            {pstate.assignedAgents.slice(0, 4).map(aid => {
              const ag = (window.AGENTS || []).find(a => a.id === aid);
              if (!ag) return null;
              return <span key={aid} className="mh-agent-chip" title={ag.name}>{ag.name.charAt(0)}</span>;
            })}
            {pstate.assignedAgents.length > 4 && <span className="mh-agent-more">+{pstate.assignedAgents.length - 4}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent assignment panel ────────────────────────────────────
function MhAgentsPanel({ state, setProvider }) {
  const agents = (window.AGENTS || []).filter(a => a.status !== 'offline');
  const connectedProviders = MH_PROVIDER_CATALOG.filter(p => {
    const st = state.providers[p.id]?.state;
    return st === MH_STATE.CONNECTED || st === MH_STATE.CONNECTED_NEW;
  });

  const toggleAgent = async (providerId, agentId) => {
    const current = state.providers[providerId].assignedAgents || [];
    const isAssigning = !current.includes(agentId);
    // Route through api.meetings.assignAgent / unassignAgent → audit
    // `meeting.agent.assign` / `meeting.agent.unassign`. Manager+ can write.
    const res = await mhApi(isAssigning ? 'assignAgent' : 'unassignAgent', providerId, agentId);
    if (res && res.error && res.error.code === 'PERMISSION_DENIED') return;
    const next = isAssigning
      ? [...current, agentId]
      : current.filter(x => x !== agentId);
    setProvider(providerId, { assignedAgents: next }, {
      kind:'agent_assignment_changed',
      providerId,
      detail: `${(window.AGENTS||[]).find(a=>a.id===agentId)?.name}: ${isAssigning ? 'assigned to' : 'unassigned from'} ${providerId}`,
    });
  };

  if (connectedProviders.length === 0) {
    return (
      <div className="mh-empty-panel">
        <I.Plug size={24}/>
        <h3>No providers connected yet</h3>
        <p>Connect a meeting provider from the Providers tab to assign agents.</p>
      </div>
    );
  }

  return (
    <div className="mh-agents-wrap">
      <div className="mh-panel-header">
        <div>
          <h3>Agent assignment</h3>
          <p>Which agents are allowed to auto-join meetings on each connected provider. Changes apply immediately and persist locally.</p>
        </div>
      </div>
      <div className="mh-agents-grid">
        {connectedProviders.map(p => {
          const assigned = state.providers[p.id].assignedAgents || [];
          return (
            <div key={p.id} className="mh-agents-card">
              <div className="mh-agents-card-head">
                <MhGlyph provider={p} size={32}/>
                <div>
                  <div className="mh-agents-card-title">{p.name}</div>
                  <div className="mh-agents-card-sub">{assigned.length} of {agents.length} assigned</div>
                </div>
              </div>
              <div className="mh-agents-list">
                {agents.map(ag => {
                  const on = assigned.includes(ag.id);
                  return (
                    <div key={ag.id} className={`mh-agent-row ${on ? 'on' : ''}`} onClick={() => toggleAgent(p.id, ag.id)}>
                      <div className="mh-agent-check">{on && <I.Check size={11}/>}</div>
                      <div className="mh-agent-avatar">{ag.name.charAt(0)}</div>
                      <div className="mh-agent-info">
                        <div className="mh-agent-name">{ag.name}</div>
                        <div className="mh-agent-role">{ag.role}</div>
                      </div>
                      <div className={`mh-agent-status ${ag.status}`}>{ag.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Permissions panel ─────────────────────────────────────────
function MhPermissionsPanel({ state, onChange, onReset }) {
  return (
    <div className="mh-perms-wrap">
      <div className="mh-panel-header">
        <div>
          <h3>Role permissions</h3>
          <p>App-level access control for meeting management. Permissions persist locally and are enforced in the UI.</p>
        </div>
        <button className="mh-btn-ghost" onClick={onReset}>
          <I.Restart size={12}/> Reset to defaults
        </button>
      </div>
      <div className="mh-perms-table">
        <div className="mh-perms-header">
          <div/>
          {MH_PERMS.map(p => <div key={p.id} className="mh-perms-col-head">{p.label}</div>)}
        </div>
        {MH_ROLES.map(role => (
          <div key={role.id} className="mh-perms-row">
            <div className="mh-perms-role">
              <div className={`mh-perms-role-badge role-${role.id}`}>{role.label.charAt(0)}</div>
              <span>{role.label}</span>
            </div>
            {MH_PERMS.map(perm => (
              <div key={perm.id} className="mh-perms-cell">
                <MhToggle
                  on={!!state.permissions[role.id]?.[perm.id]}
                  onToggle={v => onChange(role.id, perm.id, v)}
                  disabled={role.id === 'owner'}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mh-perms-note">
        <I.Info size={12}/>
        Owner permissions cannot be revoked. Server-side API calls (OAuth refresh, token rotation)
        require additional admin credentials — see <span className="mh-ik">Providers → Requirements</span> on each card.
      </div>
    </div>
  );
}

// ─── Meetings (drafts) panel ───────────────────────────────────
function MhMeetingsPanel({ state, onCreate, onCancel }) {
  if (state.drafts.length === 0) {
    return (
      <div className="mh-empty-panel">
        <I.Meeting size={24}/>
        <h3>No meetings yet</h3>
        <p>Meetings you create from this Mission Control appear here. Real join URLs appear after provider APIs are wired.</p>
        <button className="mh-btn-primary" onClick={onCreate}>
          <I.Plus size={12}/> Create meeting
        </button>
      </div>
    );
  }
  return (
    <div className="mh-meetings-wrap">
      <div className="mh-panel-header">
        <div>
          <h3>Scheduled meetings</h3>
          <p>Drafts created from this interface. Real provider calls are required to materialize them as live meetings.</p>
        </div>
        <button className="mh-btn-primary" onClick={onCreate}>
          <I.Plus size={12}/> New meeting
        </button>
      </div>
      <div className="mh-meetings-list">
        {state.drafts.map(m => {
          const p = MH_PROVIDER_CATALOG.find(x => x.id === m.providerId);
          return (
            <div key={m.id} className="mh-meeting-row">
              <MhGlyph provider={p} size={32}/>
              <div className="mh-meeting-info">
                <div className="mh-meeting-title">
                  {m.title}
                  <span className="mh-wireup-inline">setup pending</span>
                </div>
                <div className="mh-meeting-meta">
                  <span>{p.name}</span>
                  <span>•</span>
                  <span>{mhFormatDateTime(m.when)}</span>
                  <span>•</span>
                  <span>{m.durationMin} min</span>
                  {m.inviteeCount > 0 && <><span>•</span><span>{m.inviteeCount} invitees</span></>}
                </div>
                <div className="mh-meeting-url">
                  <I.Link size={11}/>
                  <span className="mh-meeting-url-text">{m.joinUrl}</span>
                  <button className="mh-link-btn" onClick={()=>{ navigator.clipboard?.writeText(m.joinUrl); mhToast('ok','Meeting reference copied'); }}>Copy</button>
                </div>
              </div>
              <div className="mh-meeting-actions">
                <button className="mh-btn-ghost" title="Real join requires provider API wire-up" disabled>
                  <I.External size={11}/> Join <MhWireup what="Opening the real join URL requires a provider API call."/>
                </button>
                <button className="mh-btn-ghost" onClick={() => onCancel(m.id)}>
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Log panel ─────────────────────────────────────────────────
function MhLogPanel({ state, onClear }) {
  return (
    <div className="mh-log-wrap">
      <div className="mh-panel-header">
        <div>
          <h3>Activity log</h3>
          <p>Every action on this page. Persisted locally — not sent to a server.</p>
        </div>
        {state.log.length > 0 && <button className="mh-btn-ghost" onClick={onClear}>Clear</button>}
      </div>
      {state.log.length === 0 ? (
        <div className="mh-empty-panel">
          <I.FileLog size={22}/>
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="mh-log-list">
          {state.log.map(e => (
            <div key={e.id} className="mh-log-row">
              <div className="mh-log-time">{mhFormatTime(e.t)}</div>
              <div className={`mh-log-kind kind-${e.kind}`}>{e.kind.replace(/_/g, ' ')}</div>
              <div className="mh-log-detail">{e.detail}</div>
              {e.providerId && <div className="mh-log-provider">{e.providerId}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connect modal (honest) ────────────────────────────────────
function MhConnectModal({ provider, pstate, onClose, onConfirm }) {
  const isResume = pstate.state === MH_STATE.AUTH_REQUIRED;
  const isReauth = pstate.state === MH_STATE.CONNECTED || pstate.state === MH_STATE.CONNECTED_NEW || pstate.state === MH_STATE.TOKEN_EXPIRED;

  return (
    <div className="mh-modal-overlay" onClick={onClose}>
      <div className="mh-modal" onClick={e => e.stopPropagation()}>
        <div className="mh-modal-head" style={{'--mh-accent': provider.accent}}>
          <MhGlyph provider={provider} size={36}/>
          <div>
            <div className="mh-modal-title">
              {isReauth ? 'Re-authorize' : isResume ? 'Resume authorization' : 'Connect'} {provider.name}
            </div>
            <div className="mh-modal-sub">{provider.tagline}</div>
          </div>
          <button className="mh-icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="mh-modal-body">
          <div className="mh-honesty mh-honesty-inline">
            <I.Info size={13}/>
            <span>
              OAuth authorization requires a server-side redirect endpoint. This Mission Control
              cannot complete the flow on its own — an admin must register the redirect URI below
              in the {provider.name} developer console.
            </span>
          </div>

          <div className="mh-field">
            <label>Redirect URI</label>
            <div className="mh-code-row">
              <code>{provider.redirectUri}</code>
              <button className="mh-link-btn" onClick={()=>{ navigator.clipboard?.writeText(provider.redirectUri); mhToast('ok','Copied'); }}>Copy</button>
            </div>
          </div>

          <div className="mh-field">
            <label>Required scopes</label>
            <div className="mh-scope-list">
              {provider.scopes.map(s => <code key={s} className="mh-scope">{s}</code>)}
            </div>
          </div>

          <div className="mh-field">
            <label>Capabilities granted</label>
            <div className="mh-caps">
              {provider.capabilities.map(c => <span key={c} className="mh-cap">{c}</span>)}
            </div>
          </div>

          <a href={provider.docs} target="_blank" rel="noopener" className="mh-doc-link">
            <I.External size={11}/> {provider.name} developer docs
          </a>
        </div>
        <div className="mh-modal-foot">
          <button className="mh-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="mh-btn-primary" onClick={onConfirm}>
            <I.Key size={12}/>
            {isReauth ? 'Mark for re-authorization' : 'Mark as awaiting OAuth'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Details modal (shows state, OAuth info, any errors) ───────
function MhDetailsModal({ provider, pstate, onClose }) {
  const meta = mhStatusMeta(pstate.state);
  const StatusIcon = I[meta.icon] || I.Info;
  return (
    <div className="mh-modal-overlay" onClick={onClose}>
      <div className="mh-modal" onClick={e => e.stopPropagation()}>
        <div className="mh-modal-head" style={{'--mh-accent': provider.accent}}>
          <MhGlyph provider={provider} size={36}/>
          <div>
            <div className="mh-modal-title">{provider.name}</div>
            <div className="mh-modal-sub">{provider.tagline}</div>
          </div>
          <button className="mh-icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="mh-modal-body">
          <div className={`mh-status-row mh-status-${meta.color}`} style={{marginBottom: 12}}>
            <StatusIcon size={13}/>
            <span className="mh-status-label">{meta.label}</span>
          </div>
          <div className="mh-status-detail" style={{marginBottom: 18}}>{meta.detail}</div>

          <div className="mh-field">
            <label>Redirect URI</label>
            <div className="mh-code-row">
              <code>{provider.redirectUri}</code>
              <button className="mh-link-btn" onClick={()=>{ navigator.clipboard?.writeText(provider.redirectUri); mhToast('ok','Copied'); }}>Copy</button>
            </div>
          </div>

          <div className="mh-field">
            <label>OAuth scopes requested</label>
            <div className="mh-scope-list">
              {provider.scopes.map(s => <code key={s} className="mh-scope">{s}</code>)}
            </div>
          </div>

          <div className="mh-field">
            <label>Capabilities</label>
            <div className="mh-caps">
              {provider.capabilities.map(c => <span key={c} className="mh-cap">{c}</span>)}
            </div>
          </div>

          {pstate.assignedAgents && pstate.assignedAgents.length > 0 && (
            <div className="mh-field">
              <label>Assigned agents</label>
              <div className="mh-agent-stack">
                {pstate.assignedAgents.map(aid => {
                  const ag = (window.AGENTS||[]).find(a=>a.id===aid);
                  if (!ag) return null;
                  return <span key={aid} className="mh-agent-chip-lg">{ag.name}</span>;
                })}
              </div>
            </div>
          )}

          <a href={provider.docs} target="_blank" rel="noopener" className="mh-doc-link">
            <I.External size={11}/> Developer documentation
          </a>
        </div>
        <div className="mh-modal-foot">
          <button className="mh-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Disconnect modal ──────────────────────────────────────────
function MhDisconnectModal({ provider, onClose, onConfirm }) {
  return (
    <div className="mh-modal-overlay" onClick={onClose}>
      <div className="mh-modal mh-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="mh-modal-head">
          <div style={{width:36,height:36,borderRadius:9, background:'rgba(239,68,68,0.14)', display:'flex',alignItems:'center',justifyContent:'center',color:'#f87171'}}>
            <I.Alert size={18}/>
          </div>
          <div>
            <div className="mh-modal-title">Disconnect {provider.name}?</div>
            <div className="mh-modal-sub">App-side credentials will be cleared immediately.</div>
          </div>
          <button className="mh-icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="mh-modal-body">
          <div className="mh-honesty mh-honesty-inline">
            <I.Info size={13}/>
            <span>
              This revokes app-side access. To fully remove the app from {provider.name}, an admin
              must also uninstall it from the provider's app console.
            </span>
          </div>
        </div>
        <div className="mh-modal-foot">
          <button className="mh-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="mh-btn-danger" onClick={onConfirm}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create meeting modal ──────────────────────────────────────
function MhCreateMeetingModal({ providers, onClose, onCreate }) {
  const [title, setTitle]             = React.useState('');
  const [providerId, setProviderId]   = React.useState(providers[0]?.id || '');
  const [when, setWhen]               = React.useState(() => {
    const d = new Date(Date.now() + 30*60*1000);
    d.setSeconds(0,0);
    // ISO without timezone offset for input[type=datetime-local]
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [duration, setDuration]       = React.useState(30);
  const [invitees, setInvitees]       = React.useState('');
  const [recording, setRecording]     = React.useState(false);
  const [autoTranscribe, setAutoTranscribe] = React.useState(true);

  const canSubmit = title.trim() && providerId && when;
  const inviteeList = invitees.split(/[\s,;]+/).filter(Boolean);

  const submit = () => {
    if (!canSubmit) return;
    const p = providers.find(x=>x.id===providerId);
    const id = 'mtg_' + Math.random().toString(36).slice(2, 10);
    const joinUrl = `meeting://${p.id}/${id}`;
    onCreate({
      id,
      title: title.trim(),
      providerId,
      when: new Date(when).toISOString(),
      durationMin: parseInt(duration, 10) || 30,
      inviteeCount: inviteeList.length,
      invitees: inviteeList,
      recording,
      autoTranscribe,
      joinUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="mh-modal-overlay" onClick={onClose}>
      <div className="mh-modal mh-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="mh-modal-head">
          <div style={{width:36,height:36,borderRadius:9, background:'rgba(107,179,255,0.12)', display:'flex',alignItems:'center',justifyContent:'center',color:'#6bb3ff'}}>
            <I.Plus size={18}/>
          </div>
          <div>
            <div className="mh-modal-title">Create meeting</div>
            <div className="mh-modal-sub">Draft a meeting on any connected provider</div>
          </div>
          <button className="mh-icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="mh-modal-body">
          <div className="mh-honesty mh-honesty-inline">
            <I.Info size={13}/>
            <span>
              This creates a local draft with a setup-pending meeting reference. The real provider API call
              (<span className="mh-ik">POST /meetings</span>) requires server-side credentials — label flagged <MhWireup/>.
            </span>
          </div>

          <div className="mh-field">
            <label>Title</label>
            <input
              className="mh-input"
              placeholder="e.g. Weekly ops sync"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mh-grid-2">
            <div className="mh-field">
              <label>Provider</label>
              <div className="mh-provider-picker">
                {providers.map(p => (
                  <button
                    key={p.id}
                    className={`mh-provider-opt ${providerId===p.id?'active':''}`}
                    onClick={()=>setProviderId(p.id)}
                    style={{'--mh-accent': p.accent}}>
                    <MhGlyph provider={p} size={22}/>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mh-field">
              <label>Duration</label>
              <div className="mh-duration-row">
                {[15, 30, 45, 60, 90].map(d => (
                  <button
                    key={d}
                    className={`mh-chip ${duration===d?'active':''}`}
                    onClick={()=>setDuration(d)}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mh-field">
            <label>When</label>
            <input
              type="datetime-local"
              className="mh-input"
              value={when}
              onChange={e => setWhen(e.target.value)}
            />
          </div>

          <div className="mh-field">
            <label>Invitees (comma or newline separated)</label>
            <textarea
              className="mh-input mh-textarea"
              placeholder="alex@example.com, pat@example.com"
              value={invitees}
              onChange={e => setInvitees(e.target.value)}
              rows={2}
            />
            {inviteeList.length > 0 && (
              <div className="mh-invitee-count">{inviteeList.length} invitee{inviteeList.length===1?'':'s'}</div>
            )}
          </div>

          <div className="mh-field">
            <label>Options</label>
            <div className="mh-options">
              <label className="mh-option">
                <MhToggle on={recording} onToggle={setRecording}/>
                <span>Record meeting <MhWireup what="Provider must support recording + scope granted."/></span>
              </label>
              <label className="mh-option">
                <MhToggle on={autoTranscribe} onToggle={setAutoTranscribe}/>
                <span>Auto-transcribe</span>
              </label>
            </div>
          </div>
        </div>
        <div className="mh-modal-foot">
          <button className="mh-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="mh-btn-primary" disabled={!canSubmit} onClick={submit}>
            <I.Plus size={12}/> Create draft
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small toggle used throughout ──────────────────────────────
function MhToggle({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`mh-toggle ${on ? 'on' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={() => !disabled && onToggle && onToggle(!on)}
      disabled={disabled}
      aria-pressed={on}
    >
      <span className="mh-toggle-dot"/>
    </button>
  );
}

// ─── Time helpers ──────────────────────────────────────────────
function mhRelativeTime(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h ago`;
    return `${Math.floor(diff/86_400_000)}d ago`;
  } catch(e) { return ''; }
}
function mhFormatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch(e) { return iso; }
}
function mhFormatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch(e) { return iso; }
}

Object.assign(window, {
  MeetingsHubPage,
  MH_STATE,
  MH_PROVIDER_CATALOG,
});
