// ============================================================
// Agent Network modals — Add Agent, Connect Engine, Approval,
// Assign Ticket, Context Menu. All mutations go through
// window.AgentRegistry. No production calls.
// ============================================================

// -----------------------------------------------------------
// Add Agent wizard — 6 steps. Mirrors the spec flow:
// type → tier → role/perms → engines → supervisor → save
// -----------------------------------------------------------
function AddAgentWizard({ open, onClose }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({
    display_name:'', system_name:'', kind:'agent', tier:'specialist',
    role:'', description:'', cluster:'OpenClaw',
    permissions:[], capabilities:[], engines:[],
    reports_to:'tony', risk_level:'low',
    approval_required_actions:[],
    default_model:'anthropic/claude-haiku-4.5',
  });
  React.useEffect(() => { if (open) { setStep(1); } }, [open]);
  if (!open) return null;

  const upd = (patch) => setForm(f => ({ ...f, ...patch }));
  const toggleArr = (key, v) => setForm(f => {
    const has = (f[key] || []).includes(v);
    return { ...f, [key]: has ? f[key].filter(x => x !== v) : [...(f[key]||[]), v] };
  });

  const snap = window.AgentRegistry.useRegistry?.() ||
               (window.AgentRegistry.subscribe && (() => null)) || {};
  const engines = (window.AgentRegistry.getEngines && window.AgentRegistry.getEngines()) || [];
  const commanders = (window.AgentRegistry.getCommanders && window.AgentRegistry.getCommanders()) || [];

  const next = () => setStep(s => Math.min(6, s+1));
  const prev = () => setStep(s => Math.max(1, s-1));

  const save = () => {
    window.AgentRegistry.createAgent({
      ...form,
      created_by: 'luis',
    });
    onClose();
  };

  const STEPS = [
    'Type', 'Tier', 'Role & perms', 'Engines', 'Supervisor', 'Save',
  ];

  return (
    <div className="an-modal-scrim" onClick={onClose}>
      <div className="an-modal" onClick={e => e.stopPropagation()}>
        <div className="an-modal-header">
          <I.Plus size={14}/>
          <h3>Add agent</h3>
          <span className="an-mock-chip">owner approval required</span>
          <span className="spacer"/>
          <button className="an-btn" onClick={onClose}><I.X size={12}/></button>
        </div>

        <div className="an-modal-body">
          <div className="an-steps">
            {STEPS.map((label, i) => {
              const idx = i+1;
              const cls = idx === step ? 'active' : idx < step ? 'done' : '';
              return (
                <React.Fragment key={label}>
                  <span className={`an-step ${cls}`}>{idx}. {label}</span>
                  {i < STEPS.length-1 && <span className="an-step-sep">›</span>}
                </React.Fragment>
              );
            })}
          </div>

          {step === 1 && (
            <div>
              <div className="an-field">
                <label>Display name</label>
                <input className="an-input" value={form.display_name}
                       onChange={e => upd({ display_name: e.target.value, system_name: e.target.value.toLowerCase().replace(/\s+/g,'-') })}
                       placeholder="e.g. Atlas, Orion, Beacon"/>
                <div className="hint">Human-readable. The system_name is auto-derived but editable.</div>
              </div>
              <div className="an-row">
                <div className="an-field">
                  <label>System name</label>
                  <input className="an-input" value={form.system_name}
                         onChange={e => upd({ system_name: e.target.value })}/>
                </div>
                <div className="an-field">
                  <label>Cluster</label>
                  <select className="an-select" value={form.cluster}
                          onChange={e => upd({ cluster: e.target.value })}>
                    <option>ClaudeClaw</option>
                    <option>OpenClaw</option>
                    <option>Agent Zero</option>
                  </select>
                </div>
              </div>
              <div className="an-field">
                <label>Type</label>
                <div className="an-radio-row">
                  {['agent','engine','tool','integration','memory','channel'].map(k => (
                    <span key={k} className={`an-radio-chip ${form.kind===k?'active':''}`}
                          onClick={() => upd({ kind: k })}>{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="an-field">
                <label>Tier</label>
                <div className="an-radio-row">
                  {['commander','lieutenant','specialist','worker','tool'].map(t => (
                    <span key={t} className={`an-radio-chip ${form.tier===t?'active':''}`}
                          onClick={() => upd({ tier: t })}>{t}</span>
                  ))}
                </div>
                <div className="hint">Promoting to <b>commander</b> requires an owner approval (high severity).</div>
              </div>
              {form.tier === 'commander' && (
                <div className="an-approval-banner" data-sev="high" style={{borderRadius:6, border:'1px solid oklch(0.55 0.16 25 / 0.4)'}}>
                  ⚠ This tier requires owner approval. The agent will be created at lieutenant level
                  and a high-severity approval ticket will be opened to promote it.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="an-field">
                <label>Role</label>
                <input className="an-input" value={form.role}
                       onChange={e => upd({ role: e.target.value })}
                       placeholder="e.g. PR reviewer, Workflow specialist"/>
              </div>
              <div className="an-field">
                <label>Description</label>
                <textarea className="an-textarea" value={form.description}
                          onChange={e => upd({ description: e.target.value })}/>
              </div>
              <div className="an-field">
                <label>Capabilities</label>
                <div className="an-radio-row">
                  {['plan','review','recommend','propose','compose','route','execute','flag','optimize'].map(c => (
                    <span key={c} className={`an-radio-chip ${form.capabilities.includes(c)?'active':''}`}
                          onClick={() => toggleArr('capabilities', c)}>{c}</span>
                  ))}
                </div>
              </div>
              <div className="an-field">
                <label>Risk level</label>
                <div className="an-radio-row">
                  {['low','medium','high'].map(r => (
                    <span key={r} className={`an-radio-chip ${form.risk_level===r?'active':''}`}
                          onClick={() => upd({ risk_level: r })}>{r}</span>
                  ))}
                </div>
                <div className="hint">High-risk agents require approval for protected actions.</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="an-field">
                <label>Engines</label>
                <div className="hint">Bridge transports: local, REST, MCP, webhook, queue, script, cloud.</div>
                <div style={{marginTop:10}}>
                  {engines.map(e => (
                    <label key={e.id} style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'6px 8px', borderRadius:6,
                      background:'rgba(255,255,255,0.03)',
                      border:'1px solid var(--line-2)', marginBottom:4,
                      cursor:'pointer', fontSize:12,
                    }}>
                      <input type="checkbox" checked={form.engines.includes(e.id)}
                             onChange={() => toggleArr('engines', e.id)}/>
                      <span style={{flex:1}}>{e.display_name}</span>
                      <code style={{fontSize:10, color:'var(--fg-3)'}}>{e.transport}</code>
                      <span className="an-sev-badge" data-sev={e.status==='degraded'?'crit':'ok'}>{e.status}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="an-field">
                <label>Reports to (supervisor)</label>
                <select className="an-select" value={form.reports_to}
                        onChange={e => upd({ reports_to: e.target.value })}>
                  {commanders.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name} · {c.tier}</option>
                  ))}
                </select>
                <div className="hint">Defaults to Tony. Any current commander may supervise. Future commanders appear here automatically.</div>
              </div>
              <div className="an-field">
                <label>Default model</label>
                <select className="an-select" value={form.default_model}
                        onChange={e => upd({ default_model: e.target.value })}>
                  <option>anthropic/claude-haiku-4.5</option>
                  <option>anthropic/claude-sonnet-4.5</option>
                  <option>anthropic/claude-opus-4.5</option>
                </select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <div className="an-ins-section">
                <h4>Review</h4>
                <dl className="an-kv">
                  <dt>Display</dt><dd><b>{form.display_name || '—'}</b></dd>
                  <dt>System</dt><dd>{form.system_name || '—'}</dd>
                  <dt>Type</dt><dd>{form.kind}</dd>
                  <dt>Tier</dt><dd>{form.tier}</dd>
                  <dt>Role</dt><dd>{form.role || '—'}</dd>
                  <dt>Cluster</dt><dd>{form.cluster}</dd>
                  <dt>Risk</dt><dd>{form.risk_level}</dd>
                  <dt>Engines</dt><dd>{form.engines.join(', ') || 'none'}</dd>
                  <dt>Reports to</dt><dd>{form.reports_to}</dd>
                  <dt>Capabilities</dt><dd>{form.capabilities.join(', ') || 'none'}</dd>
                </dl>
              </div>
              <div className="an-approval-banner" data-sev="medium" style={{borderRadius:6, marginTop:8, border:'1px solid var(--line-2)'}}>
                Saving creates the record in the <b>mock</b> registry only. Production save requires
                <code style={{margin:'0 4px'}}>POST /api/agents</code> (see spec).
              </div>
            </div>
          )}
        </div>

        <div className="an-modal-footer">
          {step > 1 && <button className="an-btn" onClick={prev}>← Back</button>}
          <span style={{flex:1}}/>
          <button className="an-btn" onClick={onClose}>Cancel</button>
          {step < 6 && <button className="an-btn primary" onClick={next}
            disabled={step===1 && !form.display_name}>Next →</button>}
          {step === 6 && <button className="an-btn primary" onClick={save}>
            <I.Check size={12}/> Save agent
          </button>}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// Connect Engine — pick from catalogue OR add new (transport,
// endpoint, perms, cost). All transports listed.
// -----------------------------------------------------------
function EngineConnectModal({ open, agentId, onClose }) {
  const [mode, setMode] = React.useState('existing'); // existing | new
  const [pick, setPick] = React.useState(null);
  const [form, setForm] = React.useState({
    display_name:'', system_name:'', transport:'rest', endpoint:'',
    permissions_required:[], cost_today:0, risk_level:'low',
  });

  if (!open) return null;
  const engines = (window.AgentRegistry.getEngines && window.AgentRegistry.getEngines()) || [];
  const agent = window.AgentRegistry.getAgent(agentId);
  if (!agent) return null;
  const available = engines.filter(e => !(agent.engines||[]).includes(e.id));

  const submit = () => {
    if (mode === 'existing' && pick) {
      const e = engines.find(x => x.id === pick);
      window.AgentRegistry.connectEngine(agentId, { id:e.id, transport:e.transport, endpoint:e.endpoint });
      onClose();
    } else if (mode === 'new' && form.display_name && form.endpoint) {
      // create the engine record, then connect
      const created = window.AgentRegistry.createAgent({
        display_name: form.display_name,
        system_name: form.system_name || form.display_name.toLowerCase().replace(/\s+/g,'-'),
        kind: 'engine', tier: 'tool',
        role: form.transport.toUpperCase() + ' engine',
      });
      // patch transport/endpoint after creation (mock only)
      const reg = window.AgentRegistry;
      reg.subscribe && reg.subscribe(()=>{}); // no-op
      // Direct mutation via internal — we use connectEngine which records the link
      reg.connectEngine(agentId, { id: created.id, transport: form.transport, endpoint: form.endpoint });
      onClose();
    }
  };

  return (
    <div className="an-modal-scrim" onClick={onClose}>
      <div className="an-modal" onClick={e => e.stopPropagation()}>
        <div className="an-modal-header">
          <I.Plug size={14}/>
          <h3>Connect engine to {agent.display_name}</h3>
          <span className="an-mock-chip">approval-gated bridge</span>
          <span className="spacer"/>
          <button className="an-btn" onClick={onClose}><I.X size={12}/></button>
        </div>
        <div className="an-modal-body">
          <div className="an-radio-row" style={{marginBottom:14}}>
            <span className={`an-radio-chip ${mode==='existing'?'active':''}`} onClick={()=>setMode('existing')}>Pick from catalogue</span>
            <span className={`an-radio-chip ${mode==='new'?'active':''}`} onClick={()=>setMode('new')}>Register new engine</span>
          </div>

          {mode === 'existing' && (
            <div>
              {available.length === 0 && <em style={{color:'var(--fg-3)', fontSize:11}}>All engines already connected.</em>}
              {available.map(e => (
                <label key={e.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                  border:'1px solid var(--line-2)', borderRadius:8, marginBottom:6, cursor:'pointer',
                  background: pick===e.id ? 'var(--accent-soft)' : 'transparent',
                }}>
                  <input type="radio" checked={pick===e.id} onChange={()=>setPick(e.id)}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12}}>{e.display_name}</div>
                    <div style={{fontSize:10, color:'var(--fg-3)'}}>{e.endpoint}</div>
                  </div>
                  <code style={{fontSize:10, color:'var(--fg-2)'}}>{e.transport}</code>
                  <span className="an-sev-badge" data-sev={e.status==='degraded'?'crit':'ok'}>{e.status}</span>
                </label>
              ))}
            </div>
          )}

          {mode === 'new' && (
            <div>
              <div className="an-row">
                <div className="an-field">
                  <label>Engine name</label>
                  <input className="an-input" value={form.display_name}
                         onChange={e=>setForm({...form, display_name:e.target.value})}/>
                </div>
                <div className="an-field">
                  <label>Transport</label>
                  <select className="an-select" value={form.transport}
                          onChange={e=>setForm({...form, transport:e.target.value})}>
                    {window.AgentRegistry.TRANSPORTS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="an-field">
                <label>Endpoint</label>
                <input className="an-input" value={form.endpoint}
                       onChange={e=>setForm({...form, endpoint:e.target.value})}
                       placeholder="https://… or mcp://… or unix:///… or amqp://…"/>
                <div className="hint">Universal bridge accepts: local · rest · mcp · webhook · queue · script · cloud.</div>
              </div>
              <div className="an-field">
                <label>Risk level</label>
                <div className="an-radio-row">
                  {['low','medium','high'].map(r => (
                    <span key={r} className={`an-radio-chip ${form.risk_level===r?'active':''}`}
                          onClick={()=>setForm({...form, risk_level:r})}>{r}</span>
                  ))}
                </div>
              </div>
              {form.risk_level === 'high' && (
                <div className="an-approval-banner" data-sev="high" style={{borderRadius:6, border:'1px solid oklch(0.55 0.16 25 / 0.4)'}}>
                  ⚠ High-risk engine. Connection will require owner approval before any agent can call it.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="an-modal-footer">
          <span style={{flex:1}}/>
          <button className="an-btn" onClick={onClose}>Cancel</button>
          <button className="an-btn primary" onClick={submit}
                  disabled={mode==='existing' ? !pick : !form.display_name || !form.endpoint}>
            <I.Plug size={12}/> Connect
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// Approval Modal — three severities
// -----------------------------------------------------------
function ApprovalModal({ approval, onClose }) {
  const [reason, setReason] = React.useState('');
  if (!approval) return null;
  const sev = approval.severity;

  return (
    <div className="an-modal-scrim" onClick={onClose}>
      <div className="an-modal an-approval" data-sev={sev} onClick={e=>e.stopPropagation()}>
        <div className="an-approval-banner" data-sev={sev}>
          {sev === 'high' && <>⛔ <b>HIGH SEVERITY</b> · Owner approval required · Reason mandatory</>}
          {sev === 'medium' && <>⚠ <b>MEDIUM SEVERITY</b> · Approval required</>}
          {sev === 'low' && <>🔒 <b>LOW SEVERITY</b> · Quick confirm</>}
        </div>
        <div className="an-modal-header">
          <I.Shield size={14}/>
          <h3>Approval — {approval.action}</h3>
          <span className="spacer"/>
          <button className="an-btn" onClick={onClose}><I.X size={12}/></button>
        </div>
        <div className="an-modal-body">
          <dl className="an-kv">
            <dt>Approval ID</dt><dd>{approval.id}</dd>
            <dt>Requested by</dt><dd>{approval.requested_by}</dd>
            <dt>Target</dt><dd>{approval.target}</dd>
            <dt>Action</dt><dd><b>{approval.action}</b></dd>
            <dt>Severity</dt><dd><b style={{color: sev==='high'?'var(--err)':sev==='medium'?'var(--warn)':'var(--ok)'}}>{sev}</b></dd>
            <dt>Ticket</dt><dd>{approval.ticket || '—'}</dd>
            <dt>Reason</dt><dd>{approval.reason}</dd>
            <dt>Resolves in</dt><dd>{approval.resolves_in_min} min</dd>
          </dl>
          {sev === 'high' && (
            <div className="an-field" style={{marginTop:14}}>
              <label>Owner reason (required for high severity)</label>
              <textarea className="an-textarea" value={reason}
                        onChange={e=>setReason(e.target.value)}
                        placeholder="Why are you approving this protected action?"/>
            </div>
          )}
        </div>
        <div className="an-modal-footer">
          <span style={{flex:1, fontSize:11, color:'var(--fg-3)'}}>
            <span className="an-mock-chip">approval-gated</span> Protected approvals require the production approval API.
          </span>
          <button className="an-btn danger" onClick={() => {
            window.AgentRegistry.resolveApproval(approval.id, 'denied', 'luis');
            onClose();
          }}>
            <I.X size={12}/> Deny
          </button>
          <button className="an-btn primary"
                  disabled={sev==='high' && !reason.trim()}
                  onClick={() => {
            window.AgentRegistry.resolveApproval(approval.id, 'approved', 'luis');
            // If the approval was a tier promotion, apply it now
            if (approval.action === 'promote_to_commander') {
              window.AgentRegistry.promote(approval.target, 'commander');
            }
            if (approval.action === 'promote_self') {
              window.AgentRegistry.promote(approval.target, 'commander');
            }
            if (approval.action === 'retire_agent') {
              window.AgentRegistry.retireAgent(approval.target, reason || 'owner-approved retire');
            }
            onClose();
          }}>
            <I.Check size={12}/> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// Assign Ticket modal
// -----------------------------------------------------------
function AssignTicketModal({ open, agentId, onClose }) {
  const snap = window.AgentRegistry.useRegistry?.() || { tickets: [] };
  const [pick, setPick] = React.useState(null);
  const [reason, setReason] = React.useState('');
  if (!open) return null;
  const agent = window.AgentRegistry.getAgent(agentId);
  if (!agent) return null;
  const candidates = (snap.tickets || []).filter(t => t.current_owner !== agentId);

  return (
    <div className="an-modal-scrim" onClick={onClose}>
      <div className="an-modal" onClick={e=>e.stopPropagation()}>
        <div className="an-modal-header">
          <I.Tasks size={14}/>
          <h3>Assign ticket to {agent.display_name}</h3>
          <span className="spacer"/>
          <button className="an-btn" onClick={onClose}><I.X size={12}/></button>
        </div>
        <div className="an-modal-body">
          {candidates.map(t => (
            <label key={t.id} style={{
              display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
              border:'1px solid var(--line-2)', borderRadius:8, marginBottom:6, cursor:'pointer',
              background: pick===t.id ? 'var(--accent-soft)' : 'transparent',
            }}>
              <input type="radio" checked={pick===t.id} onChange={()=>setPick(t.id)} style={{marginTop:3}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12, color:'var(--fg-0)'}}>{t.title}</div>
                <div style={{fontSize:10, color:'var(--fg-3)', marginTop:2}}>
                  <code>{t.id}</code> · owner: {t.current_owner} · step: {t.step}
                </div>
              </div>
              <span className="an-sev-badge" data-sev={t.priority==='high'?'crit':'warn'}>{t.priority}</span>
            </label>
          ))}
          <div className="an-field" style={{marginTop:14}}>
            <label>Reason</label>
            <input className="an-input" value={reason} onChange={e=>setReason(e.target.value)}
                   placeholder="Why is this being reassigned?"/>
          </div>
        </div>
        <div className="an-modal-footer">
          <span style={{flex:1}}/>
          <button className="an-btn" onClick={onClose}>Cancel</button>
          <button className="an-btn primary" disabled={!pick} onClick={() => {
            window.AgentRegistry.assignTicket(pick, agentId, reason || 'manual reassignment');
            onClose();
          }}>
            <I.Check size={12}/> Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// Right-click context menu
// -----------------------------------------------------------
function ContextMenu({ ctx, onClose, onConnectEngine, onAssignTicket, onApprove }) {
  if (!ctx) return null;
  const a = window.AgentRegistry.getAgent(ctx.agentId);
  if (!a) return null;
  const isAgent = a.kind === 'agent';
  const close = () => onClose();

  React.useEffect(() => {
    const h = () => close();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  return (
    <div className="an-ctx" style={{ left: ctx.x, top: ctx.y }} onClick={e=>e.stopPropagation()}>
      <div className="an-ctx-label">{a.display_name} · {a.tier}</div>
      <div className="an-ctx-sep"/>
      {isAgent && !a.locked && a.tier !== 'commander' && (
        <div className="an-ctx-item" onClick={() => {
          window.AgentRegistry.requestApproval('promote_to_commander', {
            severity:'high', requested_by:'luis', target:a.id,
            reason:`Promote ${a.display_name} to commander`, resolves_in_min:60,
          });
          onApprove?.();
          close();
        }}>↑ Promote to commander <span style={{marginLeft:'auto', color:'var(--fg-3)', fontSize:10}}>approval</span></div>
      )}
      {isAgent && !a.locked && a.tier !== 'lieutenant' && (
        <div className="an-ctx-item" onClick={() => { window.AgentRegistry.setTier(a.id, 'lieutenant'); close(); }}>
          → Move to lieutenant
        </div>
      )}
      {isAgent && !a.locked && a.tier !== 'specialist' && (
        <div className="an-ctx-item" onClick={() => { window.AgentRegistry.setTier(a.id, 'specialist'); close(); }}>
          → Move to specialist
        </div>
      )}
      {isAgent && !a.locked && a.tier !== 'worker' && (
        <div className="an-ctx-item" onClick={() => { window.AgentRegistry.setTier(a.id, 'worker'); close(); }}>
          ↓ Demote to worker
        </div>
      )}
      <div className="an-ctx-sep"/>
      <div className="an-ctx-item" onClick={() => { onConnectEngine(a.id); close(); }}>
        <I.Plug size={12}/> Connect engine
      </div>
      {isAgent && (
        <div className="an-ctx-item" onClick={() => { onAssignTicket(a.id); close(); }}>
          <I.Tasks size={12}/> Assign ticket
        </div>
      )}
      <div className="an-ctx-item" onClick={() => {
        window.AgentRegistry.setStatus(a.id, a.status === 'online' ? 'offline' : 'online');
        close();
      }}>
        ⏻ Toggle online / offline
      </div>
      <div className="an-ctx-sep"/>
      {isAgent && !a.locked && a.status !== 'retired' && (
        <div className="an-ctx-item danger" onClick={() => {
          window.AgentRegistry.requestApproval('retire_agent', {
            severity:'high', requested_by:'luis', target:a.id,
            reason:`Retire ${a.display_name}`, resolves_in_min:60,
          });
          onApprove?.();
          close();
        }}>
          <I.X size={12}/> Retire (requires approval)
        </div>
      )}
      {isAgent && !a.locked && a.status === 'retired' && (
        <div className="an-ctx-item" onClick={() => { window.AgentRegistry.restoreAgent(a.id); close(); }}>
          ↺ Restore
        </div>
      )}
      {a.locked && (
        <div className="an-ctx-item disabled">🔒 Locked — owner-only</div>
      )}
    </div>
  );
}

Object.assign(window, { AddAgentWizard, EngineConnectModal, ApprovalModal, AssignTicketModal, ContextMenu });
