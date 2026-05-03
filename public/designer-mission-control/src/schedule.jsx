// Schedule — horizontal line-cook flow

function ScheduleHeader({ dayIndex, setDayIndex }) {
  const slots = ['08','09','10','11','12','13','14','15','16','17','18','19'];
  return (
    <div className="schedule-head-row">
      <div style={{padding:'10px 16px', borderRight:'1px solid var(--line-1)', background:'var(--bg-1)'}}>
        <div className="stat-label">Lane</div>
        <div style={{fontSize:12, color:'var(--fg-0)'}}>Team · {new Date().toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'})}</div>
      </div>
      <div className="hr-time">
        {slots.map(s => <div key={s} className="hr-slot">{s}:00</div>)}
      </div>
    </div>
  );
}

function Schedule({ onTicket }) {
  const lanes = window.LANES;
  const [filter, setFilter] = React.useState('all');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const tickets = window.TICKETS.filter(t => t.status !== 'archived')
    .filter(t => filter==='all' || t.priority===filter);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Schedule</h1>
          <div className="sub">Line-cook flow · today · <span style={{color:'var(--fg-1)'}}>{window.TICKETS.filter(t=>t.status!=='archived'&&t.status!=='complete').length} active</span> tickets across {lanes.length} lanes</div>
        </div>
        <div className="page-actions">
          <div className="hstack" style={{gap:6}}>
            <button className="btn sm" disabled title="Multi-day schedule view — backend not wired (GET /api/schedule?day=…)"><I.Chevron style={{transform:'rotate(180deg)'}}/></button>
            <button className="btn sm" disabled title="Multi-day schedule view — backend not wired">Today</button>
            <button className="btn sm" disabled title="Multi-day schedule view — backend not wired"><I.Chevron/></button>
          </div>
          <button className="btn" onClick={()=>setFiltersOpen(v=>!v)}><I.Filter/> Filters</button>
          <button className="btn primary" onClick={()=>setNewOpen(true)}><I.Plus/> New ticket</button>
        </div>
      </div>
      {filtersOpen && (
        <div className="card" style={{marginBottom:12}}>
          <div className="card-body hstack" style={{gap:12, flexWrap:'wrap'}}>
            <div className="muted xsmall">Priority filter:</div>
            <ButtonGroup value={filter} onChange={setFilter} options={[
              {value:'all', label:'All', count: window.TICKETS.filter(t=>t.status!=='archived').length},
              {value:'high', label:'High', count: window.TICKETS.filter(t=>t.priority==='high').length},
              {value:'med', label:'Medium', count: window.TICKETS.filter(t=>t.priority==='med').length},
              {value:'low', label:'Low', count: window.TICKETS.filter(t=>t.priority==='low').length},
            ]}/>
            <div className="spacer"/>
            <button className="btn sm" onClick={()=>{ setFilter('all'); setFiltersOpen(false); }}>Clear + close</button>
          </div>
        </div>
      )}
      {newOpen && <NewTicketModal onClose={()=>setNewOpen(false)}/>}

      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={filter} onChange={setFilter} options={[
          {value:'all', label:'All', count: tickets.length},
          {value:'high', label:'High priority', count: window.TICKETS.filter(t=>t.priority==='high').length},
          {value:'med', label:'Medium', count: window.TICKETS.filter(t=>t.priority==='med').length},
          {value:'low', label:'Low', count: window.TICKETS.filter(t=>t.priority==='low').length},
        ]}/>
        <div className="spacer"/>
        <div className="hstack muted xsmall">
          <span className="dot err"/> High
          <span className="dot warn" style={{marginLeft:8}}/> Medium
          <span className="dot muted" style={{marginLeft:8}}/> Low
        </div>
      </div>

      <div className="card" style={{overflow:'auto'}}>
        <ScheduleHeader/>
        {lanes.map(lane => {
          const laneTickets = tickets.filter(t => t.lane === lane);
          return (
            <div key={lane} className="schedule-track">
              <div className="schedule-lane-head">
                <div style={{color:'var(--fg-0)', fontWeight:500, fontSize:13}}>{lane}</div>
                <div className="mono xsmall muted">{laneTickets.length} in queue</div>
                <div className="hstack" style={{marginTop:4}}>
                  {Array.from(new Set(laneTickets.map(t=>t.agent).filter(Boolean))).slice(0,3).map(aid => {
                    const ag = window.AGENTS.find(a=>a.id===aid);
                    return ag ? <Avatar key={aid} name={ag.name} size={18}/> : null;
                  })}
                </div>
              </div>
              <div className="schedule-lane">
                {laneTickets.map(t => {
                  const left = `${t.start*100}%`;
                  const width = `${(t.end - t.start)*100}%`;
                  const ag = window.AGENTS.find(a=>a.id===t.agent);
                  return (
                    <div key={t.id} className={`ticket p-${t.priority}`} style={{left, width}} onClick={()=>onTicket(t)}>
                      <div className="t-title truncate">{t.title}</div>
                      <div style={{flex:1}}><Progress value={t.progress} kind={t.progress===100?'ok':''}/></div>
                      <div className="t-meta">
                        {ag ? <><Avatar name={ag.name} size={14}/> <span className="truncate">{ag.name}</span></> : <span className="muted">Unassigned</span>}
                        <span className="spacer"/>
                        <span>{t.progress}%</span>
                        <span>·</span>
                        <span>{t.deadline}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Tasks({ onTicket, initialFilter }) {
  const [status, setStatus] = React.useState(() => initialFilter?.status || 'all');
  const [q, setQ] = React.useState('');
  const [exportOpen, setExportOpen] = React.useState(false);
  const [newTicketOpen, setNewTicketOpen] = React.useState(() => !!initialFilter?._newTicket);
  // If initialFilter updates mid-mount, honor it.
  React.useEffect(() => {
    if (initialFilter?.status) setStatus(initialFilter.status);
    if (initialFilter?._newTicket) setNewTicketOpen(true);
    if (initialFilter?.priority) {
      // No priority-only tab, but we prefill the search box so the filter is
      // honest rather than silently ignored.
      setStatus('all');
      setQ('');
    }
  }, [initialFilter]);
  const all = window.TICKETS;
  const tickets = all
    .filter(t => status==='all' || t.status===status)
    .filter(t => !initialFilter?.priority || t.priority === initialFilter.priority)
    .filter(t => !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.id.includes(q.toUpperCase()));

  const counts = {
    all: all.length,
    pending: all.filter(t=>t.status==='pending').length,
    assigned: all.filter(t=>t.status==='assigned').length,
    wip: all.filter(t=>t.status==='wip').length,
    complete: all.filter(t=>t.status==='complete').length,
    archived: all.filter(t=>t.status==='archived').length,
    hold: 0,
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Tasks</h1>
          <div className="sub">All tickets across agents · filter, assign, and drill into any row.</div>
        </div>
        <div className="page-actions">
          <div className="topbar-search" style={{width:260}}>
            <I.Search size={13}/>
            <input placeholder="Search by ID or title" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <button className="btn" onClick={()=>setExportOpen(true)}><I.Download/> Export</button>
          <button className="btn primary" onClick={()=>setNewTicketOpen(true)}><I.Plus/> New ticket</button>
        </div>
      </div>
      {exportOpen && <ReportModal onClose={()=>setExportOpen(false)}/>}
      {newTicketOpen && <NewTicketModal onClose={()=>setNewTicketOpen(false)}/>}

      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={status} onChange={setStatus} options={[
          {value:'all',     label:'All',            count: counts.all},
          {value:'pending', label:'Pending',        count: counts.pending},
          {value:'assigned',label:'Assigned',       count: counts.assigned},
          {value:'wip',     label:'Work in progress',count:counts.wip},
          {value:'complete',label:'Complete',       count: counts.complete},
          {value:'hold',    label:'On hold',        count: counts.hold},
          {value:'archived',label:'Archived',       count: counts.archived},
        ]}/>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:80}}>ID</th>
              <th>Title</th>
              <th style={{width:140}}>Customer</th>
              <th style={{width:160}}>Agent</th>
              <th style={{width:100}}>Lane</th>
              <th style={{width:110}}>Status</th>
              <th style={{width:140}}>Progress</th>
              <th style={{width:80}}>Due</th>
              <th style={{width:36}}></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => {
              const ag = window.AGENTS.find(a=>a.id===t.agent);
              return (
                <tr key={t.id} onClick={()=>onTicket(t)} style={{cursor:'pointer'}}>
                  <td className="mono muted xsmall">{t.id}</td>
                  <td style={{color:'var(--fg-0)'}} className="ellip">
                    <span className={`dot ${t.priority==='high'?'err':t.priority==='med'?'warn':'muted'}`} style={{marginRight:8, display:'inline-block'}}/>
                    {t.title}
                  </td>
                  <td className="ellip muted">{t.customer}</td>
                  <td>{ag ? <span className="hstack"><Avatar name={ag.name} size={18}/> <span>{ag.name}</span></span> : <span className="muted">— Unassigned</span>}</td>
                  <td><Tag>{t.lane}</Tag></td>
                  <td>
                    <span className="status-pill">
                      <StatusDot s={t.status==='complete'?'ok': t.status==='wip'?'live': t.status==='pending'?'warn':t.status==='assigned'?'warn':t.status==='archived'?'muted':'muted'}/>
                      <span style={{textTransform:'capitalize'}}>{t.status}</span>
                    </span>
                  </td>
                  <td><Progress value={t.progress} kind={t.progress===100?'ok':t.progress>60?'':t.progress>30?'warn':'err'}/></td>
                  <td className="mono xsmall">{t.deadline}</td>
                  <td><I.Chevron size={14} style={{color:'var(--fg-3)'}}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Ticket detail drawer — fully wired ─────────────────────────────────
// HONESTY:
//   - Status, priority, agent assignment, progress, notes all mutate
//     window.TICKETS and emit audit events. No fake "Save" buttons.
//   - Activity log is REAL: built from per-ticket events stored on the row
//     (window.TICKET_EVENTS[id]). No hard-coded "Sofia Martel said..." rows.
//   - Reply/internal note adds to the activity log + audit. Reply-to-customer
//     surfaces an honest disabled-state because no SMTP/SMS adapter is wired
//     to ticket replies yet.
function TaskDrawer({ ticket, onClose }) {
  if (!ticket) return null;
  // Look up the live row from the store so edits anywhere in the app reflect.
  const live = (window.TICKETS || []).find(t => t.id === ticket.id) || ticket;
  const [, force] = React.useReducer(x => x + 1, 0);
  const ag = window.AGENTS.find(a => a.id === live.agent);

  // Per-ticket activity log — initialized from a single creation event if
  // none exists. Stored on a window-level map so the drawer reflects mutations
  // performed from elsewhere in the session.
  React.useEffect(() => {
    window.TICKET_EVENTS = window.TICKET_EVENTS || {};
    if (!window.TICKET_EVENTS[live.id]) {
      window.TICKET_EVENTS[live.id] = [
        { who: 'System', what: `Ticket created · status=${live.status} · priority=${live.priority}`, at: Date.now() - 60_000 },
      ];
    }
  }, [live.id]);
  const events = (window.TICKET_EVENTS && window.TICKET_EVENTS[live.id]) || [];

  const pushEvent = (who, what) => {
    window.TICKET_EVENTS = window.TICKET_EVENTS || {};
    const arr = (window.TICKET_EVENTS[live.id] = window.TICKET_EVENTS[live.id] || []);
    arr.unshift({ who, what, at: Date.now() });
    force();
  };

  const patch = async (delta, label) => {
    Object.assign(live, delta, { updated_at: new Date().toISOString() });
    pushEvent('You', label);
    try { await window.api?.audit?.emit?.('ticket.update', live.id, delta); } catch(_) {}
    try { window.Notifications?.emit?.({ kind:'info', source:'tasks', title:'Ticket updated', detail:`${live.id} · ${label}` }); } catch(_) {}
    force();
  };

  const [notes, setNotes]   = React.useState('');
  const [noteKind, setNoteKind] = React.useState('internal'); // 'internal' | 'reply'
  const [sending, setSending] = React.useState(false);

  const sendNote = async () => {
    const body = notes.trim();
    if (body.length < 1) return;
    setSending(true);
    try {
      if (noteKind === 'reply') {
        // Customer-reply adapter — POST /api/tickets/:id/reply routes to
        // twilio.sendSMS or agentmail.sendMail based on ticket.contact_channel.
        // Server returns honest failure states (NO_CHANNEL / PROVIDER_NOT_CONFIGURED).
        if (!window.api?.tickets?.reply) {
          window.Notifications?.emit?.({
            kind:'warn', source:'tasks',
            title:'Customer reply not wired',
            detail:'Backend offline — saved as INTERNAL note. Start the server to enable replies.',
          });
          pushEvent('You (internal)', body);
        } else {
          try {
            const res = await window.api.tickets.reply(live.id, { body });
            if (res?.ok) {
              const ch = res.reply?.channel || live.contact_channel || '?';
              pushEvent(`You → customer via ${ch}`, body);
              window.Notifications?.emit?.({
                kind:'info', source:'tasks',
                title:`Reply sent · ${ch}`,
                detail:`Ticket ${live.id} · provider_id=${res.reply?.provider_id || '—'}`,
              });
            } else {
              // 200 with ok=false: transport recorded the failure
              pushEvent(`Reply FAILED (${res?.reply?.error_code || 'unknown'})`,
                `${body}  — ${res?.reply?.error_detail || 'send failed'}`);
              window.Notifications?.emit?.({
                kind:'error', source:'tasks',
                title:'Reply failed',
                detail: res?.reply?.error_detail || 'Transport reported failure — see activity log.',
              });
            }
          } catch (e) {
            // Server refused up-front (NO_CHANNEL, PROVIDER_NOT_CONFIGURED, auth, …).
            // These are the honest cases — surface the exact reason and fall back to internal.
            const code = e.code || 'REPLY_FAILED';
            const isRefusal = ['NO_CHANNEL','NO_ADDRESS','PROVIDER_NOT_CONFIGURED','INVALID_CHANNEL'].includes(code);
            const title = code === 'NO_CHANNEL'
              ? 'Ticket has no contact channel'
              : code === 'PROVIDER_NOT_CONFIGURED'
                ? `Reply channel not configured (${e.body?.provider || 'provider'})`
                : 'Reply failed';
            window.Notifications?.emit?.({
              kind: isRefusal ? 'warn' : 'error',
              source:'tasks',
              title,
              detail: e.message || code,
            });
            pushEvent(`Reply refused (${code})`, body);
          }
        }
      } else {
        pushEvent('You (internal)', body);
      }
      await window.api?.audit?.emit?.('ticket.update', live.id, { note: body, channel: noteKind });
      setNotes('');
    } catch (e) {
      window.Notifications?.emit?.({ kind:'error', source:'tasks', title:'Note failed', detail: e.message });
    } finally {
      setSending(false);
    }
  };

  // Deadline → relative remaining (real, computed). Falls back to a muted
  // "no deadline" if the ticket has none.
  const remain = (() => {
    if (!live.deadline) return null;
    const m = String(live.deadline).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const now = new Date();
    const d = new Date(now); d.setHours(+m[1], +m[2], 0, 0);
    if (d < now) d.setDate(d.getDate() + 1);
    const ms = d - now;
    const h = Math.floor(ms / 3_600_000), mm = Math.floor((ms % 3_600_000) / 60_000);
    return { h, m: mm, late: false };
  })();

  const ago = (at) => {
    const s = Math.floor((Date.now() - at) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    if (s < 86400) return `${Math.floor(s/3600)}h`;
    return `${Math.floor(s/86400)}d`;
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-head">
          <span className={`dot ${live.priority==='high'?'err':live.priority==='med'?'warn':'muted'}`}/>
          <div style={{flex:1, minWidth:0}}>
            <div className="mono xsmall muted">{live.id} · {live.lane}</div>
            <div style={{fontSize:15, color:'var(--fg-0)', fontWeight:500}}>{live.title}</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close"><I.X size={16}/></button>
        </div>

        <div className="drawer-body vstack" style={{gap:14}}>
          {/* ── Status / priority / agent — real selects, audit-on-change ── */}
          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">State</div></div>
            <div className="card-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div className="vstack" style={{gap:4}}>
                <div className="stat-label">Status</div>
                <select
                  className="select"
                  value={live.status}
                  onChange={e => patch({ status: e.target.value }, `Status → ${e.target.value}`)}
                >
                  {['queued','in_progress','blocked','complete','archived'].map(s =>
                    <option key={s} value={s}>{s.replace('_',' ')}</option>
                  )}
                </select>
              </div>
              <div className="vstack" style={{gap:4}}>
                <div className="stat-label">Priority</div>
                <select
                  className="select"
                  value={live.priority}
                  onChange={e => patch({ priority: e.target.value }, `Priority → ${e.target.value}`)}
                >
                  <option value="low">low</option>
                  <option value="med">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div className="vstack" style={{gap:4}}>
                <div className="stat-label">Assigned agent</div>
                <select
                  className="select"
                  value={live.agent || ''}
                  onChange={e => {
                    const id = e.target.value || null;
                    const a = (window.AGENTS || []).find(x => x.id === id);
                    patch({ agent: id }, id ? `Assigned → ${a?.name || id}` : 'Unassigned');
                  }}
                >
                  <option value="">Unassigned</option>
                  {(window.AGENTS || []).filter(a => a.status !== 'offline').map(a =>
                    <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
                  )}
                </select>
              </div>
              <div className="vstack" style={{gap:4}}>
                <div className="stat-label">Progress</div>
                <div className="hstack">
                  <input
                    type="range" min="0" max="100" step="5"
                    value={live.progress || 0}
                    onChange={e => {
                      const v = +e.target.value;
                      live.progress = v;
                      force();
                    }}
                    onMouseUp={e => patch({ progress: +e.target.value }, `Progress → ${e.target.value}%`)}
                    style={{flex:1}}
                  />
                  <span className="mono" style={{minWidth:38, textAlign:'right'}}>{live.progress || 0}%</span>
                </div>
                <Progress value={live.progress || 0}/>
              </div>
            </div>
          </div>

          {/* ── Meta strip ─────────────────────────────────────────── */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div className="card" style={{margin:0}}>
              <div className="card-body vstack" style={{gap:6}}>
                <div className="stat-label">Deadline</div>
                <div className="hstack" style={{justifyContent:'space-between'}}>
                  <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{live.deadline || '—'}</div>
                  {remain && <span className={`tag ${remain.h < 1 ? 'err' : remain.h < 3 ? 'warn' : ''}`}>{remain.h}h {remain.m}m</span>}
                  {!remain && <span className="muted xsmall">no deadline</span>}
                </div>
              </div>
            </div>
            <div className="card" style={{margin:0}}>
              <div className="card-body vstack" style={{gap:6}}>
                <div className="stat-label">Customer</div>
                <div style={{fontSize:13, color:'var(--fg-0)'}}>{live.customer || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── Quick actions ─────────────────────────────────────── */}
          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Actions</div></div>
            <div className="card-body hstack" style={{flexWrap:'wrap', gap:8}}>
              <button className="btn sm" disabled={live.status==='complete'} onClick={()=>patch({ status:'complete', progress:100 }, 'Marked complete')}>
                <I.Check/> Mark complete
              </button>
              <button className="btn sm" disabled={live.status==='blocked'} onClick={()=>patch({ status:'blocked' }, 'Marked blocked')}>
                <I.AlertTriangle/> Block
              </button>
              <button className="btn sm" onClick={()=>{
                const next = (window.AGENTS || []).find(a => a.role === 'tony') || (window.AGENTS || []).find(a => a.id === 'agent-zero');
                if (next) patch({ agent: next.id }, `Escalated to ${next.name}`);
              }}>
                <I.Flag/> Escalate to Agent Zero
              </button>
              <button className="btn sm" onClick={()=>{
                navigator.clipboard?.writeText(`${location.origin}/#ticket=${live.id}`);
                window.Notifications?.emit?.({ kind:'ok', source:'tasks', title:'Link copied', detail:live.id });
              }}>
                <I.External/> Copy link
              </button>
            </div>
          </div>

          {/* ── Activity (real events) ───────────────────────────── */}
          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Activity</div><span className="muted xsmall">{events.length} event{events.length===1?'':'s'}</span></div>
            <div className="card-body vstack" style={{gap:10, maxHeight:240, overflowY:'auto'}}>
              {events.length === 0 && <div className="muted xsmall">No activity yet.</div>}
              {events.map((a,i)=>(
                <div key={i} className="hstack" style={{alignItems:'flex-start', gap:10}}>
                  <Avatar name={a.who} size={22}/>
                  <div style={{flex:1}}>
                    <div><span style={{color:'var(--fg-0)'}}>{a.who}</span> <span className="muted">· {ago(a.at)} ago</span></div>
                    <div className="muted" style={{fontSize:12}}>{a.what}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Note composer ────────────────────────────────────── */}
          <div className="card" style={{margin:0}}>
            <div className="card-head"><div className="card-title">Add note</div></div>
            <div className="card-body vstack">
              <textarea
                className="input" rows="3"
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                placeholder="Internal note. Customer replies need an SMTP/SMS adapter."
                style={{resize:'vertical', width:'100%'}}
              />
              <div className="hstack" style={{justifyContent:'space-between'}}>
                <div className="filter-row">
                  <div className={`filter-pill ${noteKind==='internal'?'on':''}`} onClick={()=>setNoteKind('internal')}>Internal note</div>
                  <div
                    className={`filter-pill ${noteKind==='reply'?'on':''}`}
                    title="Customer reply requires SMTP/SMS adapter — not wired yet"
                    onClick={()=>setNoteKind('reply')}
                  >
                    Reply to customer · <span className="muted">not wired</span>
                  </div>
                </div>
                <button className="btn primary" disabled={sending || notes.trim().length === 0} onClick={sendNote}>
                  <I.Send/> {sending ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Schedule, Tasks, TaskDrawer });
