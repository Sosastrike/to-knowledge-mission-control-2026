// ============================================================
// ZapierPage — Zapier MCP control center (read-only by default)
// Write actions are blocked until owner unlock UI exists.
// ============================================================

function ZapStatePill({ state }) {
  const map = {
    connected: ['connected', 'Connected'],
    configured: ['read-only', 'Configured'],
    not_configured: ['not-installed', 'Not configured'],
    degraded: ['degraded', 'Degraded'],
    LIVE: ['live', 'Live'],
    READ_ONLY: ['read-only', 'Read-only'],
    BACKEND_REQUIRED: ['backend', 'Backend required'],
    CREDENTIAL_REQUIRED: ['not-installed', 'Credential required'],
    OWNER_APPROVAL_REQUIRED: ['approval', 'Owner approval'],
    LOCKED: ['approval', 'Locked'],
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
        if (!dead) {
          setStatus(s);
          setAudit(a);
          const preview = s?.connection_details?.tools_preview || [];
          if (preview.length) {
            setTools({
              ok: true,
              tools: preview,
              backend_required: false,
              source: 'status_preview',
              note: 'Preview from Zapier connection status. Use Load tool list for the full read-only inventory.',
            });
          }
        }
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
  const details = s.connection_details || {};
  const summary = details.summary || {};
  const connections = details.connections || [];
  const events = audit.events || [];
  const credentials = details.credential_present_by_name_only || s.credential_present_by_name_only || {};
  const credentialNames = details.credential_names_checked || s.credential_names || [];
  const activeConnections = connections.filter((item) => ['LIVE', 'READ_ONLY'].includes(item.state)).length;

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
        <div className="ns-stat"><div className="ns-stat-label">MCP</div><div className="ns-stat-value"><ZapStatePill state={summary.mcp_reachable ? 'connected' : (s.mcp || 'unknown')}/></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Tools</div><div className="ns-stat-value">{summary.tools_total ?? s.tools_count ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Writes</div><div className="ns-stat-value"><span className={`ns-pill ${s.writes_unlocked ? 'live' : 'approval'}`}>{s.writes_unlocked ? 'Unlocked' : 'Locked'}</span></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Connections</div><div className="ns-stat-value">{activeConnections}/{connections.length || '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Allowed reads (24h)</div><div className="ns-stat-value">{summary.allowed_reads_24h ?? s.allowed_reads_24h ?? 0}</div></div>
      </div>

      <div className="ns-card" style={{marginBottom: 16}}>
        <div className="ns-card-h">
          <h2>Connection details</h2>
          <span className="ns-card-sub">Credential names only · values hidden</span>
        </div>
        {connections.length === 0 ? (
          <div className="ns-empty">Connection inventory is not available yet. Refresh after the backend status route loads.</div>
        ) : (
          <table className="ns-table">
            <thead><tr><th>Connection</th><th>Status</th><th>Inventory</th><th>Endpoint</th><th>Next step</th></tr></thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td>
                    <strong>{connection.label}</strong>
                    <div style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)', marginTop: 4}}>{connection.detail}</div>
                  </td>
                  <td><ZapStatePill state={connection.state}/></td>
                  <td style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)'}}>
                    {connection.tools_total != null && <div>Tools: {connection.tools_total}</div>}
                    {connection.read_tools != null && <div>Read: {connection.read_tools} · Write-gated: {connection.write_gated_tools} · Unknown: {connection.unknown_tools}</div>}
                    {connection.approved_actions_total != null && <div>Approved actions: {connection.approved_actions_total}</div>}
                    {connection.exact_tool_name && <div>Exact tool: <code>{connection.exact_tool_name}</code></div>}
                    {connection.required_fields?.length ? <div>Fields: {connection.required_fields.join(', ')}</div> : null}
                    {connection.provider_categories?.length ? <div>Categories: {connection.provider_categories.slice(0, 6).join(', ')}</div> : null}
                    {connection.blocker && <div>Blocker: {connection.blocker}</div>}
                  </td>
                  <td><code>{connection.endpoint}</code></td>
                  <td style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)'}}>{connection.next_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="ns-banner info" style={{marginTop: 14}}>
          <strong>No-secret proof:</strong>&nbsp;
          {details.secret_values_exposed === false ? 'No credential values are exposed. ' : 'Secret exposure state unavailable. '}
          Checked names: {credentialNames.length ? credentialNames.map((name) => `${name}:${credentials[name] ? 'present' : 'missing'}`).join(' · ') : 'not reported'}.
        </div>
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
              <div style={{marginTop: 8}}>{details.next_action || tools.next_action || 'MCP client not implemented yet.'}</div>
            </div>
          ) : tools.ok && tools.tools ? (
            <table className="ns-table">
              <thead><tr><th>Tool</th><th>Provider</th><th>Kind</th><th>Allowed</th></tr></thead>
              <tbody>
                {tools.tools.map(t => (
                  <tr key={t.tool_name || t.name}>
                    <td><code>{t.tool_name || t.name}</code></td>
                    <td>{t.category || 'unknown'}</td>
                    <td>{t.write_classification || t.kind || 'unknown'}</td>
                    <td><span className={`ns-pill ${(t.write_classification || t.kind) === 'read' ? 'read-only' : 'approval'}`}>{(t.write_classification || t.kind) === 'read' ? 'Read-only' : 'Approval required'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="ns-empty">Click "Load tool list" to enumerate via MCP.</div>}
          {tools.note && <div style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)', marginTop: 10}}>{tools.note}</div>}
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
