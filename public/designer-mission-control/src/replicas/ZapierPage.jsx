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
    LIVE: ['live', 'LIVE'],
    READY: ['read-only', 'READY'],
    OWNER_GATED: ['approval', 'OWNER_GATED'],
    CREDENTIAL_GATED: ['credential', 'CREDENTIAL_GATED'],
    SERVICE_DOWN: ['failed', 'SERVICE_DOWN'],
    BLOCKED: ['failed', 'BLOCKED'],
    DISABLED: ['disabled', 'DISABLED'],
  };
  const [cls, label] = map[state] || map.unknown;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function ZapierPage() {
  const [status, setStatus] = React.useState(null);
  const [audit, setAudit]   = React.useState({ blocked_writes: [], allowed_reads: [], events: [] });
  const [tools, setTools]   = React.useState({ ok: false, backend_required: true });
  const [heygen, setHeygen] = React.useState(null);
  const [toast, setToast]   = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const [s, a, h] = await Promise.all([
          fetch('/api/bridge/zapier/status').then(r => r.json()),
          fetch('/api/zapier/audit').then(r => r.json()),
          fetch('/api/bridge/heygen/schema-readiness').then(r => r.json()),
        ]);
        if (!dead) { setStatus(s); setAudit(a); setHeygen(h); }
      } catch (e) {
        if (!dead) setStatus({ status: 'unknown', error: e.message });
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  async function loadTools() {
    try { setTools(await fetch('/api/bridge/zapier/tools').then(r => r.json())); }
    catch (e) { setTools({ ok: false, error: e.message }); }
  }
  async function requestApproval() {
    try {
      const res = await fetch('/api/zapier/request-write-approval', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'all', scope: 'session', ttl_minutes: 30 }),
      });
      const json = await res.json().catch(() => ({}));
      setToast({
        kind: 'warn',
        msg: json.approval_request_created
          ? 'Approval request created. Protected writes remain locked until approved.'
          : 'Approval queue is not connected yet. Writes stay locked; no approval request was sent.',
      });
    } catch (_) {
      setToast({ kind: 'warn', msg: 'Approval queue is unavailable. Writes stay locked; no approval request was sent.' });
    }
    setTimeout(() => setToast(null), 6000);
  }
  async function revokeApproval() {
    try {
      const res = await fetch('/api/zapier/revoke-write-approval', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setToast({
        kind: 'info',
        msg: json.revoked
          ? 'Approval revoked.'
          : 'No durable approval state exists yet, so there is nothing to revoke.',
      });
    } catch (_) {
      setToast({ kind: 'info', msg: 'Approval persistence is not connected yet, so there is nothing to revoke.' });
    }
    setTimeout(() => setToast(null), 4000);
  }

  const s = status || {};
  const events = audit.events || [];
  const topState = s.canonical_status || s.status || 'unknown';

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>Zapier <ZapStatePill state={topState}/></h1>
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
      {s.blocker && <div className="ns-banner danger"><strong>Current blocker:</strong>&nbsp;{s.blocker}</div>}
      {s.warning && <div className="ns-banner warn"><strong>Readiness note:</strong>&nbsp;{s.warning}</div>}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">OAuth</div><div className="ns-stat-value"><span className={`ns-pill ${s.oauth ? 'live' : 'not-installed'}`}>{s.oauth ? 'Connected' : 'Not connected'}</span></div></div>
        <div className="ns-stat"><div className="ns-stat-label">MCP</div><div className="ns-stat-value"><ZapStatePill state={topState}/></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Tools</div><div className="ns-stat-value">{s.tools_count ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Read</div><div className="ns-stat-value">{s.read_tools_total ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Write</div><div className="ns-stat-value">{s.write_tools_total ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Writes</div><div className="ns-stat-value"><span className={`ns-pill ${s.writes_unlocked ? 'live' : 'approval'}`}>{s.writes_unlocked ? 'Unlocked' : 'Locked'}</span></div></div>
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
          ) : tools.ok && Array.isArray(tools.tools) && tools.tools.length > 0 ? (
            <table className="ns-table">
              <thead><tr><th>Tool</th><th>Kind</th><th>Allowed</th></tr></thead>
              <tbody>
                {tools.tools.map(t => (
                  <tr key={t.tool_name}>
                    <td>{t.tool_name}</td>
                    <td>{t.write_classification}</td>
                    <td><span className={`ns-pill ${t.write_classification === 'read' ? 'read-only' : 'approval'}`}>{t.write_classification === 'read' ? 'Read-only' : 'Approval required'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tools.ok ? (
            <div className="ns-empty">
              <span className="ns-pill failed">{tools.canonical_status || 'BLOCKED'}</span>
              <div style={{marginTop: 8}}>{tools.blocker || tools.next_action || 'Zapier tool inventory is not visible. No tools are being claimed.'}</div>
            </div>
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

        <div className="ns-card">
          <div className="ns-card-h">
            <h2>HeyGen schema readiness</h2>
            <ZapStatePill state={(heygen && heygen.canonical_status) || 'unknown'} />
          </div>
          <div style={{fontSize: 12, color: 'var(--text-dim, #8a8f98)', lineHeight: 1.6}}>
            Schema validation only. Generation remains disabled until exact Bridge Session approval exists.
          </div>
          <div className="ns-status-strip" style={{marginTop: 14}}>
            <div className="ns-stat"><div className="ns-stat-label">Schema</div><div className="ns-stat-value">{heygen && heygen.schema_available ? 'Visible' : 'Not visible'}</div></div>
            <div className="ns-stat"><div className="ns-stat-label">Tool</div><div className="ns-stat-value" style={{fontSize: 11}}>{(heygen && heygen.tool_name) || '—'}</div></div>
            <div className="ns-stat"><div className="ns-stat-label">Required</div><div className="ns-stat-value" style={{fontSize: 11}}>{heygen && heygen.required_fields && heygen.required_fields.length ? heygen.required_fields.join(', ') : '—'}</div></div>
            <div className="ns-stat"><div className="ns-stat-label">Generation</div><div className="ns-stat-value"><span className="ns-pill approval">Bridge gated</span></div></div>
          </div>
          {heygen && heygen.blocker && <div className="ns-banner warn" style={{marginTop: 14}}><strong>Blocker:</strong>&nbsp;{heygen.blocker}</div>}
          {heygen && heygen.next_action && <div className="ns-empty" style={{marginTop: 14}}>{heygen.next_action}</div>}
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
