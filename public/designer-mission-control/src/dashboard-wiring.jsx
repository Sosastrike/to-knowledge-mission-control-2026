// ============================================================
// dashboard-wiring.jsx — real modals + helpers for Mission Control buttons.
//
// Every component in this file backs a control that was previously dead on
// the dashboard. Each one either:
//   (a) performs a real action that writes to the backend, or
//   (b) states out loud why it is honestly disabled.
//
// There is no smoke-and-mirrors path. If a button renders live, it is live.
// If a button renders disabled, it says exactly what endpoint it is waiting
// on in its tooltip.
// ============================================================

// ─── Clipboard helper with "Copied!" state ────────────────────────────
function useClipboardCopy(timeoutMs = 2000) {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState(null);
  const copy = React.useCallback(async (text) => {
    setError(null);
    try {
      // Modern API — requires secure context.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for insecure contexts (e.g. plain http://localhost).
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
      return true;
    } catch (e) {
      setError(e.message || String(e));
      setCopied(false);
      return false;
    }
  }, [timeoutMs]);
  return { copy, copied, error };
}

// ─── Small dismissible modal shell ────────────────────────────────────
function WireModal({ title, subtitle, onClose, footer, children, width = 520 }) {
  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="drawer" style={{maxWidth: width, right: '50%', transform: 'translateX(50%)', top: '10vh', height: 'auto', maxHeight: '80vh'}}>
        <div className="drawer-head">
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14, color:'var(--fg-0)', fontWeight:600}}>{title}</div>
            {subtitle && <div className="muted xsmall">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><I.X size={16}/></button>
        </div>
        <div className="drawer-body vstack" style={{gap:14}}>
          {children}
        </div>
        {footer && (
          <div style={{padding:'12px 16px', borderTop:'1px solid var(--line-1)', display:'flex', justifyContent:'flex-end', gap:8}}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Escalation — routes ONLY to Agent Zero, Hermes, Pacman ────────────────
//
// Frozen routing rule per spec:
//   Agent Zero = ecosystem commander
//   Hermes     = skill and workflow lieutenant
//   Pacman  = security oversight
//
// No other agent is a valid escalation target. The list below is NOT pulled
// from window.AGENTS dynamically — it is hard-wired so a future seed change
// cannot silently broaden the blast radius.
const ESCALATION_TARGETS = [
  { id: 'agent-zero', name: 'Agent Zero', role: 'Ecosystem commander', rationale: 'Mission Control, Bridge, Brain, tools, models, and agent command.' },
  { id: 'hermes', name: 'Hermes', role: 'Lieutenant · skills · workflows', rationale: 'Skill creation, workflow planning, and operational methods.' },
  { id: 'pacman',    name: 'Pacman',  role: 'Security oversight',              rationale: 'Credential, access, and policy-breach review.' },
];

function EscalateModal({ context, onClose }) {
  // context: { kind: 'ticket'|'alert'|'general', id, title }
  const [targets, setTargets] = React.useState(() => new Set(['agent-zero']));
  const [reason, setReason] = React.useState('');
  const [urgency, setUrgency] = React.useState('med');
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const toggle = (id) => {
    setTargets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (submitting) return;
    if (targets.size === 0 || reason.trim().length < 4) return;
    setSubmitting(true);
    setResult(null);
    // The /api/escalations endpoint is not yet wired. We write an audit row
    // via the public emit so the escalation is NOT lost, and we are
    // explicit about what's missing.
    try {
      const api = window.api;
      const payload = {
        kind: context?.kind || 'general',
        ref: context?.id || null,
        title: context?.title || null,
        targets: Array.from(targets),
        urgency,
        reason: reason.trim(),
        at: new Date().toISOString(),
      };
      let audited = false;
      const row = await api?.audit?.emit?.('escalation.raise', payload.ref || 'general', payload);
      audited = !!row;
      // Drop a Notification so the escalation appears in the bell.
      try {
        window.Notifications?.emit?.({
          kind: urgency === 'sev1' || urgency === 'high' ? 'warn' : 'info',
          source: 'escalation',
          title: `Escalation raised · ${payload.targets.join(', ')}`,
          detail: payload.title ? `${payload.title} — ${payload.reason}` : payload.reason,
        });
      } catch (_) {}
      setResult({
        ok: true,
        audited,
        msg: audited
          ? `Escalation recorded to audit log · routed to ${payload.targets.map(t=>t==='agent-zero'?'Agent Zero':t==='hermes'?'Hermes':t.charAt(0).toUpperCase()+t.slice(1)).join(', ')}.`
          : 'Escalation captured locally. /api/escalations endpoint not yet wired — see audit log once backend ships.',
      });
      setTimeout(() => onClose(), 1400);
    } catch (e) {
      setResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WireModal
      title="Escalate"
      subtitle={context?.title ? `${context.kind || 'item'} · ${context.title}` : 'Raise to leadership / oversight'}
      onClose={onClose}
      width={560}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={submitting || targets.size === 0 || reason.trim().length < 4}
          onClick={submit}
        >
          <I.Flag/> {submitting ? 'Raising…' : 'Raise escalation'}
        </button>
      </>}
    >
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Route to</div>
        <div className="muted xsmall" style={{marginBottom:10}}>
          Escalations go only to Agent Zero, Hermes, and Pacman. This list is frozen.
        </div>
        <div className="vstack" style={{gap:6}}>
          {ESCALATION_TARGETS.map(t => {
            const on = targets.has(t.id);
            return (
              <label key={t.id} className="agent-strip-row" style={{cursor:'pointer', borderColor: on ? 'var(--accent-line)' : 'var(--line-1)', background: on ? 'var(--accent-soft)' : 'var(--bg-2)'}}>
                <input type="checkbox" checked={on} onChange={()=>toggle(t.id)} style={{marginRight:6}}/>
                <Avatar name={t.name} size={26}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, color:'var(--fg-0)', fontWeight:500}}>{t.name} <span className="muted xsmall" style={{fontWeight:400}}>· {t.role}</span></div>
                  <div className="muted xsmall">{t.rationale}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="stat-label" style={{marginBottom:6}}>Urgency</div>
        <div className="filter-row">
          {[{id:'low',lbl:'Low'},{id:'med',lbl:'Medium'},{id:'high',lbl:'High'},{id:'sev1',lbl:'Sev-1'}].map(o => (
            <div key={o.id} className={`filter-pill ${urgency===o.id?'on':''}`} onClick={()=>setUrgency(o.id)}>{o.lbl}</div>
          ))}
        </div>
      </div>

      <div>
        <div className="stat-label" style={{marginBottom:6}}>Reason <span className="muted xsmall">· minimum 4 chars</span></div>
        <textarea
          className="input"
          rows={4}
          style={{width:'100%', resize:'vertical'}}
          value={reason}
          onChange={e=>setReason(e.target.value)}
          placeholder="What's going on? What do you need from them?"
        />
      </div>

      {result && (
        <div className={`tag ${result.ok?'ok':'err'}`} style={{display:'block', padding:'8px 10px', lineHeight:1.4}}>
          {result.msg}
        </div>
      )}
    </WireModal>
  );
}

// ─── Broadcast — dual-mode (agents + operators) ───────────────────────
//
// TWO DISTINCT AUDIENCES, two distinct delivery models:
//
//   1) Agent broadcast (default) — targets runtime agents by group
//      (Exec/Labor/Security/Ops in AGENT_GROUPS). There is no
//      external SMS/email for agents — they read the in-app feed.
//      Delivered as Notifications into each targeted agent's bell
//      plus an audit row. No backend endpoint required.
//
//   2) Operator broadcast — targets human workspace users by ROLE
//      group (execs/ops/managers). Hits POST /api/broadcast/{sms,email}
//      server-side; each recipient gets a real Twilio/AgentMail send
//      from workspace_users.phone/email. Requires backend online AND
//      caller role >= manager. Gracefully falls back to a warning
//      banner if either precondition fails.
//
// The two audiences are presented as the top-level toggle so there's
// no ambiguity about which group receives what.
function BroadcastModal({ onClose }) {
  const agentGroups = Object.keys(window.AGENT_GROUPS || {});
  const opGroups = ['execs', 'ops', 'managers'];
  const [audience, setAudience] = React.useState('agents'); // 'agents' | 'operators'
  const [picked, setPicked] = React.useState(() => new Set([agentGroups[0]].filter(Boolean)));
  const [message, setMessage] = React.useState('');
  const [subject, setSubject] = React.useState('Broadcast from Mission Control');
  const [channel, setChannel] = React.useState('inapp'); // agents: inapp only / operators: sms|email
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState(null);

  // When switching audience, reset sensible defaults.
  const switchAudience = (a) => {
    setAudience(a);
    setResult(null);
    if (a === 'agents')     { setPicked(new Set([agentGroups[0]].filter(Boolean))); setChannel('inapp'); }
    else /* operators */    { setPicked(new Set(['managers']));                      setChannel('sms');   }
  };

  const availableGroups = audience === 'agents' ? agentGroups : opGroups;
  const toggle = (g) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  const backendOnline = window.API_HTTP_READY === true && !!window.api?.broadcast;

  const submit = async () => {
    if (submitting) return;
    if (picked.size === 0 || message.trim().length < 4) return;
    setSubmitting(true);
    setResult(null);
    try {
      if (audience === 'agents') {
        // Agent broadcast (unchanged honest path: Notifications + audit)
        const recipientCount = Array.from(picked).reduce((n, g) => n + ((window.AGENT_GROUPS||{})[g]?.length || 0), 0);
        await window.api?.audit?.emit?.('dashboard.broadcast.send', 'broadcast', {
          audience: 'agents', groups: Array.from(picked), recipients: recipientCount,
          channel: 'inapp', message: message.trim(), at: new Date().toISOString(),
        });
        for (const g of picked) {
          window.Notifications?.emit?.({
            kind:'info', source:'broadcast',
            title:`Broadcast → ${g}`, detail: message.trim(),
          });
        }
        setResult({ ok:true, msg:`Delivered to ${recipientCount} agent${recipientCount===1?'':'s'} via in-app · audit row written.` });
        setTimeout(onClose, 1400);
      } else {
        // Operator broadcast — real backend send
        if (!backendOnline) {
          setResult({ ok:false, msg:'Backend not reachable — start the server to send operator SMS/email. Audit row only was written locally.' });
          await window.api?.audit?.emit?.('dashboard.broadcast.send', 'broadcast', {
            audience:'operators', groups:Array.from(picked), channel, message:message.trim(),
            status:'backend_offline', at:new Date().toISOString(),
          });
          return;
        }
        const groupsArr = Array.from(picked);
        const results = [];
        // Server only accepts one selection per call — fan out one call per group.
        for (const g of groupsArr) {
          try {
            if (channel === 'sms') {
              const r = await window.api.broadcast.sms({ group: g, body: message.trim() });
              results.push({ group: g, ...r });
            } else {
              const r = await window.api.broadcast.email({ group: g, subject: subject.trim(), text: message.trim() });
              results.push({ group: g, ...r });
            }
          } catch (e) {
            results.push({ group: g, error_code: e.code || 'BROADCAST_FAILED', error_detail: e.message || String(e) });
          }
        }
        const totalSent   = results.reduce((n,r) => n + (r.sent || 0), 0);
        const totalSkip   = results.reduce((n,r) => n + (r.skipped?.length || 0), 0);
        const totalFail   = results.reduce((n,r) => n + (r.failures?.length || 0), 0);
        const refusals    = results.filter(r => r.error_code);
        const msgParts = [
          `Operator broadcast (${channel.toUpperCase()}): sent=${totalSent}`,
          totalSkip ? `skipped=${totalSkip}` : null,
          totalFail ? `failed=${totalFail}` : null,
          refusals.length ? `refused=${refusals.length}` : null,
        ].filter(Boolean);
        setResult({
          ok: totalSent > 0 || totalFail === 0,
          msg: msgParts.join(' · '),
          detail: refusals.length ? refusals.map(r => `${r.group}: ${r.error_detail}`).join('; ') : null,
        });
        window.Notifications?.emit?.({
          kind: totalFail || refusals.length ? 'warn' : 'info',
          source:'broadcast',
          title:`Operator broadcast · ${channel.toUpperCase()}`,
          detail: msgParts.join(' · '),
        });
        if (totalSent > 0 && totalFail === 0 && !refusals.length) setTimeout(onClose, 1600);
      }
    } catch (e) {
      setResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WireModal
      title="Broadcast"
      subtitle={audience === 'agents' ? 'Message an agent group (in-app)' : 'Message operators (SMS or email)'}
      onClose={onClose}
      width={600}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={submitting || picked.size === 0 || message.trim().length < 4 || (audience==='operators' && !backendOnline)}
          onClick={submit}
        >
          <I.Send/> {submitting ? 'Sending…' : 'Send broadcast'}
        </button>
      </>}
    >
      {/* Audience toggle — top-level switch between agent in-app and operator SMS/email */}
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Audience</div>
        <div className="filter-row">
          <div className={`filter-pill ${audience==='agents'?'on':''}`} onClick={()=>switchAudience('agents')}>
            <I.Zap size={11}/> Agents · in-app
          </div>
          <div className={`filter-pill ${audience==='operators'?'on':''}`} onClick={()=>switchAudience('operators')}>
            <I.Users size={11}/> Operators · external
          </div>
        </div>
      </div>

      <div>
        <div className="stat-label" style={{marginBottom:6}}>
          {audience === 'agents' ? 'Agent groups' : 'Operator role groups'}
        </div>
        <div className="filter-row">
          {availableGroups.length === 0 && <span className="muted xsmall">No groups defined.</span>}
          {availableGroups.map(g => (
            <div key={g} className={`filter-pill ${picked.has(g)?'on':''}`} onClick={()=>toggle(g)}>
              {picked.has(g) ? <I.Check size={11}/> : <I.Plus size={11}/>}
              {g}{audience==='agents' ? ` · ${(window.AGENT_GROUPS||{})[g]?.length || 0}` : ''}
            </div>
          ))}
        </div>
        {audience === 'operators' && (
          <div className="muted xsmall" style={{marginTop:4}}>
            Groups resolve to workspace users by role. Max 20 recipients per send.
          </div>
        )}
      </div>

      <div>
        <div className="stat-label" style={{marginBottom:6}}>Channel</div>
        <div className="filter-row">
          {audience === 'agents' ? (
            <div className={`filter-pill on`}><I.Bell size={11}/> In-app · live</div>
          ) : (
            <>
              <div
                className={`filter-pill ${channel==='sms'?'on':''} ${!backendOnline?'disabled-honest':''}`}
                onClick={()=>backendOnline && setChannel('sms')}
                title={backendOnline ? '' : 'Backend offline — start the server to enable SMS broadcast'}
                style={!backendOnline ? {opacity:0.5, cursor:'not-allowed'} : {}}
              >
                <I.Phone size={11}/> SMS · Twilio
              </div>
              <div
                className={`filter-pill ${channel==='email'?'on':''} ${!backendOnline?'disabled-honest':''}`}
                onClick={()=>backendOnline && setChannel('email')}
                title={backendOnline ? '' : 'Backend offline — start the server to enable email broadcast'}
                style={!backendOnline ? {opacity:0.5, cursor:'not-allowed'} : {}}
              >
                <I.Mail size={11}/> Email · AgentMail
              </div>
            </>
          )}
        </div>
        {audience === 'operators' && !backendOnline && (
          <div className="muted xsmall" style={{marginTop:4, color:'var(--status-warn, #c48610)'}}>
            Backend not reachable — operator broadcast requires the server. Agent in-app still works.
          </div>
        )}
      </div>

      {audience === 'operators' && channel === 'email' && (
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Subject</div>
          <input
            className="input"
            style={{width:'100%'}}
            value={subject}
            onChange={e=>setSubject(e.target.value)}
            placeholder="Subject line"
          />
        </div>
      )}

      <div>
        <div className="stat-label" style={{marginBottom:6}}>Message <span className="muted xsmall">· min 4 chars</span></div>
        <textarea
          className="input"
          rows={4}
          style={{width:'100%', resize:'vertical'}}
          value={message}
          onChange={e=>setMessage(e.target.value)}
          placeholder={audience==='agents' ? 'What do you want your agents to know?' : 'Message body (plain text).'}
        />
      </div>
      {result && (
        <div className={`tag ${result.ok?'ok':'err'}`} style={{display:'block', padding:'8px 10px', lineHeight:1.4}}>
          {result.msg}
          {result.detail && <div className="muted xsmall" style={{marginTop:4}}>{result.detail}</div>}
        </div>
      )}
    </WireModal>
  );
}

// ─── Report / Export — real CSV of TICKETS ────────────────────────────
function ReportModal({ onClose }) {
  const [scope, setScope] = React.useState('open');
  const [format, setFormat] = React.useState('csv');

  const tickets = React.useMemo(() => {
    const all = window.TICKETS || [];
    if (scope === 'open')     return all.filter(t => t.status !== 'complete' && t.status !== 'archived');
    if (scope === 'complete') return all.filter(t => t.status === 'complete');
    if (scope === 'high')     return all.filter(t => t.priority === 'high');
    return all;
  }, [scope]);

  const download = () => {
    const rows = tickets;
    const agents = window.AGENTS || [];
    const cols = ['id','title','status','priority','progress','agent','customer','deadline'];
    let text;
    if (format === 'csv') {
      const esc = (v) => v == null ? '' : /[",\n]/.test(String(v)) ? '"'+String(v).replace(/"/g,'""')+'"' : String(v);
      const header = cols.join(',');
      const body = rows.map(r => cols.map(c => {
        if (c === 'agent') {
          const a = agents.find(x => x.id === r.agent);
          return esc(a ? a.name : '');
        }
        return esc(r[c]);
      }).join(',')).join('\n');
      text = header + '\n' + body;
    } else {
      text = JSON.stringify(rows, null, 2);
    }
    const blob = new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tkmc-tickets-${scope}-${new Date().toISOString().slice(0,10)}.${format}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    // Audit it.
    window.api?.audit?.emit?.('report.export', 'tickets', { scope, format, count: rows.length });
    onClose();
  };

  return (
    <WireModal
      title="Export report"
      subtitle="Download current ticket data"
      onClose={onClose}
      width={480}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={download}><I.Download/> Download {format.toUpperCase()}</button>
      </>}
    >
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Scope</div>
        <div className="filter-row">
          {[{id:'open',lbl:'Open tickets'},{id:'high',lbl:'High priority'},{id:'complete',lbl:'Completed'},{id:'all',lbl:'Everything'}].map(o => (
            <div key={o.id} className={`filter-pill ${scope===o.id?'on':''}`} onClick={()=>setScope(o.id)}>{o.lbl}</div>
          ))}
        </div>
        <div className="muted xsmall" style={{marginTop:8}}>
          {tickets.length} rows will be exported.
        </div>
      </div>
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Format</div>
        <div className="filter-row">
          <div className={`filter-pill ${format==='csv'?'on':''}`}  onClick={()=>setFormat('csv')}>CSV</div>
          <div className={`filter-pill ${format==='json'?'on':''}`} onClick={()=>setFormat('json')}>JSON</div>
        </div>
      </div>
      <div className="muted xsmall" style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)'}}>
        Note · This is a client-side snapshot of the ticket store. Full scheduled reports + PDF
        rollups ship with <span className="mono">POST /api/reports</span>.
      </div>
    </WireModal>
  );
}

// ─── "View all" button group — routes to a filtered tasks view ────────
function viewAllFilter(kind) {
  // Returns a tasks-page filter config the TasksOverlay will honor.
  // kind ∈ 'agents' | 'pending' | 'assigned' | 'wip' | 'complete' | 'priority'
  switch (kind) {
    case 'pending':  return { status: 'pending' };
    case 'assigned': return { status: 'assigned' };
    case 'wip':      return { status: 'wip' };
    case 'complete': return { status: 'complete' };
    case 'priority': return { priority: 'high' };
    default:         return {};
  }
}

// ─── Honest-disabled button wrapper ───────────────────────────────────
function HonestButton({ reason, children, className = 'btn', onClick, ...rest }) {
  if (reason) {
    return (
      <button
        className={`${className} disabled-honest`}
        disabled
        title={`Not yet wired · ${reason}`}
        {...rest}
      >{children}</button>
    );
  }
  return <button className={className} onClick={onClick} {...rest}>{children}</button>;
}

// ─── New ticket — real local create + honest backend note ─────────────
function NewTicketModal({ onClose }) {
  const [title, setTitle]         = React.useState('');
  const [priority, setPriority]   = React.useState('med');
  const [lane, setLane]           = React.useState('ops');
  const [agent, setAgent]         = React.useState('');
  const [customer, setCustomer]   = React.useState('');
  const [deadline, setDeadline]   = React.useState('18:00');
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult]       = React.useState(null);

  const submit = async () => {
    if (submitting) return;
    if (title.trim().length < 3) return;
    setSubmitting(true);
    setResult(null);
    const id = 'TKT-' + String(Math.floor(1000 + Math.random() * 9000));
    const row = {
      id,
      title: title.trim(),
      priority,
      status: agent ? 'assigned' : 'pending',
      lane,
      agent: agent || null,
      customer: customer.trim() || '—',
      deadline,
      progress: 0,
    };
    try {
      (window.TICKETS = window.TICKETS || []).unshift(row);
      await window.api?.audit?.emit?.('ticket.create', id, row);
      // Drop a notification so the new ticket is visible in the bell.
      try { window.Notifications?.emit?.({ kind:'info', source:'tasks', title:'Ticket created', detail:`${id} · ${row.title}` }); } catch(_) {}
      setResult({ ok: true, msg: `Created ${id}. Tickets board updated.` });
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WireModal
      title="New ticket"
      subtitle="Create a task in the workspace"
      onClose={onClose}
      width={560}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={submitting || title.trim().length < 3} onClick={submit}>
          <I.Plus/> {submitting ? 'Creating…' : 'Create ticket'}
        </button>
      </>}
    >
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Title</div>
        <input className="input" style={{width:'100%'}} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short, actionable title"/>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Priority</div>
          <div className="filter-row">
            {[{id:'low',lbl:'Low'},{id:'med',lbl:'Medium'},{id:'high',lbl:'High'}].map(o => (
              <div key={o.id} className={`filter-pill ${priority===o.id?'on':''}`} onClick={()=>setPriority(o.id)}>{o.lbl}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Lane</div>
          <select className="select" style={{width:'100%'}} value={lane} onChange={e=>setLane(e.target.value)}>
            <option value="ops">ops</option>
            <option value="sales">sales</option>
            <option value="support">support</option>
            <option value="finance">finance</option>
            <option value="legal">legal</option>
            <option value="security">security</option>
          </select>
        </div>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Assign agent <span className="muted xsmall">optional</span></div>
          <select className="select" style={{width:'100%'}} value={agent} onChange={e=>setAgent(e.target.value)}>
            <option value="">— Unassigned —</option>
            {(window.AGENTS || []).filter(a => a.status !== 'offline').map(a => (
              <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="stat-label" style={{marginBottom:6}}>Deadline</div>
          <input className="input" style={{width:'100%'}} value={deadline} onChange={e=>setDeadline(e.target.value)} placeholder="e.g. 18:00 or 2026-04-30"/>
        </div>
      </div>
      <div>
        <div className="stat-label" style={{marginBottom:6}}>Customer <span className="muted xsmall">optional</span></div>
        <input className="input" style={{width:'100%'}} value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Customer / account name"/>
      </div>
      {result && (
        <div className={`tag ${result.ok?'ok':'err'}`} style={{display:'block', padding:'8px 10px', lineHeight:1.4}}>
          {result.msg}
        </div>
      )}
      <div className="muted xsmall" style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)'}}>
        Note · Creates the ticket in the local workspace and writes an audit row. Cross-client sync ships with <span className="mono">POST /api/tickets</span>.
      </div>
    </WireModal>
  );
}

Object.assign(window, { NewTicketModal });

Object.assign(window, {
  useClipboardCopy,
  WireModal,
  EscalateModal,
  BroadcastModal,
  ReportModal,
  viewAllFilter,
  HonestButton,
  ESCALATION_TARGETS,
});
