// App Shell: topbar, sidebar, persona, gear quick panel

const NAV = [
  { id: 'mission',  label: 'Mission Control', icon: 'Mission' },
  { id: 'gateway',  label: 'Gateway',         icon: 'Network' },
  { id: 'schedule', label: 'Schedule',        icon: 'Schedule', count: 14 },
  { id: 'tasks',    label: 'Tasks',           icon: 'Tasks',    count: 63 },
  { id: 'meeting',  label: 'Live Meeting',    icon: 'Meeting',  live: true },
  { id: 'health',   label: 'System Health',   icon: 'Health' },
];

// Central admin surface — 8 required categories per To-Knowledge governance.
// "system / tasks / about" preserved as supporting tabs.
// Standalone pages (Email & SMTP, Brain Sync) remain reachable via sidebar
// per "dual entry" decision; their Settings tabs deep-link to them.
// Settings is the ONE admin surface. Every admin action lives here; nothing is
// split into random top-level pages. The groups below map to the user's
// Identity & Access mandate:
//   Identity & Access:  Users, Security, Models, Integrations, Skills, Agents
//   Communications:     Email, Meetings, Channels
//   Operations:         System Health, Tasks, Backend readiness, About
const SETTINGS_NAV = [
  // ── Identity & Access ────────────
  { id: 'users',        label: 'Users & Roles',   icon: 'User',    group: 'Identity & Access' },
  { id: 'security',     label: 'Security',        icon: 'Key',     group: 'Identity & Access' },
  { id: 'credentials',  label: 'Credentials',     icon: 'Key',     group: 'Identity & Access' },
  { id: 'models',       label: 'Models',          icon: 'Brain',   group: 'Identity & Access' },
  { id: 'integrations', label: 'Integrations',    icon: 'Plug',    group: 'Identity & Access' },
  { id: 'skills',       label: 'Skills',          icon: 'Brain',   group: 'Identity & Access' },
  { id: 'agentmgmt',    label: 'Agent Management',icon: 'Agents',  group: 'Identity & Access' },
  { id: 'agentmgmt-pro',label: 'Agent Mgmt · Pro',icon: 'Agents',  group: 'Identity & Access' },
  { id: 'governance',   label: 'Agent Governance',icon: 'Key',     group: 'Identity & Access' },
  // ── Communications ───────────────
  { id: 'email',        label: 'Email & SMTP',    icon: 'Mail',    group: 'Communications' },
  { id: 'meetings',     label: 'Meetings',        icon: 'Meeting', group: 'Communications' },
  { id: 'channels',     label: 'Channels',        icon: 'Radio',   group: 'Communications' },
  { id: 'alerts',       label: 'Alerts',          icon: 'Alert',   group: 'Communications' },
  // ── Operations ───────────────────
  { id: 'system',       label: 'System Health',   icon: 'Health',  group: 'Operations' },
  { id: 'tasks',        label: 'Tasks',           icon: 'Tasks',   group: 'Operations' },
  { id: 'readiness',    label: 'Backend readiness', icon: 'FileLog', group: 'Operations' },
  { id: 'about',        label: 'About',           icon: 'FileLog', group: 'Operations' },
];

const PERSONAS = [
  { id: 'owner',   name: 'Owner',   email: 'owner@knowledge-vs-ai.com' },
  { id: 'admin',   name: 'Admin',   email: 'admin@knowledge-vs-ai.com' },
  { id: 'manager', name: 'Manager', email: 'manager@knowledge-vs-ai.com' },
  { id: 'agent',   name: 'Agent',   email: 'agent@knowledge-vs-ai.com' },
  { id: 'viewer',  name: 'Viewer',  email: 'viewer@knowledge-vs-ai.com' },
];

