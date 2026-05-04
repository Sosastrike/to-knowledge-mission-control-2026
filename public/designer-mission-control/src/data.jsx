// Mock data for the prototype

const AGENTS = [
  { id: 'agent-zero', name: 'Agent Zero', role: 'Ecosystem commander',      status: 'live',    load: 62, handled: 1284, sla: 99.4, channels: ['TG','WA','SL'], model: 'sonnet-4.6', since: '84d' },
  { id: 'hermes',     name: 'Hermes',     role: 'Lieutenant / skill-workflow specialist', status: 'idle', load: 18, handled: 0, sla: 100, channels: ['MC'], model: 'openrouter', since: 'onboarding' },
  { id: 'research',   name: 'Research',   role: 'Deep research & synthesis',status: 'live',    load: 48, handled: 412,  sla: 99.1, channels: ['TG','SL'],      model: 'opus-4.6',   since: '42d' },
  { id: 'scheduler',  name: 'Scheduler',  role: 'Calendar & reminders',     status: 'live',    load: 28, handled: 806,  sla: 99.8, channels: ['TG','GM'],      model: 'haiku-4.5',  since: '61d' },
  { id: 'inbox',      name: 'Inbox',      role: 'Gmail triage & drafting',  status: 'live',    load: 54, handled: 533,  sla: 98.9, channels: ['GM'],           model: 'sonnet-4.6', since: '38d' },
  { id: 'direct',     name: 'Direct',     role: 'Meeting participant',      status: 'idle',    load: 14, handled: 46,   sla: 99.2, channels: ['TG'],           model: 'sonnet-4.6', since: '12d' },
  { id: 'handup',     name: 'Hand Up',    role: 'Live Q&A facilitator',     status: 'live',    load: 22, handled: 88,   sla: 99.0, channels: ['TG'],           model: 'sonnet-4.6', since: '18d' },
  { id: 'insight',    name: 'Insight',    role: 'Memory consolidator',      status: 'live',    load: 31, handled: 202,  sla: 99.6, channels: [],               model: 'haiku-4.5',  since: '52d' },
  { id: 'sentinel',   name: 'Sentinel',   role: 'Night shift / alerts',     status: 'offline', load: 0,  handled: 0,    sla: 0,    channels: ['TG','SL'],      model: 'haiku-4.5',  since: '—'   },
];

const CHANNEL_META = {
  TG: { name: 'Telegram',  color: '#2AABEE', glyph: 'TG' },
  WA: { name: 'WhatsApp',  color: '#25D366', glyph: 'WA' },
  SL: { name: 'Slack',     color: '#E01E5A', glyph: 'SL' },
  DC: { name: 'Discord',   color: '#5865F2', glyph: 'DC' },
  GM: { name: 'Gmail',     color: '#EA4335', glyph: 'GM' },
  X:  { name: 'X',         color: '#ffffff', glyph: 'X'  },
};

