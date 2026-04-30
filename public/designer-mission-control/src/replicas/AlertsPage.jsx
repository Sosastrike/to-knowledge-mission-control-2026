// ============================================================
// Alerts page — API-wired (api.alerts.*)
//
// HONESTY CONTRACT:
//   · Alerts are append-only. UI cannot delete — only acknowledge or resolve.
//   · All reads/writes route through window.api.alerts.*
//   · Role guards: alerts.read / alerts.ack / alerts.resolve
//   · Every ack / resolve fires an audit event.
// ============================================================

function useApiAlerts(includeResolved = false) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const r = await window.api.alerts.list({ includeResolved });
      setRows(r); setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [includeResolved]);

  React.useEffect(() => {
    refresh();
    const unsub = window.apiSubscribe?.(() => refresh());
    return () => unsub?.();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

function AlertsPage() {
  const [filter, setFilter] = React.useState('open');
  const { rows, loading, error } = useApiAlerts(filter === 'all');
  const [toast, setToast] = React.useState(null);
  const showToast = (msg, kind='info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const callerRole = window._currentPersonaId || 'owner';
  const canAck     = window.permitted?.(callerRole, 'alerts.ack');
  const canResolve = window.permitted?.(callerRole, 'alerts.resolve');

  const wrap = async (fn) => {
    try { await fn(); }
    catch (e) {
      if (e.code === 'PERMISSION_DENIED') showToast('Permission denied.', 'err');
      else showToast(e.message || 'Action failed', 'err');
    }
  };

  const ack = (a) => wrap(async () => {
    await window.api.alerts.acknowledge(a.id);
    showToast(`${a.id} acknowledged.`);
  });
  const resolve = (a) => wrap(async () => {
    await window.api.alerts.resolve(a.id);
    showToast(`${a.id} resolved.`);
  });
  const demoEmit = () => wrap(async () => {
    await window.api.alerts.emit({
      level: 'warn', msg: 'Demo alert emitted from UI test',
      area: 'System', actionable: true, source: 'ui',
    });
    showToast('Demo alert emitted.');
  });

  const visible = filter === 'all' ? rows
                : filter === 'ack' ? rows.filter(r => r.ack_at && !r.resolved_at)
                : filter === 'resolved' ? rows.filter(r => r.resolved_at)
                : rows.filter(r => !r.ack_at && !r.resolved_at);

  const counts = {
    open:     rows.filter(r => !r.ack_at && !r.resolved_at).length,
    ack:      rows.filter(r => r.ack_at && !r.resolved_at).length,
    resolved: rows.filter(r => r.resolved_at).length,
    all:      rows.length,
  };

  if (loading) return <div className="muted" style={{padding:14}}>Loading alerts…</div>;
  if (error)   return <div style={{color:'var(--err)', padding:14}}>{error}</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Alert size={20} style={{color:'var(--warn)'}}/> Alerts</h1>
          <div className="sub">
            Operator-visible events emitted by the gateway, supervisor, and policy engine.
            Append-only — resolve instead of delete.
          </div>
        </div>
        <div className="page-actions">
          <span className="tag">ADMIN</span>
          {!canAck && <span className="tag warn">READ-ONLY</span>}
        </div>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Acknowledging an alert fires <span className="mono xsmall">POST /api/alerts/:id/ack</span> and writes to the audit stream.
          Resolving requires the <span className="mono xsmall">alerts.resolve</span> capability.
          Incoming alerts require a live gateway — demo feed below is local.
        </span>
      </div>

      <div className="kpi-row" style={{marginBottom:14}}>
        <KPI label="Open"       value={counts.open}/>
        <KPI label="Acknowledged" value={counts.ack}/>
        <KPI label="Resolved"   value={counts.resolved}/>
        <KPI label="Total"      value={counts.all}/>
      </div>

      <div className="hstack" style={{gap:6, marginBottom:12, justifyContent:'space-between'}}>
        <div className="hstack" style={{gap:6}}>
          {[
            {id:'open',     label:'Open',     n: counts.open},
            {id:'ack',      label:'Acknowledged', n: counts.ack},
            {id:'resolved', label:'Resolved', n: counts.resolved},
            {id:'all',      label:'All',      n: counts.all},
          ].map(f => (
            <button key={f.id}
              className={`btn sm ${filter===f.id?'primary':''}`}
              onClick={()=>setFilter(f.id)}>
              {f.label} · {f.n}
            </button>
          ))}
        </div>
        <button className="btn sm" onClick={demoEmit} title="Demo only — writes a local alert for testing">
          Emit demo alert
        </button>
      </div>

      <div className="card">
        {visible.length === 0 ? (
          <div style={{padding:20, textAlign:'center'}} className="muted">
            No {filter === 'open' ? 'open' : filter} alerts.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th><th>Level</th><th>Message</th><th>Area</th>
                <th>State</th><th>Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const stateLabel = a.resolved_at ? 'resolved'
                                : a.ack_at ? 'acknowledged'
                                : 'open';
                const stateColor = a.resolved_at ? 'var(--ok)'
                                : a.ack_at ? 'var(--fg-1)'
                                : a.level === 'err' ? 'var(--err)'
                                : a.level === 'warn' ? 'var(--warn)' : 'var(--fg-1)';
                return (
                  <tr key={a.id}>
                    <td className="mono xsmall">{a.id}</td>
                    <td>
                      <span className="status-pill">
                        <StatusDot s={a.level === 'err' ? 'err' : a.level === 'warn' ? 'warn' : 'ok'}/>
                        {a.level}
                      </span>
                    </td>
                    <td style={{color:'var(--fg-0)'}}>{a.msg}</td>
                    <td className="muted">{a.area}</td>
                    <td>
                      <span style={{color: stateColor, fontSize:12}}>{stateLabel}</span>
                      {a.ack_by && <div className="muted xsmall">by {a.ack_by}</div>}
                      {a.resolved_by && <div className="muted xsmall">by {a.resolved_by}</div>}
                    </td>
                    <td className="mono xsmall muted">{a.source || '—'}</td>
                    <td className="hstack" style={{justifyContent:'flex-end', gap:6}}>
                      {!a.ack_at && !a.resolved_at && (
                        <button
                          className="btn sm"
                          onClick={()=>ack(a)}
                          disabled={!canAck}
                          title={!canAck ? `Role ${callerRole} cannot ack alerts.` : 'Acknowledge'}>
                          Ack
                        </button>
                      )}
                      {!a.resolved_at && (
                        <button
                          className="btn sm primary"
                          onClick={()=>resolve(a)}
                          disabled={!canResolve}
                          title={!canResolve ? `Role ${callerRole} cannot resolve alerts.` : 'Resolve'}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && (
        <div style={{
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
    </>
  );
}

Object.assign(window, { AlertsPage });
