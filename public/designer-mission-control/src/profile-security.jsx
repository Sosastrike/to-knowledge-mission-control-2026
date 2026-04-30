// Profile + Security / 2FA settings pages — with working persona sync

function ProfilePage({ persona, onPersonaUpdate }) {
  const [name, setName] = React.useState(persona.name);
  const [email, setEmail] = React.useState(persona.email);
  const [phone, setPhone] = React.useState(persona.phone || '+1 555 0100');
  const [timezone, setTimezone] = React.useState(persona.timezone || 'America/Sao_Paulo');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => { setName(persona.name); setEmail(persona.email); }, [persona]);

  const save = () => {
    onPersonaUpdate({ ...persona, name, email, phone, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  const dirty = name !== persona.name || email !== persona.email;

  return (
    <>
      <div className="hstack" style={{marginBottom:12, justifyContent:'space-between'}}>
        <div className="muted xsmall">This name and email show in the top-right badge and in audit logs.</div>
        {saved && <span className="tag ok"><I.Check size={10}/> Saved to session</span>}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
        <div className="card">
          <div className="card-head"><div className="card-title">Identity</div><span className="tag">{persona.id.toUpperCase()}</span></div>
          <div className="card-body vstack" style={{gap:12}}>
            <div className="hstack" style={{gap:12}}>
              <Avatar name={name} size={48}/>
              <div>
                <div style={{color:'var(--fg-0)', fontSize:14}}>{name}</div>
                <div className="muted xsmall">{email}</div>
              </div>
              <div className="spacer"/>
              <button className="btn sm">Change avatar</button>
            </div>

            <div>
              <div className="stat-label" style={{marginBottom:4}}>Display name</div>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} style={{width:'100%'}}/>
            </div>
            <div>
              <div className="stat-label" style={{marginBottom:4}}>Email</div>
              <input className="input" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%'}}/>
            </div>
            <div>
              <div className="stat-label" style={{marginBottom:4}}>Phone (for SMS 2FA & meeting dial-in)</div>
              <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} style={{width:'100%'}}/>
            </div>
            <div>
              <div className="stat-label" style={{marginBottom:4}}>Timezone</div>
              <select className="select" value={timezone} onChange={e=>setTimezone(e.target.value)} style={{width:'100%'}}>
                <option>America/Sao_Paulo</option>
                <option>America/New_York</option>
                <option>Europe/London</option>
                <option>Europe/Berlin</option>
                <option>Asia/Dubai</option>
                <option>Asia/Tokyo</option>
              </select>
            </div>

            <div className="hstack" style={{marginTop:6}}>
              <button className="btn primary" onClick={save} disabled={!dirty && !saved}><I.Check size={12}/> Save profile</button>
              <button className="btn" onClick={()=>{setName(persona.name); setEmail(persona.email);}} disabled={!dirty}>Reset</button>
              <div className="spacer"/>
              {dirty && <span className="muted xsmall">Unsaved changes</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Signed-in session</div><span className="tag ok">ACTIVE</span></div>
          <div className="card-body vstack">
            <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
              <div style={{color:'var(--fg-0)'}}>Device</div><span className="mono xsmall">Chrome · macOS</span>
            </div>
            <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
              <div style={{color:'var(--fg-0)'}}>IP</div><span className="mono xsmall">189.34.12.41</span>
            </div>
            <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
              <div style={{color:'var(--fg-0)'}}>Last activity</div><span className="mono xsmall">now</span>
            </div>
            <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
              <div style={{color:'var(--fg-0)'}}>Role</div><span className="tag accent">{persona.id.toUpperCase()}</span>
            </div>
            <button className="btn danger sm" style={{marginTop:10, alignSelf:'flex-start'}}>Sign out all other sessions</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="card-head"><div className="card-title">Role preview</div><span className="tag">ROLE PREVIEW</span></div>
        <div className="card-body">
          <div className="muted xsmall" style={{marginBottom:10}}>Role preview is used only to inspect permissions. The live session remains authenticated by Mission Control.</div>
          <div className="hstack" style={{flexWrap:'wrap', gap:6}}>
            {window.PERSONAS.map((p,i) => (
              <button
                key={p.id}
                className={`btn sm ${p.id===persona.id?'primary':''}`}
                onClick={()=>window.__setPersonaIdx && window.__setPersonaIdx(i)}
              >
                <Avatar name={p.name} size={16}/> {p.name.split(' ')[0]} · {p.id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Security / 2FA ───────────────────────────────────────────
function SecurityPage({ persona }) {
  const [method, setMethod] = React.useState(persona.twofa || 'none'); // 'none' | 'auth' | 'sms'
  const [enrollOpen, setEnrollOpen] = React.useState(null); // null | 'auth' | 'sms'

  return (
    <>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-body hstack" style={{justifyContent:'space-between'}}>
          <div className="hstack">
            <I.Key style={{color: method==='none' ? 'var(--warn)' : 'var(--ok)'}}/>
            <div>
              <div style={{color:'var(--fg-0)', fontWeight:500}}>
                {method==='none' && 'Two-factor authentication is OFF'}
                {method==='auth' && 'Authenticator app enrolled'}
                {method==='sms' && 'SMS one-time codes enrolled'}
              </div>
              <div className="muted xsmall">
                {method==='none' && 'Your account is protected by password only. Enroll below to require a second factor on every sign-in.'}
                {method==='auth' && 'A TOTP code from your authenticator is required on every sign-in from a new device.'}
                {method==='sms' && 'A 6-digit code is sent to your phone via Twilio on every sign-in from a new device.'}
              </div>
            </div>
          </div>
          {method !== 'none' && (
            <div className="hstack">
              <span className="tag ok">ACTIVE</span>
              <button className="btn sm danger" onClick={()=>{ if (confirm('Disable 2FA?')) setMethod('none'); }}>Disable</button>
            </div>
          )}
        </div>
      </div>

      <div className="card-title" style={{marginBottom:8, fontSize:13}}>Methods</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14}}>

        <div className="card" style={{padding:14, borderColor: method==='auth' ? 'var(--ok)' : 'var(--line-1)'}}>
          <div className="hstack" style={{marginBottom:8}}>
            <div style={{width:32, height:32, borderRadius:8, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)'}}>
              <I.QR size={16}/>
            </div>
            <div>
              <div style={{color:'var(--fg-0)', fontWeight:500}}>Authenticator app</div>
              <div className="muted xsmall">1Password · Authy · Google Auth</div>
            </div>
            {method==='auth' && <span className="tag ok" style={{marginLeft:'auto'}}>ENROLLED</span>}
          </div>
          <div className="muted xsmall" style={{minHeight:34}}>Scan a QR code once, then generate 6-digit TOTP codes offline. Recommended.</div>
          <div className="hstack" style={{marginTop:8}}>
            {method==='auth'
              ? <><button className="btn sm">Re-enroll</button><button className="btn sm">View backup codes</button></>
              : <button className="btn primary sm" onClick={()=>setEnrollOpen('auth')}><I.QR size={12}/> Set up authenticator</button>
            }
          </div>
        </div>

        <div className="card" style={{padding:14, borderColor: method==='sms' ? 'var(--ok)' : 'var(--line-1)'}}>
          <div className="hstack" style={{marginBottom:8}}>
            <div style={{width:32, height:32, borderRadius:8, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)'}}>
              <I.Phone size={16}/>
            </div>
            <div>
              <div style={{color:'var(--fg-0)', fontWeight:500}}>SMS one-time code</div>
              <div className="muted xsmall">Twilio · {persona.phone || '+1 555 0100'}</div>
            </div>
            {method==='sms' && <span className="tag ok" style={{marginLeft:'auto'}}>ENROLLED</span>}
          </div>
          <div className="muted xsmall" style={{minHeight:34}}>Codes are sent via Twilio. Less secure than an authenticator (SIM-swap risk) but easier on shared devices.</div>
          <div className="hstack" style={{marginTop:8}}>
            {method==='sms'
              ? <button className="btn sm">Change phone</button>
              : <button className="btn primary sm" onClick={()=>setEnrollOpen('sms')}><I.Phone size={12}/> Enroll by SMS</button>
            }
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Recovery</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Backup codes</div><div className="muted xsmall">One-time printable codes in case you lose your authenticator</div></div>
            <button className="btn sm" disabled={method==='none'}>Generate 10 codes</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Trusted devices</div><div className="muted xsmall">Skip 2FA on devices you've marked trusted (30 days)</div></div>
            <button className="btn sm">Manage devices</button>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Hardware key (FIDO2)</div><div className="muted xsmall">YubiKey, Titan, or platform authenticator</div></div>
            <button className="btn sm">Register key</button>
          </div>
        </div>
      </div>

      {enrollOpen==='auth' && <EnrollAuthenticator persona={persona} onDone={()=>{ setMethod('auth'); setEnrollOpen(null); }} onCancel={()=>setEnrollOpen(null)}/>}
      {enrollOpen==='sms'  && <EnrollSMS          persona={persona} onDone={()=>{ setMethod('sms');  setEnrollOpen(null); }} onCancel={()=>setEnrollOpen(null)}/>}
    </>
  );
}

// Simple QR code rendered as SVG cells (not a real TOTP — visual only)
function QRGlyph({ size=150 }) {
  // Deterministic pseudo-random pattern
  const N = 21;
  const cells = [];
  let seed = 73;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed/233280; };
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) cells.push(rng() > 0.52);
  // Force the three finder squares
  const inFinder = (x,y) => (
    (x<7 && y<7) || (x>=N-7 && y<7) || (x<7 && y>=N-7)
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} style={{background:'#fff', borderRadius:6, padding:2, boxSizing:'content-box'}}>
      {cells.map((on,i) => {
        const x = i % N, y = Math.floor(i / N);
        if (inFinder(x,y)) return null;
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0a0a0a"/> : null;
      })}
      {[[0,0],[N-7,0],[0,N-7]].map(([ox,oy],k)=>(
        <g key={k}>
          <rect x={ox} y={oy} width={7} height={7} fill="#0a0a0a"/>
          <rect x={ox+1} y={oy+1} width={5} height={5} fill="#fff"/>
          <rect x={ox+2} y={oy+2} width={3} height={3} fill="#0a0a0a"/>
        </g>
      ))}
    </svg>
  );
}

function EnrollAuthenticator({ persona, onDone, onCancel }) {
  const [step, setStep] = React.useState(1); // 1 scan  2 verify
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState(null);
  const secret = 'JBSWY3DPEHPK3PXP-TKMC'; // demo

  const verify = () => {
    if (code.length !== 6 || !/^\d+$/.test(code)) { setErr('Enter the 6-digit code from your app'); return; }
    // Demo: accept any 6 digits
    onDone();
  };

  return (
    <>
      <div className="panel-overlay" onClick={onCancel}/>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Two-factor · step {step} of 2</div>
            <h3 style={{margin:'2px 0 0', fontSize:16, color:'var(--fg-0)'}}>
              {step===1 ? 'Scan the QR code' : 'Enter the 6-digit code'}
            </h3>
          </div>
          <button className="icon-btn" onClick={onCancel}><I.X size={14}/></button>
        </div>
        <div className="modal-body">
          {step===1 && (
            <>
              <div className="hstack" style={{alignItems:'flex-start', gap:16}}>
                <QRGlyph size={160}/>
                <div style={{flex:1}}>
                  <div className="muted xsmall" style={{marginBottom:8}}>Scan with your authenticator app (1Password, Authy, Google Authenticator).</div>
                  <div className="stat-label" style={{marginBottom:4}}>Or enter manually</div>
                  <div className="mono xsmall" style={{background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:6, padding:'6px 8px', wordBreak:'break-all'}}>{secret}</div>
                  <div className="muted xsmall" style={{marginTop:8}}>Account: <span className="mono">{persona.email}</span></div>
                  <div className="muted xsmall">Issuer: <span className="mono">ClaudeClaw</span></div>
                </div>
              </div>
              <div className="hstack" style={{marginTop:16, justifyContent:'flex-end'}}>
                <button className="btn" onClick={onCancel}>Cancel</button>
                <button className="btn primary" onClick={()=>setStep(2)}>I've scanned it · Continue</button>
              </div>
            </>
          )}
          {step===2 && (
            <>
              <div className="muted xsmall" style={{marginBottom:10}}>Enter the current 6-digit code from your authenticator to confirm the pairing.</div>
              <input
                className="input mono"
                style={{width:'100%', fontSize:22, letterSpacing:'0.3em', textAlign:'center', padding:'12px'}}
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e=>{setCode(e.target.value.replace(/\D/g,'')); setErr(null);}}
                autoFocus
              />
              {err && <div style={{color:'var(--err)', fontSize:12, marginTop:6}}>{err}</div>}
              <div className="hstack" style={{marginTop:16, justifyContent:'space-between'}}>
                <button className="btn" onClick={()=>setStep(1)}>← Back</button>
                <div className="hstack">
                  <button className="btn" onClick={onCancel}>Cancel</button>
                  <button className="btn primary" onClick={verify}><I.Check size={12}/> Verify & enroll</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function EnrollSMS({ persona, onDone, onCancel }) {
  const [step, setStep] = React.useState(1);
  const [phone, setPhone] = React.useState(persona.phone || '+1 555 0100');
  const [code, setCode] = React.useState('');
  const [sentTo, setSentTo] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const sendCode = () => {
    if (!/^\+?\d[\d\s\-\(\)]{6,}$/.test(phone)) { setErr('Enter a valid phone number with country code'); return; }
    setSentTo(phone); setStep(2); setErr(null);
  };
  const verify = () => {
    if (code.length !== 6 || !/^\d+$/.test(code)) { setErr('Enter the 6-digit code from your SMS'); return; }
    onDone();
  };

  return (
    <>
      <div className="panel-overlay" onClick={onCancel}/>
      <div className="modal" style={{maxWidth:420}}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>SMS 2FA · step {step} of 2</div>
            <h3 style={{margin:'2px 0 0', fontSize:16, color:'var(--fg-0)'}}>
              {step===1 ? 'Confirm your phone number' : 'Enter the code we sent'}
            </h3>
          </div>
          <button className="icon-btn" onClick={onCancel}><I.X size={14}/></button>
        </div>
        <div className="modal-body">
          {step===1 && (
            <>
              <div className="muted xsmall" style={{marginBottom:8}}>We'll send a 6-digit code via Twilio. Standard message rates apply.</div>
              <input className="input" style={{width:'100%'}} value={phone} onChange={e=>{setPhone(e.target.value); setErr(null);}} placeholder="+1 555 0100"/>
              {err && <div style={{color:'var(--err)', fontSize:12, marginTop:6}}>{err}</div>}
              <div className="hstack" style={{marginTop:16, justifyContent:'flex-end'}}>
                <button className="btn" onClick={onCancel}>Cancel</button>
                <button className="btn primary" onClick={sendCode}><I.Send size={12}/> Send code</button>
              </div>
            </>
          )}
          {step===2 && (
            <>
              <div className="muted xsmall" style={{marginBottom:10}}>Code sent to <span className="mono" style={{color:'var(--fg-0)'}}>{sentTo}</span>. <button className="btn-link" onClick={()=>setStep(1)}>Change number</button></div>
              <input
                className="input mono"
                style={{width:'100%', fontSize:22, letterSpacing:'0.3em', textAlign:'center', padding:'12px'}}
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e=>{setCode(e.target.value.replace(/\D/g,'')); setErr(null);}}
                autoFocus
              />
              {err && <div style={{color:'var(--err)', fontSize:12, marginTop:6}}>{err}</div>}
              <div className="muted xsmall" style={{marginTop:8}}>Didn't get it? <button className="btn-link">Resend</button></div>
              <div className="hstack" style={{marginTop:16, justifyContent:'flex-end'}}>
                <button className="btn" onClick={onCancel}>Cancel</button>
                <button className="btn primary" onClick={verify}><I.Check size={12}/> Verify & enroll</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ProfilePage, SecurityPage });