const TICKETS = [
  { id: 'TSK-4812', title: 'Prep weekly ops brief from last 7d memories', agent: 'research',  progress: 62, priority: 'high', deadline: '14:30', status: 'wip',      lane: 'Research',  start: 0.10, end: 0.40, customer: 'Amelia K.' },
  { id: 'TSK-4808', title: 'Draft replies to 12 priority emails',         agent: 'inbox',     progress: 35, priority: 'high', deadline: '13:00', status: 'wip',      lane: 'Inbox',     start: 0.02, end: 0.26, customer: 'Amelia K.' },
  { id: 'TSK-4821', title: 'Schedule 1:1 with Rafael · next Tue AM',       agent: 'scheduler', progress: 78, priority: 'med',  deadline: '16:45', status: 'wip',      lane: 'Scheduler', start: 0.22, end: 0.58, customer: 'Amelia K.' },
  { id: 'TSK-4819', title: 'Compile: all memories tagged "pricing"',       agent: 'research',  progress: 100,priority: 'low',  deadline: '11:15', status: 'complete', lane: 'Research',  start: 0.06, end: 0.18, customer: 'Amelia K.' },
  { id: 'TSK-4825', title: 'Daily standup summary post in #team',          agent: 'agent-zero',progress: 18, priority: 'med',  deadline: '18:00', status: 'assigned', lane: 'Main',      start: 0.64, end: 0.92, customer: 'Team' },
  { id: 'TSK-4827', title: 'Auto-brief participants for Nest meeting',      agent: 'direct',    progress: 40, priority: 'med',  deadline: '15:30', status: 'wip',      lane: 'Meetings',  start: 0.32, end: 0.60, customer: 'Nest call' },
  { id: 'TSK-4830', title: 'Fade low-salience memories < 0.3',              agent: 'insight',   progress: 85, priority: 'high', deadline: '12:20', status: 'wip',      lane: 'Memory',    start: 0.00, end: 0.20, customer: 'System' },
  { id: 'TSK-4832', title: 'Generate Q3 research briefing',                 agent: 'research',  progress: 0,  priority: 'low',  deadline: '19:00', status: 'pending',  lane: 'Research',  start: 0.74, end: 0.98, customer: 'Amelia K.' },
  { id: 'TSK-4834', title: 'Follow up: BluePeak intro (Slack)',             agent: null,        progress: 0,  priority: 'low',  deadline: '—',     status: 'pending',  lane: 'Main',      start: 0.46, end: 0.64, customer: '—' },
  { id: 'TSK-4836', title: 'Knowledge base: refund windows article',        agent: 'research',  progress: 50, priority: 'med',  deadline: '17:00', status: 'wip',      lane: 'Research',  start: 0.66, end: 0.94, customer: 'Internal' },
  { id: 'TSK-4839', title: 'Rotate WhatsApp Business token',                agent: 'agent-zero',progress: 10, priority: 'high', deadline: '20:00', status: 'assigned', lane: 'Main',      start: 0.78, end: 0.98, customer: 'DevOps' },
  { id: 'TSK-4841', title: 'Tag onboarding-related memories',                agent: 'insight',   progress: 0,  priority: 'low',  deadline: '—',     status: 'pending',  lane: 'Memory',    start: 0.30, end: 0.54, customer: 'Internal' },
  { id: 'TSK-4843', title: 'Check Gmail labels — archive old newsletters',  agent: 'inbox',     progress: 20, priority: 'high', deadline: '16:00', status: 'wip',      lane: 'Inbox',     start: 0.52, end: 0.82, customer: 'Amelia K.' },
  { id: 'TSK-4802', title: 'Archived: Q1 migration checklist',              agent: 'agent-zero',progress: 100,priority: 'low',  deadline: 'done',  status: 'archived', lane: 'Main',      start: 0.00, end: 0.10, customer: 'Internal' },
];

const LANES = ['Main', 'Research', 'Inbox', 'Scheduler', 'Memory', 'Meetings'];

const MEETINGS = [
  { id: 'M-021', title: 'Weekly ops sync',           host: 'Amelia K.', participants: 6, status: 'live',      duration: '14:32', started: 'now',  mode: 'avatar', modeLabel: 'Pika avatar · $0.28/min', agent: 'agent-zero' },
  { id: 'M-022', title: 'Customer discovery · Nest', host: 'Orion',     participants: 3, status: 'scheduled', duration: '—',     started: '15:00', mode: 'voice',  modeLabel: 'Recall.ai voice · $0.01/min', agent: 'research' },
];

const MEETING_MODES = [
  { id: 'avatar', name: 'Avatar mode', vendor: 'Pika',              cost: '$0.28/min', desc: 'Real-time AI avatar · Pika-rendered face & voice',  icon: 'Cam'   },
  { id: 'voice',  name: 'Voice-only',  vendor: 'Recall.ai',         cost: '$0.01/min', desc: 'Joins an existing Google Meet URL · audio only',    icon: 'Mic'   },
  { id: 'daily',  name: 'Daily.co',    vendor: 'Pipecat + Gemini',  cost: 'realtime',  desc: 'Creates a Daily room · sub-second latency · tool calls', icon: 'Radio' },
];

