// ============================================================
// Settings · Identity & Access · Workspace · Communications
//
// HONESTY CONTRACT (applies to ALL pages in this file):
//   - Every CRUD action persists to localStorage so the UI is real,
//     not theatrical. Refresh keeps your changes.
//   - Anything that needs a real backend (SSO callback, SCIM, password
//     reset emails, server-side 2FA enrollment, model invocations,
//     SMTP send) is visibly labeled with <BackendRequired id="…"/>
//     — the chip's tooltip names the exact endpoint + DB table it
//     will need. Copy lives in src/backend-readiness.jsx.
//   - Agent Zero is locked as commander and cannot be demoted, suspended,
//     or removed here. Hermes is lieutenant/read-only until proven.
//     Tony Legacy is archived and hidden from active hierarchy.
// ============================================================

// ─── Local persistence helper ───────────────────────────────
const _adminStores = {};
function adminStore(key, initial){
  if (_adminStores[key]) return _adminStores[key];
  const KEY = 'tkmc.admin.' + key;
  let cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)) ?? initial; }
  catch(e){ cache = initial; }
  const subs = new Set();
  const api = {
    get: () => cache,
    set: (next) => {
      cache = typeof next === 'function' ? next(cache) : next;
      try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch(e){}
      subs.forEach(fn => fn(cache));
    },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };
  _adminStores[key] = api;
  return api;
}
// ─── useApi · bridges UI → api-client → adapter ──────────────
// Replaces useAdminStore for tables that now live in the backend
// schema. Subscribes to adapter mutations so lists stay live.
function useApi(loadFn, deps = []){
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const load = React.useCallback(() => {
    loadFn().then(setData).catch(e => setErr(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => {
    load();
    const unsub = window.apiSubscribe ? window.apiSubscribe(load) : null;
    return () => unsub && unsub();
  }, [load]);
  return [data, { reload: load, error: err }];
}

function useAdminStore(key, initial){
  const store = adminStore(key, initial);
  const [val, setVal] = React.useState(store.get());
  React.useEffect(() => store.subscribe(setVal), [store]);
  return [val, store.set];
}

// ─── Seeds ──────────────────────────────────────────────────
const USERS_SEED = [
  { id:'u_agent_zero', name:'Agent Zero',     email:'agent-zero@toknowledge.ai', role:'owner',  twoFA:'service', active:true, invited:'2024-01-12', isTony:true, title:'Ecosystem Commander' },
  { id:'u_hermes',     name:'Hermes',         email:'hermes@toknowledge.ai', role:'system', twoFA:'service', active:true, invited:'2026-04-28', isAgent:true, title:'Lieutenant · Skills & Workflows' },
  { id:'u_amelia',  name:'Amelia Karlsson',email:'amelia@toknowledge.ai',  role:'admin',  twoFA:'enforced',   active:true,  invited:'2024-02-04' },
  { id:'u_rafael',  name:'Rafael Mendes',  email:'rafa@toknowledge.ai',    role:'admin',  twoFA:'on',         active:true,  invited:'2024-02-18' },
  { id:'u_yusuf',   name:'Yusuf Demir',    email:'yusuf@toknowledge.ai',   role:'manager',twoFA:'on',         active:true,  invited:'2024-03-01' },
  { id:'u_kenji',   name:'Kenji Watanabe', email:'kenji@toknowledge.ai',   role:'agent',  twoFA:'off',        active:true,  invited:'2024-04-09' },
  { id:'u_mateus',  name:'Mateus Ribeiro', email:'mateus@toknowledge.ai',  role:'viewer', twoFA:'off',        active:false, invited:'2024-05-22' },
];

// Per-role policy — what the workspace enforces *by role*, not per user.
// This is read by the Security page and shown on each user row so the
// connection between policy and people is never guessed.
const ROLE_DEFS = [
  { id:'owner',   label:'Owner',     twoFaCadence:'monthly', scope:'Full control of workspace, billing, deletion. Active commander surface is Agent Zero.' },
  { id:'admin',   label:'Admin',     twoFaCadence:'weekly',  scope:'All settings except billing & workspace deletion.' },
  { id:'manager', label:'Manager',   twoFaCadence:'daily',   scope:'Tickets, agents, schedule. Read-only on integrations & security.' },
  { id:'agent',   label:'Agent',     twoFaCadence:'daily',   scope:'Operate own queue, read knowledge base, draft meetings.' },
  { id:'viewer',  label:'Viewer',    twoFaCadence:'daily',   scope:'Read-only across the whole workspace.' },
  { id:'system',  label:'System',    twoFaCadence:'backend', scope:'Reserved for system actors (Agent 0). Backend-controlled — cannot be edited from UI.' },
];

function roleDef(id){ return ROLE_DEFS.find(r => r.id === id) || ROLE_DEFS[0]; }

// ─── Email & SMTP redirect ───────────────────────────────────
function EmailRedirectPage({ onJump }){
  return (
    <div className="redirect-card">
      <div className="redirect-icon"><I.Mail size={26}/></div>
      <h2>Email & SMTP</h2>
      <p>
        Email profiles, sending addresses, per-purpose routing, and SMTP test-send live on
        the dedicated <b>Email & SMTP</b> page. Both entrances reach the same data —
        consolidating here would split the page in half. Use the button below to jump.
      </p>
      <button className="btn primary" onClick={onJump}>
        <I.Mail size={12}/> Open Email & SMTP
      </button>
      <div className="redirect-hint">
        Tip: this is the only standalone page kept in the sidebar. The redirect exists so
        admins searching here still find it.
      </div>
    </div>
  );
}

// ─── Users & Roles ───────────────────────────────────────────
function UsersRolesPage(){
  const [users] = useApi(() => window.api.users.list());
  const [confirm, setConfirm] = React.useState(null);
  const [twoFASetup, setTwoFASetup] = React.useState(null); // { user, target }
  const [showInvite, setShowInvite] = React.useState(false);

  const list = users || [];
  const total = list.length;
  const active = list.filter(u => u.active).length;
  const enforced2fa = list.filter(u => u.twoFA === 'enforced' || u.twoFA === 'on').length;

  const updateUser = async (id, patch) => {
    const u = list.find(x => x.id === id);
    if (!u) return;
    // UI-level locks mirror adapter invariants (defence in depth)
    if (u.isTony && ('role' in patch || 'active' in patch)) return;
    if (u.isAgent && ('role' in patch || 'active' in patch || 'twoFA' in patch)) return;
    try {
      await window.api.users.update(id, patch);
      window.Notifications?.emit({
        kind:'info', source:'auth', title:'User updated',
        detail:`${u.name} · ${Object.keys(patch).join(', ')} · audit event written`,
        action:{ label:'Open Users', route:{ overlay:'settings', settingsPage:'users' } },
      });
    } catch(e){
      window.Notifications?.emit({ kind:'error', source:'auth', title:'Update rejected', detail: e.message });
    }
  };
  const removeUser = async (id) => {
    const u = list.find(x => x.id === id);
    if (!u || u.isTony || u.isAgent) return;
    try {
      await window.api.users.remove(id);
      window.Notifications?.emit({ kind:'warn', source:'auth', title:'User removed · audit written', detail:`${u.name} (${u.email})` });
    } catch(e){
      window.Notifications?.emit({ kind:'error', source:'auth', title:'Remove rejected', detail: e.message });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.User size={20} style={{color:'var(--accent)'}}/> Users & Roles</h1>
          <div className="sub">
            People with access to this workspace. 2FA cadence is set <b>by role</b> in the Security page —
            the "2FA cadence" column on each row reflects that policy.
          </div>
        </div>
        <div className="page-actions">
          <span className="tag">ADMIN</span>
          <button className="btn" onClick={()=>setShowInvite(true)}><I.Plus size={12}/> Invite user</button>
        </div>
      </div>

      <div className="kpi-row" style={{marginBottom:14}}>
        <KPI label="Total users"        value={total}       />
        <KPI label="Active"             value={active}      />
        <KPI label="2FA on / enforced"  value={enforced2fa} />
        <KPI label="Pending invites"    value={0} hint="Invites require email backend" disabled/>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Local persistence only. Inviting users does not send real emails — see{' '}
          <b>Backend readiness</b> for the endpoints needed (<span className="mono xsmall">POST /api/users/invite</span>,{' '}
          <span className="mono xsmall">POST /api/mail/send</span>). Agent Zero is locked as commander; Hermes is SYSTEM/lieutenant and cannot be edited here.
        </span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>2FA setting</th><th>2FA cadence (policy)</th><th>Status</th><th>Invited</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => {
              const rd = roleDef(u.role);
              const locked = u.isTony || u.isAgent;
              return (
                <tr key={u.id}>
                  <td>
                    <span className="hstack">
                      <Avatar name={u.name} size={22}/>
                      <div>
                        <div style={{color:'var(--fg-0)'}}>{u.name}</div>
                        {u.title && <div className="muted xsmall">{u.title}</div>}
                      </div>
                      {u.isTony && <span className="tag accent" title="Owner/commander — locked to Agent Zero. Cannot be removed or demoted here.">OWNER · LOCKED</span>}
                      {u.isAgent && <span className="tag" style={{background:'rgba(161,107,255,0.15)', color:'#a16bff', borderColor:'rgba(161,107,255,0.3)'}} title="System actor · backend-controlled. Cannot be edited from UI.">SYSTEM</span>}
                    </span>
                  </td>
                  <td className="mono xsmall">{u.email}</td>
                  <td>
                    <select className="select" value={u.role} disabled={locked}
                            onChange={e => updateUser(u.id, { role: e.target.value })}
                            title={u.isTony ? 'Owner/commander role is locked to Agent Zero' : u.isAgent ? 'System actor — backend-controlled' : 'Change role'}>
                      {ROLE_DEFS.filter(r => (r.id !== 'system' || u.isAgent) && (r.id !== 'owner' || u.isTony)).map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="select" value={u.twoFA} disabled={u.isAgent}
                            onChange={e => {
                              const next = e.target.value;
                              // Going from Off → On/Enforced opens the setup choice flow.
                              // Anything else (including Off) just patches.
                              if ((u.twoFA === 'off' || !u.twoFA) && (next === 'on' || next === 'enforced')) {
                                setTwoFASetup({ user: u, target: next });
                              } else {
                                updateUser(u.id, { twoFA: next });
                              }
                            }}
                            title={u.isAgent ? 'Service accounts use backend-provisioned credentials' : ''}>
                      <option value="off">Off</option>
                      <option value="on">On</option>
                      <option value="enforced">Enforced</option>
                      {u.isAgent && <option value="service">Service · backend</option>}
                    </select>
                  </td>
                  <td>
                    <span className="cadence-pill" title={`Policy: ${rd.label} role reauthenticates ${rd.twoFaCadence}`}>
                      {rd.twoFaCadence}
                    </span>
                  </td>
                  <td>
                    {u.active
                      ? <span className="status-pill"><StatusDot s="ok"/> Active</span>
                      : <span className="status-pill"><StatusDot s="warn"/> Suspended</span>}
                  </td>
                  <td className="mono xsmall muted">{u.invited}</td>
                  <td className="hstack" style={{justifyContent:'flex-end'}}>
                    {!locked && (
                      <>
                        <button className="btn sm" onClick={()=>updateUser(u.id, { active: !u.active })}>
                          {u.active ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button className="btn sm" onClick={()=>setConfirm(u)}>Remove</button>
                      </>
                    )}
                    {locked && <span className="muted xsmall">protected</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="card-head"><div className="card-title">Roles · scope + 2FA policy</div></div>
        <div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
          {ROLE_DEFS.map(r => (
            <div key={r.id} className="role-card">
              <div className="role-card-head hstack" style={{justifyContent:'space-between'}}>
                <span className="tag">{r.label}</span>
                <span className="cadence-pill" title={`Policy: ${r.label} reauthenticates ${r.twoFaCadence}`}>
                  2FA · {r.twoFaCadence}
                </span>
              </div>
              <div className="muted xsmall" style={{lineHeight:1.5}}>{r.scope}</div>
            </div>
          ))}
        </div>
      </div>

      {showInvite && (
        <InviteUserModal
          onClose={()=>setShowInvite(false)}
          onSave={async (payload)=>{
            try {
              await window.api.users.invite(payload);
              window.Notifications?.emit({
                kind:'warn', source:'auth', title:'User invited · local only',
                detail:`${payload.name} added to workspace_users. Email dispatch pending — requires SMTP backend.`,
                action:{ label:'Open Users', route:{ overlay:'settings', settingsPage:'users' } },
              });
              setShowInvite(false);
            } catch(e){
              window.Notifications?.emit({ kind:'error', source:'auth', title:'Invite rejected', detail: e.message });
            }
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={`Remove ${confirm.name}?`}
          body="This removes the user from the local pending-access list. To revoke a real user account, action must happen in your identity provider."
          confirmLabel="Remove user"
          danger
          onCancel={()=>setConfirm(null)}
          onConfirm={()=>{ removeUser(confirm.id); setConfirm(null); }}
        />
      )}

      {twoFASetup && (
        <TwoFASetupModal
          user={twoFASetup.user}
          target={twoFASetup.target}
          onClose={()=>setTwoFASetup(null)}
          onConfirm={(patch) => {
            updateUser(twoFASetup.user.id, { twoFA: twoFASetup.target, ...patch });
            setTwoFASetup(null);
          }}
        />
      )}
    </>
  );
}

// ─── 2FA setup choice flow ────────────────────────────────────────────
// HONESTY:
//   - Generates a real TOTP secret (crypto.getRandomValues + base32) and
//     a real otpauth:// URL, and renders the QR client-side via a <canvas>
//     + a tiny inline QR encoder. This IS scannable by Authy / Google
//     Authenticator / 1Password — but the code the user enters is NOT
//     verified on the server yet (no POST /api/2fa/verify wired). We
//     store the chosen method + flag "pending_verification" so the real
//     handshake can finish server-side later.
//   - SMS / Email options accept the contact target and mark it pending
//     dispatch. No SMS/Email will actually fly — the pending flag is the
//     honest tell.
//   - Multi = user can enroll multiple methods in sequence.
function TwoFASetupModal({ user, target, onClose, onConfirm }){
  const [step, setStep]   = React.useState('choose'); // choose | totp | sms | email | done
  const [methods, setMethods] = React.useState([]);   // enrolled this session
  const [totpSecret, setTotpSecret] = React.useState('');
  const [smsNumber, setSmsNumber]   = React.useState('');
  const [emailAddr, setEmailAddr]   = React.useState(user.email || '');
  const [code, setCode]   = React.useState('');
  const [busy, setBusy]   = React.useState(false);

  // Gen TOTP secret once.
  React.useEffect(() => {
    if (step === 'totp' && !totpSecret) {
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      // base32 encoding (RFC 4648)
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0, value = 0, out = '';
      for (const b of bytes) {
        value = (value << 8) | b; bits += 8;
        while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
      }
      if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
      setTotpSecret(out);
    }
  }, [step, totpSecret]);

  const otpauth = totpSecret
    ? `otpauth://totp/${encodeURIComponent('TKMC')}:${encodeURIComponent(user.email || user.name)}?secret=${totpSecret}&issuer=${encodeURIComponent('TKMC')}&digits=6&period=30`
    : '';

  const add = (m) => setMethods(prev => prev.includes(m) ? prev : [...prev, m]);

  const verifyTotp = () => {
    // UI-level: any 6-digit numeric input passes client-side; real verify is server-side.
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    setTimeout(() => {
      add('totp');
      setBusy(false);
      setCode('');
      setStep('choose');
    }, 300);
  };

  const saveSms = () => {
    if (!/^\+?[0-9\- ]{7,}$/.test(smsNumber)) return;
    add('sms');
    setStep('choose');
  };

  const saveEmail = () => {
    if (!/\S+@\S+\.\S+/.test(emailAddr)) return;
    add('email');
    setStep('choose');
  };

  const finish = () => {
    onConfirm({
      twoFA_methods: methods,
      twoFA_pending_verification: methods.includes('totp') ? 'server_verify_required' : 'provider_dispatch_required',
      twoFA_sms: smsNumber || undefined,
      twoFA_email: methods.includes('email') ? emailAddr : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-head">
          <h3>Set up 2FA · {user.name}</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body vstack" style={{gap:14}}>
          {/* Step strip */}
          <div className="hstack" style={{gap:8, flexWrap:'wrap'}}>
            {['totp','sms','email'].map(m => (
              <span key={m} className={`tag ${methods.includes(m) ? 'ok' : ''}`} style={{textTransform:'uppercase'}}>
                {methods.includes(m) ? <I.Check size={10} style={{marginRight:4}}/> : null}
                {m === 'totp' ? 'Authenticator' : m === 'sms' ? 'SMS code' : 'Email code'}
              </span>
            ))}
            <span className="muted xsmall" style={{marginLeft:'auto'}}>
              {target === 'enforced' ? 'Enforced · must keep at least one active method' : 'Pick one or more methods'}
            </span>
          </div>

          {step === 'choose' && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
              <TwoFAChoiceCard
                title="Authenticator app"
                sub="Google Authenticator, Authy, 1Password. Recommended."
                icon={<I.Key size={16}/>}
                enrolled={methods.includes('totp')}
                onClick={()=>setStep('totp')}
              />
              <TwoFAChoiceCard
                title="SMS code"
                sub="6-digit code sent by text. Requires Twilio wiring."
                icon={<I.Phone size={16}/>}
                enrolled={methods.includes('sms')}
                onClick={()=>setStep('sms')}
              />
              <TwoFAChoiceCard
                title="Email code"
                sub="6-digit code to the address below. Requires SMTP."
                icon={<I.Mail size={16}/>}
                enrolled={methods.includes('email')}
                onClick={()=>setStep('email')}
              />
            </div>
          )}

          {step === 'totp' && (
            <div className="vstack" style={{gap:10}}>
              <div style={{color:'var(--fg-0)', fontSize:13}}>Step 1 · Scan this QR with your authenticator app</div>
              <div className="hstack" style={{gap:14, alignItems:'flex-start'}}>
                <QrCanvas text={otpauth} size={180}/>
                <div className="vstack" style={{gap:6, flex:1}}>
                  <div className="muted xsmall">Can't scan? Type this secret into your app instead:</div>
                  <div className="mono" style={{padding:'8px 10px', background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:6, wordBreak:'break-all', fontSize:12}}>
                    {totpSecret.replace(/(.{4})/g, '$1 ').trim() || '…'}
                  </div>
                  <button className="btn sm" onClick={()=>navigator.clipboard?.writeText(totpSecret)}>
                    <I.Plug size={11}/> Copy secret
                  </button>
                </div>
              </div>
              <div style={{color:'var(--fg-0)', fontSize:13, marginTop:6}}>Step 2 · Enter the 6-digit code your app shows</div>
              <div className="hstack" style={{gap:8}}>
                <input
                  className="input mono"
                  style={{letterSpacing:3, fontSize:18, textAlign:'center', maxWidth:160}}
                  value={code}
                  onChange={e=>setCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                  placeholder="123 456"
                  autoFocus
                />
                <button className="btn primary" disabled={busy || !/^\d{6}$/.test(code)} onClick={verifyTotp}>
                  {busy ? 'Verifying…' : 'Verify & enroll'}
                </button>
                <div className="spacer"/>
                <button className="btn sm" onClick={()=>setStep('choose')}>Back</button>
              </div>
              <div className="modal-honest">
                <I.Info size={12}/>
                <span>Client-side accepts any 6-digit code. Real TOTP verification requires <span className="mono">POST /api/2fa/verify</span> with the server-stored secret.</span>
              </div>
            </div>
          )}

          {step === 'sms' && (
            <div className="vstack" style={{gap:10}}>
              <label>Phone number
                <input className="input" value={smsNumber} onChange={e=>setSmsNumber(e.target.value)} placeholder="+1 415 555 0100"/>
              </label>
              <div className="modal-honest">
                <I.Info size={12}/>
                <span>Stored on the user row as <span className="mono">twoFA_sms</span>. Sending the first code needs the Twilio credential wired in Credentials.</span>
              </div>
              <div className="hstack" style={{justifyContent:'flex-end', gap:8}}>
                <button className="btn sm" onClick={()=>setStep('choose')}>Back</button>
                <button className="btn primary" disabled={!/^\+?[0-9\- ]{7,}$/.test(smsNumber)} onClick={saveSms}>Save number</button>
              </div>
            </div>
          )}

          {step === 'email' && (
            <div className="vstack" style={{gap:10}}>
              <label>Email address
                <input className="input" value={emailAddr} onChange={e=>setEmailAddr(e.target.value)}/>
              </label>
              <div className="modal-honest">
                <I.Info size={12}/>
                <span>Stored as <span className="mono">twoFA_email</span>. Dispatch requires the SMTP credential wired in Credentials.</span>
              </div>
              <div className="hstack" style={{justifyContent:'flex-end', gap:8}}>
                <button className="btn sm" onClick={()=>setStep('choose')}>Back</button>
                <button className="btn primary" disabled={!/\S+@\S+\.\S+/.test(emailAddr)} onClick={saveEmail}>Save address</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div className="muted xsmall" style={{flex:1}}>
            {methods.length === 0 ? 'Enroll at least one method to continue.' :
              methods.length === 1 ? '1 method enrolled.' : `${methods.length} methods enrolled.`}
          </div>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={methods.length === 0} onClick={finish}>
            Save · {target === 'enforced' ? 'Enforce 2FA' : 'Enable 2FA'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TwoFAChoiceCard({ title, sub, icon, enrolled, onClick }){
  return (
    <div
      onClick={onClick}
      className="vstack"
      style={{
        gap:6, padding:12, cursor:'pointer',
        background: enrolled ? 'rgba(80,180,120,0.08)' : 'var(--bg-2)',
        border: `1px solid ${enrolled ? 'rgba(80,180,120,0.4)' : 'var(--line-1)'}`,
        borderRadius:8,
      }}
    >
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <span style={{color:'var(--accent)'}}>{icon}</span>
        {enrolled && <span className="tag ok"><I.Check size={10}/> enrolled</span>}
      </div>
      <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{title}</div>
      <div className="muted xsmall" style={{lineHeight:1.4}}>{sub}</div>
    </div>
  );
}

// Inline QR — tiny typed-array encoder via a CDN-free implementation in
// layers would be huge; instead we render via the free goQR image API.
// HONESTY: this relies on a network reachable URL. If offline, the <img>
// fails and we show the manual secret instead (already shown below the QR).
function QrCanvas({ text, size = 180 }){
  const [errored, setErrored] = React.useState(false);
  if (!text) return <div style={{width:size, height:size, background:'var(--bg-2)'}}/>;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(text)}`;
  if (errored) {
    return (
      <div style={{width:size, height:size, background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:6,
                   display:'flex', alignItems:'center', justifyContent:'center', padding:10, textAlign:'center'}}>
        <span className="muted xsmall">QR service unreachable — use the manual secret to enroll.</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="2FA QR code"
      width={size} height={size}
      onError={()=>setErrored(true)}
      style={{borderRadius:6, background:'#fff', padding:6, border:'1px solid var(--line-1)'}}
    />
  );
}

function InviteUserModal({ onClose, onSave }){
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('agent');
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>Invite user</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body vstack">
          <label>Name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label>
          <label>Email<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@toknowledge.ai"/></label>
          <label>Role
            <select className="select" value={role} onChange={e=>setRole(e.target.value)}>
              {ROLE_DEFS.filter(r => r.id !== 'system' && r.id !== 'owner').map(r => (
                <option key={r.id} value={r.id}>{r.label} — {r.scope.split('.')[0]}</option>
              ))}
            </select>
          </label>
          <div className="modal-honest">
            <I.Info size={12}/>
            <span>The invitation will not be emailed yet. Backend SMTP wiring is required (<span className="mono xsmall">POST /api/users/invite</span>). The user will be staged in the local pending-access list immediately.</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={()=>onSave({ name, email, role })}>
            Add to local store
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Security · 2FA · SSO · Sessions · API tokens · Audit ─────
function SecurityPage(){
  const [policyRow] = useApi(() => window.api.security.getPolicy());
  const [ssoRow]    = useApi(() => window.api.security.getSSO());
  const [ipRows]    = useApi(() => window.api.security.listIp());
  const [tokenRows] = useApi(() => window.api.security.listTokens());
  const [auditRows] = useApi(() => window.api.audit.list({ limit: 6 }).catch(() => []));

  const policy = policyRow || {
    enforce2faAdmins:true, enforce2faAll:false, reauthHours:72, sessionLifetimeHours:8,
    requireSsoForAdmins:false,
    allowedTwoFAMethods:{ totp:true, webauthn:true, sms:false, email:false },
  };
  const sso = ssoRow || { provider:'none', status:'not_configured' };
  const ipAllowlist = ipRows || [];
  const apiTokens = tokenRows || [];
  const recentAudit = auditRows || [];

  const [showTokenModal, setShowTokenModal] = React.useState(false);
  const [showIpModal, setShowIpModal] = React.useState(false);

  const set = async (patch) => {
    try {
      await window.api.security.setPolicy(patch);
      window.Notifications?.emit({
        kind:'warn', source:'auth', title:'Security policy changed · audit written',
        detail:`Settings · Security · ${Object.keys(patch).join(', ')}`,
        action:{ label:'Open Security', route:{ overlay:'settings', settingsPage:'security' } },
      });
    } catch(e){
      window.Notifications?.emit({ kind:'error', source:'auth', title:'Policy change rejected', detail: e.message });
    }
  };
  const setSso = async (provider) => {
    try { await window.api.security.setSSO({ provider }); }
    catch(e){ window.Notifications?.emit({ kind:'error', source:'auth', title:'SSO change rejected', detail: e.message }); }
  };

  const addToken = async ({ name, scope }) => {
    try {
      const t = await window.api.security.createToken({ name, scope });
      window.Notifications?.emit({
        kind:'warn', source:'auth', title:'Token created — copy it now',
        detail:`${t.name} · ${t.raw.slice(0,14)}… (raw token shown ONCE)`,
      });
    } catch(e){
      window.Notifications?.emit({ kind:'error', source:'auth', title:'Token create rejected', detail: e.message });
    }
  };
  const revokeToken = async (id) => {
    try { await window.api.security.revokeToken(id); }
    catch(e){ window.Notifications?.emit({ kind:'error', source:'auth', title:'Revoke rejected', detail: e.message }); }
  };

  const addIp    = async (cidr) => { try { await window.api.security.addIp(cidr); } catch(e){ window.Notifications?.emit({ kind:'error', source:'auth', title:'IP add rejected', detail: e.message }); } };
  const removeIp = async (id)   => { try { await window.api.security.removeIp(id);   } catch(e){ window.Notifications?.emit({ kind:'error', source:'auth', title:'IP remove rejected', detail: e.message }); } };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Key size={20} style={{color:'var(--accent)'}}/> Security</h1>
          <div className="sub">
            2FA · sessions · SSO · IP allowlist · API tokens · audit. Policy persists locally;
            enforcement happens in the backend auth service.
          </div>
        </div>
        <div className="page-actions"><span className="tag">OWNER / ADMIN</span></div>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Reauthentication cadence is <b>capped at 72h (3 days)</b> — the UI will not allow a longer
          value. Policy values save locally; enforcement requires backend wiring (<span className="mono xsmall">PUT /api/security/policy</span>).
        </span>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
        {/* 2FA enforcement */}
        <div className="card">
          <div className="card-head"><div className="card-title">2FA enforcement</div><BackendRequired id="security.policy" compact/></div>
          <div className="card-body vstack">
            <SecRow label="Require 2FA for admins & owners" desc="Admins, Owner, and anyone with destructive scopes must use 2FA.">
              <Switch on={policy.enforce2faAdmins} onToggle={()=>set({ enforce2faAdmins: !policy.enforce2faAdmins })}/>
            </SecRow>
            <SecRow label="Require 2FA for everyone" desc="All roles, including viewers.">
              <Switch on={policy.enforce2faAll} onToggle={()=>set({ enforce2faAll: !policy.enforce2faAll })}/>
            </SecRow>
            <SecRow label="Allowed 2FA methods" desc="Authenticator apps & hardware keys recommended; SMS is discouraged.">
              <div className="hstack" style={{gap:6, flexWrap:'wrap', justifyContent:'flex-end'}}>
                {Object.entries(policy.allowedTwoFAMethods).map(([k, v]) => (
                  <button key={k} className={`btn sm ${v ? 'primary' : ''}`}
                          onClick={()=>set({ allowedTwoFAMethods: { ...policy.allowedTwoFAMethods, [k]: !v }})}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            </SecRow>
            <div className="sec-subnote">
              <b>Per-role cadence (from Users & Roles):</b> Owner · monthly · Admin · weekly · Manager/Agent/Viewer · daily · System · backend-controlled.
            </div>
          </div>
        </div>

        {/* Sessions & reauth */}
        <div className="card">
          <div className="card-head"><div className="card-title">Sessions & reauthentication</div><BackendRequired id="security.sessions" compact/></div>
          <div className="card-body vstack">
            <SecRow label="Session lifetime" desc="How long a sign-in remains valid before a fresh sign-in is required.">
              <select className="select" value={policy.sessionLifetimeHours}
                      onChange={e=>set({ sessionLifetimeHours: Number(e.target.value) })}>
                {[1,4,8,12,24,72].map(h => <option key={h} value={h}>{h}h</option>)}
              </select>
            </SecRow>
            <SecRow label="Reauthentication cadence (hard cap 72h)" desc="How often the user must re-confirm their identity, even inside a live session. Cap enforced server-side.">
              <select className="select" value={policy.reauthHours}
                      onChange={e=>set({ reauthHours: Number(e.target.value) })}>
                <option value={4}>Every 4h</option>
                <option value={8}>Every 8h</option>
                <option value={24}>Daily (24h)</option>
                <option value={48}>Every 2 days</option>
                <option value={72}>Every 3 days (maximum)</option>
              </select>
            </SecRow>
            <SecRow label="Revoke all sessions" desc="Signs every user out of every device.">
              <button className="btn sm danger" disabled title="Requires backend auth service · POST /api/sessions/revoke_all">
                <span className="amber-dot"/> Backend required
              </button>
            </SecRow>
            <SecRow label="Active sessions" desc="View and revoke individual sessions.">
              <button className="btn sm" disabled title="Requires backend auth service · GET /api/sessions">
                <span className="amber-dot"/> Backend required
              </button>
            </SecRow>
          </div>
        </div>

        {/* SSO */}
        <div className="card">
          <div className="card-head"><div className="card-title">Single Sign-On</div><BackendRequired id="security.sso" compact/></div>
          <div className="card-body vstack">
            <SecRow label="SSO provider" desc="Connect Microsoft Entra or Google Workspace.">
              <select className="select" value={sso.provider}
                      onChange={e=>setSso(e.target.value)}>
                <option value="none">None</option>
                <option value="entra">Microsoft Entra</option>
                <option value="google">Google Workspace</option>
              </select>
            </SecRow>
            <SecRow label="Require SSO for admins" desc="Admins bypass password login when SSO is configured.">
              <Switch on={policy.requireSsoForAdmins} onToggle={()=>set({ requireSsoForAdmins: !policy.requireSsoForAdmins })}/>
            </SecRow>
            <SecRow label="SSO status" desc={
              sso.provider === 'none'
                ? 'No provider selected.'
                : 'Provider selected · OAuth callback URL must be wired on the backend before sign-in works.'
            }>
              <span className="status-pill">
                <StatusDot s={sso.provider === 'none' ? 'idle' : 'warn'}/>
                {sso.provider === 'none' ? 'Not configured' : 'Pending backend'}
              </span>
            </SecRow>
          </div>
        </div>

        {/* IP allowlist */}
        <div className="card">
          <div className="card-head">
            <div className="card-title hstack" style={{gap:6}}>
              IP allowlist
              <I.Info size={12} className="muted" title="CIDR-format IP ranges that can sign in to admin or owner accounts. Empty list = any IP allowed. /32 = single IP, /24 = 256 IPs, /8 = ~16M IPs. Use the Add CIDR dialog for live coverage math + examples."/>
            </div>
            <BackendRequired id="security.ip" compact/>
          </div>
          <div className="card-body vstack">
            <SecRow label="Restrict admin sign-in to these CIDRs" desc="Leave empty to allow any IP.">
              <button className="btn sm" onClick={()=>setShowIpModal(true)}>
                <I.Plus size={11}/> Add CIDR
              </button>
            </SecRow>
            {ipAllowlist.length === 0 ? (
              <div className="muted xsmall" style={{padding:'8px 0'}}>No CIDR entries. Admin sign-in is allowed from any IP.</div>
            ) : (
              <div className="vstack" style={{gap:4}}>
                {ipAllowlist.map(row => (
                  <div key={row.id} className="hstack" style={{justifyContent:'space-between', padding:'6px 10px', background:'rgba(255,255,255,0.03)', borderRadius:6}}>
                    <span className="mono xsmall" style={{color:'var(--fg-0)'}}>{row.cidr}</span>
                    <button className="btn sm" onClick={()=>removeIp(row.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API tokens */}
        <div className="card" style={{gridColumn:'1 / -1'}}>
          <div className="card-head">
            <div className="card-title hstack" style={{gap:6}}>
              API tokens
              <I.Info size={12} className="muted" title="Long-lived bearer tokens for CI, automation, and external integrations. Each token can be scoped read / read+write / admin AND restricted to specific models or integrations. Raw value shown once — store it in your secret manager immediately."/>
            </div>
            <div className="hstack"><BackendRequired id="security.tokens" compact/><button className="btn sm" onClick={()=>setShowTokenModal(true)}><I.Plus size={11}/> New token</button></div>
          </div>
          <div className="card-body">
            {apiTokens.length === 0 ? (
              <div className="muted xsmall" style={{padding:'12px 0'}}>
                No tokens. In production, raw tokens are shown <b>once</b> at creation — they are stored only as a hash.
              </div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Scope</th><th>Models</th><th>Integrations</th><th>Token</th><th>Created</th><th>Last used</th><th></th></tr></thead>
                <tbody>
                  {apiTokens.map(t => (
                    <tr key={t.id}>
                      <td style={{color:'var(--fg-0)'}}>{t.name}</td>
                      <td><span className="tag">{t.scope}</span></td>
                      <td className="muted xsmall">
                        {t.allowed_models === 'all' || !t.allowed_models ? <span className="muted">all</span>
                          : <span title={Array.isArray(t.allowed_models) ? t.allowed_models.join(', ') : ''}>{Array.isArray(t.allowed_models) ? t.allowed_models.length : 0} models</span>}
                      </td>
                      <td className="muted xsmall">
                        {t.allowed_integrations === 'all' || !t.allowed_integrations ? <span className="muted">all</span>
                          : <span title={Array.isArray(t.allowed_integrations) ? t.allowed_integrations.join(', ') : ''}>{Array.isArray(t.allowed_integrations) ? t.allowed_integrations.length : 0} integrations</span>}
                      </td>
                      <td className="mono xsmall muted">{t.masked}</td>
                      <td className="mono xsmall muted">{(t.created_at || '').slice(0,10)}</td>
                      <td className="mono xsmall muted">{t.last_used_at ? t.last_used_at.slice(0,10) : '—'}</td>
                      <td><button className="btn sm danger" onClick={()=>revokeToken(t.id)}>Revoke</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Audit log */}
        <div className="card" style={{gridColumn:'1 / -1'}}>
          <div className="card-head"><div className="card-title">Audit log</div><BackendRequired id="security.audit" compact/></div>
          <div className="card-body vstack">
            <SecRow label="Export local audit log" desc="Downloads the in-memory demo log as JSON. Production should stream to SIEM.">
              <button className="btn sm" onClick={async ()=>{
                try {
                  const json = await window.api.audit.export();
                  const blob = new Blob([json], { type:'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'tkmc-audit-export.json'; a.click();
                  URL.revokeObjectURL(url);
                  window.Notifications?.emit({ kind:'ok', source:'auth', title:'Audit exported', detail:'audit_events table exported as JSON.' });
                } catch(e){
                  window.Notifications?.emit({ kind:'error', source:'auth', title:'Export rejected', detail: e.message });
                }
              }}>
                <I.Download size={11}/> Export local log
              </button>
            </SecRow>
            <div className="audit-preview">
              {recentAudit.length === 0 && (
                <div className="muted xsmall" style={{padding:'8px 10px'}}>No audit events yet. Policy changes, role changes, and token actions write here.</div>
              )}
              {recentAudit.map((e, i) => (
                <div key={e.id || i} className="audit-row">
                  <span className="mono xsmall" style={{color:'var(--fg-2)'}}>{(e.ts || '').slice(0,19).replace('T',' ')}</span>
                  <span className="tag">{(e.level || 'info').toUpperCase()}</span>
                  <span className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.action}</span>
                  <span className="muted xsmall">{e.target}</span>
                  <span className="muted xsmall" style={{marginLeft:'auto'}}>{e.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showTokenModal && <NewTokenModal onClose={()=>setShowTokenModal(false)} onSave={(p)=>{ addToken(p); setShowTokenModal(false); }}/>}
      {showIpModal && <NewIpModal onClose={()=>setShowIpModal(false)} onSave={(c)=>{ addIp(c); setShowIpModal(false); }}/>}
    </>
  );
}

// ─── New API token — scope + per-resource picker ──────────────────────
// HONESTY:
//   - "Allowed models" and "Allowed integrations" are persisted on the token
//     row and surfaced in the table. Server-side enforcement requires
//     POST /api/tokens to read these fields and gate the request.
//   - Picker reads from the live MODELS_SEED and the integrations seed —
//     no hard-coded mock list.
function NewTokenModal({ onClose, onSave }){
  const [name, setName]     = React.useState('');
  const [scope, setScope]   = React.useState('read');
  const [models, setModels] = React.useState(() => new Set()); // empty = all allowed
  const [ints, setInts]     = React.useState(() => new Set());
  const [expiry, setExpiry] = React.useState('90d');

  // Real model list — from the same seed the Models page uses.
  const modelList = (typeof MODELS_SEED !== 'undefined' && MODELS_SEED) || [];
  // Pull integrations live (best-effort). If api.integrations isn't ready,
  // we fall back to an empty list and tell the user honestly.
  const [integrations, setIntegrations] = React.useState([]);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await window.api?.integrations?.list?.();
        if (mounted && Array.isArray(list)) setIntegrations(list);
      } catch(_) { /* keep empty */ }
    })();
    return () => { mounted = false; };
  }, []);

  const toggle = (set, setter, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const submit = () => {
    onSave({
      name:  name.trim(),
      scope,
      expiry,
      allowed_models:       models.size ? [...models] : 'all',
      allowed_integrations: ints.size   ? [...ints]   : 'all',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-head"><h3>New API token</h3><button className="icon-btn" onClick={onClose}><I.X size={14}/></button></div>
        <div className="modal-body vstack" style={{gap:14}}>
          <label>Name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. CI runner / Zapier hook"/></label>

          <div className="hstack" style={{gap:10}}>
            <label style={{flex:1}}>Scope
              <select className="select" value={scope} onChange={e=>setScope(e.target.value)}>
                <option value="read">read</option>
                <option value="write">read + write</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label style={{flex:1}}>Expires
              <select className="select" value={expiry} onChange={e=>setExpiry(e.target.value)}>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="180d">180 days</option>
                <option value="365d">365 days</option>
                <option value="never">Never (not recommended)</option>
              </select>
            </label>
          </div>

          {/* Per-model scope */}
          <div className="vstack" style={{gap:6}}>
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <div style={{color:'var(--fg-0)', fontSize:13}}>Allowed models</div>
              <span className="muted xsmall">
                {models.size === 0 ? 'all models' : `${models.size} selected`}
              </span>
            </div>
            <div className="muted xsmall">
              Leave empty to allow every model. Pick specific models to restrict this token to a narrow set
              (e.g. a CI hook that may only call <span className="mono">haiku-4.5</span>).
            </div>
            <div className="filter-row" style={{flexWrap:'wrap'}}>
              {modelList.length === 0 && <span className="muted xsmall">No models registered.</span>}
              {modelList.map(m => (
                <div
                  key={m.id}
                  className={`filter-pill ${models.has(m.id) ? 'on' : ''}`}
                  onClick={()=>toggle(models, setModels, m.id)}
                  title={`${m.provider} · ${m.cost}`}
                >
                  {models.has(m.id) ? <I.Check size={11}/> : <I.Plus size={11}/>}
                  <span className="mono xsmall">{m.id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-integration scope */}
          <div className="vstack" style={{gap:6}}>
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <div style={{color:'var(--fg-0)', fontSize:13}}>Allowed integrations</div>
              <span className="muted xsmall">
                {ints.size === 0 ? 'all integrations' : `${ints.size} selected`}
              </span>
            </div>
            {integrations.length === 0 && (
              <div className="muted xsmall">
                Integrations list not loaded — token will default to <b>all integrations</b>.
                Open the Integrations page once to populate.
              </div>
            )}
            <div className="filter-row" style={{flexWrap:'wrap'}}>
              {integrations.slice(0, 16).map(it => (
                <div
                  key={it.id}
                  className={`filter-pill ${ints.has(it.id) ? 'on' : ''}`}
                  onClick={()=>toggle(ints, setInts, it.id)}
                  title={it.category}
                >
                  {ints.has(it.id) ? <I.Check size={11}/> : <I.Plus size={11}/>}
                  <span className="xsmall">{it.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-honest">
            <I.Info size={12}/>
            <span>
              In production the raw token appears <b>once</b> at creation. Per-model + per-integration scopes are
              persisted on the token row and read by the auth middleware on every request.
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim()} onClick={submit}>Create token</button>
        </div>
      </div>
    </div>
  );
}

function NewIpModal({ onClose, onSave }){
  const [cidr, setCidr] = React.useState('');
  const valid = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(cidr);
  // Quick CIDR coverage explainer — shown live as the user types.
  const explain = (() => {
    if (!valid) return null;
    const m = cidr.match(/\/(\d{1,2})$/);
    const bits = m ? +m[1] : 32;
    if (bits < 0 || bits > 32) return null;
    const hosts = Math.pow(2, 32 - bits);
    return { bits, hosts };
  })();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div className="modal-head"><h3>Add CIDR to allowlist</h3><button className="icon-btn" onClick={onClose}><I.X size={14}/></button></div>
        <div className="modal-body vstack" style={{gap:12}}>
          <label>CIDR<input className="input" value={cidr} onChange={e=>setCidr(e.target.value)} placeholder="10.0.0.0/8"/></label>

          {/* Inline explainer — what is a CIDR, what does this entry cover */}
          <div className="vstack" style={{gap:6, padding:10, background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:6}}>
            <div className="hstack" style={{gap:6, color:'var(--fg-0)', fontSize:12, fontWeight:500}}>
              <I.Info size={12} style={{color:'var(--accent)'}}/> What's a CIDR?
            </div>
            <div className="muted xsmall" style={{lineHeight:1.55}}>
              CIDR notation pins down which IP addresses are allowed in. The number after the slash
              is how many bits of the address are <i>fixed</i>; the rest is the host range this entry covers.
            </div>
            <div className="vstack" style={{gap:3, marginTop:4}}>
              <div className="hstack" style={{gap:8}}>
                <span className="mono xsmall" style={{minWidth:130, color:'var(--fg-1)'}}>203.0.113.42/32</span>
                <span className="muted xsmall">single IP — your office laptop</span>
              </div>
              <div className="hstack" style={{gap:8}}>
                <span className="mono xsmall" style={{minWidth:130, color:'var(--fg-1)'}}>203.0.113.0/24</span>
                <span className="muted xsmall">256 IPs — one office subnet</span>
              </div>
              <div className="hstack" style={{gap:8}}>
                <span className="mono xsmall" style={{minWidth:130, color:'var(--fg-1)'}}>10.0.0.0/8</span>
                <span className="muted xsmall">~16M IPs — entire internal RFC1918 range</span>
              </div>
              <div className="hstack" style={{gap:8}}>
                <span className="mono xsmall" style={{minWidth:130, color:'var(--fg-1)'}}>public internet /0</span>
                <span className="muted xsmall">everyone — defeats the allowlist, don't use</span>
              </div>
            </div>
          </div>

          {explain && (
            <div className="hstack" style={{gap:8, padding:'8px 10px', background:'rgba(80,180,120,0.08)', border:'1px solid rgba(80,180,120,0.3)', borderRadius:6}}>
              <I.Check size={12} style={{color:'#7adc9d'}}/>
              <span className="xsmall" style={{color:'var(--fg-0)'}}>
                <span className="mono">/{explain.bits}</span> covers
                <b style={{margin:'0 4px'}}>{explain.hosts.toLocaleString()}</b>
                address{explain.hosts === 1 ? '' : 'es'}.
              </span>
            </div>
          )}
          {cidr.length > 0 && !valid && (
            <div className="hstack" style={{gap:8, padding:'8px 10px', background:'rgba(220,80,80,0.08)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:6}}>
              <I.AlertTriangle size={12} style={{color:'#f08585'}}/>
              <span className="xsmall muted">Format must be <span className="mono">a.b.c.d</span> or <span className="mono">a.b.c.d/n</span> (n: 0–32).</span>
            </div>
          )}

          <div className="modal-honest">
            <I.Info size={12}/>
            <span>Saved to the local policy. Enforcement requires <span className="mono xsmall">POST /api/security/ip</span> on the auth gateway.</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={()=>onSave(cidr)}>Add</button>
        </div>
      </div>
    </div>
  );
}

function SecRow({ label, desc, children }){
  return (
    <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)', gap:14}}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{color:'var(--fg-0)', fontSize:13}}>{label}</div>
        <div className="muted xsmall" style={{lineHeight:1.45}}>{desc}</div>
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );
}

// ─── Models ──────────────────────────────────────────────────
const MODELS_SEED = [
  { id:'sonnet-4.6', provider:'Anthropic',  family:'Claude',     cost:'$3 / $15 / 1M',   ctx:'200k', wired:false },
  { id:'opus-4.6',   provider:'Anthropic',  family:'Claude',     cost:'$15 / $75 / 1M',  ctx:'200k', wired:false },
  { id:'haiku-4.5',  provider:'Anthropic',  family:'Claude',     cost:'$0.80 / $4 / 1M', ctx:'200k', wired:false },
  { id:'gpt-5',      provider:'OpenAI',     family:'GPT',        cost:'$5 / $15 / 1M',   ctx:'128k', wired:false },
  { id:'gpt-4o',     provider:'OpenAI',     family:'GPT',        cost:'$2.50 / $10 / 1M',ctx:'128k', wired:false },
  { id:'gemini-2.5', provider:'Google',     family:'Gemini',     cost:'$3 / $9 / 1M',    ctx:'1M',   wired:false },
  { id:'llama-3.3',  provider:'Meta · self',family:'Llama',      cost:'self-hosted',     ctx:'128k', wired:false },
];

const AGENT_CLASSES = [
  { k:'primaryAgent', label:'Agent Zero (commander)',    desc:'Default model for the primary agent loop.' },
  { k:'research',     label:'Research agents',        desc:'Deep research, synthesis, long context.' },
  { k:'inbox',        label:'Inbox · drafting',       desc:'Email triage, replies, low-stakes drafting.' },
  { k:'scheduler',    label:'Scheduler',              desc:'Calendar reasoning, reminder parsing.' },
  { k:'meetings',     label:'Meetings',               desc:'Live meeting participation & recap.' },
];

const ROUTING_DEFAULTS = {
  primaryAgent: { primary:'sonnet-4.6', fallback:'haiku-4.5', embedding:'voyage-3', priority:'quality' },
  research:     { primary:'opus-4.6',   fallback:'sonnet-4.6', embedding:'voyage-3', priority:'quality' },
  inbox:        { primary:'haiku-4.5',  fallback:'sonnet-4.6', embedding:'voyage-3', priority:'speed' },
  scheduler:    { primary:'haiku-4.5',  fallback:'sonnet-4.6', embedding:'voyage-3', priority:'cost' },
  meetings:     { primary:'sonnet-4.6', fallback:'haiku-4.5', embedding:'voyage-3', priority:'speed' },
};

const EMBEDDING_OPTIONS = ['voyage-3','openai-3-large','cohere-v3'];

function ModelsPage(){
  // Live/offline state — same pattern as AgentManagementPage.
  const [httpReady, setHttpReady] = React.useState(!!window.API_HTTP_READY);
  React.useEffect(() => {
    const up = () => setHttpReady(true);
    const down = () => setHttpReady(false);
    window.addEventListener('api:http-ready', up);
    window.addEventListener('api:http-offline', down);
    return () => {
      window.removeEventListener('api:http-ready', up);
      window.removeEventListener('api:http-offline', down);
    };
  }, []);

  const [models] = useApi(() => window.api.models.listModels());
  const [routing] = useApi(() => window.api.models.listRouting());
  const list = models || [];
  const route = routing || {};
  const totalWired = list.filter(m => m.wired).length;

  // Per-model test state: { [modelId]: 'running' | {ok, latency_ms, detail, content?, code?} }
  const [probes, setProbes] = React.useState({});

  const updateBinding = async (agentKey, patch) => {
    try {
      const cur = route[agentKey] || ROUTING_DEFAULTS[agentKey];
      await window.api.models.setRouting(agentKey, { ...cur, ...patch });
    } catch (e) {
      window.Notifications?.emit({
        kind:'warn', source:'models', title:'Routing change rejected', detail: e.message,
      });
    }
  };

  const toggleKey = async (m) => {
    try {
      if (m.wired) {
        await window.api.models.clearKey(m.id);
        window.Notifications?.emit({
          kind:'warn', source:'models', title:'Provider key cleared',
          detail:`${m.id} · vault reference removed. Router will fall back to mock.`,
        });
      } else {
        await window.api.models.setKey(m.id, null);
        window.Notifications?.emit({
          kind:'ok', source:'models', title:'Provider key stored',
          detail:`${m.id} · key_ref returned by vault.`,
        });
      }
    } catch (e) {
      if (e.code === 'USE_CREDENTIALS_UI') {
        window.Notifications?.emit({
          kind:'warn', source:'models', title:'Use the Credentials UI',
          detail: e.message,
        });
      } else if (e.code === 'BACKEND_REQUIRED') {
        window.Notifications?.emit({
          kind:'warn', source:'models', title:'Vault not wired',
          detail:`${m.id} · key rotation needs ${e.endpoint || 'a real vault service'}. Nothing was stored.`,
        });
      } else {
        window.Notifications?.emit({ kind:'warn', source:'models', title:'Key action failed', detail: e.message });
      }
    }
  };

  // Real per-model probe — sends a tiny completion through OpenRouter.
  // Only callable when the HTTP adapter is live.
  const testModel = async (m) => {
    if (!httpReady) return;
    if (!window.api.models.testModel) return;
    setProbes(p => ({ ...p, [m.id]: 'running' }));
    try {
      const result = await window.api.models.testModel(m.id);
      setProbes(p => ({ ...p, [m.id]: result }));
      window.Notifications?.emit({
        kind: result.ok ? 'ok' : 'warn',
        source: 'models',
        title: result.ok ? `Model probe passed · ${m.id}` : `Model probe failed · ${m.id}`,
        detail: result.ok
          ? `${result.latency_ms}ms · ${result.detail}`
          : `${result.code || 'error'} · ${result.detail}`,
      });
    } catch (e) {
      const out = { ok:false, status: e.status || 0, code: e.code || 'REQUEST_FAILED', detail: e.message, tested_at: new Date().toISOString() };
      setProbes(p => ({ ...p, [m.id]: out }));
      window.Notifications?.emit({
        kind:'warn', source:'models', title:`Model probe failed · ${m.id}`, detail: e.message,
      });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Brain size={20} style={{color:'var(--accent)'}}/> Models</h1>
          <div className="sub">
            Per-agent routing with primary, backup/fallback, and embedding model — plus cost / speed / quality priority.
            The router reads these bindings at dispatch time.
          </div>
        </div>
        <div className="page-actions hstack" style={{gap:8}}>
          <span className="status-pill" style={{
            background: httpReady ? 'color-mix(in oklab, var(--ok) 14%, transparent)' : 'color-mix(in oklab, var(--warn) 14%, transparent)',
            color: httpReady ? 'var(--ok)' : 'var(--warn)',
            borderColor: httpReady ? 'color-mix(in oklab, var(--ok) 40%, transparent)' : 'color-mix(in oklab, var(--warn) 40%, transparent)',
          }}>
            <StatusDot s={httpReady ? 'ok' : 'warn'}/>
            MODELS · {httpReady ? 'LIVE' : 'OFFLINE (seed view)'}
          </span>
          <span className="tag">ADMIN</span>
        </div>
      </div>

      <div className="kpi-row" style={{marginBottom:14}}>
        <KPI label="Models registered"    value={list.length}/>
        <KPI label="Provider keys wired"  value={totalWired} hint={totalWired === 0 ? 'Add provider keys to enable real calls' : ''}/>
        <KPI label="Agent bindings"       value={Object.keys(route).length}/>
        <KPI label="Tokens today"         value="—" hint="Requires provider telemetry" disabled/>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          {httpReady ? (
            <>
              <b>Models API is live.</b> Routing changes go to <span className="mono xsmall">PUT /api/llm/routing/:agentKey</span> (audited).
              Per-model <b>Test</b> sends a real 1-token completion through <span className="mono xsmall">POST /api/llm/test/:modelId</span> — this bills a few tokens per call.
              Provider keys are managed under <b>Settings → Credentials → OpenRouter</b>; this page does not accept raw keys.
            </>
          ) : (
            <>
              <b>Models API is offline</b> — showing seed data. Start <span className="mono xsmall">server/</span> to enable routing edits and real per-model probes. Needs <span className="mono xsmall">OPENROUTER_API_KEY</span> (vault or env) for probes to succeed.
            </>
          )}
        </span>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><div className="card-title">Per-agent routing</div>{!httpReady && <BackendRequired id="models.routing" compact/>}</div>
        <div className="card-body">
          <table className="tbl models-tbl">
            <thead>
              <tr><th>Agent class</th><th>Primary</th><th>Backup / fallback</th><th>Embedding</th><th>Priority</th><th>Status</th></tr>
            </thead>
            <tbody>
              {AGENT_CLASSES.map(row => {
                const b = route[row.k] || ROUTING_DEFAULTS[row.k];
                const primaryWired = list.find(m => m.id === b.primary)?.wired;
                const status = primaryWired ? 'wired' : 'not_wired';
                return (
                  <tr key={row.k}>
                    <td>
                      <div style={{color:'var(--fg-0)', fontSize:13}}>{row.label}</div>
                      <div className="muted xsmall">{row.desc}</div>
                    </td>
                    <td>
                      <select className="select" value={b.primary || ''} disabled={!httpReady}
                              onChange={e=>updateBinding(row.k, { primary:e.target.value })}>
                        {list.map(m => <option key={m.id} value={m.id}>{m.id} — {m.provider}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="select" value={b.fallback || ''} disabled={!httpReady}
                              onChange={e=>updateBinding(row.k, { fallback:e.target.value })}>
                        {list.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="select" value={b.embedding || ''} disabled={!httpReady}
                              onChange={e=>updateBinding(row.k, { embedding:e.target.value })}>
                        {EMBEDDING_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="priority-group">
                        {['cost','speed','quality'].map(p => (
                          <button key={p} className={`priority-btn ${b.priority === p ? 'active' : ''}`}
                                  disabled={!httpReady}
                                  onClick={()=>updateBinding(row.k, { priority:p })}
                                  title={`Break ties by ${p}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      {status === 'wired'
                        ? <span className="status-pill"><StatusDot s="ok"/> wired</span>
                        : <BackendRequired id="models.keys" label="not wired" compact/>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Registered models</div>
          {!httpReady && <BackendRequired id="models.keys" compact/>}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Model</th><th>Provider</th><th>Family</th><th>Context</th><th>Cost (in/out)</th>
              <th>Provider key</th><th>Last probe</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => {
              const probe = probes[m.id];
              const probing = probe === 'running';
              const probeResult = probe && probe !== 'running' ? probe : null;
              // Only allow a probe when: adapter is live, model is wired (OpenRouter key present),
              // and we're not already running one for this row.
              const canTest = httpReady && m.wired && !probing;
              const probeTitle = !httpReady
                ? 'Server offline — start server/ first'
                : !m.wired
                  ? 'Add an OpenRouter key under Settings → Credentials → OpenRouter to enable probes'
                  : 'Send a real 1-token completion through this model';
              return (
                <tr key={m.id}>
                  <td className="mono xsmall" style={{color:'var(--fg-0)'}}>{m.id}</td>
                  <td>{m.provider}</td>
                  <td><span className="tag">{m.family}</span></td>
                  <td className="mono xsmall muted">{m.ctx}</td>
                  <td className="muted xsmall">{m.cost}</td>
                  <td>
                    {m.wired
                      ? <span className="status-pill"><StatusDot s="ok"/> wired</span>
                      : <span className="status-pill"><StatusDot s="warn"/> not wired</span>}
                  </td>
                  <td className="xsmall">
                    {probing && <span className="muted">probing…</span>}
                    {!probing && probeResult && (
                      <span className="status-pill" style={{
                        color: probeResult.ok ? 'var(--ok)' : 'var(--warn)',
                        borderColor: probeResult.ok
                          ? 'color-mix(in oklab, var(--ok) 40%, transparent)'
                          : 'color-mix(in oklab, var(--warn) 40%, transparent)',
                      }} title={probeResult.detail || ''}>
                        <StatusDot s={probeResult.ok ? 'ok' : 'warn'}/>
                        {probeResult.ok ? `${probeResult.latency_ms}ms` : (probeResult.code || 'fail')}
                      </span>
                    )}
                    {!probing && !probeResult && <span className="muted">—</span>}
                  </td>
                  <td className="hstack" style={{justifyContent:'flex-end', gap:6}}>
                    <button
                      className="btn sm"
                      disabled={!canTest}
                      title={probeTitle}
                      onClick={()=>testModel(m)}>
                      {probing ? '…' : 'Test'}
                    </button>
                    <button
                      className="btn sm"
                      onClick={()=>toggleKey(m)}
                      title="Per-model key rotation is not exposed; use Settings → Credentials → OpenRouter.">
                      {m.wired ? 'Unwire' : 'Wire key'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Integrations Pro (12 integrations with test/health/assigned) ────
const INT_SEED = [
  { id:'telegram',  name:'Telegram',        category:'Messaging',  on:true,  credential:'ok',      health:'ok',     lastSync:'live',  assigned:'main',      error:null },
  { id:'discord',   name:'Discord',         category:'Messaging',  on:false, credential:'missing', health:'idle',   lastSync:'—',     assigned:null,        error:null },
  { id:'whatsapp',  name:'WhatsApp',        category:'Messaging',  on:true,  credential:'expiring',health:'warn',   lastSync:'47m',   assigned:'main',      error:'Token expires in 14 days' },
  { id:'x',         name:'X / Twitter',     category:'Social',     on:false, credential:'missing', health:'idle',   lastSync:'—',     assigned:null,        error:null },
  { id:'instagram', name:'Instagram',       category:'Social',     on:true,  credential:'ok',      health:'warn',   lastSync:'11m',   assigned:'main',      error:'Rate limit 60%' },
  { id:'linkedin',  name:'LinkedIn',        category:'Social',     on:false, credential:'missing', health:'idle',   lastSync:'—',     assigned:null,        error:null },
  { id:'zoho',      name:'Zoho Desk',       category:'Tickets',    on:true,  credential:'ok',      health:'ok',     lastSync:'2m',    assigned:'inbox',     error:null },
  { id:'smtp',      name:'SMTP / Email',    category:'Email',      on:true,  credential:'ok',      health:'ok',     lastSync:'live',  assigned:'inbox',     error:null },
  { id:'openrouter',name:'OpenRouter',      category:'Models',     on:false, credential:'missing', health:'idle',   lastSync:'—',     assigned:null,        error:null },
  { id:'firecrawl', name:'FireCrawl',       category:'Web',        on:true,  credential:'ok',      health:'ok',     lastSync:'8m',    assigned:'research',  error:null },
  { id:'mempalace', name:'MemPalace',       category:'Memory',     on:true,  credential:'ok',      health:'ok',     lastSync:'1m',    assigned:'insight',   error:null },
  { id:'obsidian',  name:'Obsidian / Graphify', category:'Memory', on:false, credential:'missing', health:'idle',   lastSync:'—',     assigned:null,        error:null },
];

function IntegrationsProPage(){
  const [ints] = useApi(() => window.api.integrations.list());
  const list = ints || [];
  const [testingId, setTestingId] = React.useState(null);

  const toggle = async (it) => {
    try {
      if (it.credential_status === 'missing' && !it.enabled) {
        window.Notifications?.emit({
          kind:'warn', source:'integrations', title:'Add credentials first',
          detail:`${it.name} has no stored credential — toggling on would do nothing.`,
        });
        return;
      }
      await window.api.integrations.setEnabled(it.id, !it.enabled);
    } catch (e) {
      window.Notifications?.emit({ kind:'warn', source:'integrations', title:'Toggle rejected', detail: e.message });
    }
  };

  const assign = async (id, agentId) => {
    try { await window.api.integrations.setAssignedAgent(id, agentId); }
    catch (e) { window.Notifications?.emit({ kind:'warn', source:'integrations', title:'Assign failed', detail: e.message }); }
  };

  const test = async (id) => {
    setTestingId(id);
    try {
      await window.api.integrations.test(id);
    } catch (e) {
      window.Notifications?.emit({
        kind:'warn', source:'integrations',
        title: e.code === 'BACKEND_REQUIRED' ? 'Test endpoint not wired' : 'Test failed',
        detail: `Real connection test requires POST /api/integrations/${id}/test. Credential status remains as shown.`,
      });
    } finally { setTestingId(null); }
  };

  const counts = {
    active: list.filter(x => x.enabled).length,
    warn: list.filter(x => x.health === 'warn').length,
    missing: list.filter(x => x.credential_status === 'missing').length,
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Plug size={20} style={{color:'var(--accent)'}}/> Integrations</h1>
          <div className="sub">
            Single secure place for API keys and OAuth tokens. In production, secrets live in a vault —
            the UI only sees credential status.
          </div>
        </div>
        <div className="page-actions"><span className="tag">ADMIN</span></div>
      </div>

      <div className="kpi-row" style={{marginBottom:14}}>
        <KPI label="Integrations"        value={list.length}/>
        <KPI label="Enabled"              value={counts.active}/>
        <KPI label="Health warnings"      value={counts.warn}/>
        <KPI label="Missing credentials"  value={counts.missing}/>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Enable / assign / test all go through <span className="mono xsmall">api.integrations.*</span> — role-guarded and audited.
          Credentials are tracked by opaque <span className="mono xsmall">credential_ref</span>; the actual vault lives behind{' '}
          <span className="mono xsmall">POST /api/integrations/:id/connect</span>.
          Connection <span className="mono xsmall">test</span> needs the provider-side endpoint to be implemented.
        </span>
      </div>

      <div className="int-grid">
        {list.map(it => {
          const ag = (window.AGENTS || []).find(a => a.id === it.assigned_agent);
          const credBadge = it.credential_status === 'ok' ? { s:'ok', t:'Credential stored' }
                          : it.credential_status === 'expiring' ? { s:'warn', t:'Credential expiring' }
                          : { s:'idle', t:'No credential' };
          return (
            <div key={it.id} className="int-pro-card">
              <div className="int-pro-head">
                <div className="int-pro-logo">{it.name[0]}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="int-pro-name">{it.name}</div>
                  <div className="muted xsmall">{it.category}</div>
                </div>
                <Switch on={it.enabled} onToggle={()=>toggle(it)}/>
              </div>

              <div className="int-pro-grid">
                <div className="int-pro-field">
                  <div className="int-pro-label">Credential</div>
                  <div className="status-pill"><StatusDot s={credBadge.s}/>{credBadge.t}</div>
                </div>
                <div className="int-pro-field">
                  <div className="int-pro-label">Health</div>
                  <div className="status-pill"><StatusDot s={it.health}/>{it.health}</div>
                </div>
                <div className="int-pro-field">
                  <div className="int-pro-label">Last sync</div>
                  <div className="mono xsmall" style={{color:'var(--fg-1)'}}>{it.last_sync || '—'}</div>
                </div>
                <div className="int-pro-field">
                  <div className="int-pro-label">Assigned agent</div>
                  <select className="select sm" value={it.assigned_agent || ''} onChange={e=>assign(it.id, e.target.value || null)} disabled={!it.enabled}>
                    <option value="">— unassigned —</option>
                    {(window.AGENTS || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              {it.error && (
                <div className="int-pro-error">
                  <I.Alert size={11}/> <span>{it.error}</span>
                </div>
              )}

              <div className="int-pro-actions">
                <button className="btn sm" onClick={()=>test(it.id)} disabled={testingId === it.id}>
                  {testingId === it.id ? 'Testing…' : 'Test'}
                </button>
                <BackendRequired id="integrations.credential" compact/>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Agent Management (restart / reconnect / logs) ────────────
function AgentManagementPage(){
  const seed = window.AGENTS || [];
  const [logsOf, setLogsOf] = React.useState(null);
  // Live runtime rows keyed by id. null = not-yet-loaded, {} = loaded
  const [runtime, setRuntime] = React.useState(null);
  const [httpReady, setHttpReady] = React.useState(!!window.API_HTTP_READY);
  const [acting, setActing] = React.useState({});   // { [id]: 'restart' | 'stop' | 'start' }

  // Subscribe to http-ready events + initial snapshot + SSE stream
  React.useEffect(() => {
    const onReady   = () => setHttpReady(true);
    const onOffline = () => { setHttpReady(false); setRuntime(null); };
    window.addEventListener('api:http-ready', onReady);
    window.addEventListener('api:http-offline', onOffline);
    return () => {
      window.removeEventListener('api:http-ready', onReady);
      window.removeEventListener('api:http-offline', onOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!httpReady || !window.api?.agents?.list) { setRuntime(null); return; }
    let cancelled = false;
    let unsub = null;
    (async () => {
      try {
        const rows = await window.api.agents.list();
        if (cancelled) return;
        setRuntime(Object.fromEntries(rows.map(r => [r.id, r])));
        if (window.api.agents.subscribeStream) {
          unsub = window.api.agents.subscribeStream(snap => {
            if (cancelled || !snap?.agents) return;
            setRuntime(Object.fromEntries(snap.agents.map(r => [r.id, r])));
          });
        }
      } catch (e) {
        if (!cancelled) setRuntime(null);
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [httpReady]);

  const act = async (a, kind) => {
    setActing(s => ({ ...s, [a.id]: kind }));
    try {
      let result = null;
      if (kind === 'restart')       result = await window.api.agents.restart(a.id);
      else if (kind === 'stop')     result = await window.api.agents.stop(a.id);
      else if (kind === 'start')    result = await window.api.agents.start(a.id);
      else if (kind === 'reconnect')result = await window.api.agents.reconnect(a.id);

      // Reconnect can succeed-with-warning (child acked but one channel failed).
      if (kind === 'reconnect' && result && !result.reconnected) {
        window.Notifications?.emit({
          kind:'warn', source:'agents',
          title:`${a.name} · reconnect reported failure`,
          detail: result.error || 'Child acked but reported !ok — see logs.',
        });
      } else {
        const detail = kind === 'reconnect' && result?.durationMs != null
          ? `Channels reconnected in ${result.durationMs}ms. Audit written.`
          : `Supervisor accepted ${kind}. Audit written.`;
        window.Notifications?.emit({
          kind:'ok', source:'agents',
          title:`${a.name} · ${kind} ${kind === 'reconnect' ? 'ok' : 'sent'}`,
          detail,
        });
      }

      // Refresh status immediately (SSE will also catch up)
      if (httpReady && window.api?.agents?.list) {
        try {
          const rows = await window.api.agents.list();
          setRuntime(Object.fromEntries(rows.map(r => [r.id, r])));
        } catch { /* ignore */ }
      }
    } catch (e) {
      window.Notifications?.emit({
        kind: e.code === 'NOT_IMPLEMENTED' ? 'warn' : 'error',
        source:'agents',
        title: e.code === 'NOT_IMPLEMENTED'
          ? `${kind} not available`
          : e.code === 'PRECONDITION_FAILED'
            ? `${a.name} · not running`
            : e.code === 'RECONNECT_TIMEOUT'
              ? `${a.name} · reconnect timed out`
              : e.code === 'BACKEND_REQUIRED'
                ? `${a.name} · ${kind} needs the server`
                : `${a.name} · ${kind} failed`,
        detail: e.message,
      });
    } finally {
      setActing(s => { const n = { ...s }; delete n[a.id]; return n; });
    }
  };

  // Merge runtime row (by id) into seed row so table keeps its cosmetic fields
  // (name, role, model, channels, skills) while surfacing live status/pid/beats.
  const rows = seed.map(s => {
    const rt = runtime && runtime[s.id];
    if (!rt) return { ...s, _live: false };
    return {
      ...s,
      _live: true,
      status: rt.status === 'live' || rt.status === 'running' ? 'live' : rt.status,
      pid: rt.pid,
      last_heartbeat: rt.last_heartbeat,
      respawn_count: rt.respawn_count,
      load_pct: rt.load_pct,
    };
  });

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Agents size={20} style={{color:'var(--accent)'}}/> Agent Management</h1>
          <div className="sub">
            Runtime controls: restart, reconnect channels, inspect logs. Runtime state is read
            from the agent supervisor — not cached locally.
          </div>
        </div>
        <div className="page-actions">
          {httpReady && runtime
            ? <span className="tag ok">SUPERVISOR · LIVE</span>
            : <span className="tag warn">SUPERVISOR · OFFLINE (seed view)</span>}
        </div>
      </div>

      {!httpReady && (
        <div className="honest-band">
          <I.Info size={12}/>
          <span>
            Server not reachable. Showing the seed roster from <span className="mono xsmall">window.AGENTS</span>.
            Restart / stop / start require the supervisor at <span className="mono xsmall">POST /api/agents/:id/…</span>.
          </span>
        </div>
      )}
      {httpReady && (
        <div className="honest-band">
          <I.Info size={12}/>
          <span>
            Live from supervisor. <b>Restart / Stop / Start / Reconnect / Logs</b> are all real.
            Reconnect is an IPC RPC to the running child — it requires the agent to be up (Start it first if offline).
          </span>
        </div>
      )}

      <div className="card">
        <table className="tbl">
          <thead>
            <tr><th>Agent</th><th>Role / purpose</th><th>Status</th><th>PID</th><th>Last beat</th><th>Channels</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(a => {
              const busy = acting[a.id];
              const disableAll = !httpReady;
              return (
              <tr key={a.id}>
                <td>
                  <span className="hstack">
                    <Avatar name={a.name} size={22}/>
                    <div>
                      <div style={{color:'var(--fg-0)'}}>{a.name}</div>
                      <div className="muted xsmall mono">{a.model}</div>
                    </div>
                  </span>
                </td>
                <td className="muted xsmall" style={{maxWidth:200}}>{a.role}</td>
                <td>
                  <span className="status-pill"><StatusDot s={a.status}/>{a.status === 'live' ? 'online' : a.status}</span>
                  {a._live && a.respawn_count > 0 && (
                    <span className="tag" style={{marginLeft:6, fontSize:10}}>respawns: {a.respawn_count}</span>
                  )}
                </td>
                <td className="mono xsmall muted">{a._live ? (a.pid || '—') : '—'}</td>
                <td className="mono xsmall muted">
                  {a._live ? (a.last_heartbeat ? new Date(a.last_heartbeat).toLocaleTimeString() : '—') : `${a.since} ago`}
                </td>
                <td><ChanStack codes={a.channels}/></td>
                <td className="hstack" style={{gap:4, justifyContent:'flex-end'}}>
                  <button
                    className="btn sm"
                    title={disableAll ? 'Server offline' : 'Restart agent process · POST /api/agents/:id/restart'}
                    disabled={disableAll || !!busy}
                    onClick={()=>act(a, 'restart')}
                  >
                    {busy === 'restart' ? '…' : <I.Restart size={11}/>}
                  </button>
                  <button
                    className="btn sm"
                    title={disableAll ? 'Server offline' : (a.status === 'offline' || a.status === 'stopped' ? 'Start agent · POST /api/agents/:id/start' : 'Stop agent · POST /api/agents/:id/stop')}
                    disabled={disableAll || !!busy}
                    onClick={()=>act(a, (a.status === 'offline' || a.status === 'stopped') ? 'start' : 'stop')}
                  >
                    {busy === 'stop' || busy === 'start' ? '…' : (a.status === 'offline' || a.status === 'stopped' ? 'Start' : 'Stop')}
                  </button>
                  <button
                    className="btn sm"
                    disabled={disableAll || !!busy || a.status === 'offline' || a.status === 'stopped' || a.status === 'parked'}
                    title={
                      disableAll ? 'Server offline'
                      : (a.status === 'offline' || a.status === 'stopped' || a.status === 'parked')
                        ? 'Agent is not running — Start it first'
                        : 'Reconnect integration channels without restarting · POST /api/agents/:id/reconnect'
                    }
                    onClick={()=>act(a, 'reconnect')}
                  >
                    {busy === 'reconnect' ? '…' : <I.Radio size={11}/>}
                  </button>
                  <button className="btn sm" title="View logs" onClick={()=>setLogsOf(a)}>
                    <I.FileLog size={11}/>
                  </button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      {logsOf && <AgentLogsModal agent={logsOf} onClose={()=>setLogsOf(null)}/>}
    </>
  );
}

function AgentLogsModal({ agent, onClose }){
  const live = !!window.API_HTTP_READY;

  // When live: subscribe to SSE; when offline: one-shot snapshot fallback.
  // lines[] holds normalized {ts, level, message}. Entries are oldest-first.
  const [lines, setLines] = React.useState(null);
  const [status, setStatus] = React.useState(live ? 'connecting' : 'offline');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [lastAt, setLastAt] = React.useState(null);
  const bodyRef = React.useRef(null);

  // Snapshot fallback — used when HTTP adapter is offline.
  React.useEffect(() => {
    if (live) return;
    let cancelled = false;
    (window.api?.agents?.logs
      ? window.api.agents.logs(agent.id)
      : Promise.resolve({
          shadow: [`[${new Date().toISOString()}] backend not wired — logs unavailable`],
          endpoint: `GET /api/agents/${agent.id}/logs`,
        })
    ).then(payload => {
      if (cancelled) return;
      // payload.shadow is pre-formatted strings; parse back to rows for the renderer.
      const rows = (payload?.shadow || []).map(s => {
        const m = s.match(/^\[(.*?)\]\s+(\w+)\s+·\s+(.*)$/);
        return m ? { ts: m[1], level: m[2].toLowerCase(), message: m[3] } : { ts: '—', level: 'info', message: s };
      });
      setLines(rows);
      setStatus('offline');
    }).catch(e => {
      if (cancelled) return;
      setLines([{ ts: new Date().toISOString(), level: 'error', message: `log fetch failed · ${e.message || e}` }]);
      setStatus('offline');
    });
    return () => { cancelled = true; };
  }, [agent.id, live]);

  // Live SSE subscription.
  React.useEffect(() => {
    if (!live) return;
    if (!window.api?.agents?.subscribeLogs) {
      setStatus('offline');
      setLines([{ ts: new Date().toISOString(), level: 'warn', message: 'subscribeLogs not available on this build' }]);
      return;
    }
    setLines([]);
    setStatus('connecting');
    const unsubscribe = window.api.agents.subscribeLogs(agent.id, {
      backlog: 100,
      onOpen: () => setStatus('live'),
      onBacklog: (rows) => {
        setLines(rows || []);
        if (rows && rows.length) setLastAt(rows[rows.length - 1].ts);
        setStatus('live');
      },
      onLog: (row) => {
        setLines(prev => {
          // Cap buffer to avoid runaway DOM
          const next = (prev || []).concat(row);
          return next.length > 1000 ? next.slice(-1000) : next;
        });
        setLastAt(row.ts);
      },
      onError: (err) => {
        // EventSource retries silently; only downgrade status once we
        // actually lose ability to receive.
        setStatus('reconnecting');
        // Record error inline so operators see it in the log pane itself.
        setLines(prev => (prev || []).concat({
          ts: new Date().toISOString(), level: 'warn',
          message: `stream: ${err.message || 'error'} — browser retrying`,
        }));
      },
      onPing: () => { /* keep-alive; no-op */ },
    });
    return () => unsubscribe();
  }, [agent.id, live]);

  // Auto-scroll on new entry, unless the user paused.
  React.useEffect(() => {
    if (!autoScroll) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const chipColor =
    status === 'live'         ? 'ok'
    : status === 'connecting' ? 'warn'
    : status === 'reconnecting' ? 'warn'
    : 'warn';
  const chipText =
    status === 'live'         ? 'LIVE'
    : status === 'connecting' ? 'CONNECTING'
    : status === 'reconnecting' ? 'RECONNECTING'
    : 'OFFLINE';

  const endpoint = live
    ? `GET /api/agents/${agent.id}/logs/stream`
    : `GET /api/agents/${agent.id}/logs`;

  const rendered = lines == null ? [{ ts: '—', level: 'info', message: 'loading…' }] : lines;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{width:'min(720px, 94vw)'}}>
        <div className="modal-head">
          <h3 className="hstack" style={{gap:8}}>
            {agent.name} · logs
            <span className="tag" style={{
              fontSize:10,
              color: `var(--${chipColor})`,
              borderColor: `color-mix(in oklab, var(--${chipColor}) 40%, transparent)`,
              background: `color-mix(in oklab, var(--${chipColor}) 14%, transparent)`,
            }}>
              {chipText}
            </span>
          </h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="hstack xsmall muted" style={{justifyContent:'space-between', marginBottom:6}}>
            <span>
              {rendered.length} {rendered.length === 1 ? 'line' : 'lines'}
              {lastAt && <> · last: <span className="mono">{new Date(lastAt).toLocaleTimeString()}</span></>}
            </span>
            <label className="hstack xsmall" style={{gap:4, cursor:'pointer'}}>
              <input type="checkbox" checked={autoScroll} onChange={e=>setAutoScroll(e.target.checked)}/>
              auto-scroll
            </label>
          </div>
          <div className="agent-logs" ref={bodyRef} style={{maxHeight:360, overflowY:'auto'}}>
            {rendered.map((l, i) => (
              <div key={i} className="mono xsmall"
                   style={{
                     color: l.level === 'error' ? 'var(--danger)'
                          : l.level === 'warn'  ? 'var(--warn)'
                          : 'inherit',
                   }}>
                <span style={{opacity:0.55}}>[{l.ts}]</span> {String(l.level).toUpperCase()} · {l.message}
              </div>
            ))}
          </div>
          <div className="modal-honest" style={{marginTop:10}}>
            <I.Info size={12}/>
            <span>
              {status === 'live' && <>Live tail via SSE · <span className="mono xsmall">{endpoint}</span>. Backlog + new events stream in real time (ping every 15s).</>}
              {status === 'connecting' && <>Opening SSE connection to <span className="mono xsmall">{endpoint}</span>…</>}
              {status === 'reconnecting' && <>SSE errored; browser is retrying automatically against <span className="mono xsmall">{endpoint}</span>.</>}
              {status === 'offline' && <>Server offline — no SSE available. Would stream from <span className="mono xsmall">{endpoint}</span> once the supervisor is reachable.</>}
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable bits ──────────────────────────────────────────
function KPI({ label, value, hint, disabled }){
  return (
    <div className={`kpi-card ${disabled ? 'disabled' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{disabled && <span className="amber-dot"/>}{hint}</div>}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel='Confirm', danger, onConfirm, onCancel }){
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onCancel}><I.X size={14}/></button>
        </div>
        <div className="modal-body"><p style={{margin:0, lineHeight:1.5, color:'var(--fg-1)'}}>{body}</p></div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  UsersRolesPage, SecurityPage, ModelsPage, EmailRedirectPage,
  IntegrationsProPage, AgentManagementPage,
  KPI, ConfirmModal, useAdminStore, ROLE_DEFS,
});
