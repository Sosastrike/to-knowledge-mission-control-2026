// ============================================================
// MCPToolsPage — MCP server registry
// Reads truth from Mission Control's canonical MCP registry API.
// Surfaces blocked/service-down state directly; never implies tools are live.
// ============================================================

function McpServerPill({ status, canonical }) {
  const map = {
    connected: ['live', 'Connected'],
    ok:        ['live', 'OK'],
    failed:    ['failed', 'Failed'],
    degraded:  ['degraded', 'Degraded'],
    unknown:   ['unknown', 'Unknown'],
    LIVE: ['live', 'LIVE'],
    READY: ['read-only', 'READY'],
    OWNER_GATED: ['approval', 'OWNER_GATED'],
    CREDENTIAL_GATED: ['credential', 'CREDENTIAL_GATED'],
    SERVICE_DOWN: ['failed', 'SERVICE_DOWN'],
    BLOCKED: ['failed', 'BLOCKED'],
    DISABLED: ['disabled', 'DISABLED'],
  };
  const [cls, label] = map[canonical || status] || map.unknown;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function MCPToolsPage() {
  const [data, setData]     = React.useState({ servers: [] });
  const [status, setStatus] = React.useState(null);
  const [busy, setBusy]     = React.useState({});
  const [toast, setToast]   = React.useState(null);

  async function load() {
    try {
      const [d, s] = await Promise.all([
        fetch('/api/mcp/servers').then(r => r.json()),
        fetch('/api/mcp/status').then(r => r.json()),
      ]);
      setData(d); setStatus(s);
    } catch (e) { setData({ servers: [], error: e.message, canonical_status: 'SERVICE_DOWN', blocker_class: 'SERVICE_DOWN' }); }
  }
  React.useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function testServer(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const r = await fetch(`/api/mcp/servers/${id}/test`, { method: 'POST' });
      const j = await r.json();
      setToast({ kind: j.ok ? 'info' : 'warn',
        msg: `${id}: ${j.ok ? 'OK' : 'FAIL'} · ${j.latency_ms ?? 0}ms${j.error ? ' · ' + j.error : ''}` });
      load();
    } catch (e) { setToast({ kind: 'danger', msg: e.message }); }
    finally {
      setBusy(b => ({ ...b, [id]: false }));
      setTimeout(() => setToast(null), 5000);
    }
  }
  async function approval(id, action) {
    const res = await fetch(`/api/mcp/servers/${id}/${action}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setToast({
      kind: 'warn',
      msg: body.approval_request_created
        ? `${action} on ${id} queued for owner approval.`
        : `${action} on ${id} requires owner approval. Approval queue is not connected yet; no request was sent.`,
    });
    setTimeout(() => setToast(null), 5000);
  }

  const servers = data.servers || [];
  const summary = data.summary || status?.summary || {
    total: status?.total ?? servers.length,
    healthy: status?.healthy ?? 0,
    degraded: status?.degraded ?? 0,
    failed: status?.failed ?? 0,
    unknown: status?.unknown ?? 0,
  };
  const topStatus = data.canonical_status || status?.canonical_status || 'BLOCKED';
  const topBlocker = data.blocker || status?.blocker || data.error || null;
  const ownerStatusSummary = data.owner_status_summary || status?.owner_status_summary || {};

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>MCP Tools <McpServerPill canonical={topStatus}/></h1>
          <div className="ns-sub">Model Context Protocol servers · transport, auth, tool count, visibility</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={load}>Refresh MCP list</button>
        </div>
      </div>

      <div className="ns-banner warn">
        <strong>Security note:</strong>&nbsp;
        MCP tools can execute remote code. Re-authentication, enable, and disable actions all require owner approval.
        Per-tool permissions are surfaced where the upstream server exposes them.
      </div>

      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      {topBlocker && (
        <div className="ns-banner danger">
          <strong>Current blocker:</strong>&nbsp;{topBlocker}
        </div>
      )}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">Total</div><div className="ns-stat-value">{summary.total ?? servers.length}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Ready</div><div className="ns-stat-value">{ownerStatusSummary.READY ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Live</div><div className="ns-stat-value">{ownerStatusSummary.LIVE ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Gated</div><div className="ns-stat-value">{(ownerStatusSummary.OWNER_GATED ?? 0) + (ownerStatusSummary.CREDENTIAL_GATED ?? 0)}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Blocked</div><div className="ns-stat-value">{(ownerStatusSummary.SERVICE_DOWN ?? 0) + (ownerStatusSummary.BLOCKED ?? 0) + (ownerStatusSummary.DISABLED ?? 0)}</div></div>
      </div>

      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Servers</h2>
          <span className="ns-card-sub">{data.sources_checked?.join(' · ') || '—'}</span>
        </div>
        {servers.length === 0 ? (
          <div className="ns-empty">
            {topBlocker
              ? `No MCP servers are visible to Mission Control. Current blocker: ${topBlocker}. Tool execution remains unavailable and no live tools are being claimed.`
              : 'Loading MCP server registry…'}
          </div>
        ) : (
          <table className="ns-table">
            <thead><tr>
              <th>Name</th><th>Transport</th><th>Canonical</th><th>Auth</th>
              <th>Tools</th><th>Owner visible</th><th>Sub-agents</th>
              <th>Blocker</th><th></th>
            </tr></thead>
            <tbody>
              {servers.map(s => (
                <tr key={s.name}>
                  <td><strong>{s.name}</strong> <span style={{fontSize: 10, color: 'var(--text-dim, #8a8f98)'}}>· {s.source}</span></td>
                  <td>{s.transport}</td>
                  <td><McpServerPill status={s.status} canonical={s.canonical_status}/></td>
                  <td>{s.auth || 'unknown'}</td>
                  <td className="num">{s.tool_count ?? '—'}</td>
                  <td>{s.visible_to?.owner ? 'yes' : 'no'}</td>
                  <td>{s.visible_to?.sub_agents ? 'yes' : 'no'}</td>
                  <td style={{fontSize: 11, color: (s.blocker || s.error) ? '#ef4444' : 'var(--text-dim, #8a8f98)'}}>{s.blocker || s.error || '—'}</td>
                  <td className="row-actions">
                    <button className="ns-btn tiny" onClick={() => testServer(s.name)} disabled={busy[s.name]}>Test</button>
                    <button className="ns-btn tiny warn" onClick={() => approval(s.name, 'reauth')}  data-locked="Owner approval required">Reauth</button>
                    <button className="ns-btn tiny warn" onClick={() => approval(s.name, s.status === 'connected' ? 'disable' : 'enable')} data-locked="Owner approval required">{s.status === 'connected' ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

window.MCPToolsPage = MCPToolsPage;