const ALERTS = [
  { id: 'A1', level: 'err',  msg: 'Polaris offline for 8h — auto-retry failed',     time: '2m ago',  area: 'Agent',       actionable: true },
  { id: 'A2', level: 'warn', msg: 'Instagram token expires in 36h',                 time: '11m ago', area: 'Integration', actionable: true },
  { id: 'A3', level: 'warn', msg: 'Nova SLA dipped to 94.1% (threshold 95%)',       time: '23m ago', area: 'Agent',       actionable: true },
  { id: 'A4', level: 'info', msg: 'Model fallback triggered 4× in last hour',       time: '48m ago', area: 'Models',      actionable: false },
];

const USERS = [
  { id: 'u1', name: 'Amelia Karlsson',   email: 'amelia@tkmc.co',   role: 'owner',   status: 'active',   last: 'now',      twofa: 'auth' },
  { id: 'u2', name: 'Rafael Mendes',      email: 'rafa@tkmc.co',     role: 'admin',   status: 'active',   last: '2m',       twofa: 'auth' },
  { id: 'u3', name: 'Priya Shah',         email: 'priya@tkmc.co',    role: 'admin',   status: 'active',   last: '14m',      twofa: 'auth' },
  { id: 'u4', name: 'Yusuf Demir',        email: 'yusuf@tkmc.co',    role: 'manager', status: 'active',   last: '1h',       twofa: 'sms' },
  { id: 'u5', name: 'Olivia Brennan',     email: 'olivia@tkmc.co',   role: 'manager', status: 'active',   last: '3h',       twofa: 'auth' },
  { id: 'u6', name: 'Kenji Watanabe',     email: 'kenji@tkmc.co',    role: 'agent',   status: 'active',   last: '9m',       twofa: 'auth' },
  { id: 'u7', name: 'Imani Osei',         email: 'imani@tkmc.co',    role: 'agent',   status: 'active',   last: '22m',      twofa: 'sms' },
  { id: 'u8', name: 'Chloé Rousseau',     email: 'chloe@tkmc.co',    role: 'agent',   status: 'invited',  last: '—',        twofa: 'none' },
  { id: 'u9', name: 'Mateus Ribeiro',     email: 'mateus@tkmc.co',   role: 'viewer',  status: 'active',   last: '2d',       twofa: 'auth' },
];

const MODELS = [
  { id: 'sonnet-4.6', vendor: 'Anthropic', name: 'Claude Sonnet 4.6', tier: 'primary',  cost: '$3.00/1M', ctx: '200k', assigned: 4, fallback: 'haiku-4.5',  status: 'healthy' },
  { id: 'haiku-4.5',  vendor: 'Anthropic', name: 'Claude Haiku 4.5',  tier: 'fast',     cost: '$0.80/1M', ctx: '200k', assigned: 3, fallback: 'sonnet-4.6', status: 'healthy' },
  { id: 'opus-4.6',   vendor: 'Anthropic', name: 'Claude Opus 4.6',   tier: 'reserve',  cost: '$15.00/1M',ctx: '200k', assigned: 1, fallback: 'sonnet-4.6', status: 'healthy' },
  { id: 'gemini-live',vendor: 'Google',    name: 'Gemini Live',       tier: 'realtime', cost: 'var/min',  ctx: '—',    assigned: 1, fallback: '—',          status: 'healthy' },
];

