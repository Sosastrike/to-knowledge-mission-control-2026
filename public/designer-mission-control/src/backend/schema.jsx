// ============================================================
// Backend schema · table/collection definitions
//
// Single source of truth for what the real database looks like.
// Both adapters (local, future real backend) honor these shapes.
// Fields prefixed with `_` are adapter-internal (never returned
// by the API client).
// ============================================================

const SCHEMA = {
  // ── Core identity ────────────────────────────────────────
  workspace_users: {
    pk: 'id',
    fields: ['id','name','email','title','isTony','isAgent','active','invited','created_by'],
    indexes: ['email'],
    // Hard invariants enforced in the adapter:
    invariants: [
      'Exactly one protected commander row for Agent Zero; Tony Legacy remains archived only.',
      'Exactly one row with isAgent=true (Agent 0, system).',
      'Commander and archived legacy rows cannot be deleted from this UI.',
    ],
  },
  workspace_role_assignments: {
    pk: 'user_id',
    fields: ['user_id','role','assigned_by','assigned_at'],
    // role enum: owner | admin | manager | agent | viewer | system
    invariants: [
      'Exactly one active commander assignment, bound to Agent Zero.',
      'Exactly one role=system assignment, bound to the isAgent user.',
      'Only an owner can grant role=owner (never exposed in UI).',
    ],
  },
  user_security: {
    pk: 'user_id',
    fields: ['user_id','twoFA','twoFA_secret_ref','last_reauth_at','backup_codes_ref'],
    // twoFA enum: off | on | enforced | service
    // twoFA_secret_ref is an opaque handle into the vault — NEVER the secret itself.
  },
  workspace_security_policy: {
    pk: 'workspace_id',
    fields: [
      'workspace_id',
      'enforce2faAdmins',
      'enforce2faAll',
      'reauthHours',              // SERVER CAP: min(value, 72)
      'sessionLifetimeHours',
      'requireSsoForAdmins',
      'allowedTwoFAMethods',      // { totp, webauthn, sms, email }
      'updated_by','updated_at',
    ],
    invariants: [
      'reauthHours is clamped to [1, 72] server-side. UI cannot bypass.',
    ],
  },
  auth_sessions: {
    pk: 'id',
    fields: ['id','user_id','ip','user_agent','created_at','last_seen_at','reauth_at','revoked_at'],
    // Sessions are server-side only. No localStorage fallback — the local
    // adapter returns an empty list and surfaces a "backend required" hint.
  },
  audit_events: {
    pk: 'id',
    fields: ['id','ts','actor','action','target','meta','level','ip'],
    // Append-only. Never updated, never deleted by the API.
  },
  workspace_sso_connections: {
    pk: 'workspace_id',
    fields: ['workspace_id','provider','status','callback_url','metadata_ref','updated_by','updated_at'],
  },
  workspace_ip_allowlist: {
    pk: 'id',
    fields: ['id','cidr','created_by','created_at','note'],
  },
  workspace_api_tokens: {
    pk: 'id',
    fields: ['id','name','scope','hash_ref','masked','created_by','created_at','last_used_at','expires_at'],
    invariants: [
      'hash_ref points into the vault. Raw token is never stored — surfaced once at creation.',
      '`masked` is a display-only string (prefix…suffix).',
    ],
  },

  // ── Models · provider registry + per-agent routing ────────
  provider_models: {
    pk: 'id',
    fields: ['id','provider','family','ctx','cost','wired','key_ref','updated_by','updated_at'],
    // key_ref → vault handle. Raw provider API key NEVER stored here.
    invariants: [
      'Raw provider keys must live in the vault. key_ref is an opaque handle.',
      '`wired` reflects presence of a vault-backed key, not UI state.',
    ],
  },
  agent_model_routing: {
    pk: 'agent_key',
    fields: ['agent_key','primary','fallback','embedding','priority','updated_by','updated_at'],
    // priority enum: cost | speed | quality
  },

  // ── Integrations · credential refs only ───────────────────
  workspace_integrations: {
    pk: 'id',
    fields: [
      'id','name','category','enabled','credential_ref','credential_status',
      'health','last_sync','assigned_agent','error','updated_by','updated_at',
    ],
    // credential_status enum: ok | expiring | missing
    // health enum: ok | warn | fail | idle
    invariants: [
      'Raw OAuth tokens / SMTP passwords / API keys live in the vault.',
      'credential_ref is opaque. The UI sees only credential_status.',
    ],
  },

  // ── Agent supervisor · runtime state (read-through) ───────
  agent_runtime: {
    pk: 'agent_id',
    fields: ['agent_id','status','last_heartbeat_at','pid','restart_count','last_restart_at','last_restart_by'],
    // Destructive ops (restart/reconnect) go to supervisor, not this table.
    invariants: [
      'Agent runtime is sourced from the supervisor. Local adapter surfaces a shadow only.',
      'restart / reconnect actions require a live supervisor endpoint.',
    ],
  },

  // ── Email / SMTP ─────────────────────────────────────────
  email_profiles: {
    pk: 'id',
    fields: [
      'id','profile_name','provider_type','from_address','purpose',
      'status','credential_ref','last_test_at','is_default','updated_by','updated_at',
    ],
    // status enum: active | needs_credentials | api_not_wired | disabled
    // credential_ref is a vault handle — never the raw SMTP password or API key.
    invariants: [
      'credential_ref is opaque. Raw SMTP passwords / API keys live in the vault.',
      'Exactly one row has is_default=true (or zero when no profiles exist).',
    ],
  },
  email_addresses: {
    pk: 'id',
    fields: ['id','email','verified','used_by','status','dkim_ref','spf_ref','updated_at'],
    // status enum: verified | needs_verification | api_not_wired
    // dkim_ref / spf_ref are vault handles for signing material.
  },
  email_routing: {
    pk: 'id',
    fields: ['id','email_type','assigned_profile_id','from_address','status','updated_by','updated_at'],
    // status enum: active | unassigned
    invariants: [
      'When assigned_profile_id is null, status must be "unassigned".',
      'from_address denormalizes from the assigned profile for display.',
    ],
  },

  // ── Channels · per-channel routing + credential refs ──────
  workspace_channels: {
    pk: 'id',
    fields: [
      'id','key','name','enabled','health','assigned_agent','routing',
      'rate','credential_ref','credential_status','updated_by','updated_at',
    ],
    // key enum: TG | WA | SL | GM | DC | X
    // health enum: ok | warn | fail | muted
    // credential_status enum: ok | expiring | missing
    invariants: [
      'Raw channel API tokens / bot credentials live in the vault; credential_ref is an opaque handle.',
      'enabled=true requires credential_status != "missing".',
    ],
  },

  // ── Skills · versioned capabilities ───────────────────────
  workspace_skills: {
    pk: 'id',
    fields: ['id','name','version','deps','usage','status','updated','updated_by','updated_at'],
    // status enum: valid | review | retired
    // usage is a counter written by the gateway, not by the admin UI.
    invariants: [
      'usage is read-only from the admin UI; only the gateway may write it.',
      'retired skills cannot be invoked but remain visible for audit.',
    ],
  },

  // ── Alerts · append-only (triaged by operators) ───────────
  workspace_alerts: {
    pk: 'id',
    fields: ['id','level','msg','time','area','actionable','ack_at','ack_by','resolved_at','resolved_by','source'],
    // level enum: err | warn | info
    // Alerts are emitted by the gateway / supervisor; UI only ACKs or resolves them.
    invariants: [
      'Alerts are never deleted — only acknowledged or resolved.',
      'source identifies the emitter (agent | integration | policy | system).',
    ],
  },

  // ── Meetings (provider wire-up + permissions + drafts + log) ──
  workspace_meeting_state: {
    pk: 'workspace_id',
    fields: ['workspace_id','providers','permissions','drafts','log','updated_by','updated_at'],
    // `providers` is a map { zoom|teams|meet|webex: { state, assignedAgents[], lastAction } }.
    // `permissions` is a role→perm matrix.
    // `drafts` / `log` are append-only arrays (prototype-scoped).
    invariants: [
      'Connect / disconnect / rotate require admin+. The page-level UI is gated server-side.',
      'OAuth tokens never live here — provider state is "auth_required" until the OAuth backend stores the refresh token in the vault and flips it to "connected".',
    ],
  },
};

