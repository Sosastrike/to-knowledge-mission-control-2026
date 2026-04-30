// ============================================================
// Skills page — API-wired (api.skills.*)
//
// HONESTY CONTRACT:
//   · All reads/writes route through window.api.skills.*
//   · Role guards: skills.read / skills.write / skills.retire (owner-only)
//   · Every status change fires an audit event.
//   · Registering a new skill throws BACKEND_REQUIRED — new skills are
//     uploaded to the skill host, not the admin UI.
// ============================================================

function useApiSkills() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const r = await window.api.skills.list();
      setRows(r); setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load skills');
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

function SkillsPage(){
  const { rows: skills, loading, error } = useApiSkills();
  const [filter, setFilter] = React.useState('all');
  const [toast, setToast] = React.useState(null);
  const showToast = (msg, kind='info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  const callerRole = window._currentPersonaId || 'owner';
  const canWrite  = window.permitted?.(callerRole, 'skills.write');
  const canRetire = window.permitted?.(callerRole, 'skills.retire');

  const wrap = async (fn) => {
    try { await fn(); }
    catch (e) {
      if (e.code === 'PERMISSION_DENIED') showToast(`Permission denied — ${callerRole} cannot do this.`, 'err');
      else if (e.code === 'BACKEND_REQUIRED') showToast(e.message, 'warn');
      else showToast(e.message || 'Action failed', 'err');
    }
  };

  const toggleStatus = (s) => wrap(async () => {
    const next = s.status === 'valid' ? 'review' : 'valid';
    await window.api.skills.setStatus(s.id, next);
    showToast(`${s.name} → ${next}.`);
  });
  const retire = (s) => wrap(async () => {
    if (!window.confirm(`Retire ${s.name}? Retired skills cannot be invoked by agents.`)) return;
    await window.api.skills.retire(s.id);
    showToast(`${s.name} retired.`);
  });
  const registerNew = () => wrap(async () => {
    await window.api.skills.register({});  // will throw BACKEND_REQUIRED
  });

  const counts = {
    total:   skills.length,
    valid:   skills.filter(s => s.status === 'valid').length,
    review:  skills.filter(s => s.status === 'review').length,
    retired: skills.filter(s => s.status === 'retired').length,
  };
  const rows = filter === 'all' ? skills : skills.filter(s => s.status === filter);

  if (loading) return <div className="muted" style={{padding:14}}>Loading skills…</div>;
  if (error)   return <div style={{color:'var(--err)', padding:14}}>{error}</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1 className="hstack"><I.Brain size={20} style={{color:'var(--accent)'}}/> Skills</h1>
          <div className="sub">
            Versioned capabilities the agents call. Each skill declares its dependencies and usage counter.
          </div>
        </div>
        <div className="page-actions">
          <span className="tag">ADMIN</span>
          {!canWrite && <span className="tag warn">READ-ONLY</span>}
        </div>
      </div>

      <div className="kpi-row" style={{marginBottom:14}}>
        <KPI label="Skills"    value={counts.total}/>
        <KPI label="Valid"     value={counts.valid}/>
        <KPI label="In review" value={counts.review}/>
        <KPI label="Retired"   value={counts.retired}/>
      </div>

      <div className="honest-band">
        <I.Info size={12}/>
        <span>
          Status changes route through <span className="mono xsmall">api.skills.setStatus</span>
          and are audited. Retire is owner-only. Registering a new skill requires uploading the
          package to the skill host via <span className="mono xsmall">POST /api/skills</span>
          — the admin UI cannot do this directly.
        </span>
      </div>

      <div className="hstack" style={{gap:6, marginBottom:12, justifyContent:'space-between'}}>
        <div className="hstack" style={{gap:6, flexWrap:'wrap'}}>
          <button className={`btn sm ${filter==='all' ? 'primary' : ''}`} onClick={()=>setFilter('all')}>All · {counts.total}</button>
          <button className={`btn sm ${filter==='valid' ? 'primary' : ''}`} onClick={()=>setFilter('valid')}>Valid · {counts.valid}</button>
          <button className={`btn sm ${filter==='review' ? 'primary' : ''}`} onClick={()=>setFilter('review')}>In review · {counts.review}</button>
          <button className={`btn sm ${filter==='retired' ? 'primary' : ''}`} onClick={()=>setFilter('retired')}>Retired · {counts.retired}</button>
        </div>
        <button className="btn sm" onClick={registerNew} title="Requires upload to skill host">
          Register skill
          <span style={{
            display:'inline-block', marginLeft:6, padding:'1px 6px', borderRadius:6, fontSize:9,
            letterSpacing:0.6, textTransform:'uppercase', fontWeight:600,
            color:'#ffb060', background:'rgba(255,176,96,0.14)', border:'1px solid rgba(255,176,96,0.35)',
          }}>ADMIN WIRE-UP</span>
        </button>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr><th>Skill</th><th>Version</th><th>Dependencies</th><th>Usage</th><th>Status</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{color:'var(--fg-0)'}}>{s.name}</div>
                  <div className="muted xsmall mono">{s.id}</div>
                </td>
                <td className="mono xsmall">{s.version}</td>
                <td>
                  {(s.deps || []).length === 0
                    ? <span className="muted xsmall">none</span>
                    : (s.deps || []).map(d => <span key={d} className="tag" style={{marginRight:4}}>{d}</span>)}
                </td>
                <td className="mono xsmall">{(s.usage || 0).toLocaleString()}</td>
                <td>
                  <span className="status-pill" style={{
                    color: s.status === 'valid' ? 'var(--ok)' :
                           s.status === 'review' ? 'var(--warn)' : 'var(--err)',
                  }}>
                    <StatusDot s={s.status === 'valid' ? 'ok' : s.status === 'review' ? 'warn' : 'err'}/>
                    {s.status}
                  </span>
                </td>
                <td className="mono xsmall muted">{s.updated}</td>
                <td className="hstack" style={{justifyContent:'flex-end', gap:6}}>
                  {s.status !== 'retired' && (
                    <button
                      className="btn sm"
                      onClick={()=>toggleStatus(s)}
                      disabled={!canWrite}
                      title={!canWrite ? `Role ${callerRole} is read-only here.` : ''}>
                      {s.status === 'valid' ? 'Mark for review' : 'Mark valid'}
                    </button>
                  )}
                  {s.status !== 'retired' && (
                    <button
                      className="btn sm"
                      onClick={()=>retire(s)}
                      disabled={!canRetire}
                      title={!canRetire ? `Only owner can retire skills.` : 'Retire skill'}
                      style={{color: canRetire ? 'var(--err)' : undefined}}>
                      Retire
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

Object.assign(window, { SkillsPage });
