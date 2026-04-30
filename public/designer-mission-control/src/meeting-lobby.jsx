// Meeting lobby — waiting room + working "Invite External" modal

function MeetingLobby({ meeting, onEnter, onCancel }) {
  const [mic, setMic] = React.useState(true);
  const [cam, setCam] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const [invites, setInvites] = React.useState([
    { id:1, type:'email',  to:'priya@tkmc.co',       status:'accepted', when:'2m ago' },
    { id:2, type:'email',  to:'yusuf@tkmc.co',       status:'accepted', when:'2m ago' },
    { id:3, type:'email',  to:'guest@bluepeak.co',   status:'pending',  when:'just now' },
  ]);

  const [waiting, setWaiting] = React.useState([
    { name:'Diego Ramos', org:'BluePeak · Guest', email:'diego@bluepeak.co', joined:'4s ago' },
  ]);

  const admit   = (idx) => setWaiting(w => w.filter((_,i)=>i!==idx));
  const dismiss = (idx) => setWaiting(w => w.filter((_,i)=>i!==idx));

  const addInvite = (newOnes) => setInvites(prev => [...prev, ...newOnes]);

  return (
    <>
      <div className="panel-overlay"/>
      <div className="meeting-stage">
        {/* Lobby head */}
        <div style={{padding:'12px 16px', borderBottom:'1px solid var(--line-1)', display:'flex', alignItems:'center', gap:12}}>
          <span className="dot warn" style={{width:8, height:8}}/>
          <div>
            <div className="hstack"><b style={{color:'var(--fg-0)'}}>{meeting?.title || 'Weekly ops sync'}</b> <span className="tag">LOBBY</span></div>
            <div className="muted xsmall">Waiting to start · {invites.filter(i=>i.status==='accepted').length} accepted · {invites.filter(i=>i.status==='pending').length} pending</div>
          </div>
          <div className="spacer"/>
          <button className="btn" onClick={onCancel}><I.X size={14}/> Cancel</button>
        </div>

        <div style={{flex:1, display:'grid', gridTemplateColumns:'1fr 340px', minHeight:0}}>

          {/* Self-preview */}
          <div style={{padding:24, display:'flex', flexDirection:'column', gap:16, minHeight:0, alignItems:'center', justifyContent:'center'}}>

            <div style={{
              width:'min(560px, 92%)', aspectRatio:'16/9',
              background:'var(--bg-2)', borderRadius:12,
              border:'1px solid var(--line-2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              position:'relative', overflow:'hidden'
            }}>
              <div style={{position:'absolute', inset:0, background:'radial-gradient(600px 300px at 50% 40%, rgba(92,200,255,0.08), transparent 60%)'}}/>
              {cam ? (
                <div className="muted xsmall">Camera preview</div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
                  <Avatar name={(window.PERSONAS[window.__personaIdx||0]).name} size={72}/>
                  <div style={{color:'var(--fg-0)'}}>{(window.PERSONAS[window.__personaIdx||0]).name}</div>
                  <div className="muted xsmall">Camera is off</div>
                </div>
              )}
              <div style={{position:'absolute', bottom:10, left:14}} className="hstack">
                <span className="tag">YOU</span>
                {!mic && <span className="tag" style={{color:'var(--err)', borderColor:'var(--err)'}}><I.MicOff size={10}/> muted</span>}
              </div>
            </div>

            <div className="hstack" style={{gap:10}}>
              <button className={`btn ${mic?'':'danger'}`} onClick={()=>setMic(!mic)}>{mic ? <I.Mic/> : <I.MicOff/>} {mic?'Mic on':'Mic muted'}</button>
              <button className={`btn ${cam?'primary':''}`} onClick={()=>setCam(!cam)}><I.Cam/> {cam?'Camera on':'Camera off'}</button>
              <button className="btn" disabled title="Device picker — needs getUserMedia.enumerateDevices wired in."><I.Settings2/> Devices</button>
            </div>

            <button className="btn primary" style={{padding:'10px 22px', fontSize:14}} onClick={()=>onEnter({mic, cam})}>
              Enter meeting →
            </button>
          </div>

          {/* Right rail: waiting room + invites */}
          <aside style={{borderLeft:'1px solid var(--line-1)', display:'flex', flexDirection:'column', minHeight:0, background:'var(--bg-1)'}}>

            <div style={{padding:'10px 14px', borderBottom:'1px solid var(--line-1)'}} className="hstack">
              <span style={{fontSize:11, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Waiting room</span>
              <span className="tag" style={{marginLeft:'auto'}}>{waiting.length}</span>
            </div>

            <div style={{padding:12, borderBottom:'1px solid var(--line-1)'}}>
              {waiting.length===0
                ? <div className="muted xsmall">No one waiting.</div>
                : waiting.map((w,i)=>(
                  <div key={i} className="hstack" style={{padding:'8px 0', borderBottom:i<waiting.length-1?'1px solid var(--line-1)':'none', gap:8}}>
                    <Avatar name={w.name} size={28}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{color:'var(--fg-0)', fontSize:12}}>{w.name}</div>
                      <div className="muted xsmall truncate">{w.org} · {w.joined}</div>
                    </div>
                    <button className="btn sm primary" onClick={()=>admit(i)}><I.Check size={12}/> Admit</button>
                    <button className="icon-btn" onClick={()=>dismiss(i)} title="Dismiss"><I.X size={12}/></button>
                  </div>
                ))
              }
            </div>

            <div style={{padding:'10px 14px', borderBottom:'1px solid var(--line-1)'}} className="hstack">
              <span style={{fontSize:11, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Invites</span>
              <div className="spacer"/>
              <button className="btn sm primary" onClick={()=>setInviteOpen(true)}><I.Plus size={12}/> Invite people</button>
            </div>

            <div style={{flex:1, overflow:'auto', padding:12}}>
              {invites.map(inv => (
                <div key={inv.id} className="hstack" style={{padding:'8px 0', borderBottom:'1px solid var(--line-1)', gap:8}}>
                  <div style={{width:26, height:26, borderRadius:'50%', background:'var(--bg-3)', border:'1px solid var(--line-2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-2)'}}>
                    {inv.type==='email' && <I.Mail size={12}/>}
                    {inv.type==='sms'   && <I.Phone size={12}/>}
                    {inv.type==='link'  && <I.Link size={12}/>}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="truncate" style={{color:'var(--fg-0)', fontSize:12}}>{inv.to}</div>
                    <div className="muted xsmall">{inv.when}</div>
                  </div>
                  {inv.status==='accepted' && <span className="tag ok">accepted</span>}
                  {inv.status==='pending'  && <span className="tag warn">pending</span>}
                  {inv.status==='declined' && <span className="tag" style={{color:'var(--err)', borderColor:'var(--err)'}}>declined</span>}
                </div>
              ))}
            </div>

            <div style={{padding:10, borderTop:'1px solid var(--line-1)'}} className="vstack">
              <div className="muted xsmall">Meeting link</div>
              <div className="hstack" style={{gap:6}}>
                <input className="input mono xsmall" readOnly value={`mc.knowledge-vs-ai.com/j/${(meeting?.id||'wk-ops').toLowerCase()}`} style={{flex:1}}/>
                <button className="btn sm" onClick={()=>navigator.clipboard?.writeText(`https://mc.knowledge-vs-ai.com/j/${(meeting?.id||'wk-ops').toLowerCase()}`)}><I.Copy size={12}/></button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {inviteOpen && <InviteExternalModal onAdd={addInvite} onClose={()=>setInviteOpen(false)} meeting={meeting}/>}
    </>
  );
}

function InviteExternalModal({ onAdd, onClose, meeting }) {
  const [tab, setTab] = React.useState('email'); // 'email' | 'sms' | 'link'
  const [emails, setEmails] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [role, setRole] = React.useState('guest');
  const [expiry, setExpiry] = React.useState('4h');
  const [err, setErr] = React.useState(null);
  const [linkCopied, setLinkCopied] = React.useState(false);

  const link = `https://mc.knowledge-vs-ai.com/j/${(meeting?.id||'wk-ops').toLowerCase()}?guest=${Math.random().toString(36).slice(2,8)}`;

  const send = () => {
    if (tab==='email') {
      const list = emails.split(/[,\n\s]+/).filter(Boolean);
      const bad = list.find(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      if (bad || list.length===0) { setErr(bad ? `Not a valid email: ${bad}` : 'Add at least one email'); return; }
      onAdd(list.map((to,i)=>({ id: Date.now()+i, type:'email', to, status:'pending', when:'just now' })));
      onClose();
    } else if (tab==='sms') {
      if (!/^\+?\d[\d\s\-\(\)]{6,}$/.test(phone)) { setErr('Enter a valid phone number with country code'); return; }
      onAdd([{ id: Date.now(), type:'sms', to: phone, status:'pending', when:'just now' }]);
      onClose();
    } else {
      onAdd([{ id: Date.now(), type:'link', to: link.replace('https://',''), status:'pending', when:'just now' }]);
      onClose();
    }
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:560, zIndex:211}}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Meeting · {meeting?.title || 'Weekly ops sync'}</div>
            <h3 style={{margin:'2px 0 0', fontSize:16, color:'var(--fg-0)'}}>Invite external participants</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab==='email'?'active':''}`} onClick={()=>{setTab('email'); setErr(null);}}><I.Mail size={12}/> Email</button>
          <button className={`modal-tab ${tab==='sms'?'active':''}`} onClick={()=>{setTab('sms'); setErr(null);}}><I.Phone size={12}/> SMS</button>
          <button className={`modal-tab ${tab==='link'?'active':''}`} onClick={()=>{setTab('link'); setErr(null);}}><I.Link size={12}/> Share link</button>
        </div>

        <div className="modal-body">
          {tab==='email' && (
            <>
              <div className="stat-label" style={{marginBottom:4}}>Emails (comma- or newline-separated)</div>
              <textarea
                className="input"
                style={{width:'100%', minHeight:80, fontFamily:'inherit'}}
                placeholder="guest@bluepeak.co, partner@acme.io"
                value={emails}
                onChange={e=>{setEmails(e.target.value); setErr(null);}}
                autoFocus
              />
            </>
          )}
          {tab==='sms' && (
            <>
              <div className="stat-label" style={{marginBottom:4}}>Phone number</div>
              <input className="input" style={{width:'100%'}} placeholder="+1 555 0100" value={phone} onChange={e=>{setPhone(e.target.value); setErr(null);}} autoFocus/>
              <div className="muted xsmall" style={{marginTop:6}}>Via Twilio · standard SMS rates apply.</div>
            </>
          )}
          {tab==='link' && (
            <>
              <div className="stat-label" style={{marginBottom:4}}>Share this link</div>
              <div className="hstack" style={{gap:6}}>
                <input className="input mono xsmall" readOnly value={link} style={{flex:1}}/>
                <button className="btn" onClick={()=>{navigator.clipboard?.writeText(link); setLinkCopied(true); setTimeout(()=>setLinkCopied(false), 2000);}}>
                  {linkCopied ? <><I.Check size={12}/> Copied</> : <><I.Copy size={12}/> Copy</>}
                </button>
              </div>
              <div className="muted xsmall" style={{marginTop:6}}>Anyone with this link can request to join. You'll admit them from the lobby.</div>
            </>
          )}

          <div className="hstack" style={{marginTop:14, gap:12, flexWrap:'wrap'}}>
            <div>
              <div className="stat-label" style={{marginBottom:4}}>Role in meeting</div>
              <select className="select" value={role} onChange={e=>setRole(e.target.value)}>
                <option value="guest">Guest (view + chat)</option>
                <option value="speaker">Speaker (can unmute)</option>
                <option value="co-host">Co-host (full control)</option>
              </select>
            </div>
            <div>
              <div className="stat-label" style={{marginBottom:4}}>Link expiry</div>
              <select className="select" value={expiry} onChange={e=>setExpiry(e.target.value)}>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
              </select>
            </div>
          </div>

          {tab !== 'link' && (
            <>
              <div className="stat-label" style={{marginTop:12, marginBottom:4}}>Note (optional)</div>
              <textarea className="input" style={{width:'100%', minHeight:50, fontFamily:'inherit'}} placeholder="Added to the invite." value={msg} onChange={e=>setMsg(e.target.value)}/>
            </>
          )}

          {err && <div style={{color:'var(--err)', fontSize:12, marginTop:8}}>{err}</div>}

          <div className="hstack" style={{marginTop:16, justifyContent:'space-between'}}>
            <div className="muted xsmall">External guests see a branded join page. Admission is required.</div>
            <div className="hstack">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={send}>
                {tab==='email' && <><I.Send size={12}/> Send invites</>}
                {tab==='sms'   && <><I.Send size={12}/> Send SMS</>}
                {tab==='link'  && <><I.Link size={12}/> Add to meeting</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { MeetingLobby, InviteExternalModal });
