// ============================================================
// AgentInspector — right-side panel showing the FULL agent
// record. Every field maps to registry data. Action buttons
// route through registry mutations.
// ============================================================

function AgentInspector({ agentId, snap, onClose, onConnectEngine, onAddAgent, onApprove, onAssignTicket }) {
  const [tab, setTab] = React.useState('overview');
  const a = snap.agents.find(x => x.id === agentId);
  const isAgent = a && a.kind === 'agent';
  const tickets = (snap.tickets || []).filter(t => t.current_owner === agentId);
  const auditEvents = (snap.brain_sync || []).filter(e => e.actor === agentId || e.target === agentId).slice(0, 20);

  if (!a) {
    return (
      <aside className="an-inspector">
        <div className="an-ins-body" style={{padding:24, color:'var(--fg-2)', fontSize:12}}>
          <p>Click any node on the canvas to inspect it.</p>
          <p style={{marginTop:18}}>
            <button className="an-btn primary" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.('Add agent')}>
              <I.Plus size={12}/> Add agent
            </button>
          </p>
        </div>
      </aside>
    );
  }

  const Icon = iconFor(a.icon);

  return (
    <aside className="an-inspector" data-bind={`agent.${a.id}`}>
      <div className="an-ins-header">
        <div className="an-ins-disc" style={{ '--ring': a.tier==='commander'
            ? (a.id==='agent_zero' ? 'var(--cmd-2)' : 'var(--cmd-1)') : 'var(--line-3)' }}>
          <Icon size={20}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div className="an-ins-name" data-bind={`agent.${a.id}.display_name`}>
            {a.display_name} {a.locked && <span title="Locked" style={{color:'var(--fg-3)'}}>🔒</span>}
          </div>
          <div className="an-ins-role">
            <span data-bind={`agent.${a.id}.tier`}>{a.tier}</span>
            <span style={{color:'var(--fg-4)', margin:'0 4px'}}>·</span>
            <span data-bind={`agent.${a.id}.role`}>{a.role || a.kind}</span>
          </div>
          <div className="an-ins-id" data-bind={`agent.${a.id}.id`}>{a.id}</div>
        </div>
        <button className="an-btn" onClick={onClose} title="Close inspector"><I.X size={12}/></button>
      </div>

      <div className="an-ins-tabs" role="tablist">
        {[
          ['overview','Overview'],
          ['perms','Permissions'],
          ['engines','Engines'],
          ['tickets','Tickets'],
          ['audit','Audit'],
        ].map(([id, label]) => (
          <button key={id}
                  className={`an-ins-tab ${tab===id?'active':''}`}
                  onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className="an-ins-body">
        {tab === 'overview' && <OverviewTab a={a} snap={snap}/>}
        {tab === 'perms'    && <PermsTab    a={a}/>}
        {tab === 'engines'  && <EnginesTab  a={a} snap={snap} onConnectEngine={onConnectEngine}/>}
        {tab === 'tickets'  && <TicketsTab  a={a} tickets={tickets} snap={snap} onAssignTicket={onAssignTicket}/>}
        {tab === 'audit'    && <AuditTab    events={auditEvents}/>}
      </div>

      {/* actions footer */}
      <div className="an-ins-actions">
        {isAgent && !a.locked && (
          <>
            {a.tier !== 'commander' && (
              <button className="an-btn primary" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.(`Promote ${a.display_name} to commander`)}>
                <I.Plus size={12}/> Promote to commander
                <span className="an-mock-chip">requires approval</span>
              </button>
            )}
            {a.tier === 'commander' && (
              <button className="an-btn" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.(`Demote ${a.display_name}`)}>
                <I.Minus size={12}/> Demote to lieutenant
              </button>
            )}
            <button className="an-btn" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.(`Connect engine to ${a.display_name}`)}>
              <I.Plug size={12}/> Connect engine
            </button>
            <button className="an-btn danger" onClick={() => window.TKMC_LIVE_BRIDGE?.blockedWrite?.(`Retire ${a.display_name}`)}>
              <I.X size={12}/> Retire
              <span className="an-mock-chip">approval</span>
            </button>
          </>
        )}
        {isAgent && a.locked && (
          <span style={{fontSize:11, color:'var(--fg-3)'}}>
            🔒 Locked agent — cannot be retired or demoted. Owner-only.
          </span>
        )}
        {!isAgent && (
          <span style={{fontSize:11, color:'var(--fg-3)'}}>
            Engine · transport <code style={{color:'var(--fg-1)'}}>{a.transport}</code>.
            Connect from an agent's <b>Engines</b> tab.
          </span>
        )}
      </div>
    </aside>
  );
}

