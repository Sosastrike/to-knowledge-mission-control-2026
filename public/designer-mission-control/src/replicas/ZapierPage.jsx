// ============================================================
// ZapierPage — Zapier MCP control center (read-only by default)
// Write actions are blocked until owner unlock UI exists.
// ============================================================

function ZapStatePill({ state }) {
  const map = {
    connected: ['connected', 'Connected'],
    not_configured: ['not-installed', 'Not configured'],
    degraded: ['degraded', 'Degraded'],
    unknown: ['unknown', 'Unknown'],
  };
  const [cls, label] = map[state] || map.unknown;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function ZapierPage() {
  const [status, setStatus] = React.useState(null);
  const [audit, setAudit]   = React.useState({ blocked_writes: [], allowed_reads: [], events: [] });
  const [tools, setTools]   = React.useState({ ok: false, backend_required: true });
  const [toast, setToast]   = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const [s, a] = await Promise.all([
          fetch('/api/zapier/status').then(r => r.json()),
          fetch('/api/zapier/audit').then(r => r.json()),
        ]);
        if (!dead) { setStatus(s); setAudit(a); }
      } catch (e) {
        if (!dead) setStatus({ status: 'unknown', error: e.message });
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  async function loadTools() {
    try { setTools(await fetch('/api/zapier/tools').then(r => r.json())); }
    catch (e) { setTools({ ok: false, error: e.message }); }
  }
  async function requestApproval() {
    setToast({ kind: 'warn', msg: 'Owner approval flow not implemented yet — request was logged with backend_required.' });
    try {
      await fetch('/api/zapier/request-write-approval', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'all', scope: 'session', ttl_minutes: 30 }),
      });
    } catch (_) {}
    setTimeout(() => setToast(null), 6000);
  }
  async function revokeApproval() {
    await fetch('/api/zapier/revoke-write-approval', { method: 'POST' });
    setToast({ kind: 'info', msg: 'Approval revoked.' });
    setTimeout(() => setToast(null), 4000);
  }

  const s = status || {};
  const events = audit.events || [];

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>Zapier <ZapStatePill state={s.status || 'unknown'}/></h1>
          <div className="ns-sub">Zapier MCP control center · Read actions allowed · Writes locked behind owner approval</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={() => window.location.reload()}>Refresh</button>
          <button className="ns-btn" onClick={() => window.open('https://zapier.com/app/dashboard', '_blank')}>Open Zapier</button>
        </div>
      </div>

      <div className="ns-banner info">
        <strong>Zapier rule:</strong>&nbsp;
        Read / list / find / get actions are allowed. Create / update / delete / send / post / upload / run actions are blocked until owner approval.
      </div>

      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">OAuth</div><div className="ns-stat-value"><span className={`ns-pill ${s.oauth ? 'live' : 'not-installed'}`}>{s.oauth ? 'Connected' : 'Not connected'}</span></div></div>
        <div className="ns-stat"><div className="ns-stat-label">MCP</div><div className="ns-stat-value"><ZapStatePill state={s.mcp || 'unknown'}/></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Tools</div><div className="ns-stat-value">{s.tools_count ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Writes</div><div className="ns-stat-value"><span className={`ns-pill ${s.writes_unlocked ? 'live' : 'approval'}`}>{s.writes_unlocked ? 'Unlocked' : 'Locked'}</span></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Blocked writes (24h)</div><div className="ns-stat-value">{s.blocked_writes_24h ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Allowed reads (24h)</div><div className="ns-stat-value">{s.allowed_reads_24h ?? 0}</div></div>
      </div>

      <div className="ns-cols">
        <div className="ns-card">
          <div className="ns-card-h">
            <h2>Tools</h2>
            <button className="ns-btn tiny" onClick={loadTools}>Load tool list</button>
          </div>
          {tools.backend_required ? (
            <div className="ns-empty">
              <span className="ns-pill backend">Backend required</span>
              <div style={{marginTop: 8}}>{tools.next_action || 'MCP client not implemented yet.'}</div>
            </div>
          ) : tools.ok && tools.tools ? (
            <table className="ns-table">
              <thead><tr><th>Tool</th><th>Kind</th><th>Allowed</th></tr></thead>
              <tbody>
                {tools.tools.map(t => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{t.kind}</td>
                    <td><span className={`ns-pill ${t.kind === 'read' ? 'read-only' : 'approval'}`}>{t.kind === 'read' ? 'Read-only' : 'Approval required'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="ns-empty">Click "Load tool list" to enumerate via MCP.</div>}
        </div>

        <div className="ns-card">
          <div className="ns-card-h">
            <h2>Write approval</h2>
            <span className="ns-card-sub">Per-job, time-limited</span>
          </div>
          <div style={{fontSize: 12, color: 'var(--text-dim, #8a8f98)', lineHeight: 1.6}}>
            Requesting approval pages the owner via Telegram with a single approval card scoped to one job.
            Approval expires automatically. All approval use is audited.
          </div>
          <div className="ns-form-actions" style={{marginTop: 14}}>
            <button className="ns-btn warn" onClick={requestApproval} data-locked="Owner-unlock UI not built yet">Request write approval</button>
            <button className="ns-btn" onClick={revokeApproval}>Revoke approval</button>
          </div>
        </div>
      </div>

      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Recent activity</h2>
          <span className="ns-card-sub">{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>
        {events.length === 0 ? (
          <div className="ns-empty">No Zapier audit events recorded yet.</div>
        ) : (
          <table className="ns-table">
            <thead><tr><th>Time</th><th>Event</th><th>Outcome</th><th>Detail</th></tr></thead>
            <tbody>
              {events.slice(0, 30).map((e, i) => (
                <tr key={i}>
                  <td>{e.ts}</td>
                  <td>{e.event}</td>
                  <td><span className={`ns-pill ${e.outcome === 'blocked' ? 'failed' : 'live'}`}>{e.outcome}</span></td>
                  <td style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)'}}>{e.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

window.ZapierPage = ZapierPage;
