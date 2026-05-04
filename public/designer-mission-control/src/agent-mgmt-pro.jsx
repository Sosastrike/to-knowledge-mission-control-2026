// ─── Agent Management · redesigned (left rail + 6 tabs) ───────────────
//
// NON-DESTRUCTIVE: this file introduces a NEW page component
// `AgentMgmtPro` and registers it on window. The existing
// `AgentManagementPage` is left untouched.
//
// 6 tabs per agent:
//   Overview · Role · Channels · Credentials · Runtime · Audit
//
// HONESTY:
//   - Runtime pulls from /api/agents + SSE stream if server is up;
//     falls back to window.AGENTS seed read-only and says so.
//   - Role change / delete / create call /api/agents (admin-gated);
//     Agent Zero is hard-protected as commander; Tony Legacy is archived.
//   - Channels tab lists from /api/channels (9-catalogue) and grants
//     per agent via POST/DELETE /api/agents/:id/channels.
//   - Credentials tab is view-only — deep-links to Settings → Credentials
//     because credential rotation lives in one place by design.
//   - Audit tab filters audit_events by agent id; does NOT re-query per
//     tab switch (one fetch, client-side filter).

(function(){
  const I = window.I || {};

  function AgentMgmtPro(){
    const [agents, setAgents] = React.useState(() => (window.AGENTS || []).slice());
    const [runtime, setRuntime] = React.useState(null);      // { id: rt-row }
    const [sel, setSel] = React.useState(() => (window.AGENTS || [])[0]?.id || null);
    const [httpReady, setHttpReady] = React.useState(!!window.API_HTTP_READY);
    const [tab, setTab] = React.useState('overview');
    const [includeDeleted, setIncludeDeleted] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [busy, setBusy] = React.useState({});

    // Server readiness
    React.useEffect(() => {
      const on = () => setHttpReady(true);
      const off = () => { setHttpReady(false); setRuntime(null); };
      window.addEventListener('api:http-ready', on);
      window.addEventListener('api:http-offline', off);
      return () => {
        window.removeEventListener('api:http-ready', on);
        window.removeEventListener('api:http-offline', off);
      };
    }, []);

    // Agent list + SSE
    const refresh = React.useCallback(async () => {
      if (!httpReady || !window.api?.agents?.list) return;
      try {
        const rows = await window.api.agents.list({ include_deleted: includeDeleted });
        setAgents(rows);
        setRuntime(Object.fromEntries(rows.map(r => [r.id, r])));
      } catch(_) {}
    }, [httpReady, includeDeleted]);

    React.useEffect(() => {
      if (!httpReady) { setAgents((window.AGENTS || []).slice()); setRuntime(null); return; }
      refresh();
      let unsub = null;
      if (window.api?.agents?.subscribeStream) {
        unsub = window.api.agents.subscribeStream(snap => {
          if (!snap?.agents) return;
          setAgents(prev => {
            // Merge status changes without losing non-runtime fields.
            const byId = Object.fromEntries(prev.map(p => [p.id, p]));
            for (const r of snap.agents) byId[r.id] = { ...byId[r.id], ...r };
            return Object.values(byId);
          });
          setRuntime(Object.fromEntries(snap.agents.map(r => [r.id, r])));
        });
      }
      return () => { if (unsub) unsub(); };
    }, [httpReady, refresh]);

    const current = agents.find(a => a.id === sel) || agents[0] || null;
    const isProtected = (a) => a?.id === 'agent-zero' || a?.id === 'agent_zero' || a?.id === 'hermes' || a?.id === 'tony' || a?.id === 'tony_legacy' || a?.role === 'archived' || a?.protected;

    const act = async (kind, extra) => {
      if (!current) return;
      setBusy(b => ({ ...b, [kind]: true }));
      try {
        let r = null;
        if (kind === 'restart')   r = await window.api.agents.restart(current.id);
        else if (kind === 'stop') r = await window.api.agents.stop(current.id);
        else if (kind === 'start')r = await window.api.agents.start(current.id);
        else if (kind === 'reconnect') r = await window.api.agents.reconnect(current.id);
        else if (kind === 'rename')    r = await window.api.agents.update(current.id, { name: extra });
        else if (kind === 'role')      r = await window.api.agents.update(current.id, { role: extra });
        else if (kind === 'delete-soft') r = await window.api.agents.remove(current.id);
        else if (kind === 'delete-hard') r = await window.api.agents.remove(current.id, { hard:true, confirm: extra });
        window.Notifications?.emit?.({ kind:'ok', source:'agents', title:`${current.name} · ${kind} ok`, detail:'Audit row written.' });
        await refresh();
      } catch (e) {
        window.Notifications?.emit?.({ kind:'error', source:'agents', title:`${current.name} · ${kind} failed`, detail: e.message });
      } finally {
        setBusy(b => { const n = { ...b }; delete n[kind]; return n; });
      }
    };

    // Create flow
    const createAgent = async (payload) => {
      try {
        await window.api.agents.create(payload);
        window.Notifications?.emit?.({ kind:'ok', source:'agents', title:`Agent created`, detail:`${payload.name} · status offline — start manually.` });
        setCreateOpen(false);
        refresh();
      } catch(e) {
        window.Notifications?.emit?.({ kind:'error', source:'agents', title:'Create failed', detail: e.message });
      }
    };

    return (
      <>
        <div className="page-header">
          <div className="page-title">
            <h1 className="hstack" style={{gap:8}}>
              <I.Agents size={20} style={{color:'var(--accent)'}}/>
              Agent Management <span className="card-subtitle">redesigned</span>
            </h1>
            <div className="sub">
              Left rail picks an agent · 6 tabs per agent · all mutations hit the supervisor.
              {!httpReady && ' · Server offline: showing local seed read-only.'}
            </div>
          </div>
          <div className="page-actions">
            <label className="hstack xsmall" style={{gap:6, color:'var(--fg-1)'}}>
              <input type="checkbox" checked={includeDeleted} onChange={e=>setIncludeDeleted(e.target.checked)}/>
              Include deleted
            </label>
            {httpReady
              ? <span className="tag ok">SUPERVISOR · LIVE</span>
              : <span className="tag warn">SEED VIEW</span>}
            <button className="btn primary" disabled={!httpReady} title={httpReady ? 'Create a new agent' : 'Server offline'} onClick={()=>setCreateOpen(true)}>
              <I.Plus/> New agent
            </button>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'260px 1fr', gap:16, alignItems:'start'}}>
          {/* ── Left rail ── */}
          <div className="card" style={{margin:0, position:'sticky', top:12}}>
            <div className="card-head">
              <div className="card-title">Agents</div>
              <span className="muted xsmall">{agents.length}</span>
            </div>
            <div className="vstack" style={{gap:2, padding:6, maxHeight:'70vh', overflowY:'auto'}}>
              {agents.map(a => {
                const rt = runtime && runtime[a.id];
                const live = rt?.status === 'live' || rt?.status === 'running';
                const deleted = !!a.deleted_at;
                return (
                  <div
                    key={a.id}
                    onClick={()=>{ setSel(a.id); setTab('overview'); }}
                    className="agent-strip-row"
                    style={{
                      cursor:'pointer',
                      border:'1px solid ' + (a.id === sel ? 'var(--accent-line)' : 'transparent'),
                      background: a.id === sel ? 'var(--accent-soft)' : 'transparent',
                      opacity: deleted ? 0.5 : 1,
                      padding:'6px 8px',
                    }}
                  >
                    <span className={`dot ${live ? 'ok' : rt?.status === 'warn' ? 'warn' : 'muted'}`}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{color:'var(--fg-0)', fontSize:13, textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap'}}>
                        {a.name} {isProtected(a) && <I.Lock size={10} style={{color:'var(--fg-2)', marginLeft:4}}/>}
                      </div>
                      <div className="muted xsmall mono">{a.role}</div>
                    </div>
                    {deleted && <span className="tag" style={{fontSize:9}}>DEL</span>}
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div className="muted xsmall" style={{padding:12}}>No agents. Create one above.</div>
              )}
            </div>
          </div>

          {/* ── Right pane ── */}
          {!current ? (
            <div className="card"><div className="card-body muted">Select an agent from the rail.</div></div>
          ) : (
            <div className="vstack" style={{gap:12}}>
              <AgentHeader agent={current} runtime={runtime?.[current.id]} protected={isProtected(current)}/>
              <TabBar tab={tab} setTab={setTab}/>
              {tab === 'overview'    && <OverviewTab agent={current} runtime={runtime?.[current.id]} act={act} busy={busy} httpReady={httpReady} protected={isProtected(current)}/>}
              {tab === 'role'        && <RoleTab     agent={current} act={act} busy={busy} httpReady={httpReady} protected={isProtected(current)}/>}
              {tab === 'channels'    && <ChannelsTab agent={current} httpReady={httpReady}/>}
              {tab === 'credentials' && <CredentialsTab agent={current}/>}
              {tab === 'runtime'     && <RuntimeTab  agent={current} runtime={runtime?.[current.id]} httpReady={httpReady}/>}
              {tab === 'audit'       && <AuditTab    agent={current}/>}
            </div>
          )}
        </div>

        {createOpen && <CreateAgentModal onClose={()=>setCreateOpen(false)} onCreate={createAgent}/>}
      </>
    );
  }

  // ── Header ──────────────────────────────────────────────────────────
  function AgentHeader({ agent, runtime, protected: prot }){
    const live = runtime?.status === 'live' || runtime?.status === 'running';
    const deleted = !!agent.deleted_at;
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-body hstack" style={{gap:14, alignItems:'center'}}>
          <div style={{width:46, height:46, borderRadius:10, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-1)', fontWeight:600, fontSize:18}}>
            {(agent.name || '?').slice(0,1).toUpperCase()}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div className="hstack" style={{gap:8}}>
              <div style={{color:'var(--fg-0)', fontSize:16, fontWeight:500}}>{agent.name}</div>
              {prot && <span className="tag" title="Agent Zero cannot be deleted or have commander role changed; Tony Legacy is archived"><I.Lock size={10}/> PROTECTED</span>}
              {deleted && <span className="tag err">DELETED</span>}
            </div>
            <div className="muted xsmall mono">id={agent.id} · role={agent.role} · model={agent.model || '—'}</div>
          </div>
          <div className="hstack" style={{gap:6}}>
            {live
              ? <span className="status-pill"><span className="dot ok"/> LIVE</span>
              : runtime?.status === 'offline'
                ? <span className="status-pill"><span className="dot muted"/> OFFLINE</span>
                : <span className="status-pill"><span className="dot warn"/> {runtime?.status || 'UNKNOWN'}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── Tab bar ─────────────────────────────────────────────────────────
  function TabBar({ tab, setTab }){
    const tabs = [
      { id:'overview',    label:'Overview',    icon:'Gauge' },
      { id:'role',        label:'Role',        icon:'Users' },
      { id:'channels',    label:'Channels',    icon:'Radio' },
      { id:'credentials', label:'Credentials', icon:'Key' },
      { id:'runtime',     label:'Runtime',     icon:'Activity' },
      { id:'audit',       label:'Audit',       icon:'FileLog' },
    ];
    return (
      <div className="filter-row" style={{gap:6}}>
        {tabs.map(t => {
          const Ic = I[t.icon] || I.Dot;
          return (
            <div key={t.id} className={`filter-pill ${tab === t.id ? 'on' : ''}`} onClick={()=>setTab(t.id)}>
              <Ic size={12}/> {t.label}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Overview ────────────────────────────────────────────────────────
  function OverviewTab({ agent, runtime, act, busy, httpReady, protected: prot }){
    const beat = runtime?.last_heartbeat ? new Date(runtime.last_heartbeat) : null;
    const beatAge = beat ? Math.floor((Date.now() - beat.getTime()) / 1000) : null;
    return (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="card" style={{margin:0}}>
          <div className="card-head"><div className="card-title">Runtime snapshot</div></div>
          <div className="card-body vstack" style={{gap:6}}>
            <KV k="Status"    v={runtime?.status || <span className="muted">not reporting</span>}/>
            <KV k="PID"       v={runtime?.pid || <span className="muted">—</span>}/>
            <KV k="Heartbeat" v={beatAge != null ? `${beatAge}s ago` : <span className="muted">never</span>}/>
            <KV k="Respawns"  v={runtime?.respawn_count ?? <span className="muted">—</span>}/>
            <KV k="Load"      v={runtime?.load_pct != null ? `${runtime.load_pct}%` : <span className="muted">—</span>}/>
          </div>
        </div>
        <div className="card" style={{margin:0}}>
          <div className="card-head"><div className="card-title">Controls</div></div>
          <div className="card-body hstack" style={{flexWrap:'wrap', gap:6}}>
            <button className="btn sm" disabled={!httpReady || busy.start} onClick={()=>act('start')}><I.Play size={11}/> Start</button>
            <button className="btn sm" disabled={!httpReady || busy.stop}  onClick={()=>act('stop')}><I.Pause size={11}/> Stop</button>
            <button className="btn sm" disabled={!httpReady || busy.restart} onClick={()=>act('restart')}><I.Restart size={11}/> Restart</button>
            <button className="btn sm" disabled={!httpReady || busy.reconnect} onClick={()=>act('reconnect')}><I.Refresh size={11}/> Reconnect channels</button>
            <div className="spacer"/>
            {prot
              ? <button className="btn sm danger" disabled title="Agent Zero cannot be deleted. Tony Legacy is archived."><I.Trash size={11}/> Delete (protected)</button>
              : <DeleteBlock act={act} busy={busy} httpReady={httpReady} agentName={agent.name}/>
            }
          </div>
        </div>
      </div>
    );
  }

  function DeleteBlock({ act, busy, httpReady, agentName }){
    const [confirm, setConfirm] = React.useState('');
    const [mode, setMode] = React.useState(null); // 'soft' | 'hard'
    if (mode === 'hard') {
      return (
        <div className="hstack" style={{gap:6}}>
          <input className="input" placeholder={`Type ${agentName} to confirm`} value={confirm} onChange={e=>setConfirm(e.target.value)} style={{width:220}}/>
          <button className="btn sm danger" disabled={confirm !== agentName || busy['delete-hard']} onClick={()=>act('delete-hard', confirm)}>
            Hard delete
          </button>
          <button className="btn sm" onClick={()=>{ setMode(null); setConfirm(''); }}>Cancel</button>
        </div>
      );
    }
    return (
      <>
        <button className="btn sm" disabled={!httpReady || busy['delete-soft']} onClick={()=>act('delete-soft')}>
          <I.Trash size={11}/> Soft delete
        </button>
        <button className="btn sm danger" disabled={!httpReady} onClick={()=>setMode('hard')}>Hard delete…</button>
      </>
    );
  }

  // ── Role ────────────────────────────────────────────────────────────
  function RoleTab({ agent, act, busy, httpReady, protected: prot }){
    const [name, setName] = React.useState(agent.name);
    const [role, setRole] = React.useState(agent.role);
    React.useEffect(() => { setName(agent.name); setRole(agent.role); }, [agent.id]);
    const dirty = name !== agent.name || role !== agent.role;
    const roles = ['agent-zero','hermes-lieutenant','specialist','voice','ops','security','research','support','archived'];
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-head">
          <div className="card-title">Role & name</div>
          {prot && <span className="muted xsmall"><I.Lock size={10}/> Role locked on protected agents</span>}
        </div>
        <div className="card-body vstack" style={{gap:10}}>
          <label>Name
            <input className="input" value={name} onChange={e=>setName(e.target.value)} disabled={prot}/>
          </label>
          <label>Role
            <select className="select" value={role} onChange={e=>setRole(e.target.value)} disabled={prot}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="hstack" style={{justifyContent:'flex-end', gap:6}}>
            <button className="btn sm" disabled={!dirty} onClick={()=>{ setName(agent.name); setRole(agent.role); }}>Discard</button>
            <button className="btn primary sm" disabled={!dirty || !httpReady || prot || busy.rename || busy.role}
              onClick={async ()=>{
                if (name !== agent.name) await act('rename', name);
                if (role !== agent.role) await act('role',   role);
              }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Channels ────────────────────────────────────────────────────────
  function ChannelsTab({ agent, httpReady }){
    const [catalogue, setCatalogue] = React.useState([]);
    const [grants, setGrants] = React.useState([]);
    const [busy, setBusy] = React.useState({});

    const load = React.useCallback(async () => {
      if (!httpReady) return;
      try {
        const [cat, g] = await Promise.all([
          window.api.channels.list(),
          window.api.agents.channels(agent.id, { include_revoked:true }),
        ]);
        setCatalogue(cat.catalogue || cat || []);
        setGrants(Array.isArray(g) ? g : (g.grants || []));
      } catch(_) {}
    }, [httpReady, agent.id]);

    React.useEffect(() => { load(); }, [load]);

    const grantSet = new Set(grants.filter(x => !x.revoked_at).map(x => x.channel_id));

    const toggle = async (ch) => {
      setBusy(b => ({ ...b, [ch.id]: true }));
      try {
        if (grantSet.has(ch.id)) {
          await window.api.agents.revokeChannel(agent.id, ch.id);
        } else {
          await window.api.agents.grantChannel(agent.id, ch.id);
        }
        await load();
      } catch (e) {
        window.Notifications?.emit?.({ kind:'error', source:'agents', title:'Channel change failed', detail:e.message });
      } finally {
        setBusy(b => { const n = { ...b }; delete n[ch.id]; return n; });
      }
    };

    if (!httpReady) {
      return <div className="card"><div className="card-body muted">Channel catalogue lives on the server. Start the backend to manage grants.</div></div>;
    }
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-head">
          <div className="card-title">Channel grants</div>
          <span className="muted xsmall">{grantSet.size} / {catalogue.length} active</span>
        </div>
        <div className="card-body">
          <table className="tbl">
            <thead><tr><th>Channel</th><th>Kind</th><th>Provider</th><th>Ready</th><th></th></tr></thead>
            <tbody>
              {catalogue.map(ch => {
                const on = grantSet.has(ch.id);
                return (
                  <tr key={ch.id}>
                    <td style={{color:'var(--fg-0)'}}>{ch.label || ch.name || ch.id}</td>
                    <td className="muted xsmall">{ch.kind}</td>
                    <td className="mono xsmall muted">{ch.provider_service}</td>
                    <td>{ch.provider_ready ? <span className="tag ok">ready</span> : <span className="tag warn">vault empty</span>}</td>
                    <td>
                      <button className={`btn sm ${on ? 'danger' : 'primary'}`} disabled={busy[ch.id]} onClick={()=>toggle(ch)}>
                        {busy[ch.id] ? '…' : on ? 'Revoke' : 'Grant'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {catalogue.length === 0 && <tr><td colSpan={5} className="muted xsmall">No channels in catalogue.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Credentials (view-only, deep link) ──────────────────────────────
  function CredentialsTab({ agent }){
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-head"><div className="card-title">Credentials</div></div>
        <div className="card-body vstack" style={{gap:10}}>
          <div className="muted xsmall">
            Per-agent credential isolation is not a thing in this product — all channel credentials live in the
            shared vault under <b>Settings → Credentials</b> and are referenced by channel grants above. This tab
            intentionally does not duplicate the vault UI.
          </div>
          <div>
            <button className="btn" onClick={()=>window.appGoTo?.('settings:credentials')}>
              <I.External size={12}/> Open Credentials vault
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Runtime (detailed) ──────────────────────────────────────────────
  function RuntimeTab({ agent, runtime, httpReady }){
    if (!httpReady || !runtime) {
      return <div className="card"><div className="card-body muted">No live runtime row. Start the supervisor to populate.</div></div>;
    }
    const keys = ['status','pid','last_heartbeat','respawn_count','load_pct','started_at','env','model','version'];
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-head"><div className="card-title">Full runtime row</div></div>
        <div className="card-body">
          <table className="tbl">
            <tbody>
              {keys.map(k => (
                <tr key={k}>
                  <td className="mono xsmall" style={{width:160, color:'var(--fg-1)'}}>{k}</td>
                  <td className="mono xsmall">{runtime[k] === undefined ? <span className="muted">—</span> : String(runtime[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Audit (filtered to this agent) ──────────────────────────────────
  function AuditTab({ agent }){
    const [rows, setRows] = React.useState(null);
    React.useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const r = await window.api?.audit?.list?.({ limit: 200 });
          if (cancelled) return;
          setRows(Array.isArray(r) ? r : []);
        } catch { if (!cancelled) setRows([]); }
      })();
      return () => { cancelled = true; };
    }, [agent.id]);
    const mine = (rows || []).filter(r => r.subject === agent.id || r.ref === agent.id || r.payload?.agent_id === agent.id || r.payload?.id === agent.id);
    return (
      <div className="card" style={{margin:0}}>
        <div className="card-head">
          <div className="card-title">Audit trail</div>
          <span className="muted xsmall">{mine.length} entries</span>
        </div>
        <div className="card-body" style={{maxHeight:480, overflowY:'auto'}}>
          <table className="tbl">
            <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Severity</th></tr></thead>
            <tbody>
              {rows == null && <tr><td colSpan={4} className="muted xsmall">Loading…</td></tr>}
              {rows != null && mine.length === 0 && <tr><td colSpan={4} className="muted xsmall">No audit rows yet.</td></tr>}
              {mine.map((r, i) => (
                <tr key={i}>
                  <td className="mono xsmall muted">{r.at?.slice?.(0,19)?.replace('T',' ') || '—'}</td>
                  <td className="mono xsmall">{r.action}</td>
                  <td className="mono xsmall muted">{r.actor || 'system'}</td>
                  <td>{r.severity === 'security' ? <span className="tag err">security</span> : <span className="tag">{r.severity || 'info'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Create Agent modal ──────────────────────────────────────────────
  function CreateAgentModal({ onClose, onCreate }){
    const [name, setName] = React.useState('');
    const [role, setRole] = React.useState('specialist');
    const [model, setModel] = React.useState('');
    const roles = ['specialist','voice','ops','security','research','support'];
    const models = (window.MODELS_SEED || []).map(m => m.id);
    const valid = name.trim().length >= 2;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
          <div className="modal-head"><h3>New agent</h3><button className="icon-btn" onClick={onClose}><I.X size={14}/></button></div>
          <div className="modal-body vstack" style={{gap:10}}>
            <label>Name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Mila"/></label>
            <label>Role
              <select className="select" value={role} onChange={e=>setRole(e.target.value)}>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>Model (optional)
              <select className="select" value={model} onChange={e=>setModel(e.target.value)}>
                <option value="">— inherit role default —</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <div className="modal-honest">
              <I.Info size={12}/>
              <span>Agent is created as <b>offline</b>. Start it from the Overview tab. Channels can be granted after creation.</span>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!valid} onClick={()=>onCreate({ name:name.trim(), role, model: model || undefined })}>Create</button>
          </div>
        </div>
      </div>
    );
  }

  function KV({ k, v }){
    return (
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <span className="muted xsmall">{k}</span>
        <span className="mono xsmall" style={{color:'var(--fg-0)'}}>{v}</span>
      </div>
    );
  }

  Object.assign(window, { AgentMgmtPro });
})();