const SKILLS = [
  { id: 'memory-consolidate', name: 'Memory consolidation',       version: '3.2.0', deps: ['Embeddings','KG'],       usage: 5612, status: 'valid',  updated: '6h'  },
  { id: 'gmail-draft',        name: 'Gmail triage & draft',       version: '2.4.1', deps: ['Gmail API'],             usage: 842,  status: 'valid',  updated: '2d'  },
  { id: 'meet-brief',         name: 'Auto-brief for meetings',    version: '1.8.0', deps: ['Calendar'],              usage: 318,  status: 'valid',  updated: '5d'  },
  { id: 'web-research',       name: 'Web research & synthesis',    version: '4.2.3', deps: ['Brave','Readability'],  usage: 2140, status: 'valid',  updated: '1h'  },
  { id: 'todo-capture',       name: 'Todo capture from chat',     version: '0.9.4', deps: [],                        usage: 221,  status: 'review', updated: '3d'  },
  { id: 'importance-score',   name: 'Memory importance scorer',   version: '1.2.0', deps: [],                        usage: 3001, status: 'valid',  updated: '12d' },
  { id: 'handoff-human',      name: 'Hand-off to human',          version: '2.1.0', deps: ['Slack'],                 usage: 77,   status: 'valid',  updated: '1d'  },
];

const INTEGRATIONS = [
  { id: 'telegram', name: 'Telegram',   glyph: 'T', category: 'Messaging', status: 'ok',   lastSync: 'live', tokenDays: 400 },
  { id: 'whatsapp', name: 'WhatsApp',   glyph: 'W', category: 'Messaging', status: 'warn', lastSync: '47m',  tokenDays: 14  },
  { id: 'slack',    name: 'Slack',      glyph: 'S', category: 'Messaging', status: 'ok',   lastSync: 'live', tokenDays: 180 },
  { id: 'gmail',    name: 'Gmail',      glyph: 'G', category: 'Email',     status: 'ok',   lastSync: '1m',   tokenDays: 340 },
  { id: 'gcal',     name: 'Google Cal', glyph: 'C', category: 'Calendar',  status: 'ok',   lastSync: '3m',   tokenDays: 340 },
  { id: 'pika',     name: 'Pika',       glyph: 'P', category: 'Avatar',    status: 'ok',   lastSync: '8m',   tokenDays: 90  },
  { id: 'recall',   name: 'Recall.ai',  glyph: 'R', category: 'Meet bot',  status: 'ok',   lastSync: '12m',  tokenDays: 120 },
  { id: 'daily',    name: 'Daily.co',   glyph: 'D', category: 'Video',     status: 'ok',   lastSync: '2m',   tokenDays: 160 },
  { id: 'twilio',   name: 'Twilio',     glyph: 'T', category: 'SMS',       status: 'warn', lastSync: '—',    tokenDays: 0   },
];

const CHANNELS = [
  { id: 'tg', key: 'TG', enabled: true,  health: 'ok',   assigned: 'agent-zero',routing: 'Agent Zero by default', rate: '120/min' },
  { id: 'wa', key: 'WA', enabled: true,  health: 'warn', assigned: 'agent-zero',routing: 'Agent Zero, Scheduler for time queries', rate: '40/min'  },
  { id: 'sl', key: 'SL', enabled: true,  health: 'ok',   assigned: 'agent-zero',routing: 'Agent Zero, Research for #research',   rate: '60/min'  },
  { id: 'gm', key: 'GM', enabled: true,  health: 'ok',   assigned: 'inbox',     routing: 'Inbox agent (triage & draft)',   rate: '—'       },
  { id: 'dc', key: 'DC', enabled: false, health: 'muted', assigned: null,        routing: 'Not configured',                 rate: '—'       },
  { id: 'x',  key: 'X',  enabled: false, health: 'muted', assigned: null,        routing: 'Not configured',                 rate: '—'       },
];

const ROLES = [
  { id: 'owner',   name: 'Owner',   count: 1, desc: 'Full access; billing, ownership transfer, irreversible actions.',  color: 'accent' },
  { id: 'admin',   name: 'Admin',   count: 2, desc: 'All admin tools; cannot transfer ownership or delete the workspace.',  color: 'accent' },
  { id: 'manager', name: 'Manager', count: 2, desc: 'Manage assigned teams, agents, and their channels. No API keys.',  color: 'muted' },
  { id: 'agent',   name: 'Agent',   count: 3, desc: 'Operator. Work tickets, attend meetings, cannot edit settings.', color: 'muted' },
  { id: 'viewer',  name: 'Viewer',  count: 1, desc: 'Read-only access to dashboards and logs. No actions.', color: 'muted' },
];

