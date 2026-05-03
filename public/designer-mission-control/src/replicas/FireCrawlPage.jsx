// ============================================================
// FireCrawlPage — Live Web Research & Crawl Operations
//
// HONEST RULE: every action button reads its state from server status.
// No mocked activity. Live feed says "backend_required" until SDK wired.
// ============================================================

const FC_AGENTS = ['Agent Zero', 'Hermes', 'Researcher', 'Builder', 'Operator', 'Marketing', 'Support'];

function FcStatePill({ state }) {
  const map = {
    live: ['live', 'Live'],
    backend_required: ['backend', 'Backend required'],
    credential_required: ['credential', 'Credential required'],
    degraded: ['degraded', 'Degraded'],
    not_installed: ['not-installed', 'Not installed'],
    unknown: ['unknown', 'Unknown'],
  };
  const [cls, label] = map[state] || map.unknown;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function FcLockedBtn({ children, state, locked, onClick, primary }) {
  const reasons = {
    backend_required: 'Backend required — SDK not wired',
    credential_required: 'Credential required — add FIRECRAWL_API_KEY',
    owner_approval_required: 'Owner approval required',
  };
  if (locked) {
    return (
      <button className={`ns-btn ${primary ? 'primary' : ''}`} disabled data-locked={reasons[state] || 'Disabled'}>
        {children}
      </button>
    );
  }
  return (
    <button className={`ns-btn ${primary ? 'primary' : ''}`} onClick={onClick}>{children}</button>
  );
}

function FireCrawlPage() {
  const [status, setStatus] = React.useState(null);
  const [jobs, setJobs]     = React.useState([]);
  const [feed, setFeed]     = React.useState([]); // empty until SSE has events
  const [feedNote, setFeedNote] = React.useState('No events yet — waiting for backend');
  const [form, setForm]     = React.useState({
    type: 'crawl', title: '', url: '', depth: 2, max_pages: 25, include: '', exclude: '',
    format: 'markdown', priority: 'normal', agent: 'Researcher', requires_credential: false, requires_approval: true,
  });
  const [busy, setBusy]     = React.useState(false);
  const [toast, setToast]   = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const [s, j] = await Promise.all([
          window.api.get?.('/api/firecrawl/status') ?? fetch('/api/firecrawl/status').then(r => r.json()),
          window.api.get?.('/api/firecrawl/jobs')   ?? fetch('/api/firecrawl/jobs').then(r => r.json()),
        ]);
        if (dead) return;
        setStatus(s); setJobs(j.jobs || []);
      } catch (e) {
        if (!dead) setStatus({ status: 'unknown', error: e.message });
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  async function submit() {
    setBusy(true);
    try {
      const payload = {
        ...form,
        include: form.include.split('\n').map(s => s.trim()).filter(Boolean),
        exclude: form.exclude.split('\n').map(s => s.trim()).filter(Boolean),
      };
      const r = await fetch('/api/firecrawl/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.backend_required) {
        setToast({ kind: 'warn', msg: 'Job design accepted — execution waits for backend wiring.' });
      } else if (j.credential_required) {
        setToast({ kind: 'warn', msg: 'Credential required — open the vault to add FIRECRAWL_API_KEY.' });
      } else if (j.ok) {
        setToast({ kind: 'info', msg: `Job created: ${j.job?.id || 'pending'}` });
      } else {
        setToast({ kind: 'danger', msg: j.error || 'Unknown error' });
      }
    } catch (e) {
      setToast({ kind: 'danger', msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 6000);
    }
  }

  const s = status || {};
  const stateLabel = s.status || 'unknown';
  const execLocked = stateLabel !== 'live';
  const exportLocked = true; // BACKEND_REQUIRED until SDK wired
  const lightragLocked = true;
  const memLocked = true;

  return (
    <div className="ns-page">
      {/* Header */}
      <div className="ns-header">
        <div>
          <h1>FireCrawl <FcStatePill state={stateLabel}/></h1>
          <div className="ns-sub">Live web research & crawl operations · Designed for crawl, scrape, extract, monitor</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={() => window.location.reload()}>Refresh</button>
          <FcLockedBtn locked={execLocked} state={stateLabel} primary>+ New job</FcLockedBtn>
        </div>
      </div>

      {/* Honest banner */}
      {stateLabel !== 'live' && (
        <div className={`ns-banner ${stateLabel === 'credential_required' ? 'warn' : 'info'}`}>
          <strong>Honest state:</strong>&nbsp;
          {stateLabel === 'credential_required' && <span>Add <code>FIRECRAWL_API_KEY</code> to the vault to enable execution.</span>}
          {stateLabel === 'backend_required' && <span>UI is real, contracts are real. <code>clients/firecrawl.js</code> not wired yet — execute buttons return <code>backend_required</code>.</span>}
          {stateLabel === 'unknown' && <span>Status endpoint unreachable.</span>}
        </div>
      )}

      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      {/* Status strip */}
      <div className="ns-status-strip">
        <div className="ns-stat">
          <div className="ns-stat-label">FireCrawl</div>
          <div className="ns-stat-value"><FcStatePill state={stateLabel}/></div>
          <div className="ns-stat-foot">key: {s.key_present ? 'present' : 'missing'} · sdk: {s.sdk_loaded ? 'loaded' : 'not_loaded'}</div>
        </div>
        <div className="ns-stat">
          <div className="ns-stat-label">MCP</div>
          <div className="ns-stat-value"><FcStatePill state={s.mcp?.status === 'failed_to_connect' ? 'failed' : (s.mcp?.status || 'unknown')}/></div>
          <div className="ns-stat-foot">{s.mcp?.name || 'firecrawl-mcp'}</div>
        </div>
        <div className="ns-stat"><div className="ns-stat-label">Active jobs</div><div className="ns-stat-value">{s.jobs?.active ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Queued</div><div className="ns-stat-value">{s.jobs?.queued ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Completed</div><div className="ns-stat-value">{s.jobs?.completed ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Failed</div><div className="ns-stat-value">{s.jobs?.failed ?? 0}</div></div>
      </div>

      {/* Two column: form + activity feed */}
      <div className="ns-cols">
        <div className="ns-card">
          <div className="ns-card-h">
            <h2>New crawl / scrape task</h2>
            <span className="ns-card-sub">Design accepted · execution gated on backend</span>
          </div>
          <div className="ns-form">
            <div>
              <label>Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="crawl">Crawl (multi-page)</option>
                <option value="scrape">Scrape (single page)</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
            </div>
            <div className="full">
              <label>Task title</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Audit competitor pricing pages"/>
            </div>
            <div className="full">
              <label>Target URL or domain</label>
              <input value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://example.com"/>
            </div>
            <div>
              <label>Crawl depth</label>
              <input type="number" min="0" max="6" value={form.depth} onChange={e => setForm({...form, depth: +e.target.value})}/>
            </div>
            <div>
              <label>Max pages</label>
              <input type="number" min="1" max="2000" value={form.max_pages} onChange={e => setForm({...form, max_pages: +e.target.value})}/>
            </div>
            <div>
              <label>Include patterns (one per line)</label>
              <textarea value={form.include} onChange={e => setForm({...form, include: e.target.value})} placeholder="/pricing&#10;/docs"/>
            </div>
            <div>
              <label>Exclude patterns</label>
              <textarea value={form.exclude} onChange={e => setForm({...form, exclude: e.target.value})} placeholder="/login&#10;/account"/>
            </div>
            <div>
              <label>Output format</label>
              <select value={form.format} onChange={e => setForm({...form, format: e.target.value})}>
                <option value="markdown">Markdown</option><option value="json">JSON</option><option value="html">HTML</option>
              </select>
            </div>
            <div>
              <label>Assigned agent</label>
              <select value={form.agent} onChange={e => setForm({...form, agent: e.target.value})}>
                {FC_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="full">
              <label style={{display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0}}>
                <input type="checkbox" checked={form.requires_credential} onChange={e => setForm({...form, requires_credential: e.target.checked})}/>
                <span>Site requires login (credential vault will be used)</span>
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, marginTop: 6}}>
                <input type="checkbox" checked={form.requires_approval} onChange={e => setForm({...form, requires_approval: e.target.checked})}/>
                <span>Require owner approval before execution</span>
              </label>
            </div>
          </div>
          <div className="ns-form-actions">
            <FcLockedBtn primary locked={execLocked || busy} state={stateLabel} onClick={submit}>
              {busy ? 'Submitting…' : 'Start job'}
            </FcLockedBtn>
            <button className="ns-btn" disabled>Save draft</button>
            <button className="ns-btn" onClick={() => setForm({...form, title: '', url: '', include: '', exclude: ''})}>Cancel</button>
          </div>
        </div>

        <div className="ns-card">
          <div className="ns-card-h">
            <h2>Live activity feed</h2>
            <span className="ns-card-sub">Real events only — no mocking</span>
          </div>
          {feed.length === 0 ? (
            <div className="ns-feed-empty">
              <strong>No events yet</strong>
              {stateLabel === 'live'
                ? 'Start a job to begin streaming.'
                : `Backend required — feed will populate once clients/firecrawl.js is wired.`}
            </div>
          ) : (
            <div className="ns-feed">
              {feed.map((ev, i) => (
                <div key={i} className="ns-feed-row">
                  <span className="ts">{ev.ts}</span>
                  <span className="agent">{ev.agent}</span>
                  <span>{ev.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job queue */}
      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Job queue</h2>
          <span className="ns-card-sub">{jobs.length} job{jobs.length === 1 ? '' : 's'}</span>
        </div>
        {jobs.length === 0 ? (
          <div className="ns-empty">No jobs yet. Submit one above to begin.</div>
        ) : (
          <table className="ns-table">
            <thead><tr>
              <th>ID</th><th>Title</th><th>Agent</th><th>Status</th><th>Progress</th>
              <th>Started</th><th>Cost</th><th></th>
            </tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.id}</td>
                  <td>{j.title || '—'}</td>
                  <td>{j.agent || '—'}</td>
                  <td><FcStatePill state={j.status || 'unknown'}/></td>
                  <td className="num">{j.progress != null ? `${j.progress}%` : '—'}</td>
                  <td>{j.started_at || '—'}</td>
                  <td className="num">{j.cost_usd != null ? `$${j.cost_usd.toFixed(3)}` : '—'}</td>
                  <td className="row-actions">
                    <FcLockedBtn locked={execLocked} state={stateLabel}><span className="ns-btn tiny">Pause</span></FcLockedBtn>
                    <FcLockedBtn locked={execLocked} state={stateLabel}><span className="ns-btn tiny">Cancel</span></FcLockedBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Results / export */}
      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Results & export</h2>
          <span className="ns-card-sub">Export & forward actions</span>
        </div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <FcLockedBtn locked={exportLocked} state="backend_required">Export JSON</FcLockedBtn>
          <FcLockedBtn locked={exportLocked} state="backend_required">Export Markdown</FcLockedBtn>
          <FcLockedBtn locked={exportLocked} state="backend_required">Export PDF</FcLockedBtn>
          <FcLockedBtn locked={lightragLocked} state="backend_required">Send to LightRAG</FcLockedBtn>
          <FcLockedBtn locked={memLocked} state="backend_required">Send to Claude-Mem</FcLockedBtn>
          <FcLockedBtn locked={execLocked} state={stateLabel}>Create follow-up task</FcLockedBtn>
        </div>
        <div style={{marginTop: 12, fontSize: 11, color: 'var(--text-dim, #8a8f98)'}}>
          Credentials are never displayed here. If a site requires login, the agent halts and the
          credential vault is used securely.
        </div>
      </div>
    </div>
  );
}

window.FireCrawlPage = FireCrawlPage;