function OverviewTab({ a, snap }) {
  const isAgent = a.kind === 'agent';
  return (
    <div>
      <div className="an-ins-section">
        <h4>Identity</h4>
        <dl className="an-kv">
          <dt>System name</dt><dd>{a.system_name}</dd>
          <dt>Kind</dt><dd>{a.kind}</dd>
          <dt>Tier</dt><dd><b>{a.tier}</b></dd>
          <dt>Cluster</dt><dd>{a.cluster}</dd>
          <dt>Owner</dt><dd>{a.owner || '—'}</dd>
          <dt>Reports to</dt><dd>{a.reports_to || '—'}</dd>
        </dl>
      </div>

      <div className="an-ins-section">
        <h4>Status</h4>
        <dl className="an-kv">
          <dt>Status</dt><dd><b style={{color: a.status==='online' ? 'var(--ok)' : a.status==='degraded' ? 'var(--err)' : a.status==='busy' ? 'var(--warn)' : 'var(--fg-2)'}}>{a.status}</b></dd>
          <dt>Health</dt><dd>{(a.health_score*100|0)}%</dd>
          <dt>Sync state</dt><dd>{a.sync_state || '—'}</dd>
          <dt>Confidence</dt><dd>{a.confidence_level != null ? (a.confidence_level*100|0)+'%' : '—'}</dd>
          <dt>Last active</dt><dd>{a.last_sync_at ? a.last_sync_at.slice(11,19) : '—'}</dd>
        </dl>
      </div>

      {isAgent && (
        <div className="an-ins-section">
          <h4>Gateway Flow</h4>
          <p style={{fontSize:12, color:'var(--fg-1)', margin:'0 0 4px'}}>
            {a.current_task_summary || <em style={{color:'var(--fg-3)'}}>idle</em>}
          </p>
          {a.current_ticket_id && (
            <p style={{fontSize:11, color:'var(--fg-3)', margin:0}}>
              Flow: <code style={{color:'var(--fg-1)'}}>{a.current_ticket_id}</code>
            </p>
          )}
        </div>
      )}

      <div className="an-ins-section">
        <h4>Cost / tokens (today)</h4>
        <dl className="an-kv">
          <dt>Spend</dt><dd>${(a.cost_today || 0).toFixed(2)}</dd>
          <dt>Tokens</dt><dd>{(a.token_usage_today || 0).toLocaleString()}</dd>
          <dt>Model</dt><dd>{a.default_model || '—'}</dd>
          <dt>Provider</dt><dd>{a.model_provider || '—'}</dd>
        </dl>
      </div>

      <div className="an-ins-section">
        <h4>Risk</h4>
        <dl className="an-kv">
          <dt>Risk level</dt><dd><b style={{color: a.risk_level==='high' ? 'var(--err)' : a.risk_level==='medium' ? 'var(--warn)' : 'var(--ok)'}}>{a.risk_level}</b></dd>
          <dt>Approval req'd</dt>
          <dd>{(a.approval_required_actions || []).length
              ? a.approval_required_actions.join(', ')
              : 'none'}</dd>
          <dt>Memory access</dt><dd>{a.memory_access_level || '—'}</dd>
        </dl>
      </div>
    </div>
  );
}

