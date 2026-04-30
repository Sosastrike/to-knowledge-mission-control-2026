// ============================================================
// MCPToolsPage — MCP server registry
// Reads truth from `claude mcp list` + ~/.claude/mcp.json.
// Surfaces firecrawl-mcp failure if present, never hides it.
// ============================================================

function McpServerPill({ status }) {
  const map = {
    connected: ['live', 'Connected'],
    ok:        ['live', 'OK'],
    failed:    ['failed', 'Failed'],
    degraded:  ['degraded', 'Degraded'],
    unknown:   ['unknown', 'Unknown'],
  };
  const [cls, label] = map[status] || map.unknown;
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
    } catch (e) { setData({ servers: [], error: e.message }); }
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
    await fetch(`/api/mcp/servers/${id}/${action}`, { method: 'POST' });
    setToast({ kind: 'warn', msg: `${action} on ${id} requires owner approval — request logged.` });
    setTimeout(() => setToast(null), 5000);
  }

  const servers = data.servers || [];

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>MCP Tools</h1>
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

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">Total</div><div className="ns-stat-value">{status?.total ?? servers.length}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Healthy</div><div className="ns-stat-value">{status?.healthy ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Degraded</div><div className="ns-stat-value">{status?.degraded ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Failed</div><div className="ns-stat-value">{status?.failed ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Unknown</div><div className="ns-stat-value">{status?.unknown ?? 0}</div></div>
      </div>

      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Servers</h2>
          <span className="ns-card-sub">{data.sources_checked?.join(' · ') || '—'}</span>
        </div>
        {servers.length === 0 ? (
          <div className="ns-empty">
            {data.note === 'no_mcp_servers_detected'
              ? 'No MCP servers detected. Configure via `claude mcp add` or ~/.claude/mcp.json.'
              : 'Loading…'}
          </div>
        ) : (
          <table className="ns-table">
            <thead><tr>
              <th>Name</th><th>Transport</th><th>Status</th><th>Auth</th>
              <th>Tools</th><th>Visible to Tony</th><th>Visible to sub-agents</th>
              <th>Last error</th><th></th>
            </tr></thead>
            <tbody>
              {servers.map(s => (
                <tr key={s.name}>
                  <td><strong>{s.name}</strong> <span style={{fontSize: 10, color: 'var(--text-dim, #8a8f98)'}}>· {s.source}</span></td>
                  <td>{s.transport}</td>
                  <td><McpServerPill status={s.status}/></td>
                  <td>{s.auth || 'unknown'}</td>
                  <td className="num">{s.tool_count ?? '—'}</td>
                  <td>{s.visible_to?.tony ? 'yes' : 'no'}</td>
                  <td>{s.visible_to?.sub_agents ? 'yes' : 'no'}</td>
                  <td style={{fontSize: 11, color: s.error ? '#ef4444' : 'var(--text-dim, #8a8f98)'}}>{s.error || '—'}</td>
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
