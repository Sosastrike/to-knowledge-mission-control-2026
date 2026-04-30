// Overlay wrappers — per correction addendum, Mission Control is single-scroll;
// Schedule, Tasks, and Settings open as right-side workspace overlays, not separate pages.

function WorkspaceOverlay({ title, subtitle, onClose, children, wide }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className={`workspace-overlay ${wide?'wide':''}`}>
        <div className="ws-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Workspace</div>
            <div className="hstack" style={{gap:10, marginTop:2}}>
              <h2 style={{margin:0, fontSize:18, color:'var(--fg-0)', fontWeight:600}}>{title}</h2>
              {subtitle && <span className="muted xsmall">{subtitle}</span>}
            </div>
          </div>
          <div className="spacer"/>
          <button className="btn" onClick={onClose}><I.X size={14}/> Close</button>
        </div>
        <div className="ws-body">
          {children}
        </div>
      </div>
    </>
  );
}

function ScheduleOverlay({ onClose, onTicket }) {
  return (
    <WorkspaceOverlay
      title="Schedule"
      subtitle="Horizontal line-cook flow · today"
      onClose={onClose}
      wide
    >
      <Schedule onTicket={onTicket}/>
    </WorkspaceOverlay>
  );
}

function TasksOverlay({ onClose, onTicket, initialFilter }) {
  return (
    <WorkspaceOverlay
      title="Tasks"
      subtitle="All tickets · filter, assign, drill into any row"
      onClose={onClose}
      wide
    >
      <Tasks onTicket={onTicket} initialFilter={initialFilter}/>
    </WorkspaceOverlay>
  );
}

// Settings as a right-side drawer with a vertical tab rail —
// matches the real ClaudeClaw right-drawer Settings.
function SettingsDrawer({ page, setPage, onClose, onAgent, onPageChange }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);

  let content = null;
  if (page==='system') content = <SystemPage/>;
  else if (page==='agents') content = <AgentsPage onAgent={onAgent}/>;
  else if (page==='agentmgmt') content = <AgentManagementPage/>;
  else if (page==='agentmgmt-pro') content = <AgentMgmtPro/>;
  else if (page==='governance') content = <GovernancePage/>;
  else if (page==='meetings') content = <MeetingsPage/>;
  else if (page==='tasks') content = <TasksSettingsPage/>;
  else if (page==='integrations') content = <IntegrationsProPage/>;
  else if (page==='channels') content = <ChannelsPage/>;
  else if (page==='alerts') content = <AlertsPage/>;
  else if (page==='about') content = <AboutPage/>;
  else if (page==='users') content = <UsersRolesPage/>;
  else if (page==='security') content = <SecurityPage/>;
  else if (page==='credentials') content = <CredentialsPage/>;
  else if (page==='models') content = <ModelsPage/>;
  else if (page==='skills') content = <SkillsPage/>;
  else if (page==='readiness') content = <BackendReadinessPage/>;
  else if (page==='email') content = <EmailRedirectPage onJump={()=>{ onPageChange?.('email-smtp'); onClose(); }}/>;
  else content = <UsersRolesPage/>;

  // Build grouped rail
  const groups = [];
  for (const item of window.SETTINGS_NAV) {
    let g = groups.find(x => x.label === item.group);
    if (!g) { g = { label: item.group || 'Other', items: [] }; groups.push(g); }
    g.items.push(item);
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="settings-drawer">
        <div className="sd-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Admin · To-Knowledge Mission Control</div>
            <h2 style={{margin:'2px 0 0', fontSize:18, color:'var(--fg-0)', fontWeight:600}}>Settings</h2>
          </div>
          <div className="spacer"/>
          <button className="btn" onClick={onClose}><I.X size={14}/> Close</button>
        </div>
        <div className="sd-body">
          <aside className="sd-rail">
            {groups.map(g => (
              <div key={g.label} className="sd-rail-group">
                <div className="sd-rail-group-label">{g.label}</div>
                {g.items.map(s => {
                  const IconCmp = I[s.icon] || I.Dot;
                  return (
                    <div key={s.id} className={`sd-tab ${page===s.id?'active':''}`} onClick={()=>setPage(s.id)}>
                      <IconCmp size={14}/>
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="sd-rail-foot">
              <div className="muted xsmall">To-Knowledge Mission Control</div>
              <div className="muted xsmall mono">v2.0 · live read-only</div>
            </div>
          </aside>
          <div className="sd-content">
            {content}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { WorkspaceOverlay, ScheduleOverlay, TasksOverlay, SettingsDrawer });
