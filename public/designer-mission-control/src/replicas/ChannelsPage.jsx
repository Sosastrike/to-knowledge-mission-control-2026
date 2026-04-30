// ============================================================
// Channels page — API-wired (api.channels.*)
//
// HONESTY CONTRACT:
//   · All reads/writes route through window.api.channels.*
//   · Role guards: channels.read / channels.write / channels.assign / channels.keys
//   · Every mutation fires an audit event (see api-client.jsx).
//   · Credential save / rotate throw BACKEND_REQUIRED — surfaced as an
//     amber toast + the ADMIN WIRE-UP badge, not a silent no-op.
// ============================================================

function useApiChannels() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const r = await window.api.channels.list();
      setRows(r); setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const unsub = window.apiSubscribe?.(() => refresh());
    return () => unsub?.();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

function ChannelsPage() {
  const { rows, loading, error, refresh } = useApiChannels();
  const [toast, setToast] = React.useState(null);
  const showToast = (msg, kind='info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  };

  const agents = (window.AGENTS || []);
  const callerRole = window._currentPersonaId || 'owner';
  const canWrite  = window.permitted?.(callerRole, 'channels.write');
  const canAssign = window.permitted?.(callerRole, 'channels.assign');
  const canKeys   = window.permitted?.(callerRole, 'channels.keys');

  const wrap = async (fn) => {
    try { await fn(); }
    catch (e) {
      if (e.code === 'PERMISSION_DENIED') showToast('Permission denied · ' + callerRole + ' cannot do this.', 'err');
      else if (e.code === 'BACKEND_REQUIRED') showToast(e.message, 'warn');
      else if (e.code === 'INVARIANT_MISSING_CREDENTIAL') showToast(e.message, 'warn');
      else showToast(e.message || 'Action failed', 'err');
    }
  };

  const toggleEnabled = (r) => wrap(async () => {
    await window.api.channels.setEnabled(r.id, !r.enabled);
    showToast(`${r.name} ${!r.enabled ? 'enabled' : 'disabled'}.`);
  });
  const setAgent = (r, agentId) => wrap(async () => {
    await window.api.channels.assignAgent(r.id, agentId || null);
    showToast(`${r.name} routed to ${agentId || '—'}.`);
  });
  const openCredentials = (r) => wrap(async () => {
    // Demo: try to store a fake credential — the API honestly rejects with BACKEND_REQUIRED.
    await window.api.channels.setCredentials(r.id);
  });
  const testConnection = (r) => wrap(async () => {
    const res = await window.api.channels.test(r.id);
    if (res.ok) showToast('Test call succeeded.');
    else showToast(res.message || 'Test failed.', 'warn');
  });

  if (loading) return <div className="muted" style={{padding:14}}>Loading channels…</div>;
  if (error)   return <div style={{color:'var(--err)', padding:14}}>{error}</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Radio size={20} style={{color:'var(--accent)'}}/> Channels</h1>
          <div className="sub">
            Where conversations happen. Each channel binds to an agent, has its own
            credential in the vault, and is rate-limited at the gateway.
          </div>
        </div>
        <div className="page-actions">
          <span className="tag">ADMIN</span>
          {!canWrite && <span className="tag warn" title={`Role ${callerRole} is read-only here.`}>READ-ONLY</span>}
        </div>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Routing state persists locally via <span className="mono xsmall">api.channels.*</span>.
          Credentials themselves live in the vault — the UI only sees an opaque reference.
          Connect / rotate require <span className="mono xsmall">POST /api/channels/:id/credentials</span>.
        </span>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><div className="card-title">Governance · channel policy</div></div>
        <div className="card-body vstack">
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Telegram</div><div className="muted xsmall">Primary conversation channel</div></div>
            <span className="tag accent">PRIMARY</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line-1)'}}>
            <div><div style={{color:'var(--fg-0)'}}>Slack</div><div className="muted xsmall">Project structure + team collab</div></div>
            <span className="tag">TEAM</span>
          </div>
          <div className="hstack" style={{justifyContent:'space-between', padding:'8px 0'}}>
            <div><div style={{color:'var(--fg-0)'}}>Mission Control (this UI)</div><div className="muted xsmall">Operator dashboard</div></div>
            <span className="tag ok">ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Channel</th><th>On</th><th>Health</th><th>Credentials</th>
              <th>Assigned agent</th><th>Routing</th><th>Throughput</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const ag = agents.find(a => a.id === c.assigned_agent);
              return (
                <tr key={c.id}>
                  <td>
                    <span className="hstack">
                      <ChanChip code={c.key} size={24}/>
                      <span style={{color:'var(--fg-0)'}}>{c.name}</span>
                    </span>
                  </td>
                  <td>
                    <button
                      className="switch-btn"
                      onClick={() => toggleEnabled(c)}
                      disabled={!canWrite}
                      title={!canWrite ? `Role ${callerRole} cannot toggle channels.` : ''}
                      style={{
                        width:34, height:18, borderRadius:9, border:'1px solid var(--line-1)',
                        background: c.enabled ? 'var(--accent)' : 'var(--bg-2)',
                        opacity: canWrite ? 1 : 0.55, cursor: canWrite ? 'pointer' : 'not-allowed',
                        position:'relative',
                      }}
                    >
                      <span style={{
                        position:'absolute', top:2, left: c.enabled ? 18 : 2,
                        width:12, height:12, borderRadius:'50%',
                        background: c.enabled ? '#fff' : 'var(--fg-2)', transition:'left 120ms ease',
                      }}/>
                    </button>
                  </td>
                  <td><span className="status-pill"><StatusDot s={c.health}/>{c.health}</span></td>
                  <td>
                    <span className="hstack">
                      <span className={`status-pill`} style={{
                        color: c.credential_status === 'ok' ? 'var(--ok)' :
                               c.credential_status === 'expiring' ? 'var(--warn)' : 'var(--err)',
                        background: 'transparent', border:'1px solid currentColor', opacity: 0.75,
                      }}>{c.credential_status}</span>
                      {c.credential_ref
                        ? <span className="mono xsmall muted" title={c.credential_ref}>vault://…</span>
                        : <span className="muted xsmall">—</span>}
                    </span>
                  </td>
                  <td>
                    {canAssign ? (
                      <select
                        value={c.assigned_agent || ''}
                        onChange={(e) => setAgent(c, e.target.value)}
                        style={{background:'var(--bg-2)', color:'var(--fg-0)', border:'1px solid var(--line-1)', borderRadius:6, padding:'4px 8px', fontSize:12}}
                      >
                        <option value="">—</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    ) : (
                      ag ? <span className="hstack"><Avatar name={ag.name} size={18}/> <span>{ag.name}</span></span> : <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{c.routing || <span className="muted xsmall">—</span>}</td>
                  <td className="mono xsmall">{c.rate}</td>
                  <td className="hstack" style={{justifyContent:'flex-end', gap:6}}>
                    <button
                      className="btn sm"
                      onClick={() => openCredentials(c)}
                      disabled={!canKeys}
                      title={!canKeys ? `Role ${callerRole} cannot manage credentials.` : 'Save credentials via vault'}
                    >
                      Credentials
                      {canKeys && <span className="admin-wireup-badge" style={{marginLeft:6}}>ADMIN WIRE-UP</span>}
                    </button>
                    <button className="btn sm" onClick={() => testConnection(c)} title="Test provider adapter">
                      Test
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="ch-toast" style={{
          position:'fixed', bottom:18, right:18, zIndex: 120,
          padding:'10px 14px', borderRadius:8, fontSize:12.5, maxWidth: 440,
          background: toast.kind === 'err' ? 'rgba(239,68,68,0.14)' :
                      toast.kind === 'warn' ? 'rgba(255,176,96,0.14)' : 'rgba(107,255,179,0.14)',
          border: toast.kind === 'err' ? '1px solid rgba(239,68,68,0.4)' :
                  toast.kind === 'warn' ? '1px solid rgba(255,176,96,0.4)' : '1px solid rgba(107,255,179,0.4)',
          color: toast.kind === 'err' ? '#ff8088' :
                 toast.kind === 'warn' ? '#ffb060' : '#6bffb3',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .admin-wireup-badge {
          display:inline-block; padding:1px 6px; border-radius:6px; font-size:9px;
          letter-spacing:0.6px; text-transform:uppercase; font-weight:600;
          color: #ffb060; background: rgba(255,176,96,0.14); border:1px solid rgba(255,176,96,0.35);
        }
      `}</style>
    </>
  );
}

Object.assign(window, { ChannelsPage });
