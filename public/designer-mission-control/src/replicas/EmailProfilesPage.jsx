// ============================================================
// EmailProfilesPage — admin surface for sender profiles, addresses, routing.
// Every button wired to window.MockApi OR clearly disabled with honest label.
// ============================================================

// ─── Toast helper (tiny inline toast system) ────────────────────
const _toastEvt = new EventTarget();
function pushToast(kind, message){ _toastEvt.dispatchEvent(new CustomEvent('t', { detail:{ kind, message, id:Math.random() } })); }

function ToastHost(){
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    const h = (e) => {
      const t = e.detail;
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3800);
    };
    _toastEvt.addEventListener('t', h);
    return () => _toastEvt.removeEventListener('t', h);
  }, []);
  return (
    <div style={{position:'fixed', right:16, bottom:16, zIndex:200, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none'}}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents:'auto',
          padding:'10px 14px', borderRadius:8,
          background: t.kind==='err' ? 'rgba(239, 68, 68, 0.14)' : t.kind==='warn' ? 'rgba(251, 191, 36, 0.14)' : 'rgba(34, 197, 94, 0.14)',
          border: `1px solid ${t.kind==='err' ? 'rgba(239, 68, 68, 0.35)' : t.kind==='warn' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
          color:'var(--fg-0)', fontSize:12, maxWidth:340, boxShadow:'0 10px 30px rgba(0,0,0,0.35)',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Status pill (honest labels) ────────────────────────────────
function ProfileStatus({ status }){
  const map = {
    active:                    { cls:'ok',   label:'Active',              kind:'live' },
    needs_credentials:         { cls:'warn', label:'Credential missing',  kind:'warn' },
    api_not_wired:             { cls:'err',  label:'API not wired yet',   kind:'err'  },
    verification_not_implemented: { cls:'warn', label:'Verification not implemented', kind:'warn' },
    needs_verification:        { cls:'warn', label:'Needs verification',  kind:'warn' },
    verified:                  { cls:'ok',   label:'Verified',            kind:'live' },
    unassigned:                { cls:'err',  label:'Unassigned',          kind:'err'  },
  };
  const m = map[status] || { cls:'muted', label:status, kind:'muted' };
  return (
    <span className="status-pill">
      <StatusDot s={m.kind}/>
      <span style={{textTransform:'capitalize'}}>{m.label}</span>
    </span>
  );
}

// ─── Provider glyph (2-letter mark, deterministic color) ────────
function ProviderMark({ type }){
  const colors = {
    zoom:'#2D8CFF', m365:'#D83B01', smtp:'#64748b', ses:'#FF9900',
    postmark:'#FFDD00', sendgrid:'#1A82E2', agentmail:'#a78bfa', generic:'#94a3b8',
  };
  const names = {
    zoom:'Zoom', m365:'Microsoft 365', smtp:'Custom SMTP', ses:'AWS SES',
    postmark:'Postmark', sendgrid:'SendGrid', agentmail:'AgentMail', generic:'Generic',
  };
  const initials = (names[type] || type).split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:22, height:22, borderRadius:5,
      background: (colors[type] || '#64748b') + '22',
      border: '1px solid ' + (colors[type] || '#64748b') + '55',
      color: colors[type] || '#94a3b8',
      fontSize:9, fontWeight:700, letterSpacing:0.3,
      fontFamily:'var(--mono)', flexShrink:0,
    }}>{initials}</span>
  );
}

// ─── Add / Edit Profile modal ───────────────────────────────────
function ProfileModal({ mode, initial, onClose, onSave }){
  const [form, setForm] = React.useState(() => initial || {
    profile_name:'', provider_type:'smtp', from_address:'', purpose:'Transactional',
  });
  const set = (k,v) => setForm(f => ({...f, [k]:v}));
  const valid = form.profile_name.trim() && form.from_address.includes('@');
  const isAgentMail = form.provider_type === 'agentmail';
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:520, zIndex:211}}>
        <div className="modal-head">
          <h3 style={{margin:0, fontSize:15, color:'var(--fg-0)'}}>{mode==='edit' ? 'Edit profile' : 'Add email sender profile'}</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body vstack" style={{gap:14}}>
          <label className="field">
            <span>Profile name</span>
            <input className="input" value={form.profile_name} onChange={e=>set('profile_name', e.target.value)} placeholder="e.g. Marketing outbound"/>
          </label>
          <label className="field">
            <span>Provider</span>
            <select className="select" value={form.provider_type} onChange={e=>set('provider_type', e.target.value)}>
              {window.MockApi.PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.hint}</option>
              ))}
            </select>
          </label>
          {isAgentMail && (
            <div style={{padding:'8px 10px', borderRadius:6, background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.28)', color:'var(--fg-1)', fontSize:12}}>
              <NotWiredBadge label="api not wired"/> &nbsp;AgentMail backend is not connected yet. Profile will save but will not send mail until wired.
            </div>
          )}
          <label className="field">
            <span>From address</span>
            <input className="input" value={form.from_address} onChange={e=>set('from_address', e.target.value)} placeholder="no-reply@yourdomain.com"/>
          </label>
          <label className="field">
            <span>Purpose</span>
            <select className="select" value={form.purpose} onChange={e=>set('purpose', e.target.value)}>
              <option>Invitations</option>
              <option>System Notifications</option>
              <option>Support / Alerts</option>
              <option>Transactional</option>
              <option>Agent outbound</option>
              <option>Marketing</option>
            </select>
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={()=>onSave(form)}>
            {mode==='edit' ? 'Save changes' : 'Create profile'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Confirm dialog ─────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, danger, onClose, onConfirm }){
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:420, zIndex:211}}>
        <div className="modal-head">
          <h3 style={{margin:0, fontSize:15, color:'var(--fg-0)'}}>{title}</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body">
          <p style={{fontSize:13, color:'var(--fg-1)', lineHeight:1.55, margin:0}}>{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger?'danger':'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

// ─── Add Address modal ──────────────────────────────────────────
function AddressModal({ onClose, onSave }){
  const [email, setEmail] = React.useState('');
  const valid = email.includes('@') && email.includes('.');
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:440, zIndex:211}}>
        <div className="modal-head" style={{alignItems:'center'}}><h3 style={{margin:0, fontSize:15, color:'var(--fg-0)'}}>Add outgoing address</h3><button className="icon-btn" onClick={onClose}><I.X size={14}/></button></div>
        <div className="modal-body vstack" style={{gap:10}}>
          <label className="field">
            <span>Email address</span>
            <input className="input" autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@domain.com"/>
          </label>
          <div style={{fontSize:11, color:'var(--fg-2)'}}>
            <NotWiredBadge label="verification not implemented"/> DKIM/SPF verification is not wired yet. Address will be stored as "needs verification".
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={()=>onSave({ email })}>Add address</button>
        </div>
      </div>
    </>
  );
}

// ─── Routing editor drawer ──────────────────────────────────────
function RoutingEditor({ routing, profiles, onClose, onSave }){
  const [rows, setRows] = React.useState(() => routing.map(r => ({...r})));
  const updateRow = (id, patch) => setRows(rs => rs.map(r => r.id === id ? {...r, ...patch} : r));
  const save = async () => {
    for (const r of rows){
      const orig = routing.find(x => x.id === r.id);
      if (orig && orig.assigned_profile_id !== r.assigned_profile_id){
        await window.MockApi.updateRouting(r.id, { assigned_profile_id: r.assigned_profile_id });
      }
    }
    pushToast('ok', 'Routing rules saved');
    onSave();
  };
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:720, zIndex:211}}>
        <div className="modal-head">
          <h3 style={{margin:0, fontSize:15, color:'var(--fg-0)'}}>Edit routing rules</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body">
          <p style={{fontSize:12, color:'var(--fg-2)', margin:'0 0 12px'}}>Choose which sender profile handles each outbound email type.</p>
          <table className="tbl">
            <thead><tr><th>Email type</th><th style={{width:260}}>Assigned profile</th><th style={{width:220}}>From address</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const prof = profiles.find(p => p.id === r.assigned_profile_id);
                return (
                  <tr key={r.id}>
                    <td style={{color:'var(--fg-0)'}}>{r.email_type}</td>
                    <td>
                      <select className="select" value={r.assigned_profile_id || ''} onChange={e=>updateRow(r.id, { assigned_profile_id:e.target.value })}>
                        <option value="">— Unassigned —</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.profile_name} ({p.from_address})</option>
                        ))}
                      </select>
                    </td>
                    <td className="mono xsmall muted">{prof ? prof.from_address : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save routing</button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ──────────────────────────────────────────────────
function EmailProfilesPage(){
  const [profiles, setProfiles]   = React.useState([]);
  const [addresses, setAddresses] = React.useState([]);
  const [routing, setRouting]     = React.useState([]);
  const [filter, setFilter]       = React.useState('all');
  const [modal, setModal]         = React.useState(null); // { kind, data }

  const reload = React.useCallback(async () => {
    const [p, a, r] = await Promise.all([
      window.MockApi.listProfiles(),
      window.MockApi.listAddresses(),
      window.MockApi.listRouting(),
    ]);
    setProfiles(p); setAddresses(a); setRouting(r);
  }, []);

  React.useEffect(() => {
    reload();
    const unsub = window.MockApi.subscribe(reload);
    return unsub;
  }, [reload]);

  // Derived stats
  const activeCount = profiles.filter(p => p.status === 'active').length;
  const verifiedCount = addresses.filter(a => a.verified).length;
  const needsCredCount = profiles.filter(p => p.status === 'needs_credentials' || p.status === 'api_not_wired').length;
  const defaultProfile = profiles.find(p => p.is_default);

  const visibleProfiles = React.useMemo(() => {
    if (filter === 'all') return profiles;
    if (filter === 'active') return profiles.filter(p => p.status === 'active');
    if (filter === 'needs') return profiles.filter(p => p.status === 'needs_credentials');
    if (filter === 'notwired') return profiles.filter(p => p.status === 'api_not_wired');
    return profiles;
  }, [profiles, filter]);

  // Actions
  const handleAdd    = () => setModal({ kind:'add' });
  const handleEdit   = (p) => setModal({ kind:'edit', data:p });
  const handleDelete = (p) => setModal({ kind:'delete', data:p });
  const handleRotate = (p) => setModal({ kind:'rotate', data:p });
  const handleAddAddr = () => setModal({ kind:'addAddr' });
  const handleEditRouting = () => setModal({ kind:'routing' });

  const handleTest = async (p) => {
    pushToast('warn', `Testing ${p.profile_name}…`);
    const r = await window.MockApi.testSend(p.id);
    pushToast(r.ok ? 'ok' : 'err', r.message);
  };

  const handleTestAll = async () => {
    pushToast('warn', 'Testing all profiles…');
    const results = await window.MockApi.testAll();
    const failed = results.filter(r => !r.ok);
    if (failed.length === 0) pushToast('ok', `All ${results.length} profiles passed`);
    else pushToast('warn', `${results.length - failed.length}/${results.length} passed · ${failed.length} failed`);
  };

  const handleSetDefault = async (p) => {
    await window.MockApi.updateProfile(p.id, { is_default:true });
    pushToast('ok', `${p.profile_name} is now default`);
  };

  const handleVerifyAddr = async (a) => {
    const r = await window.MockApi.verifyAddress(a.id);
    pushToast(r.ok ? 'ok' : 'warn', r.message);
  };

  return (
    <div className="page-email" style={{padding:'18px 22px', maxWidth:1640, margin:'0 auto'}}>
      <ToastHost/>

      {/* Header */}
      <div className="hstack" style={{alignItems:'flex-start', marginBottom:18}}>
        <div style={{flex:1}}>
          <h1 style={{fontSize:26, fontWeight:600, color:'var(--fg-0)', margin:0, letterSpacing:'-0.01em'}}>
            Email &amp; SMTP Profiles <MockBadge label="demo" title="All values come from the in-app mock store"/>
          </h1>
          <div style={{color:'var(--fg-2)', fontSize:13, marginTop:4}}>Centralized email management for all outbound communications.</div>
        </div>
        <div className="hstack" style={{gap:8}}>
          <button className="btn" disabled title="Coming soon">
            <I.Book size={12}/> Documentation <span className="mock-badge sm" style={{marginLeft:4}}>soon</span>
          </button>
          <button className="btn primary" onClick={handleAdd}>
            <I.Plus size={12}/> Add Profile
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="dash-grid" style={{marginBottom:18}}>
        <div className="card col-2-4"><div className="card-body vstack">
          <div className="stat-label"><I.Mail size={11} style={{marginRight:4, opacity:0.6}}/>Active profiles</div>
          <div className="stat-big">{activeCount}<span className="unit">/ {profiles.length}</span></div>
          <div className="muted xsmall">of {profiles.length} total</div>
        </div></div>
        <div className="card col-2-4"><div className="card-body vstack">
          <div className="stat-label"><I.Users size={11} style={{marginRight:4, opacity:0.6}}/>Verified senders</div>
          <div className="stat-big">{verifiedCount}</div>
          <div className="muted xsmall">Ready to send</div>
        </div></div>
        <div className="card col-2-4"><div className="card-body vstack">
          <div className="stat-label"><I.Key size={11} style={{marginRight:4, opacity:0.6}}/>Needs attention</div>
          <div className="stat-big" style={{color: needsCredCount>0 ? 'oklch(0.82 0.14 85)' : 'var(--fg-0)'}}>{needsCredCount}</div>
          <div className="muted xsmall">Credential or wiring</div>
        </div></div>
        <div className="card col-2-4"><div className="card-body vstack">
          <div className="stat-label"><I.Activity size={11} style={{marginRight:4, opacity:0.6}}/>Delivery success</div>
          <div className="hstack" style={{gap:6}}>
            <div className="stat-big">—</div>
            <NotWiredBadge label="api not wired" title="No delivery metrics endpoint yet"/>
          </div>
          <div className="muted xsmall">Awaiting provider metrics</div>
        </div></div>
        <div className="card col-2-4"><div className="card-body vstack">
          <div className="stat-label"><I.Shield size={11} style={{marginRight:4, opacity:0.6}}/>Default profile</div>
          <div style={{fontSize:13, color:'var(--fg-0)', fontWeight:500, marginTop:2}}>{defaultProfile?.profile_name || '—'}</div>
          <div className="muted xsmall mono">{defaultProfile?.from_address || '—'}</div>
        </div></div>
      </div>

      {/* Profiles table */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <div className="card-title">
            <I.Mail/> Email sender profiles
            <span className="card-subtitle">Manage sender identities, providers, and credentials</span>
          </div>
          <div className="hstack" style={{gap:8}}>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:160}}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="needs">Needs credentials</option>
              <option value="notwired">API not wired</option>
            </select>
            <button className="btn" onClick={handleTestAll}><I.Send size={11}/> Test all</button>
          </div>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>Profile name</th>
            <th style={{width:150}}>Provider</th>
            <th style={{width:260}}>From address</th>
            <th style={{width:180}}>Purpose</th>
            <th style={{width:200}}>Status</th>
            <th style={{width:110}}>Last test</th>
            <th style={{width:240}} className="ta-right">Actions</th>
          </tr></thead>
          <tbody>
            {visibleProfiles.map(p => (
              <tr key={p.id}>
                <td>
                  <span style={{color:'var(--fg-0)', fontWeight:500}}>{p.profile_name}</span>
                  {p.is_default && <span className="tag accent" style={{marginLeft:8, fontSize:9}}>default</span>}
                </td>
                <td>
                  <span className="hstack" style={{gap:7}}>
                    <ProviderMark type={p.provider_type}/>
                    <span className="mono xsmall" style={{color:'var(--fg-1)'}}>{p.provider_type}</span>
                  </span>
                </td>
                <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{p.from_address}</td>
                <td><Tag>{p.purpose}</Tag></td>
                <td><ProfileStatus status={p.status}/></td>
                <td className="mono xsmall muted">{p.last_test_at}</td>
                <td className="ta-right">
                  <div className="hstack" style={{gap:4, justifyContent:'flex-end'}}>
                    <button className="btn sm" onClick={()=>handleTest(p)} title="Send test email (simulated)"><I.Send size={11}/></button>
                    <button className="btn sm" onClick={()=>handleEdit(p)} title="Edit profile"><I.Edit size={11}/></button>
                    <button className="btn sm" onClick={()=>handleRotate(p)} title="Rotate credentials"><I.Refresh size={11}/></button>
                    {!p.is_default && (
                      <button className="btn sm" onClick={()=>handleSetDefault(p)} title="Set as default"><I.Flag size={11}/></button>
                    )}
                    <button className="btn sm" onClick={()=>handleDelete(p)} title="Delete profile" style={{color:'var(--err)'}}><I.Trash size={11}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleProfiles.length === 0 && (
              <tr><td colSpan={7} style={{textAlign:'center', color:'var(--fg-2)', padding:'24px 0'}}>No profiles match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Addresses + Routing */}
      <div className="dash-grid">
        <div className="card col-6">
          <div className="card-head">
            <div className="card-title">
              <I.Users/> Outgoing email addresses
              <span className="card-subtitle">Used across your profiles</span>
            </div>
            <button className="btn sm" onClick={handleAddAddr}><I.Plus size={11}/> Add address</button>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Email address</th>
              <th style={{width:200}}>Used by</th>
              <th style={{width:200}}>Status</th>
              <th style={{width:90}} className="ta-right">Actions</th>
            </tr></thead>
            <tbody>
              {addresses.map(a => (
                <tr key={a.id}>
                  <td className="mono xsmall" style={{color:'var(--fg-0)'}}>{a.email}</td>
                  <td style={{color:'var(--fg-1)'}}>{a.used_by}</td>
                  <td><ProfileStatus status={a.status}/></td>
                  <td className="ta-right">
                    {a.status !== 'verified' ? (
                      <button className="btn sm" onClick={()=>handleVerifyAddr(a)} title="Attempt verification"><I.Shield size={11}/></button>
                    ) : (
                      <span className="muted xsmall">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card col-6">
          <div className="card-head">
            <div className="card-title">
              <I.Send/> Email routing &amp; assignment
              <span className="card-subtitle">Which profile handles each type</span>
            </div>
            <button className="btn sm" onClick={handleEditRouting}><I.Edit size={11}/> Edit routing rules</button>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Email type</th>
              <th style={{width:200}}>Assigned profile</th>
              <th style={{width:220}}>From address</th>
              <th style={{width:110}}>Status</th>
            </tr></thead>
            <tbody>
              {routing.map(r => {
                const prof = profiles.find(p => p.id === r.assigned_profile_id);
                return (
                  <tr key={r.id}>
                    <td style={{color:'var(--fg-0)'}}>{r.email_type}</td>
                    <td>
                      {prof ? (
                        <span className="hstack" style={{gap:6}}>
                          <ProviderMark type={prof.provider_type}/>
                          <span style={{color:'var(--fg-1)'}}>{prof.profile_name}</span>
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="mono xsmall muted">{r.from_address}</td>
                    <td><ProfileStatus status={r.status}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal?.kind === 'add' && (
        <ProfileModal
          mode="add"
          onClose={()=>setModal(null)}
          onSave={async (payload) => {
            const p = await window.MockApi.addProfile(payload);
            pushToast('ok', `Profile "${p.profile_name}" created · ${p.status === 'api_not_wired' ? 'API not wired yet' : 'configure credentials to activate'}`);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'edit' && (
        <ProfileModal
          mode="edit" initial={modal.data}
          onClose={()=>setModal(null)}
          onSave={async (payload) => {
            await window.MockApi.updateProfile(modal.data.id, payload);
            pushToast('ok', 'Profile updated');
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete profile?"
          message={`Delete "${modal.data.profile_name}"? Any routing rules using it will become unassigned. This cannot be undone.`}
          confirmLabel="Delete" danger
          onClose={()=>setModal(null)}
          onConfirm={async () => {
            await window.MockApi.deleteProfile(modal.data.id);
            pushToast('ok', `Profile deleted`);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'rotate' && (
        <ConfirmDialog
          title="Rotate credentials?"
          message={`Rotate credentials for "${modal.data.profile_name}"? Current credentials are invalidated immediately; you'll need to re-enter new ones in the edit form to reactivate.`}
          confirmLabel="Rotate"
          onClose={()=>setModal(null)}
          onConfirm={async () => {
            const r = await window.MockApi.rotateCredentials(modal.data.id);
            pushToast('warn', r.message);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'addAddr' && (
        <AddressModal
          onClose={()=>setModal(null)}
          onSave={async (payload) => {
            await window.MockApi.addAddress(payload);
            pushToast('warn', `Address added · verification not implemented yet`);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'routing' && (
        <RoutingEditor
          routing={routing} profiles={profiles}
          onClose={()=>setModal(null)}
          onSave={()=>setModal(null)}
        />
      )}
    </div>
  );
}

Object.assign(window, { EmailProfilesPage, pushToast, ToastHost });