function PermsTab({ a }) {
  return (
    <div>
      <div className="an-ins-section">
        <h4>Capabilities</h4>
        <div className="an-radio-row">
          {(a.capabilities || []).map(c => (
            <span key={c} className="an-radio-chip">{c}</span>
          ))}
          {!(a.capabilities||[]).length && <em style={{color:'var(--fg-3)', fontSize:11}}>none</em>}
        </div>
      </div>
      <div className="an-ins-section">
        <h4>Permissions</h4>
        <div className="an-radio-row">
          {(a.permissions || []).map(p => (
            <span key={p} className="an-radio-chip">{p}</span>
          ))}
          {!(a.permissions||[]).length && <em style={{color:'var(--fg-3)', fontSize:11}}>none</em>}
        </div>
      </div>
      <div className="an-ins-section">
        <h4>Approval-required actions</h4>
        <div className="an-radio-row">
          {(a.approval_required_actions || []).map(p => (
            <span key={p} className="an-radio-chip" style={{borderColor:'oklch(0.55 0.16 25 / 0.4)', color:'oklch(0.78 0.16 25)'}}>{p}</span>
          ))}
          {!(a.approval_required_actions||[]).length && <em style={{color:'var(--fg-3)', fontSize:11}}>none</em>}
        </div>
      </div>
      <div className="an-ins-section">
        <h4>Gateway Routes</h4>
        <div className="an-radio-row">
          {(a.handoff_targets || []).map(p => (
            <span key={p} className="an-radio-chip">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EnginesTab({ a, snap, onConnectEngine }) {
  const all = snap.agents.filter(x => ['engine','tool','integration','memory'].includes(x.kind));
  const connected = (a.engines || []);
  return (
    <div>
      <div className="an-ins-section">
        <h4>Connected engines · {connected.length}</h4>
        {connected.length === 0 && <em style={{color:'var(--fg-3)', fontSize:11}}>No engines connected.</em>}
        {connected.map(eid => {
          const e = snap.agents.find(x => x.id === eid);
          if (!e) return null;
          return (
            <div key={eid} style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'6px 8px', borderRadius:6,
              background:'rgba(255,255,255,0.03)', border:'1px solid var(--line-2)',
              marginBottom:6,
            }}>
              <span style={{flex:1, fontSize:12}}>{e.display_name}</span>
              <span className="an-sev-badge" data-sev={e.status==='degraded'?'crit':e.status==='online'?'ok':'warn'}>
                {e.status}
              </span>
              <code style={{fontSize:10, color:'var(--fg-3)'}}>{e.transport}</code>
              {!a.locked && (
                <button className="an-btn" style={{padding:'2px 6px'}}
                        onClick={() => window.AgentRegistry.disconnectEngine(a.id, eid)}>
                  <I.X size={10}/>
                </button>
              )}
            </div>
          );
        })}
        <button className="an-btn primary" style={{marginTop:8}}
                onClick={() => onConnectEngine(a.id)}>
          <I.Plus size={12}/> Connect engine
        </button>
      </div>

      <div className="an-ins-section">
        <h4>Available engines · catalogue</h4>
        {all.filter(e => !connected.includes(e.id)).map(e => (
          <div key={e.id} style={{
            display:'flex', alignItems:'center', gap:8, padding:'4px 8px', fontSize:11, color:'var(--fg-2)',
          }}>
            <span style={{flex:1}}>{e.display_name}</span>
            <code style={{fontSize:10, color:'var(--fg-3)'}}>{e.transport}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketsTab({ a, tickets, snap, onAssignTicket }) {
  return (
    <div>
      <div className="an-ins-section">
        <h4>Active tickets · {tickets.length}</h4>
        {tickets.length === 0 && <em style={{color:'var(--fg-3)', fontSize:11}}>No tickets currently owned.</em>}
        {tickets.map(t => (
          <div key={t.id} style={{
            padding:'8px 10px', marginBottom:6, borderRadius:6,
            background:'rgba(255,255,255,0.03)', border:'1px solid var(--line-2)',
          }}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <code style={{fontSize:10, color:'var(--fg-3)'}}>{t.id}</code>
              <span className="an-sev-badge" data-sev={t.severity==='high'?'crit':t.severity==='medium'?'warn':'ok'}>
                {t.priority}
              </span>
              {t.requires_approval && <span className="an-sev-badge" data-sev="warn">approval</span>}
            </div>
            <div style={{fontSize:12, color:'var(--fg-0)'}}>{t.title}</div>
            <div style={{fontSize:11, color:'var(--fg-2)', marginTop:4}}>
              Step: <b>{t.step}</b> · Trail: {t.trail.length}
            </div>
            <div style={{display:'flex', gap:4, marginTop:6, flexWrap:'wrap'}}>
              {(a.handoff_targets || []).filter(h => h !== a.id).map(target => (
                <button key={target} className="an-btn" style={{padding:'2px 6px', fontSize:10}}
                        onClick={() => window.AgentRegistry.handoff(t.id, a.id, target, `manual Gateway Route from ${a.display_name}`)}>
                  → {target}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="an-ins-section">
        <h4>Assign Gateway Flow</h4>
        <button className="an-btn" onClick={onAssignTicket}>
          <I.Plus size={12}/> Assign existing Gateway Flow to {a.display_name}
        </button>
      </div>
    </div>
  );
}

function AuditTab({ events }) {
  return (
    <div className="an-ins-section">
      <h4>Recent Brain Sync events · {events.length}</h4>
      {events.length === 0 && <em style={{color:'var(--fg-3)', fontSize:11}}>No events.</em>}
      {events.map(e => (
        <div key={e.id} className="an-evt" data-severity={e.severity || ''} style={{padding:'4px 0', gridTemplateColumns:'56px 100px 1fr'}}>
          <time>{e.at}</time>
          <span className="kind">{e.kind}</span>
          <span className="body">{e.note || ''} <small>({e.actor} → {e.target})</small></span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AgentInspector });
