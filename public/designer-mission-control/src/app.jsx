// Main app — routing, state, Tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 210,
  "density": "balanced",
  "showPersonaSwitcher": true,
  "scanlines": false
}/*EDITMODE-END*/;

function App() {
  // Per correction addendum: no separate interface. Single-scroll Mission Control.
  const [, setLiveRevision] = React.useState(0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsPage, setSettingsPage] = React.useState(() => localStorage.getItem('cc.settingsPage') || 'system');
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [tasksOpen, setTasksOpen] = React.useState(false);
  const [tasksFilter, setTasksFilter] = React.useState(null);
  const openTasks = (filter) => { setTasksFilter(filter || null); setTasksOpen(true); };
  const [personaIdx, setPersonaIdx] = React.useState(0);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [meetingOpen, setMeetingOpen] = React.useState(false);
  const [meeting, setMeeting] = React.useState(null);
  const [ticket, setTicket] = React.useState(null);
  const [agent, setAgent] = React.useState(null);
  const [opsDrawer, setOpsDrawer] = React.useState(null); // 'graphify' | 'webops' | 'obsidian' | 'telemetry' | 'policy' | 'pacman'
  const [pacmanTab, setPacmanTab] = React.useState('backups');
  const [telemetryFocus, setTelemetryFocus] = React.useState({ tab:null, skillId:null });
  const [editMode, setEditMode] = React.useState(false);
  const [page, setPage] = React.useState(() => {
    const requested = new URLSearchParams(location.search).get('page');
    return requested || localStorage.getItem('cc.page') || 'mission';
  });
  React.useEffect(()=>localStorage.setItem('cc.page', page), [page]);
  React.useEffect(() => {
    if (page === 'gateway' || page === 'agent-network') window.location.href = '/gateway/agent-hub';
  }, [page]);
  const [modules, setModules] = React.useState({ agents:true, meetings:true, hive:true, tasks:true, quick:true, schedule:true, alerts:true, health:true, memory:true, tokens:true, graphify:true, webops:true, obsidian:true, telemetry:true, policy:true, pacman:true });

  // Search palette + Notifications drawer
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  // Global keyboard: ⌘K / Ctrl+K opens search palette
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Tweak state
  const [tweaks, setTweaks] = React.useState(TWEAK_DEFAULTS);
  const [tweaksVisible, setTweaksVisible] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', `oklch(0.78 0.13 ${tweaks.accentHue})`);
    document.documentElement.style.setProperty('--accent-2', `oklch(0.68 0.14 ${tweaks.accentHue})`);
    document.documentElement.style.setProperty('--accent-soft', `oklch(0.78 0.13 ${tweaks.accentHue} / 0.14)`);
    document.documentElement.style.setProperty('--accent-line', `oklch(0.78 0.13 ${tweaks.accentHue} / 0.35)`);
    document.body.style.fontSize = tweaks.density==='tight' ? '12px' : tweaks.density==='airy' ? '14px' : '13px';
    document.body.classList.toggle('scanline', !!tweaks.scanlines);
  }, [tweaks]);

  // Edit-mode protocol
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksVisible(true);
      else if (e.data?.type === '__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  React.useEffect(()=>localStorage.setItem('cc.settingsPage', settingsPage),[settingsPage]);

  React.useEffect(() => {
    const bump = () => setLiveRevision(v => v + 1);
    window.addEventListener('tkmc:live-data', bump);
    window.addEventListener('api:http-ready', bump);
    return () => {
      window.removeEventListener('tkmc:live-data', bump);
      window.removeEventListener('api:http-ready', bump);
    };
  }, []);

  const persona = window.PERSONAS[personaIdx];

  const goTo = (p) => {
    if (p.startsWith('settings:')) { setSettingsPage(p.split(':')[1]); setSettingsOpen(true); }
    else if (p === 'mission')  { setPage('mission'); }
    else if (p === 'brain-sync'){ setPage('brain-sync'); }
    else if (p === 'mirofish')  { setPage('mirofish'); }
    else if (p === 'gateway' || p === 'agent-network') { window.location.href = '/gateway/agent-hub'; return; }
    else if (p === 'firecrawl') { setPage('firecrawl'); }
    else if (p === 'zapier') { setPage('zapier'); }
    else if (p === 'n8n') { setPage('n8n'); }
    else if (p === 'mcp-tools') { setPage('mcp-tools'); }
    else if (p === 'skills') { setPage('skills'); }
    else if (p === 'reports') { setPage('reports'); }
    else if (p === 'meeting' || p === 'meetings') {
      const live = (window.MEETINGS || []).find(m => m.live) || (window.MEETINGS || [])[0];
      if (live) { setMeeting(live); setMeetingOpen(true); }
      else window.Notifications?.emit?.({ kind:'info', source:'meetings', title:'No live meetings', detail:'Nothing scheduled right now.' });
    }
    else if (p === 'schedule') setScheduleOpen(true);
    else if (p === 'tasks') setTasksOpen(true);
    else if (p === 'settings') setSettingsOpen(true);
    // Aliases used by the dashboard for cross-page jumps:
    else if (p === 'brain')   { setPage('brain-sync'); }
    else if (p === 'health' || p === 'system' || p === 'system-health') {
      setSettingsPage('system'); setSettingsOpen(true);
    }
    else {
      window.Notifications?.emit?.({ kind:'warn', source:'nav', title:'Route not wired', detail:`No destination registered for "${p}".` });
    }
  };

  // Expose a minimal navigation bridge for pages that live outside the main
  // shell (like BrainSyncPage). They can call window.appGoTo('settings:readiness')
  // or window.appGoTo('mission') without needing to prop-drill goTo.
  React.useEffect(() => {
    window.appGoTo = goTo;
    return () => { if (window.appGoTo === goTo) delete window.appGoTo; };
  });

  const openSettings = (sp) => { setSettingsPage(sp); setSettingsOpen(true); setQuickOpen(false); };

  // Resolves a route { page?, overlay?, settingsPage?, agentId?, ticketId?, meetingId? }
  // Used by the search palette and the notifications drawer. Honest:
  // if a destination doesn't exist, we toast instead of pretending.
  const handleSearchRoute = (result) => {
    const r = result?.route || result;
    if (!r) return;
    if (r.page) setPage(r.page);
    if (r.overlay === 'settings') {
      if (r.settingsPage) setSettingsPage(r.settingsPage);
      setSettingsOpen(true);
    }
    if (r.overlay === 'schedule') setScheduleOpen(true);
    if (r.overlay === 'tasks') setTasksOpen(true);
    if (r.agentId) {
      const a = (window.AGENTS || []).find(x => x.id === r.agentId);
      if (a) setAgent(a);
    }
    if (r.ticketId) {
      const t = (window.TICKETS || []).find(x => x.id === r.ticketId);
      if (t) setTicket(t);
    }
    if (r.meetingId) {
      const m = (window.MEETINGS || []).find(x => x.id === r.meetingId);
      if (m) { setMeeting(m); setMeetingOpen(true); }
    }
  };

  const toggleModule = (m) => setModules(prev => ({...prev, [m]: !prev[m]}));

  const updateTweak = (k, v) => {
    const next = {...tweaks, [k]: v};
    setTweaks(next);
    window.parent.postMessage({type:'__edit_mode_set_keys', edits:{[k]:v}}, '*');
  };

  const bc = <><span>To-Knowledge</span><span className="bc-sep">/</span><b>Mission Control</b></>;

  return (
    <div className="app-solo with-rail">
      <Topbar
        persona={persona}
        onPersonaCycle={()=>setPersonaIdx((personaIdx+1)%window.PERSONAS.length)}
        onGear={()=>setQuickOpen(!quickOpen)}
        onSettings={()=>setSettingsOpen(true)}
        inSettings={false}
        breadcrumb={bc}
        onCommand={()=>setPaletteOpen(true)}
        onNotifications={()=>setNotifOpen(true)}
      />
      <DemoBanner/>

      <div className="app-body">
        <WorkspaceRail page={page} onPage={setPage}/>
        <main className="main-solo">
          {page === 'mission'    && <Dashboard onGo={goTo} onJoin={(m)=>{setMeeting(m); setMeetingOpen(true);}} editMode={editMode} setEditMode={setEditMode} modules={modules} toggleModule={toggleModule} onAgent={setAgent} onTicket={setTicket} onOpenTasks={openTasks} onOps={(k,arg1,arg2)=>{ setOpsDrawer(k); if (k==='pacman' && arg1) setPacmanTab(arg1); if (k==='telemetry') setTelemetryFocus({ tab:arg1||null, skillId:arg2||null }); }}/>}
          {page === 'brain-sync' && <BrainSyncPage/>}
          {page === 'mirofish'   && <MiroFishPage/>}
          {(page === 'gateway' || page === 'agent-network') && <AgentNetworkPage/>}
          {page === 'firecrawl' && <FireCrawlPage/>}
          {page === 'zapier' && <ZapierPage/>}
          {page === 'n8n' && <N8NPage/>}
          {page === 'mcp-tools' && <MCPToolsPage/>}
          {page === 'skills' && <SkillsRegistryPage/>}
          {page === 'reports' && <ExecutiveReportsPage/>}
          {page === 'email-smtp' && <EmailProfilesPage/>}
        </main>
      </div>

      {opsDrawer==='graphify'  && <GraphifyDrawer       onClose={()=>setOpsDrawer(null)}/>}
      {opsDrawer==='webops'    && <WebOpsDrawer         onClose={()=>setOpsDrawer(null)}/>}
      {opsDrawer==='obsidian'  && <ObsidianSyncDrawer  onClose={()=>setOpsDrawer(null)}/>}
      {opsDrawer==='telemetry' && <AgentTelemetryDrawer onClose={()=>{ setOpsDrawer(null); setTelemetryFocus({tab:null,skillId:null}); }} initialTab={telemetryFocus.tab} initialSkillId={telemetryFocus.skillId}/>}
      {opsDrawer==='policy'    && <PolicyHealthDrawer   onClose={()=>setOpsDrawer(null)}/>}
      {opsDrawer==='pacman'    && <PacmanOpsDrawer      onClose={()=>setOpsDrawer(null)} initialTab={pacmanTab}/>}

      {settingsOpen && <SettingsDrawer page={settingsPage} setPage={setSettingsPage} onClose={()=>setSettingsOpen(false)} onAgent={setAgent} onPageChange={setPage}/>}
      {scheduleOpen && <ScheduleOverlay onClose={()=>setScheduleOpen(false)} onTicket={setTicket}/>}
      {tasksOpen && <TasksOverlay onClose={()=>setTasksOpen(false)} onTicket={setTicket} initialFilter={tasksFilter}/>}
      {quickOpen && <GearQuickPanel onClose={()=>setQuickOpen(false)} onOpenSettings={openSettings}/>}
      {ticket && <TaskDrawer ticket={ticket} onClose={()=>setTicket(null)}/>}
      {agent && <AgentDrawer agent={agent} onClose={()=>setAgent(null)}/>}
      {meetingOpen && <MeetingRoom meeting={meeting} onClose={()=>setMeetingOpen(false)}/>}

      {/* Search palette + Notifications drawer — both client-side, honest about backend gaps */}
      <SearchCommand
        open={paletteOpen}
        onClose={()=>setPaletteOpen(false)}
        onNavigate={(r)=>handleSearchRoute(r)}
      />
      <NotificationsDrawer
        open={notifOpen}
        onClose={()=>setNotifOpen(false)}
        onNavigate={(route)=>handleSearchRoute({ route })}
      />

      {tweaksVisible && (
        <div className="tweaks-panel">
          <h4>Tweaks <span className="kbd">beta</span></h4>
          <div className="tweak-row">
            <label>Accent</label>
            <div className="tweak-swatches">
              {[{h:210,c:'#22d3ee'},{h:250,c:'#818cf8'},{h:160,c:'#34d399'},{h:80,c:'#f59e0b'},{h:20,c:'#fb7185'}].map(sw => (
                <div key={sw.h} className={`tweak-sw ${tweaks.accentHue===sw.h?'active':''}`} onClick={()=>updateTweak('accentHue', sw.h)} style={{background:`oklch(0.78 0.13 ${sw.h})`}}/>
              ))}
            </div>
          </div>
          <div className="tweak-row">
            <label>Density</label>
            <select className="select" value={tweaks.density} onChange={e=>updateTweak('density', e.target.value)}>
              <option value="tight">Tight</option>
              <option value="balanced">Balanced</option>
              <option value="airy">Airy</option>
            </select>
          </div>
          <div className="tweak-row">
            <label>Scanlines</label>
            <Switch on={tweaks.scanlines} onToggle={v=>updateTweak('scanlines', v)}/>
          </div>
          <div className="tweak-row">
            <label>Edit dashboard</label>
            <Switch on={editMode} onToggle={v=>setEditMode(v)}/>
          </div>
          <div className="muted xsmall" style={{marginTop:8, borderTop:'1px solid var(--line-1)', paddingTop:8}}>
            Demo: click the persona badge (top right) to cycle roles · click the gear for the quick admin panel.
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