function Sidebar({ page, onNav, inSettings, settingsPage, onSettingsNav }) {
  if (inSettings) {
    return (
      <aside className="sidebar">
        <div className="nav-item" onClick={()=>onNav('mission')} style={{color:'var(--fg-2)'}}>
          <I.Chevron style={{transform:'rotate(180deg)'}} />
          <span>Back to workspace</span>
        </div>
        <div className="nav-section-label">Settings</div>
        {SETTINGS_NAV.map(n => {
          const IconCmp = I[n.icon];
          return (
            <div key={n.id} className={`nav-item ${settingsPage===n.id?'active':''}`} onClick={()=>onSettingsNav(n.id)}>
              <IconCmp/>
              <span>{n.label}</span>
            </div>
          );
        })}
        <div className="sidebar-footer">
          <div className="sys-pill">
            <span className="dot ok"/> <span>All systems nominal</span>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      <div className="nav-section-label">Workspace</div>
      {NAV.map(n => {
        const IconCmp = I[n.icon];
        return (
          <div key={n.id} className={`nav-item ${page===n.id?'active':''}`} onClick={()=>onNav(n.id)}>
            <IconCmp/>
            <span>{n.label}</span>
            {n.live && <span className="dot ok" style={{marginLeft:'auto'}}/>}
            {n.count && <span className="count">{n.count}</span>}
          </div>
        );
      })}
      <div className="nav-section-label">Favorites</div>
      <div className="nav-item"><I.Hash/> <span>VIP Queue</span></div>
      <div className="nav-item"><I.Hash/> <span>Refund triage</span></div>
      <div className="nav-item"><I.Hash/> <span>Outbound: Q4 SMB</span></div>

      <div className="sidebar-footer">
        <div className="sys-pill">
          <span className="dot ok"/>
          <span className="truncate">Uptime 99.98% · p95 382ms</span>
        </div>
        <div className="sys-pill">
          <span className="dot warn"/>
          <span className="truncate">2 alerts need review</span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ persona, onPersonaCycle, onGear, onSettings, inSettings, breadcrumb, onCommand, onNotifications }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"/>
        <span>To-Knowledge <span style={{color:'var(--fg-2)', fontWeight:400}}>Mission Control</span></span>
        <span className="tag accent" style={{marginLeft:4}}>v2.0</span>
      </div>
      <div className="topbar-sep"/>
      <div className="breadcrumb">{breadcrumb}</div>
      <div className="topbar-spacer"/>
      <div className="topbar-search" onClick={onCommand} title="Search loaded Mission Control data (⌘K)">
        <I.Search size={13}/>
        <input placeholder="Search tickets, agents, settings…" readOnly/>
        <span className="kbd">⌘K</span>
      </div>
      <NotifBell onOpen={onNotifications}/>
      <button className={`icon-btn ${inSettings?'':''}`} title="Settings" onClick={onGear}>
        <I.Gear size={15}/>
      </button>
      <div className="topbar-sep"/>
      {window.SessionBadge ? <window.SessionBadge/> : null}
      <div className="topbar-sep"/>
      <div className="persona" onClick={onPersonaCycle} title="Preview role permissions">
        <Avatar name={persona.name}/>
        <div style={{display:'flex', flexDirection:'column', lineHeight:1.1}}>
          <span style={{fontSize:12, color:'var(--fg-0)'}}>{persona.name.split(' ')[0]}</span>
          <span className="persona-role mono">{persona.id.toUpperCase()}</span>
        </div>
        <I.ChevronDown size={12}/>
      </div>
    </header>
  );
}

function GearQuickPanel({ onClose, onOpenSettings }) {
  const items = [
    { icon: 'Plus',     label: 'Add user',          hint: 'U',  go: () => onOpenSettings('users') },
    { icon: 'Mail',     label: 'Invite via email',  hint: '',   go: () => onOpenSettings('users') },
    { icon: 'Link',     label: 'Create invite link',hint: '',   go: () => onOpenSettings('users') },
    { icon: 'Bell',     label: 'View alerts',       hint: '2',  go: () => onOpenSettings('alerts') },
    { icon: 'Plug',     label: 'Integration health',hint: '',   go: () => onOpenSettings('integrations') },
    { icon: 'Key',      label: 'Security / 2FA',    hint: '',   go: () => onOpenSettings('security') },
  ];
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <>
      <div style={{position:'fixed', inset:0, zIndex:85}} onClick={onClose}/>
      <div className="quick-panel">
        <div className="qp-head">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--fg-2)', fontWeight:600}}>Admin quick panel</span>
            <span className="kbd">G · S</span>
          </div>
          <div style={{fontSize:12, color:'var(--fg-2)'}}>Shortcuts to common admin actions. For the full surface, open Settings.</div>
        </div>
        <div className="qp-section">
          {items.map(it => {
            const IconCmp = I[it.icon];
            return (
              <div key={it.label} className="qp-item" onClick={it.go}>
                <IconCmp/> <span>{it.label}</span>
                {it.hint && <span className="hint kbd">{it.hint}</span>}
              </div>
            );
          })}
        </div>
        <div className="qp-section" style={{borderBottom:0}}>
          <div className="qp-item qp-open" onClick={() => onOpenSettings('users')}>
            <I.Gear/> <span>Open full settings</span>
            <I.ArrowRight style={{marginLeft:'auto'}}/>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Sidebar, Topbar, GearQuickPanel, PERSONAS, NAV, SETTINGS_NAV });
