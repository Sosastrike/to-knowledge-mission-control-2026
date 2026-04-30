// ============================================================
// AgentNetworkPage — assembles the canvas + inspector + bottom
// dock (Brain Sync feed · Harness lanes · Cost panel) and owns
// the modal state.
//
// All data flows through window.AgentRegistry. Nothing is faked
// for animation only — every visible row is a real registry
// record.
// ============================================================

function AgentNetworkPage() {
  const snap = window.AgentRegistry.useRegistry();
  const [selectedId, setSelectedId] = React.useState('tony');
  const [ctx, setCtx]               = React.useState(null);
  const [addOpen, setAddOpen]       = React.useState(false);
  const [engineOpen, setEngineOpen] = React.useState(null); // agentId
  const [assignOpen, setAssignOpen] = React.useState(null); // agentId
  const [activeApproval, setActiveApproval] = React.useState(null);
  const [dockTab, setDockTab]       = React.useState('feed'); // for Brain Sync: feed | table

  // Auto-open the most recent pending approval whenever a new one arrives.
  // (Demonstrates the protected-action chrome surfacing live.)
  const lastApvRef = React.useRef(null);
  React.useEffect(() => {
    const pending = (snap.approvals || []).filter(a => a.status === 'pending');
    const latest = pending[0];
    if (latest && lastApvRef.current !== latest.id) {
      lastApvRef.current = latest.id;
      // Don't auto-open the seeded approvals on first load (they exist already)
    }
  }, [snap.approvals]);

  const onContextMenu = (e, agent) => {
    setCtx({ x: e.clientX, y: e.clientY, agentId: agent.id });
  };

  const pendingApprovals = (snap.approvals || []).filter(a => a.status === 'pending');
  const pendingHigh = pendingApprovals.filter(a => a.severity === 'high').length;
  const pendingMed  = pendingApprovals.filter(a => a.severity === 'medium').length;

  return (
    <div className="an-page" data-bind="page.agent-network">
      {/* ===== Header ===== */}
      <header className="an-header">
        <span className="an-title">Agent Network</span>
        <span className="an-sub">— Brain Sync · Harness · Universal Bridge</span>

        <span style={{flex:1}}/>

        <span className="an-pill" title="Number of active agents (kind=agent, status≠retired)">
          <span className="dot"/>
          {snap.agents.filter(a => a.kind==='agent' && a.status!=='retired').length} agents online
        </span>
        <span className="an-pill warn" title="Engines reporting status='degraded'">
          <span className="dot"/>
          {snap.agents.filter(a => a.kind!=='agent' && a.status==='degraded').length} degraded
        </span>
        <span className={`an-pill ${pendingHigh ? 'err' : pendingMed ? 'warn' : 'muted'}`}
              title="Pending approvals — click to review"
              onClick={() => pendingApprovals[0] && setActiveApproval(pendingApprovals[0])}
              style={{cursor: pendingApprovals.length ? 'pointer' : 'default'}}>
          <span className="dot"/>
          {pendingApprovals.length} approvals
        </span>

        <button className="an-btn primary" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.('Add agent')}>
          <I.Plus size={12}/> Add agent
        </button>
        <button className="an-btn" onClick={() => {
          window.TKMC_LIVE_BRIDGE?.refresh?.();
        }} title="Refresh live Mission Control provider, agent, skill, gateway, Brain Sync, and Harness status">
          ↻ Refresh live
        </button>
        <span className="an-mock-chip" title="Live read-only data. Protected writes stay disabled until owner-approved backend gates are implemented.">
          LIVE READ-ONLY
        </span>
      </header>

      {/* ===== Canvas (left) ===== */}
      <AgentNetworkCanvas
        snap={snap}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onContextMenu={onContextMenu}
        onDropToTier={(id, tier) => {
          window.TKMC_LIVE_BRIDGE?.blockedWrite?.(`Change ${id} tier to ${tier}`);
        }}
      />

      {/* ===== Inspector (right) ===== */}
      <AgentInspector
        agentId={selectedId}
        snap={snap}
        onClose={() => setSelectedId(null)}
        onConnectEngine={(id) => setEngineOpen(id)}
        onAssignTicket={() => setAssignOpen(selectedId)}
        onAddAgent={() => setAddOpen(true)}
        onApprove={() => {
          const apv = (window.AgentRegistry.useRegistry?.() || snap).approvals?.find(a => a.status==='pending');
          if (apv) setActiveApproval(apv);
        }}
      />

      {/* ===== Bottom dock — Brain Sync · Harness · Cost ===== */}
      <div className="an-dock">
        {/* Brain Sync */}
        <div className="an-dock-pane" data-bind="brain_sync">
          <div className="an-dock-header">
            <I.Sparkle size={12}/>
            <b>Brain Sync</b>
            <span style={{color:'var(--fg-3)'}}>· learning ledger</span>
            <span className="spacer"/>
            <button className={`an-btn ${dockTab==='feed'?'primary':''}`}
                    style={{padding:'2px 6px', fontSize:10}}
                    onClick={()=>setDockTab('feed')}>Feed</button>
            <button className={`an-btn ${dockTab==='table'?'primary':''}`}
                    style={{padding:'2px 6px', fontSize:10}}
                    onClick={()=>setDockTab('table')}>Table</button>
          </div>
          <div className="an-dock-body">
            {dockTab === 'feed' && (snap.brain_sync || []).slice(0, 30).map(e => (
              <div key={e.id} className="an-evt" data-severity={e.severity || ''}
                   data-bind={`brain_sync.${e.id}`}>
                <time>{e.at}</time>
                <span className="kind">{e.kind}</span>
                <span className="body">
                  {e.note || ''}
                  <small style={{marginLeft:6}}>· {e.actor} → {e.target}</small>
                </span>
              </div>
            ))}
            {dockTab === 'table' && (
              <table style={{width:'100%', fontSize:11, borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{color:'var(--fg-3)', textAlign:'left'}}>
                    <th style={{padding:'4px 12px'}}>Time</th>
                    <th>Kind</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(snap.brain_sync || []).slice(0, 50).map(e => (
                    <tr key={e.id} style={{borderTop:'1px solid var(--line-1)'}}>
                      <td style={{padding:'4px 12px', color:'var(--fg-3)', fontFamily:'var(--font-mono)'}}>{e.at}</td>
                      <td style={{fontFamily:'var(--font-mono)', fontSize:10}}>{e.kind}</td>
                      <td>{e.actor}</td>
                      <td>{e.target}</td>
                      <td style={{color:'var(--fg-2)'}}>{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Harness */}
        <div className="an-dock-pane" data-bind="harness">
          <div className="an-dock-header">
            <I.Plug size={12}/>
            <b>Harness</b>
            <span style={{color:'var(--fg-3)'}}>· routing layer</span>
          </div>
          <div className="an-dock-body">
            {(snap.harness || []).slice(0, 30).map(e => (
              <div key={e.id} className="an-evt" data-bind={`harness.${e.id}`}>
                <time>{e.at}</time>
                <span className="kind">{e.kind}</span>
                <span className="body">
                  <code style={{color:'var(--fg-1)', fontSize:10.5}}>{e.route}</code>
                  {e.ticket && <small style={{marginLeft:6}}>· {e.ticket}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost / tokens */}
        <div className="an-dock-pane" data-bind="cost">
          <div className="an-dock-header">
            <I.Zap size={12}/>
            <b>Cost · tokens</b>
            <span style={{color:'var(--fg-3)'}}>
              · ${(snap.cost?.spend_today || 0).toFixed(2)} of ${snap.cost?.budget_today.toFixed(2)} today
            </span>
          </div>
          <div className="an-dock-body">
            {(snap.cost?.warnings || []).map(w => (
              <div key={w.id} className="an-evt" data-severity={w.severity==='crit'?'high':'medium'}>
                <time>{w.at}</time>
                <span className="kind">{w.severity}</span>
                <span className="body">
                  <code>{w.target}</code> · {w.note}
                </span>
              </div>
            ))}
            {(snap.cost?.by_agent || []).map(c => {
              const a = window.AgentRegistry.getAgent(c.id);
              return (
                <div key={c.id} className="an-cost-row" data-bind={`cost.${c.id}`}>
                  <span><b>{a?.display_name || c.id}</b></span>
                  <span><code>${c.spend.toFixed(2)}</code></span>
                  <span><code>{c.tokens.toLocaleString()} tok</code></span>
                  <span className="an-sev-badge" data-sev={c.severity}>{c.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Modals + ctx ===== */}
      <ContextMenu ctx={ctx} onClose={()=>setCtx(null)}
                   onConnectEngine={(id)=>setEngineOpen(id)}
                   onAssignTicket={(id)=>setAssignOpen(id)}
                   onApprove={()=>{
                     const apv = (snap.approvals || []).find(a => a.status==='pending');
                     if (apv) setActiveApproval(apv);
                   }}/>

      <AddAgentWizard open={addOpen} onClose={()=>setAddOpen(false)}/>

      <EngineConnectModal open={!!engineOpen} agentId={engineOpen}
                          onClose={()=>setEngineOpen(null)}/>

      <AssignTicketModal open={!!assignOpen} agentId={assignOpen}
                         onClose={()=>setAssignOpen(null)}/>

      <ApprovalModal approval={activeApproval}
                     onClose={()=>setActiveApproval(null)}/>
    </div>
  );
}

Object.assign(window, { AgentNetworkPage });
