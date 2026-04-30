// ============================================================
// SkillsRegistryPage — Skills + npx skills + finder
// Reads filesystem + agent_skills truthfully.
// ============================================================

function SkillStatePill({ state }) {
  const map = {
    installed: ['live', 'Installed'],
    not_installed: ['not-installed', 'Not installed'],
    backend_required: ['backend', 'Backend required'],
    credential_required: ['credential', 'Credential required'],
    disabled: ['disabled', 'Disabled'],
  };
  const [cls, label] = map[state] || map.not_installed;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function SkillsRegistryPage() {
  const [data, setData] = React.useState({ filesystem: [], agent: [], named: [], npx: [] });
  const [query, setQuery] = React.useState('');
  const [toast, setToast] = React.useState(null);

  async function load() {
    try {
      const j = await fetch('/api/skills').then(r => r.json());
      setData(j);
    } catch (e) { setData({ filesystem: [], agent: [], named: [], npx: [], error: e.message }); }
  }
  React.useEffect(() => { load(); }, []);

  async function approval(skill_id, action) {
    const res = await fetch(`/api/skills/${encodeURIComponent(skill_id)}/${action}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    const queued = body.approval_request_created === true;
    setToast({
      kind: 'warn',
      msg: queued
        ? `${action} on ${skill_id} queued for owner approval.`
        : `${action} on ${skill_id} requires owner approval. Approval queue is not connected yet; no request was sent.`,
    });
    setTimeout(() => setToast(null), 5000);
  }
  async function requestInstall(name) {
    const res = await fetch('/api/skills/finder/request-install', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    const queued = body.approval_request_created === true;
    setToast({
      kind: 'warn',
      msg: queued
        ? `Install request for "${name}" queued for owner approval.`
        : `Installing "${name}" requires owner approval. Approval queue is not connected yet; no request was sent.`,
    });
    setTimeout(() => setToast(null), 5000);
  }
  async function search() {
    if (!query.trim()) return;
    try {
      const res = await fetch('/api/skills/finder/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const body = await res.json().catch(() => ({}));
      setToast({
        kind: res.ok ? 'ok' : 'warn',
        msg: res.ok
          ? `Read-only skill search found ${body.total || 0} matching skills. Installs remain approval-locked.`
          : body.next_action || body.error || 'Skill search is unavailable.',
      });
    } catch (_) {
      setToast({ kind: 'warn', msg: 'Skill search is unavailable.' });
    }
    setTimeout(() => setToast(null), 5000);
  }

  const named = data.named || [];
  const installedCount = named.filter(n => n.installed).length;

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>Skills</h1>
          <div className="ns-sub">Filesystem + agent + npx skill registry · search & install</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={load}>Refresh skills</button>
        </div>
      </div>

      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">Filesystem skills</div><div className="ns-stat-value">{data.filesystem?.length ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Agent skills</div><div className="ns-stat-value">{data.agent?.length ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">npx skills</div><div className="ns-stat-value">{data.npx?.length ?? 0}</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Named skills</div><div className="ns-stat-value">{installedCount} / {named.length}</div></div>
      </div>

      {/* Named skills from the brief */}
      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Named skills</h2>
          <span className="ns-card-sub">From the canonical skills list</span>
        </div>
        <table className="ns-table">
          <thead><tr><th>Skill</th><th>State</th><th>Next action</th><th></th></tr></thead>
          <tbody>
            {named.map(n => (
              <tr key={n.label}>
                <td><strong>{n.label}</strong></td>
                <td><SkillStatePill state={n.state}/></td>
                <td style={{fontSize: 11, color: 'var(--text-dim, #8a8f98)'}}>{n.next_action || '—'}</td>
                <td className="row-actions">
                  {!n.installed && (
                    <button className="ns-btn tiny warn" onClick={() => requestInstall(n.label)} data-locked="Owner approval required">Request install</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filesystem skills */}
      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Filesystem skills</h2>
          <span className="ns-card-sub">Scanned from agent-skills, .claude/skills, agent-tools</span>
        </div>
        {(data.filesystem || []).length === 0 ? (
          <div className="ns-empty">No filesystem skills detected in {(data.roots_scanned || []).join(', ')}.</div>
        ) : (
          <table className="ns-table">
            <thead><tr><th>Name</th><th>Path</th><th>Docs</th><th></th></tr></thead>
            <tbody>
              {data.filesystem.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td style={{fontFamily: 'JetBrains Mono, monospace', fontSize: 11}}>{s.install_path}</td>
                  <td>{s.readme ? 'README.md' : '—'}</td>
                  <td className="row-actions">
                    <button className="ns-btn tiny" disabled data-locked="Backend required — per-skill probe runner not wired">Test</button>
                    <button className="ns-btn tiny warn" onClick={() => approval(s.id, 'enable')}  data-locked="Owner approval required">Enable</button>
                    <button className="ns-btn tiny warn" onClick={() => approval(s.id, 'disable')} data-locked="Owner approval required">Disable</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Finder */}
      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Find a missing skill</h2>
          <span className="ns-card-sub">Read-only search is live. Install and enable actions stay owner-approval locked.</span>
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. PDF redact, Slack triage, OCR…"
            style={{flex: 1, background: 'var(--surface-2, #0f1115)', border: '1px solid var(--border, #23262d)',
                    borderRadius: 8, padding: '8px 10px', color: 'var(--text, #e6e7ea)', fontSize: 13}}/>
          <button className="ns-btn primary" onClick={search}>Search</button>
        </div>
      </div>
    </div>
  );
}

window.SkillsRegistryPage = SkillsRegistryPage;
