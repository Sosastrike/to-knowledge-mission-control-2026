// ============================================================
// N8NPage — n8n workflow control center
// All execute/activate/deactivate gated on owner approval.
// ============================================================

function N8nStatePill({ state }) {
  const map = {
    live: ['live', 'Live'],
    degraded: ['degraded', 'Degraded'],
    not_installed: ['not-installed', 'Not installed'],
    credential_required: ['credential', 'Credential required'],
    unknown: ['unknown', 'Unknown'],
  };
  const [cls, label] = map[state] || map.unknown;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function N8NPage() {
  const [status, setStatus] = React.useState(null);
  const [test, setTest]     = React.useState(null);
  const [toast, setToast]   = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const s = await fetch('/api/n8n/status').then(r => r.json());
        if (!dead) setStatus(s);
      } catch (e) { if (!dead) setStatus({ status: 'unknown' }); }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  async function runTest() {
    setTest({ pending: true });
    try {
      const r = await fetch('/api/n8n/test', { method: 'POST' });
      setTest(await r.json());
    } catch (e) { setTest({ ok: false, error: e.message }); }
  }

  async function approval(action, id = 'all') {
    try {
      const res = await fetch(`/api/n8n/workflows/${id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      setToast({
        kind: 'warn',
        msg: body.approval_request_created
          ? `${action} queued for owner approval.`
          : `${action} requires owner approval. Approval queue is not connected yet; no request was sent.`,
      });
    } catch (_) {
      setToast({ kind: 'warn', msg: `${action} requires owner approval. Approval queue is unavailable; no request was sent.` });
    }
    setTimeout(() => setToast(null), 6000);
  }

  const s = status || {};
  const stateLabel = s.status || 'unknown';
  const installed = !!s.installed;
  const execLocked = true; // OWNER_APPROVAL_REQUIRED

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>n8n <N8nStatePill state={stateLabel}/></h1>
          <div className="ns-sub">Workflow automation · Triggers, actions, credentials, executions</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={() => window.location.reload()}>Refresh</button>
          <button className="ns-btn" onClick={() => s.ui_url && window.open(s.ui_url, '_blank')} disabled={!installed}>Open n8n</button>
        </div>
      </div>

      {!installed && (
        <div className="ns-banner warn">
          <strong>Not installed.</strong>&nbsp;
          Set <code>N8N_BASE_URL</code> in <code>.env</code> to enable. Once running, add <code>N8N_API_KEY</code> to the credential vault.
        </div>
      )}
      {installed && !s.api_key_present && (
        <div className="ns-banner warn">
          <strong>Credential required.</strong>&nbsp;
          n8n service is reachable but no API key is configured.
        </div>
      )}
      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">Service</div><div className="ns-stat-value"><N8nStatePill state={stateLabel}/></div></div>
        <div className="ns-stat"><div className="ns-stat-label">Workflows</div><div className="ns-stat-value">{s.workflows_count ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Active</div><div className="ns-stat-value">{s.active ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Failed (24h)</div><div className="ns-stat-value">{s.failed_24h ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Credentials</div><div className="ns-stat-value">{s.credentials_configured ?? '—'}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Last execution</div><div className="ns-stat-value" style={{fontSize: 13}}>{s.last_execution || '—'}</div></div>
      </div>

      <div className="ns-cols">
        <div className="ns-card">
          <div className="ns-card-h"><h2>Connection</h2></div>
          <table className="ns-table">
            <tbody>
              <tr><th>Installed</th><td>{installed ? 'Yes' : 'No'}</td></tr>
              <tr><th>UI URL</th><td>{s.ui_url || '—'}</td></tr>
              <tr><th>API reachable</th><td>{s.api?.reachable ? 'Yes' : `No${s.api?.error ? ` (${s.api.error})` : ''}`}</td></tr>
              <tr><th>API key</th><td>{s.api_key_present ? 'present (vault)' : 'missing'}</td></tr>
              <tr><th>Webhook status</th><td>{s.webhook_status || '—'}</td></tr>
            </tbody>
          </table>
          <div className="ns-form-actions" style={{marginTop: 12}}>
            <button className="ns-btn" onClick={runTest} disabled={!installed}>Test connection</button>
          </div>
          {test && !test.pending && (
            <div className="ns-banner info" style={{marginTop: 12, marginBottom: 0}}>
              Test result: {test.ok ? 'OK' : 'FAIL'} · {test.latency_ms ?? 0}ms
              {test.error && <span> · <code>{test.error}</code></span>}
            </div>
          )}
        </div>

        <div className="ns-card">
          <div className="ns-card-h"><h2>Workflow actions</h2></div>
          <div style={{display: 'grid', gap: 8}}>
            <button className="ns-btn" disabled data-locked="Backend required — workflow list passthrough not wired">List workflows</button>
            <button className="ns-btn" disabled data-locked="Backend required — executions passthrough not wired">View executions</button>
            <button className="ns-btn" disabled data-locked="Backend required — failed-only filter not wired">View failed executions</button>
            <button className="ns-btn warn" onClick={() => approval('activate')}    data-locked="Owner approval required">Activate workflow</button>
            <button className="ns-btn warn" onClick={() => approval('deactivate')}  data-locked="Owner approval required">Deactivate workflow</button>
            <button className="ns-btn warn" onClick={() => approval('execute')}     data-locked="Owner approval required">Execute workflow</button>
            <button className="ns-btn" disabled data-locked="Backend required — webhook list not wired">View webhooks</button>
          </div>
        </div>
      </div>

      <div className="ns-card">
        <div className="ns-card-h"><h2>Assigned agents</h2></div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          {(s.assigned_agents || []).map(a => (
            <span key={a} className="ns-pill read-only">{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

window.N8NPage = N8NPage;
