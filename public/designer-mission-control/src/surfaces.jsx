// Live meeting overlay, health page, and agent drawer

// ============================================================
// MeetingRoom — premium, HONEST.
//
// CONTRACT (do not regress):
//   - No fake participants. Starts with just "You" + a waiting state.
//   - No fake transcript. No fake chat. No claim of recording.
//   - Mic / camera / screen-share toggles only affect LOCAL UI state
//     and are labeled as such — they don't pretend a real media device
//     is active (no fake video feed, no fake "is sharing" overlay).
//   - Unwired provider features (recording, transcribe, invite agent,
//     real copy-link) are visibly disabled with an ADMIN WIRE-UP dot.
//   - Leave + close are real. Layout prefs are real. Local notes are real
//     and clearly labeled "notes to self — not sent anywhere".
// ============================================================

function MeetingRoom({ onClose, meeting }) {
  // Local-only UI state. These toggles DO NOT touch getUserMedia or any
  // provider SDK — they only toggle this component's presentation so the
  // UI can be previewed. The body copy reflects that truthfully.
  const [mic, setMic]       = React.useState(false);
  const [cam, setCam]       = React.useState(false);
  const [screen, setScreen] = React.useState(false);
  const [panel, setPanel]   = React.useState('details');  // details | notes | invite | agents
  const [layout, setLayout] = React.useState('single');   // single | dual | tri
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [notes, setNotes]   = React.useState([]);
  const [draft, setDraft]   = React.useState('');
  // Real local participants — agents added to this room. Tiles below render
  // these. Each carries a `pendingDispatch` flag because actually placing an
  // SDK call to bring the agent online requires a provider; until that ships,
  // we add the seat truthfully and label the dispatch as queued.
  const [roomAgents, setRoomAgents] = React.useState([]);

  // Real clipboard copy — uses Clipboard API in secure contexts and falls
  // back to execCommand for plain http://localhost preview frames.
  const { copy, copied, error: copyError } = (window.useClipboardCopy
    ? window.useClipboardCopy(2000)
    : { copy: () => {}, copied: false, error: null });

  // Real timer from the moment the component mounts.
  const startedAtRef = React.useRef(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Esc to leave.
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  const meetingTitle = meeting?.title || 'Untitled room';
  const roomUrl = `room://${(meeting?.id || 'local-preview').slice(0, 14)}`;

  const doCopy = () => {
    copy(roomUrl);
    window.api?.audit?.emit?.('meeting.link.copy', meeting?.id || 'local', { url: roomUrl });
  };

  const addAgentToRoom = (agentId) => {
    if (roomAgents.some(a => a.id === agentId)) return;
    const a = (window.AGENTS || []).find(x => x.id === agentId);
    if (!a) return;
    setRoomAgents(prev => [...prev, { id: a.id, name: a.name, role: a.role, status: a.status, addedAt: new Date(), pendingDispatch: true }]);
    // Audit the local invite — the provider dispatch is honestly queued.
    window.api?.audit?.emit?.('meeting.agent.invite', meeting?.id || 'local', { agent: a.id, name: a.name });
  };

  const removeAgentFromRoom = (agentId) => {
    const removed = roomAgents.find(a => a.id === agentId);
    setRoomAgents(prev => prev.filter(a => a.id !== agentId));
    if (removed) {
      window.api?.audit?.emit?.('meeting.agent.remove', meeting?.id || 'local', { agent: removed.id, name: removed.name });
    }
  };

  const addGroupToRoom = (group) => {
    const ids = (window.AGENT_GROUPS && window.AGENT_GROUPS[group]) || [];
    ids.forEach(id => addAgentToRoom(id));
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes(prev => [...prev, { id: Date.now(), t: new Date(), text }]);
    setDraft('');
  };

  // "You" avatar initials from whatever session identity we have.
  const me = (window.CURRENT_USER || window.ME || { name: 'You' });
  const initials = (me.name || 'You').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <>
      <div className="mrx-overlay" onClick={onClose}/>
      <div className="mrx-stage" role="dialog" aria-label="Meeting room preview" onClick={(e) => e.stopPropagation()}>

        {/* ───── TOP BAR ───── */}
        <div className="mrx-top">
          <div className="mrx-top-left">
            <span className="mrx-live-chip">LIVE READ-ONLY ROOM</span>
            <div className="mrx-title-block">
              <div className="mrx-title">{meetingTitle}</div>
              <div className="mrx-sub">
                <span className="mrx-honest-chip">No provider connected</span>
                <span>·</span>
                <span>Room UI active — provider join controls remain approval-gated</span>
              </div>
            </div>
          </div>

          <div className="mrx-top-center">
            <div className="mrx-timer" title="Local timer — started when you opened this room">
              <span className="mrx-timer-val">{fmtTime(elapsedSec)}</span>
              <span className="mrx-timer-label">local</span>
            </div>
          </div>

          <div className="mrx-top-right">
            <button
              className="mrx-pill-btn"
              onClick={() => setLayout(layout === 'single' ? 'dual' : layout === 'dual' ? 'tri' : 'single')}
              title="Switch tile layout (local preference only)">
              <I.Grid size={12}/> Layout
            </button>
            <button
              className={`mrx-pill-btn ${copied ? 'copied just-copied' : ''}`}
              onClick={doCopy}
              title={copyError ? `Copy failed: ${copyError}` : 'Copy room link to clipboard'}
            >
              <I.Copy size={12}/> {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button className="mrx-leave" onClick={onClose}>
              <I.Phone size={14}/> Leave
            </button>
          </div>
        </div>

        {/* ───── BODY ───── */}
        <div className="mrx-body">
          {/* STAGE */}
          <div className="mrx-stage-area">
            <div className={`mrx-grid ${layout}`}>
              {/* YOU tile — always real */}
              <div className={`mrx-tile is-you ${mic ? 'is-mic-on' : ''}`}>
                <div className="mrx-tile-center">
                  <div className="mrx-avatar-ring">
                    <span className="mrx-avatar-initials">{initials}</span>
                  </div>
                  <div className="mrx-tile-name">
                    {me.name || 'You'}
                    <span className="mrx-host-tag">You</span>
                  </div>
                  <div className="mrx-tile-role">
                    {cam ? 'Camera on (preview — no feed)' : 'Camera off'}
                  </div>
                </div>

                {!cam && (
                  <div className="mrx-camoff-note">
                    <I.CamOff size={11}/> No video — camera access not requested
                  </div>
                )}

                <div className="mrx-tile-br">
                  <div className={`mrx-state-icon ${mic ? 'on' : 'off'}`} title={mic ? 'Mic state: on (local UI only)' : 'Mic state: off (local UI only)'}>
                    {mic ? <I.Mic size={13}/> : <I.MicOff size={13}/>}
                  </div>
                </div>
              </div>

              {/* Real agent seats — added via the Invite tab. Tagged "Queued"
                  because the provider dispatch isn't wired yet. */}
              {roomAgents.map(a => (
                <div key={a.id} className="mrx-tile is-agent">
                  <div className="mrx-tile-center">
                    <div className="mrx-avatar-ring" style={{borderColor:'var(--accent)'}}>
                      <span className="mrx-avatar-initials">
                        {(a.name || 'A').split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="mrx-tile-name">
                      {a.name}
                      <span className="mrx-host-tag" style={{background:'var(--accent)', color:'#fff'}}>Agent</span>
                    </div>
                    <div className="mrx-tile-role">{a.role} · seat queued</div>
                  </div>
                  <div className="mrx-camoff-note" title="Provider dispatch pending — seat is real, the agent isn't connected yet">
                    <I.Info size={11}/> Dispatch queued · not yet on call
                  </div>
                  <div className="mrx-tile-br">
                    <button className="icon-btn" onClick={()=>removeAgentFromRoom(a.id)} title="Remove from room" style={{background:'rgba(0,0,0,0.45)'}}>
                      <I.X size={11}/>
                    </button>
                  </div>
                </div>
              ))}

              {/* "Empty" tiles only fill remaining slots in dual/tri layout — and only when no agents have been added */}
              {layout !== 'single' && roomAgents.length === 0 && (
                <div className="mrx-tile is-empty">
                  <div className="mrx-empty-inner">
                    <div className="mrx-empty-icon"><I.User size={20}/></div>
                    <div className="mrx-empty-head">Waiting for participants</div>
                    <div className="mrx-empty-body">
                      No one else is here. Add an agent from the <b>Invite</b> tab,
                      or wait for participants once a provider is connected.
                    </div>
                  </div>
                </div>
              )}
              {layout === 'tri' && roomAgents.length < 2 && (
                <div className="mrx-tile is-empty">
                  <div className="mrx-empty-inner">
                    <div className="mrx-empty-icon"><I.User size={20}/></div>
                    <div className="mrx-empty-head">Empty seat</div>
                    <div className="mrx-empty-body">Layout preview — no fake attendees.</div>
                  </div>
                </div>
              )}
            </div>

            {/* CONTROL DOCK */}
            <div className="mrx-dock-wrap">
              <div className="mrx-dock" role="toolbar" aria-label="Meeting controls">
                <button
                  className={`mrx-ctrl ${mic ? 'is-on' : 'is-off'}`}
                  onClick={() => setMic(!mic)}
                  title="Local UI state only — no microphone access requested">
                  <div className="mrx-ctrl-btn">{mic ? <I.Mic size={18}/> : <I.MicOff size={18}/>}</div>
                  <span className="mrx-ctrl-label">{mic ? 'Mic on' : 'Mic off'}</span>
                </button>

                <button
                  className={`mrx-ctrl ${cam ? 'is-on' : ''}`}
                  onClick={() => setCam(!cam)}
                  title="Local UI state only — no camera access requested">
                  <div className="mrx-ctrl-btn">{cam ? <I.Cam size={18}/> : <I.CamOff size={18}/>}</div>
                  <span className="mrx-ctrl-label">{cam ? 'Camera on' : 'Camera off'}</span>
                </button>

                <button
                  className={`mrx-ctrl ${screen ? 'is-on' : ''}`}
                  onClick={() => setScreen(!screen)}
                  title="Local UI state only — no screen capture active">
                  <div className="mrx-ctrl-btn">{screen ? <I.Screen size={18}/> : <I.Screen size={18}/>}</div>
                  <span className="mrx-ctrl-label">{screen ? 'Share on' : 'Share'}</span>
                </button>

                <div className="mrx-dock-sep"/>

                <button className="mrx-ctrl" disabled title="Recording requires a connected provider (ADMIN WIRE-UP)">
                  <div className="mrx-ctrl-btn">
                    <I.Dot size={18}/>
                    <span className="mrx-ctrl-nw-dot"/>
                  </div>
                  <span className="mrx-ctrl-label">Record</span>
                </button>

                <button className="mrx-ctrl" disabled title="Live transcript requires a connected provider (ADMIN WIRE-UP)">
                  <div className="mrx-ctrl-btn">
                    <I.FileLog size={18}/>
                    <span className="mrx-ctrl-nw-dot"/>
                  </div>
                  <span className="mrx-ctrl-label">Transcribe</span>
                </button>

                <button
                  className={`mrx-ctrl ${panel === 'invite' ? 'is-on' : ''}`}
                  onClick={() => setPanel('invite')}
                  title="Add an agent or saved group to this room (provider dispatch queued until ADMIN WIRE-UP)">
                  <div className="mrx-ctrl-btn">
                    <I.Agents size={18}/>
                  </div>
                  <span className="mrx-ctrl-label">Add agent</span>
                </button>

                <div className="mrx-dock-sep"/>

                <button
                  className={`mrx-ctrl ${panel === 'details' ? 'is-on' : ''}`}
                  onClick={() => setPanel(panel === 'details' ? 'notes' : 'details')}
                  title="Toggle side panel">
                  <div className="mrx-ctrl-btn"><I.Info size={18}/></div>
                  <span className="mrx-ctrl-label">Panel</span>
                </button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL */}
          <aside className="mrx-side">
            <div className="mrx-side-tabs">
              <button className={`mrx-side-tab ${panel==='details'?'active':''}`} onClick={() => setPanel('details')}>
                <I.Info size={12}/> Details
              </button>
              <button className={`mrx-side-tab ${panel==='notes'?'active':''}`} onClick={() => setPanel('notes')}>
                <I.FileLog size={12}/> Notes
              </button>
              <button className={`mrx-side-tab ${panel==='invite'?'active':''}`} onClick={() => setPanel('invite')}>
                <I.Link size={12}/> Invite
              </button>
            </div>

            <div className="mrx-side-panel">
              {panel === 'details' && (
                <>
                  <div className="mrx-detail-card">
                    <div className="mrx-detail-head">Room</div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Title</span>
                      <span className="mrx-detail-value">{meetingTitle}</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Provider</span>
                      <span className="mrx-detail-value muted">None</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Status</span>
                      <span className="mrx-detail-value warn">Provider setup pending</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Local elapsed</span>
                      <span className="mrx-detail-value">{fmtTime(elapsedSec)}</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Participants</span>
                      <span className="mrx-detail-value">1 (you only)</span>
                    </div>
                  </div>

                  <div className="mrx-detail-card">
                    <div className="mrx-detail-head">Local UI state</div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Microphone</span>
                      <span className={`mrx-detail-value ${mic ? 'ok' : 'muted'}`}>{mic ? 'On (UI)' : 'Off'}</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Camera</span>
                      <span className={`mrx-detail-value ${cam ? 'ok' : 'muted'}`}>{cam ? 'On (UI)' : 'Off'}</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Screen share</span>
                      <span className={`mrx-detail-value ${screen ? 'ok' : 'muted'}`}>{screen ? 'On (UI)' : 'Off'}</span>
                    </div>
                    <div className="mrx-detail-row">
                      <span className="mrx-detail-label">Layout</span>
                      <span className="mrx-detail-value">{layout}</span>
                    </div>
                  </div>

                  <div className="mrx-not-wired-card">
                    <div className="mrx-not-wired-head">
                      <I.Info size={11}/> Not wired in this build
                    </div>
                    These features need a connected conferencing provider
                    (Zoom / Teams / Meet / Webex) configured from
                    <b> Meetings &amp; Integrations</b>:
                    <ul className="mrx-not-wired-list">
                      <li>Actual audio / video / screen capture</li>
                      <li>Real join links &amp; participant presence</li>
                      <li>Recording</li>
                      <li>Live transcript &amp; captions</li>
                      <li>Dispatching the agents you've added (the seats are
                          real and queued — provider call still pending)</li>
                    </ul>
                  </div>
                </>
              )}

              {panel === 'notes' && (
                <>
                  <div className="mrx-note-head">
                    <div className="mrx-note-title">Your notes</div>
                    <span className="mrx-detail-value muted" style={{fontSize:11}}>{notes.length}</span>
                  </div>
                  <div className="mrx-note-sub">
                    Notes to self — kept locally in this session and
                    <b> not sent to anyone</b>. They disappear when you leave the room.
                  </div>
                  <div className="mrx-notes-list">
                    {notes.length === 0 ? (
                      <div className="mrx-notes-empty">No notes yet.</div>
                    ) : notes.map(n => (
                      <div key={n.id} className="mrx-note-row">
                        <div className="mrx-note-time">
                          {n.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="mrx-note-body">{n.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {panel === 'invite' && (
                <>
                  <div className="mrx-detail-card">
                    <div className="mrx-detail-head">Share link</div>
                    <div className="mrx-invite-url">
                      <I.Link size={12}/>
                      <span className="mrx-invite-url-text">{roomUrl}</span>
                      <button
                        className={`mrx-pill-btn ${copied ? 'copied just-copied' : ''}`}
                        onClick={doCopy}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {copyError && <div className="muted xsmall" style={{marginTop:6, color:'var(--err)'}}>Copy failed · {copyError}</div>}
                    {copied && <div className="muted xsmall" style={{marginTop:6, color:'var(--ok)'}}>Link copied to your clipboard.</div>}
                  </div>

                  <div className="mrx-detail-card">
                    <div className="mrx-detail-head">
                      Add agents to this room
                      <span className="muted xsmall" style={{fontWeight:400, marginLeft:8}}>
                        {roomAgents.length} added
                      </span>
                    </div>

                    {/* Saved groups — quick-pick buttons. Sourced from window.AGENT_GROUPS. */}
                    <div className="muted xsmall" style={{marginTop:8, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>
                      Saved groups
                    </div>
                    <div className="filter-row" style={{flexWrap:'wrap'}}>
                      {Object.entries(window.AGENT_GROUPS || {}).map(([key, members]) => (
                        <button
                          key={key}
                          className="filter-pill"
                          onClick={() => addGroupToRoom(key)}
                          title={`${members.length} agents · click to add all to room`}
                          style={{cursor:'pointer'}}
                        >
                          <I.Users size={11}/> {key} · {members.length}
                        </button>
                      ))}
                    </div>

                    {/* Individual agent picker — searchable select. */}
                    <div className="muted xsmall" style={{marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>
                      Individual agents
                    </div>
                    <select
                      className="select"
                      style={{width:'100%'}}
                      value=""
                      onChange={(e) => { if (e.target.value) addAgentToRoom(e.target.value); e.target.value = ''; }}
                    >
                      <option value="">— Pick an agent to add —</option>
                      {(window.AGENTS || [])
                        .filter(a => !roomAgents.some(r => r.id === a.id))
                        .map(a => (
                          <option key={a.id} value={a.id} disabled={a.status === 'offline'}>
                            {a.name} · {a.role}{a.status === 'offline' ? ' (offline)' : ''}
                          </option>
                        ))
                      }
                    </select>

                    {/* Current roster — real local participants. */}
                    {roomAgents.length > 0 && (
                      <div className="vstack" style={{gap:6, marginTop:10}}>
                        {roomAgents.map(a => (
                          <div key={a.id} className="hstack" style={{padding:'6px 8px', background:'var(--bg-2)', border:'1px solid var(--line-1)', borderRadius:6}}>
                            <Avatar name={a.name} size={22}/>
                            <div style={{flex:1, minWidth:0}}>
                              <div style={{fontSize:12, color:'var(--fg-0)', fontWeight:500}}>{a.name}</div>
                              <div className="muted xsmall">{a.role}</div>
                            </div>
                            <span className="tag warn" title="Seat reserved locally · provider dispatch queued">Queued</span>
                            <button className="icon-btn" onClick={()=>removeAgentFromRoom(a.id)} title="Remove from room">
                              <I.X size={12}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mrx-not-wired-card">
                    <div className="mrx-not-wired-head">
                      <I.Info size={11}/> What's actually wired here
                    </div>
                    Adding an agent or group is a real local action — they appear
                    as room seats and a <span className="mono">meeting.agent.invite</span> audit
                    row is written. Dispatching the agent into a real provider
                    call (placing them on Zoom / Teams / Meet) requires a
                    connected provider in <b>Meetings &amp; Integrations</b>.
                  </div>
                </>
              )}
            </div>

            {panel === 'notes' && (
              <div className="mrx-side-foot">
                <textarea
                  className="mrx-note-input"
                  placeholder="Jot a note (stays local)…"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault(); addNote();
                    }
                  }}
                />
                <button className="mrx-note-send" disabled={!draft.trim()} onClick={addNote} title="Save note (⌘/Ctrl + Enter)">
                  <I.Send size={14}/>
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function HealthPage() {
  const h = window.SYS_HEALTH;
  const uptime = [99.98,99.97,99.99,99.99,99.98,99.96,99.99,99.98,99.99,99.98];
  const latency = [320,340,380,360,395,410,382,370,390,385,400,382];
  const errs = [0.1,0.2,0.3,0.25,0.2,0.22,0.18,0.2,0.21,0.2,0.25,0.21];
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>System Health</h1>
          <div className="sub">Operational telemetry · 24-hour rolling</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card col-4">
          <div className="card-body">
            <div className="stat-label">Uptime · 30d</div>
            <div className="stat-big">{h.uptime}<span className="unit">%</span></div>
            <Sparkline data={uptime} w={220} h={36}/>
          </div>
        </div>
        <div className="card col-4">
          <div className="card-body">
            <div className="stat-label">p95 latency</div>
            <div className="stat-big">{h.p95}<span className="unit">ms</span></div>
            <Sparkline data={latency} w={220} h={36} stroke="var(--warn)"/>
          </div>
        </div>
        <div className="card col-4">
          <div className="card-body">
            <div className="stat-label">Error rate</div>
            <div className="stat-big" style={{color: h.errRate>1?'var(--err)':'var(--fg-0)'}}>{h.errRate}<span className="unit">%</span></div>
            <Sparkline data={errs} w={220} h={36} stroke="var(--err)"/>
          </div>
        </div>

        <div className="card col-8">
          <div className="card-head"><div className="card-title">Active incidents</div><span className="tag ok">0 open</span></div>
          <div className="card-body">
            <div className="ph-img" style={{height:100}}>No active incidents. Last incident: 14 days ago — resolved in 42m.</div>
          </div>
        </div>
        <div className="card col-4">
          <div className="card-head"><div className="card-title">Recent events</div></div>
          <div className="card-body vstack" style={{gap:8}}>
            {window.AUDIT.slice(0,4).map((e,i)=>(
              <div key={i} className="hstack" style={{gap:8}}>
                <StatusDot s={e.level==='warn'?'warn':'ok'}/>
                <div style={{flex:1, minWidth:0}}>
                  <div className="truncate" style={{fontSize:12}}>{e.action}</div>
                  <div className="mono xsmall muted">{e.ts}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function AgentDrawer({ agent, onClose }) {
  if (!agent) return null;
  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-head">
          <Avatar name={agent.name} size={32}/>
          <div style={{flex:1}}>
            <div style={{fontSize:15, color:'var(--fg-0)', fontWeight:500}}>{agent.name}</div>
            <div className="muted xsmall">{agent.role} · active {agent.since}</div>
          </div>
          <span className="status-pill"><StatusDot s={agent.status}/>{agent.status}</span>
          <button className="icon-btn" onClick={onClose}><I.X size={16}/></button>
        </div>
        <div className="drawer-body vstack" style={{gap:14}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
            {[
              {l:'Load', v: agent.status==='offline'?'—':`${agent.load}%`},
              {l:'Handled', v: agent.handled},
              {l:'SLA', v: agent.status==='offline'?'—':`${agent.sla}%`},
              {l:'Model', v: agent.model},
            ].map(s=>(
              <div key={s.l} style={{padding:'10px 12px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                <div className="stat-label">{s.l}</div>
                <div className="mono" style={{color:'var(--fg-0)', fontSize:16}}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Channels</div></div>
            <div className="card-body"><ChanStack codes={agent.channels}/></div>
          </div>

          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Controls</div></div>
            <div className="card-body hstack" style={{flexWrap:'wrap'}}>
              <button className="btn" disabled title="Use Settings → Agent Management · Restart is wired there with confirm + audit."><I.Restart/> Restart</button>
              <button className="btn" disabled title="Use Settings → Agent Management · Reconnect is wired there.">Reconnect</button>
              <button className="btn" disabled title="Agent pause not wired — supervisor needs a pause/resume RPC."><I.Pause/> Pause intake</button>
              <button className="btn" disabled title="Logs drawer — needs GET /api/agents/:id/logs"><I.FileLog/> Open logs</button>
              <button className="btn danger" disabled title="Force-offline not wired — use Settings → Agent Management.">Force offline</button>
            </div>
          </div>

          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Assigned skills</div></div>
            <div className="card-body hstack" style={{flexWrap:'wrap', gap:6}}>
              {window.SKILLS.slice(0,5).map(s=><Tag key={s.id}>{s.name}</Tag>)}
            </div>
          </div>

          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Recent activity</div></div>
            <div className="card-body vstack" style={{gap:8}}>
              {[
                `Handled TKT-4812 · Refund processing`,
                `Reconnected Telegram channel`,
                `Applied Refund & Cancellation Flow v2.4.1`,
                `Sent message to @user_3281`,
              ].map((t,i)=>(
                <div key={i} className="hstack" style={{gap:8}}>
                  <span className="dot ok"/>
                  <div className="truncate" style={{fontSize:12}}>{t}</div>
                  <span className="mono xsmall muted" style={{marginLeft:'auto'}}>{i*4+2}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { MeetingRoom, HealthPage, AgentDrawer });