// Role → permission matrix used by the API client to guard requests.
const ROLE_PERMISSIONS = {
  owner: {
    'users.invite':     true,
    'users.update':     true,
    'users.delete':     true,
    'users.role.owner': true,   // only owner can create another owner (UI never exposes)
    'users.role':       true,
    'security.policy':  true,
    'security.sso':     true,
    'security.ip':      true,
    'security.tokens':  true,
    'security.sessions':true,
    'audit.read':       true,
    'audit.export':     true,
    'models.read':      true,
    'models.routing':   true,
    'models.keys':      true,
    'integrations.read':   true,
    'integrations.update': true,
    'integrations.keys':   true,
    'integrations.test':   true,
    'agents.read':      true,
    'agents.restart':   true,
    'agents.reconnect': true,
    'agents.logs':      true,
    'email.read':       true,
    'email.write':      true,
    'email.keys':       true,
    'email.test':       true,
    'meetings.read':    true,
    'meetings.write':   true,
    'meetings.connect': true,
    'meetings.rotate':  true,
    'channels.read':    true,
    'channels.write':   true,
    'channels.keys':    true,
    'channels.assign':  true,
    'skills.read':      true,
    'skills.write':     true,
    'skills.retire':    true,
    'alerts.read':      true,
    'alerts.ack':       true,
    'alerts.resolve':   true,
    // ── Agent 0 · creator/owner-only ───────────────────────
    // Agent 0 is the brain-management / knowledge-oversight specialist,
    // subordinate to Agent Zero. Every protected Agent Zero request MUST route through the
    // owner. No other role — not even admin — may invoke Agent 0 directly.
    // Enforced in api-client._requireRole and on the server's POST
    // /api/agent-zero/request handler (see server-scaffold.md).
    'agent_zero.request': true,
    'agent_zero.scope':   true,   // view/adjust brain-oversight scope
  },
  admin: {
    'users.invite':     true,
    'users.update':     true,
    'users.delete':     false,  // Owner-only (destructive)
    'users.role':       true,
    'security.policy':  true,
    'security.sso':     false,
    'security.ip':      false,
    'security.tokens':  true,
    'security.sessions':true,
    'audit.read':       true,
    'audit.export':     true,
    'models.read':      true,
    'models.routing':   true,
    'models.keys':      true,
    'integrations.read':   true,
    'integrations.update': true,
    'integrations.keys':   true,
    'integrations.test':   true,
    'agents.read':      true,
    'agents.restart':   true,
    'agents.reconnect': true,
    'agents.logs':      true,
    'email.read':       true,
    'email.write':      true,
    'email.keys':       true,
    'email.test':       true,
    'meetings.read':    true,
    'meetings.write':   true,
    'meetings.connect': true,
    'meetings.rotate':  true,
    'channels.read':    true,
    'channels.write':   true,
    'channels.keys':    true,
    'channels.assign':  true,
    'skills.read':      true,
    'skills.write':     true,
    'skills.retire':    false,   // owner-only (destructive)
    'alerts.read':      true,
    'alerts.ack':       true,
    'alerts.resolve':   true,
    // Admin explicitly DOES NOT get agent_zero.request — owner-only rule.
    'agent_zero.request': false,
    'agent_zero.scope':   false,
  },
  manager: {
    'users.update':     false,
    'audit.read':       true,
    'models.read':      true,
    'integrations.read':true,
    'agents.read':      true,
    'agents.reconnect': true,   // operator-level
    'agents.logs':      true,
    'email.read':       true,
    'email.test':       true,
    'meetings.read':    true,
    'meetings.write':   true,  // can assign agents, create drafts — not rotate/connect
    'channels.read':    true,
    'channels.assign':  true,    // can assign agents to channels
    'channels.write':   false,   // cannot toggle enabled / edit routing
    'skills.read':      true,
    'skills.write':     false,
    'alerts.read':      true,
    'alerts.ack':       true,
    'alerts.resolve':   true,
  },
  agent:  { 'audit.read': false, 'agents.read': true, 'agents.logs': true, 'email.read': true, 'meetings.read': true, 'channels.read': true, 'skills.read': true, 'alerts.read': true, 'alerts.ack': true },
  viewer: { 'audit.read': false, 'models.read': true, 'integrations.read': true, 'agents.read': true, 'email.read': true, 'meetings.read': true, 'channels.read': true, 'skills.read': true, 'alerts.read': true },
  system: {}, // Agent 0 never acts through the UI API.
};

function permitted(role, capability){
  return !!(ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role][capability]);
}

Object.assign(window, { SCHEMA, ROLE_PERMISSIONS, permitted });
