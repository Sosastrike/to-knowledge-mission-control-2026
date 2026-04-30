// ============================================================
// Backend Readiness Map
//
// For every localStorage-backed setting and action in the admin area,
// this file records:
//   · localStorage key (current prototype storage)
//   · data description
//   · future DB table / collection name
//   · required REST endpoints
//   · minimum permission level
//   · action sensitivity (safe | sensitive | destructive)
//   · readiness status — one of:
//       local_only           — lives in localStorage with no API layer
//       backend_scaffolded   — API client method exists + schema defined,
//                              but the adapter is still local
//       connected            — wired to a live backend endpoint
//       needs_vault          — requires an encrypted secret store
//       needs_audit          — requires an append-only audit stream
//       destructive          — needs extra confirm + audit + reauth
//
// This is the single source of truth for the "amber backend-required"
// labels scattered through the UI. The <BackendRequired> chip looks
// up its copy here by id so copy stays consistent.
// ============================================================

const STATUS_META = {
  local_only:         { color: '#ff8088', label: 'Local only' },
  backend_scaffolded: { color: '#6bb3ff', label: 'Backend scaffolded' },
  connected:          { color: '#6bffb3', label: 'Connected' },
  needs_vault:        { color: '#ffb060', label: 'Needs vault' },
  needs_audit:        { color: '#d5a3ff', label: 'Needs audit stream' },
  destructive:        { color: '#ff8088', label: 'Destructive' },
};