const PERMISSIONS = [
  { key: 'view_dashboard',     label: 'View dashboard',           owner: true,  admin: true,  manager: true,  agent: true,  viewer: true  },
  { key: 'manage_tasks',       label: 'Assign / edit tasks',      owner: true,  admin: true,  manager: true,  agent: false, viewer: false },
  { key: 'manage_agents',      label: 'Restart / reconnect agents', owner: true, admin: true, manager: true, agent: false, viewer: false },
  { key: 'manage_users',       label: 'Invite / remove users',    owner: true,  admin: true,  manager: false, agent: false, viewer: false },
  { key: 'edit_roles',         label: 'Edit roles & permissions', owner: true,  admin: true,  manager: false, agent: false, viewer: false },
  { key: 'manage_integrations',label: 'Manage integrations',      owner: true,  admin: true,  manager: false, agent: false, viewer: false },
  { key: 'manage_api_keys',    label: 'View / rotate API keys',   owner: true,  admin: true,  manager: false, agent: false, viewer: false },
  { key: 'billing',            label: 'Billing & invoices',       owner: true,  admin: false, manager: false, agent: false, viewer: false },
];

const AUDIT = [
  { ts: '14:02:18', who: 'amelia@tkmc.co', action: 'settings.channel.update',   target: 'WhatsApp', meta: 'routing=VIP first', level: 'info' },
  { ts: '14:01:02', who: 'rafa@tkmc.co',   action: 'agent.restart',             target: 'Polaris',  meta: 'manual restart',    level: 'warn' },
  { ts: '13:58:44', who: 'priya@tkmc.co',  action: 'user.invite',               target: 'chloe@tkmc.co', meta: 'role=agent',  level: 'info' },
  { ts: '13:44:12', who: 'system',         action: 'integration.token.expiring',target: 'Instagram',meta: '36h remaining',     level: 'warn' },
  { ts: '13:30:00', who: 'amelia@tkmc.co', action: 'role.permission.toggle',    target: 'Manager',  meta: '+manage_tasks',     level: 'info' },
  { ts: '13:18:21', who: 'system',         action: 'model.fallback',            target: 'gpt-mini', meta: 'sonnet-4.5 degraded 4x', level: 'info' },
  { ts: '12:50:07', who: 'rafa@tkmc.co',   action: 'security.2fa.enforced',     target: 'Admins',   meta: 'cadence=weekly',    level: 'info' },
];

const SYS_HEALTH = {
  uptime: 99.982,
  p95: 382,   // ms
  qps: 1428,
  errRate: 0.21, // %
  queueDepth: 34,
  incidents: 0,
};

// Saved agent groups for the Live Meetings invite picker — quick-pick
// rosters that map to the operational silos already in the AGENTS table.
// Agent Zero is the active commander; Tony Legacy is intentionally not in active groups and is
// reachable only via the dashboard's Escalate flow.
const AGENT_GROUPS = {
  Exec:     ['agent-zero','hermes', 'insight'],  // commander + lieutenant + memory
  Labor:    ['research',  'inbox', 'scheduler'], // ticket-doers
  Security: ['sentinel'],                        // alerts & night shift
  Ops:      ['agent-zero', 'handup', 'direct'],  // live-ops surface
};

Object.assign(window, {
  AGENTS, AGENT_GROUPS, CHANNEL_META, TICKETS, LANES, MEETINGS, MEETING_MODES, ALERTS,
  USERS, MODELS, SKILLS, INTEGRATIONS, CHANNELS, ROLES, PERMISSIONS, AUDIT, SYS_HEALTH
});