const BACKEND_READINESS = [
  // ── Identity & Access ────────────────────────────────────
  {
    id: 'users.invite',
    area: 'Users & Roles',
    label: 'Invite user by email',
    lsKey: 'tkmc.admin.users',
    stores: 'Local user list with role, 2FA, active flag, invited date.',
    table: 'workspace_users',
    endpoints: ['POST /api/users/invite', 'POST /api/mail/send (SMTP)'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Creates a pending user row and dispatches an invite email through the SMTP profile marked for transactional mail.',
  },
  {
    id: 'users.remove',
    area: 'Users & Roles',
    label: 'Remove user',
    lsKey: 'tkmc.admin.users',
    stores: 'Soft-delete flag on user row (active=false).',
    table: 'workspace_users',
    endpoints: ['DELETE /api/users/:id', 'POST /api/audit (who/what/when)'],
    permission: 'owner',
    sensitivity: 'destructive',
    status: 'destructive',
    note: 'Tony and Agent 0 are structurally protected and cannot be removed.',
  },
  {
    id: 'users.role',
    area: 'Users & Roles',
    label: 'Change user role',
    lsKey: 'tkmc.admin.users',
    stores: 'role field on user row.',
    table: 'workspace_users · workspace_role_assignments',
    endpoints: ['PATCH /api/users/:id { role }'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Cannot promote to Owner or demote the Owner from the UI.',
  },
  {
    id: 'users.2fa',
    area: 'Users & Roles',
    label: 'Force 2FA for user',
    lsKey: 'tkmc.admin.users',
    stores: 'twoFA field (off | on | enforced | service).',
    table: 'workspace_users · user_security',
    endpoints: ['PATCH /api/users/:id/security { twoFA }'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
  },
  {
    id: 'security.policy',
    area: 'Security',
    label: 'Workspace security policy',
    lsKey: 'tkmc.admin.security_policy',
    stores: '2FA enforcement, session lifetime, SSO provider, IP allowlist, reauth cadence.',
    table: 'workspace_security_policy',
    endpoints: ['GET /api/security/policy', 'PUT /api/security/policy'],
    permission: 'owner',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Reauth cadence is capped server-side at 72h (3 days). UI cannot choose a longer value.',
  },
  {
    id: 'security.sso',
    area: 'Security',
    label: 'SSO provider connection',
    lsKey: 'tkmc.admin.security_policy (nested sso)',
    stores: 'Provider id + configured/pending flag.',
    table: 'workspace_sso_connections',
    endpoints: ['POST /api/sso/connect', 'POST /api/sso/callback', 'GET /api/sso/status'],
    permission: 'owner',
    sensitivity: 'sensitive',
    status: 'local_only',
    note: 'Requires OAuth callback URL registered with identity provider (Microsoft Entra or Google Workspace).',
  },
  {
    id: 'security.ip',
    area: 'Security',
    label: 'IP allowlist',
    lsKey: 'tkmc.admin.security_policy (nested ipAllowlist)',
    stores: 'CIDR list applied to admin sign-in.',
    table: 'workspace_ip_allowlist',
    endpoints: ['GET /api/security/ip', 'POST /api/security/ip', 'DELETE /api/security/ip/:cidr'],
    permission: 'owner',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
  },
  {
    id: 'security.tokens',
    area: 'Security',
    label: 'API tokens',
    lsKey: 'tkmc.admin.api_tokens',
    stores: 'Token name, scopes, last-used, expires.',
    table: 'workspace_api_tokens',
    endpoints: ['GET /api/tokens', 'POST /api/tokens', 'DELETE /api/tokens/:id'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'Raw token only shown once at creation; stored as a hash server-side.',
  },
  {
    id: 'security.sessions',
    area: 'Security',
    label: 'Revoke active sessions',
    lsKey: '—',
    stores: 'Session rows live only server-side; UI shows from /sessions endpoint.',
    table: 'auth_sessions',
    endpoints: ['GET /api/sessions', 'DELETE /api/sessions/:id', 'POST /api/sessions/revoke_all'],
    permission: 'admin',
    sensitivity: 'destructive',
    status: 'destructive',
  },
  {
    id: 'security.audit',
    area: 'Security',
    label: 'Audit log export',
    lsKey: 'window.AUDIT (in-memory)',
    stores: 'Auth / settings / role change events.',
    table: 'audit_events',
    endpoints: ['GET /api/audit?since=&type=', 'POST /api/audit/export'],
    permission: 'admin',
    sensitivity: 'safe',
    status: 'needs_audit',
    note: 'Local export downloads the in-memory demo log. Production should stream to SIEM.',
  },

  // ── Models ──────────────────────────────────────────────
  {
    id: 'models.routing',
    area: 'Models',
    label: 'Per-agent model routing',
    lsKey: 'agent_model_routing (adapter table)',
    stores: 'Primary, fallback, embedding model ids per agent class.',
    table: 'agent_model_routing',
    endpoints: ['GET /api/models/routing', 'PUT /api/models/routing'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Routing reads/writes go through api.models.setRouting; guarded by models.routing role permission; audited.',
  },
  {
    id: 'models.keys',
    area: 'Models',
    label: 'Provider API keys',
    lsKey: 'provider_models.key_ref (opaque handle)',
    stores: 'Only a vault reference (key_ref) + wired bool. Raw keys never hit localStorage.',
    table: 'provider_credentials (vault)',
    endpoints: ['POST /api/providers/:id/key', 'DELETE /api/providers/:id/key', 'GET /api/providers/status'],
    permission: 'owner',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'Keys must be encrypted at rest (KMS) and only decrypted in the gateway process.',
  },
  {
    id: 'models.priority',
    area: 'Models',
    label: 'Cost / speed / quality priority',
    lsKey: 'agent_model_routing.priority',
    stores: 'Enum per-agent: cost | speed | quality. Used by the router to break ties.',
    table: 'agent_model_routing',
    endpoints: ['PUT /api/models/routing'],
    permission: 'admin',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },

  // ── Integrations ─────────────────────────────────────────
  {
    id: 'integrations.credential',
    area: 'Integrations',
    label: 'Save integration credentials',
    lsKey: 'workspace_integrations.credential_ref',
    stores: 'Opaque vault handle + credential_status enum + assigned agent + last-sync.',
    table: 'workspace_integrations · integration_credentials (vault)',
    endpoints: [
      'POST /api/integrations/:id/connect',
      'DELETE /api/integrations/:id',
      'GET /api/integrations/:id/health',
      'POST /api/integrations/:id/test',
    ],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'OAuth integrations redirect to provider; API-key integrations (FireCrawl, OpenRouter) read from vault.',
  },
  {
    id: 'integrations.assign',
    area: 'Integrations',
    label: 'Assign integration to agent',
    lsKey: 'workspace_integrations.assigned_agent',
    stores: 'assigned_agent id on integration row.',
    table: 'workspace_integrations',
    endpoints: ['PATCH /api/integrations/:id { assignedAgent }'],
    permission: 'admin',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'integrations.test',
    area: 'Integrations',
    label: 'Test connection',
    lsKey: '—',
    stores: 'Adapter-side endpoint honestly throws BACKEND_REQUIRED until wired.',
    table: 'workspace_integrations',
    endpoints: ['POST /api/integrations/:id/test'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },

  // ── Agent Management ─────────────────────────────────────
  {
    id: 'agents.restart',
    area: 'Agent Management',
    label: 'Restart agent process',
    lsKey: '—',
    stores: 'Restart dispatches a job; status is read back from the agent supervisor.',
    table: 'agent_supervisor_jobs',
    endpoints: ['POST /api/agents/:id/restart'],
    permission: 'admin',
    sensitivity: 'destructive',
    status: 'destructive',
    note: 'Agent 0 is backend-controlled and cannot be restarted from the UI without the OPERATIONS scope.',
  },
  {
    id: 'agent_zero.request',
    area: 'Agent Management',
    label: 'Agent 0 requests (owner-only)',
    lsKey: '—',
    stores: 'Permission matrix enforces role=owner in ROLE_PERMISSIONS. UI in Brain Sync disables the action for non-owner personas.',
    table: 'agent_zero_requests',
    endpoints: ['POST /api/agent-zero/request', 'GET /api/agent-zero/scope', 'PUT /api/agent-zero/scope', 'GET /api/agent-zero/audit'],
    permission: 'owner',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'UI gate is live. Server endpoint is scaffolded in server-scaffold.md — must honor the same owner-only capability on every request.',
  },
  {
    id: 'agents.reconnect',
    area: 'Agent Management',
    label: 'Reconnect agent channels',
    lsKey: '—',
    stores: 'Adapter honestly throws BACKEND_REQUIRED; audit event recorded as pending.',
    table: 'agent_channel_bindings',
    endpoints: ['POST /api/agents/:id/reconnect'],
    permission: 'manager',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
  },
  {
    id: 'agents.logs',
    area: 'Agent Management',
    label: 'View agent logs',
    lsKey: '—',
    stores: 'Shadow stream from local adapter; real supervisor required for live lines.',
    table: 'agent_logs (time-series)',
    endpoints: ['GET /api/agents/:id/logs?since='],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },

  // ── Email & SMTP ─────────────────────────────────────────
  {
    id: 'email.profiles',
    area: 'Email & SMTP',
    label: 'SMTP profiles',
    lsKey: 'tkmc.bk.email_profiles',
    stores: 'SMTP host, port, auth mode, from-address, purpose tag. Raw passwords / API keys live in vault → credential_ref.',
    table: 'email_profiles',
    endpoints: ['GET /api/email/profiles', 'POST /api/email/profiles', 'PATCH /api/email/profiles/:id', 'DELETE /api/email/profiles/:id', 'POST /api/email/profiles/:id/keys', 'POST /api/email/profiles/:id/rotate'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
  },
  {
    id: 'email.addresses',
    area: 'Email & SMTP',
    label: 'Verified sender addresses',
    lsKey: 'tkmc.bk.email_addresses',
    stores: 'Outgoing from-addresses + DKIM/SPF refs. DNS probe not implemented.',
    table: 'email_addresses',
    endpoints: ['GET /api/email/addresses', 'POST /api/email/addresses', 'POST /api/email/addresses/:id/verify'],
    permission: 'admin',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'email.routing',
    area: 'Email & SMTP',
    label: 'Per-purpose email routing',
    lsKey: 'tkmc.bk.email_routing',
    stores: 'Which profile sends transactional, marketing, system, invitation mail.',
    table: 'email_routing',
    endpoints: ['GET /api/email/routing', 'PATCH /api/email/routing/:id'],
    permission: 'admin',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'email.test',
    area: 'Email & SMTP',
    label: 'Test email send',
    lsKey: null,
    stores: 'Simulated — no real SMTP round-trip until the mail service is live.',
    table: null,
    endpoints: ['POST /api/email/profiles/:id/test', 'POST /api/email/profiles/test-all'],
    permission: 'admin',
    sensitivity: 'destructive',
    status: 'needs_vault',
  },

  // ── Channels ─────────────────────────────────────────────
  {
    id: 'channels.read',
    area: 'Channels',
    label: 'Read channel list',
    lsKey: 'tkmc.bk.workspace_channels',
    stores: 'Per-channel routing, assigned agent, health, credential_ref, rate.',
    table: 'workspace_channels',
    endpoints: ['GET /api/channels'],
    permission: 'viewer',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'channels.toggle',
    area: 'Channels',
    label: 'Enable / disable channel',
    lsKey: 'tkmc.bk.workspace_channels',
    stores: 'enabled flag on channel row.',
    table: 'workspace_channels',
    endpoints: ['PATCH /api/channels/:id { enabled }'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Invariant: enabled=true rejected if credential_status=missing.',
  },
  {
    id: 'channels.assign',
    area: 'Channels',
    label: 'Assign agent to channel',
    lsKey: 'tkmc.bk.workspace_channels',
    stores: 'assigned_agent id on channel row.',
    table: 'workspace_channels',
    endpoints: ['PATCH /api/channels/:id { assignedAgent }'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'channels.credentials',
    area: 'Channels',
    label: 'Save / rotate channel credentials',
    lsKey: 'tkmc.bk.workspace_channels (ref only)',
    stores: 'Opaque credential_ref handle only. Raw bot tokens / API keys live in vault.',
    table: 'workspace_channels · channel_credentials (vault)',
    endpoints: [
      'POST /api/channels/:id/credentials',
      'POST /api/channels/:id/credentials/rotate',
      'DELETE /api/channels/:id/credentials',
    ],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'UI surfaces BACKEND_REQUIRED and fires audit `channel.credentials.save.pending` until vault is wired.',
  },
  {
    id: 'channels.test',
    area: 'Channels',
    label: 'Test channel connection',
    lsKey: '—',
    stores: 'Adapter honestly returns BACKEND_REQUIRED until provider adapters exist.',
    table: null,
    endpoints: ['POST /api/channels/:id/test'],
    permission: 'viewer',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },

  // ── Skills ───────────────────────────────────────────────
  {
    id: 'skills.read',
    area: 'Skills',
    label: 'List skills',
    lsKey: 'tkmc.bk.workspace_skills',
    stores: 'Skill name, version, deps, usage counter, status.',
    table: 'workspace_skills',
    endpoints: ['GET /api/skills'],
    permission: 'viewer',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'skills.status',
    area: 'Skills',
    label: 'Change skill status (valid / review / retired)',
    lsKey: 'tkmc.bk.workspace_skills',
    stores: 'status field on skill row.',
    table: 'workspace_skills',
    endpoints: ['PATCH /api/skills/:id { status }'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Retire → owner-only. Retired skills cannot be invoked but remain visible for audit.',
  },
  {
    id: 'skills.register',
    area: 'Skills',
    label: 'Register new skill',
    lsKey: '—',
    stores: 'Skill package is uploaded to the skill host, not the admin UI.',
    table: 'workspace_skills',
    endpoints: ['POST /api/skills (multipart — skill host)'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'local_only',
    note: 'UI intentionally throws BACKEND_REQUIRED. Registration belongs to the skill-host deploy pipeline.',
  },

  // ── Alerts ───────────────────────────────────────────────
  {
    id: 'alerts.read',
    area: 'Alerts',
    label: 'Read alert stream',
    lsKey: 'tkmc.bk.workspace_alerts',
    stores: 'Append-only alert rows with level, message, area, source, ack/resolve timestamps.',
    table: 'workspace_alerts',
    endpoints: ['GET /api/alerts?state=open|ack|resolved'],
    permission: 'viewer',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
    note: 'Alerts are emitted by the gateway / supervisor / policy engine — never written by the admin UI except in demo.',
  },
  {
    id: 'alerts.ack',
    area: 'Alerts',
    label: 'Acknowledge alert',
    lsKey: 'tkmc.bk.workspace_alerts',
    stores: 'ack_at + ack_by on alert row.',
    table: 'workspace_alerts',
    endpoints: ['POST /api/alerts/:id/ack'],
    permission: 'agent',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
  },
  {
    id: 'alerts.resolve',
    area: 'Alerts',
    label: 'Resolve alert',
    lsKey: 'tkmc.bk.workspace_alerts',
    stores: 'resolved_at + resolved_by. Alerts are never deleted.',
    table: 'workspace_alerts',
    endpoints: ['POST /api/alerts/:id/resolve'],
    permission: 'manager',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Invariant: delete is rejected — alerts are append-only.',
  },

  // ── Meetings & conferencing ──────────────────────────────
  {
    id: 'meetings.state',
    area: 'Meetings',
    label: 'Workspace meeting state',
    lsKey: 'tkmc.bk.workspace_meeting_state',
    stores: 'Per-provider state (zoom/teams/meet/webex), assigned agents, role permissions, drafts, local log.',
    table: 'workspace_meeting_state',
    endpoints: ['GET /api/meetings/state', 'PUT /api/meetings/state'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
    note: 'Single-row table per workspace. Fully routed through api.meetings.getState/saveState; adapter is still local until the HTTP endpoints are deployed.',
  },
  {
    id: 'meetings.connect',
    area: 'Meetings',
    label: 'Connect provider (OAuth)',
    lsKey: null,
    stores: 'Provider refresh token + granted scopes after OAuth dance completes.',
    table: 'workspace_meeting_providers · workspace_oauth_tokens',
    endpoints: ['POST /api/meetings/:provider/connect', 'GET /api/oauth/:provider/callback'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'UI fires audit `meeting.provider.connect.start` and transitions to AUTH_REQUIRED. Real callback must persist tokens in the vault and flip state to CONNECTED_NEW.',
  },
  {
    id: 'meetings.disconnect',
    area: 'Meetings',
    label: 'Disconnect provider',
    lsKey: null,
    stores: 'Clears app-side OAuth tokens and assigned-agent list for the provider.',
    table: 'workspace_meeting_providers',
    endpoints: ['POST /api/meetings/:provider/disconnect'],
    permission: 'admin',
    sensitivity: 'destructive',
    status: 'backend_scaffolded',
    note: 'Audit `meeting.provider.disconnect` (warn). Provider-side app uninstall still requires action in the provider console.',
  },
  {
    id: 'meetings.rotate',
    area: 'Meetings',
    label: 'Rotate provider credentials',
    lsKey: null,
    stores: 'New refresh token replaces the old one in the vault.',
    table: 'workspace_oauth_tokens',
    endpoints: ['POST /api/meetings/:provider/rotate'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'needs_vault',
    note: 'Audit `meeting.provider.keys.rotate`. Old token is revoked after the new one is validated.',
  },
  {
    id: 'meetings.test',
    area: 'Meetings',
    label: 'Test provider connection',
    lsKey: null,
    stores: 'Last test timestamp + result on the provider row.',
    table: 'workspace_meeting_providers',
    endpoints: ['POST /api/meetings/:provider/test'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
    note: 'Audit `meeting.provider.test`. Real call hits provider `/me` or `/ping` with the stored token.',
  },
  {
    id: 'meetings.assign',
    area: 'Meetings',
    label: 'Assign agent to provider',
    lsKey: 'tkmc.bk.workspace_meeting_state',
    stores: 'Which agents are allowed to auto-join meetings on each provider.',
    table: 'workspace_meeting_agent_assignments',
    endpoints: ['POST /api/meetings/:provider/agents', 'DELETE /api/meetings/:provider/agents/:agentId'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
    note: 'Audit `meeting.agent.assign` / `meeting.agent.unassign` on every toggle.',
  },
  {
    id: 'meetings.permissions',
    area: 'Meetings',
    label: 'Role permissions (create/join/assign/disconnect)',
    lsKey: 'tkmc.bk.workspace_meeting_state',
    stores: 'App-level permission grid per role × capability.',
    table: 'workspace_meeting_permissions',
    endpoints: ['PUT /api/meetings/permissions/:role'],
    permission: 'admin',
    sensitivity: 'sensitive',
    status: 'backend_scaffolded',
    note: 'Audit `meeting.permissions.update`. Owner row is locked.',
  },
  {
    id: 'meetings.draft',
    area: 'Meetings',
    label: 'Create / cancel meeting draft',
    lsKey: 'tkmc.bk.workspace_meeting_state',
    stores: 'Local drafts with setup-pending meeting references until a real provider call materializes them.',
    table: 'workspace_meeting_drafts',
    endpoints: ['POST /api/meetings/drafts', 'DELETE /api/meetings/drafts/:id', 'POST /api/meetings/:provider/create (real)'],
    permission: 'manager',
    sensitivity: 'safe',
    status: 'backend_scaffolded',
    note: 'Audit `meeting.draft.create` / `meeting.draft.cancel`. Real meeting creation requires provider API call (`POST /meetings`).',
  },
];

// Indexed by id for the BackendRequired chip
const BACKEND_READINESS_BY_ID = Object.fromEntries(
  BACKEND_READINESS.map(e => [e.id, e])
);

// ─── <BackendRequired> chip ───────────────────────────────────
// Amber pill with a native-title tooltip describing the exact endpoint
// or table the action needs. Pass either:
//   · id:     look up canonical copy from BACKEND_READINESS_BY_ID
//   · label:  free-form override shown in the chip
//   · tip:    free-form override shown in the tooltip
function BackendRequired({ id, label, tip, compact }) {
  const entry = id ? BACKEND_READINESS_BY_ID[id] : null;
  const displayLabel = label || (entry ? 'Backend required' : 'Backend required');
  const tooltip = tip || (entry
    ? `${entry.label}\n\nEndpoints: ${entry.endpoints.join(', ')}\nTable: ${entry.table}\nRole: ${entry.permission.toUpperCase()}${entry.note ? '\n\n' + entry.note : ''}`
    : 'This action requires a backend endpoint.'
  );
  return (
    <span className={`backend-chip ${compact ? 'compact' : ''}`} title={tooltip}>
      <span className="amber-dot"/>
      <span>{displayLabel}</span>
    </span>
  );
}

// ─── Small sensitivity badge ─────────────────────────────────
function SensitivityBadge({ level }) {
  const map = {
    safe:        { color:'#6bffb3', label:'SAFE' },
    sensitive:   { color:'#ffb060', label:'SENSITIVE' },
    destructive: { color:'#ff8088', label:'DESTRUCTIVE' },
  };
  const m = map[level] || map.safe;
  return (
    <span className="sensitivity-pill" style={{
      color: m.color,
      borderColor: m.color + '55',
      background: m.color + '12',
    }}>{m.label}</span>
  );
}

// ─── Readiness status pill ───────────────────────────────────
function ReadinessStatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.local_only;
  return (
    <span className="sensitivity-pill" style={{
      color: m.color, borderColor: m.color + '55', background: m.color + '12',
    }}>{m.label.toUpperCase()}</span>
  );
}

// ─── Readiness map viewer (used by the "Backend readiness" tab) ───
function BackendReadinessPage() {
  const areas = [...new Set(BACKEND_READINESS.map(e => e.area))];
  const [filter, setFilter] = React.useState('all');
  const rows = filter === 'all'
    ? BACKEND_READINESS
    : BACKEND_READINESS.filter(e => e.area === filter);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.FileLog size={20} style={{color:'var(--accent)'}}/> Backend readiness map</h1>
          <div className="sub">
            Every localStorage-backed feature, mapped to the DB tables and endpoints
            it needs before production. This page is the contract between the interface
            and backend engineers.
          </div>
        </div>
        <div className="page-actions">
          <span className="tag">REFERENCE</span>
        </div>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Rows marked <b>destructive</b> need extra guards: confirm modal, audit log, and — for Owner-only actions —
          a re-auth challenge. Rows marked <b>sensitive</b> need audit logging at minimum.
        </span>
      </div>

      <div className="card" style={{marginBottom:12, padding:'10px 14px'}}>
        <div className="muted xsmall" style={{marginBottom:6, color:'var(--fg-1)', textTransform:'uppercase', letterSpacing:0.4}}>Status legend</div>
        <div className="hstack" style={{gap:10, flexWrap:'wrap'}}>
          {Object.entries(STATUS_META).map(([k, m]) => (
            <span key={k} className="hstack" style={{gap:6}}>
              <ReadinessStatusPill status={k}/>
              <span className="muted xsmall">{
                k==='local_only' ? 'localStorage only, no API layer' :
                k==='backend_scaffolded' ? 'API client + schema exist, adapter still local' :
                k==='connected' ? 'Wired to live backend endpoint' :
                k==='needs_vault' ? 'Requires encrypted secret store' :
                k==='needs_audit' ? 'Requires append-only audit stream' :
                'Needs confirm + audit + reauth'
              }</span>
            </span>
          ))}
        </div>
      </div>

      <div className="hstack" style={{gap:6, marginBottom:12, flexWrap:'wrap'}}>
        <button className={`btn sm ${filter==='all' ? 'primary' : ''}`} onClick={()=>setFilter('all')}>
          All · {BACKEND_READINESS.length}
        </button>
        {areas.map(a => (
          <button key={a} className={`btn sm ${filter===a ? 'primary' : ''}`} onClick={()=>setFilter(a)}>
            {a} · {BACKEND_READINESS.filter(e => e.area === a).length}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="tbl readiness-tbl">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Status</th>
              <th>Current storage</th>
              <th>Future table</th>
              <th>Endpoints</th>
              <th>Role</th>
              <th>Sensitivity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.id}>
                <td>
                  <div style={{color:'var(--fg-0)', fontSize:12.5, fontWeight:500}}>{e.label}</div>
                  <div className="muted xsmall">{e.area}</div>
                  {e.note && <div className="readiness-note">{e.note}</div>}
                </td>
                <td><ReadinessStatusPill status={e.status || 'local_only'}/></td>
                <td className="mono xsmall muted" style={{maxWidth:180}}>
                  <div>{e.lsKey}</div>
                  <div className="muted xsmall" style={{marginTop:2, fontFamily:'inherit', opacity:0.75}}>{e.stores}</div>
                </td>
                <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.table}</td>
                <td className="mono xsmall" style={{maxWidth:260}}>
                  {e.endpoints.map((ep, i) => (
                    <div key={i} style={{color: ep.startsWith('POST') ? '#ffb060' : ep.startsWith('DELETE') ? '#ff8088' : ep.startsWith('PUT') || ep.startsWith('PATCH') ? '#6bb3ff' : 'var(--fg-1)'}}>
                      {ep}
                    </div>
                  ))}
                </td>
                <td><span className="tag">{e.permission.toUpperCase()}</span></td>
                <td><SensitivityBadge level={e.sensitivity}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

Object.assign(window, {
  BACKEND_READINESS, BACKEND_READINESS_BY_ID, STATUS_META,
  BackendRequired, SensitivityBadge, ReadinessStatusPill, BackendReadinessPage,
});
