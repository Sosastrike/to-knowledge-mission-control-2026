// ============================================================
// ExecutiveReportsPage — Scheduled / Executive Reports
// Canonical Mission Control report definitions. Generation and
// delivery runners remain locked until separately approved.
// ============================================================

const REPORT_TYPES = [
  ['morning', 'Morning report'],
  ['afternoon', 'Afternoon report'],
  ['daily', 'Daily report'],
  ['weekly', 'Weekly report'],
  ['monthly', 'Monthly report'],
  ['custom', 'Custom report'],
  ['agent_specific', 'Agent-specific report'],
  ['project_specific', 'Project-specific report'],
  ['system_health', 'System health report'],
  ['approval_audit', 'Approval / audit report'],
  ['task_completion', 'Task completion report'],
];

const REPORT_AGENTS = ['Agent Zero', 'Hermes', 'Researcher', 'Builder', 'Operator', 'Pac-Man', 'Forge', 'Loom'];

function ReportStatePill({ state }) {
  const map = {
    enabled: ['live', 'Enabled'],
    disabled: ['disabled', 'Disabled'],
    paused: ['backend', 'Paused'],
    blocked: ['failed', 'Blocked'],
    pending: ['backend', 'Pending'],
    completed: ['live', 'Completed'],
    failed: ['failed', 'Failed'],
  };
  const [cls, label] = map[state] || map.disabled;
  return <span className={`ns-pill ${cls}`}>{label}</span>;
}

function fmtTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts * 1000).toLocaleString(); } catch { return '—'; }
}

function defaultForm() {
  return {
    name: 'Daily executive report',
    report_type: 'daily',
    assigned_agent: 'Agent Zero',
    schedule_text: 'daily at 9am',
    enabled: true,
    criteria_text: 'Focus: Mission Control health, task completions, approvals, blockers, and next actions.',
  };
}

function criteriaFromText(text) {
  return {
    owner_instructions: String(text || '').trim(),
    sources: ['shared_brain_context', 'task_history', 'approval_history', 'system_health'],
    generation_state: 'definition_only_execution_locked',
  };
}

function formFromReport(report) {
  return {
    name: report.name || '',
    report_type: report.report_type || 'daily',
    assigned_agent: report.assigned_agent || 'Agent Zero',
    schedule_text: report.schedule_text || 'daily at 9am',
    enabled: !!report.enabled,
    criteria_text: report.criteria?.owner_instructions || JSON.stringify(report.criteria || {}, null, 2),
  };
}

function ExecutiveReportsPage() {
  const [reports, setReports] = React.useState([]);
  const [summary, setSummary] = React.useState({ total: 0, enabled: 0, disabled: 0, blocked: 0 });
  const [selected, setSelected] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [form, setForm] = React.useState(defaultForm());
  const [editingId, setEditingId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [error, setError] = React.useState(null);

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  async function load() {
    try {
      setError(null);
      const json = await api('/api/reports?include_disabled=1');
      setReports(json.reports || []);
      setSummary(json.summary || {});
      if (selected) {
        const fresh = (json.reports || []).find(r => r.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  React.useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  async function loadHistory(report) {
    setSelected(report);
    try {
      const json = await api(`/api/reports/${encodeURIComponent(report.id)}/history`);
      setHistory(json.history || []);
    } catch (e) {
      setHistory([]);
      setToast({ kind: 'warn', msg: `History unavailable: ${e.message}` });
    }
  }

  function editReport(report) {
    setEditingId(report.id);
    setForm(formFromReport(report));
    setSelected(report);
  }

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm());
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const payload = {
        name: form.name,
        report_type: form.report_type,
        assigned_agent: form.assigned_agent,
        schedule_text: form.schedule_text,
        enabled: form.enabled,
        criteria: criteriaFromText(form.criteria_text),
      };
      const json = editingId
        ? await api(`/api/reports/${encodeURIComponent(editingId)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
      setToast({ kind: 'info', msg: editingId ? 'Report updated.' : 'Report created.' });
      setSelected(json.report || null);
      setEditingId(null);
      await load();
    } catch (e) {
      setToast({ kind: 'danger', msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 6000);
    }
  }

  async function toggleReport(report) {
    setBusy(true);
    try {
      await api(`/api/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !report.enabled }),
      });
      await load();
      setToast({ kind: 'info', msg: report.enabled ? 'Report disabled.' : 'Report enabled.' });
    } catch (e) {
      setToast({ kind: 'danger', msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function deleteReport(report) {
    if (!window.confirm(`Delete scheduled report "${report.name}"? This is a soft delete.`)) return;
    setBusy(true);
    try {
      await api(`/api/reports/${encodeURIComponent(report.id)}`, { method: 'DELETE' });
      if (selected?.id === report.id) { setSelected(null); setHistory([]); }
      await load();
      setToast({ kind: 'info', msg: 'Report deleted.' });
    } catch (e) {
      setToast({ kind: 'danger', msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  const nextReport = reports.filter(r => r.next_run_at).sort((a, b) => a.next_run_at - b.next_run_at)[0];

  return (
    <div className="ns-page">
      <div className="ns-header">
        <div>
          <h1>Executive Reports <span className="ns-pill read-only">Scheduled Reports</span></h1>
          <div className="ns-sub">Create, assign, schedule, edit, delete, and review owner/admin reports. Generation runners are approval-gated and not enabled here.</div>
        </div>
        <div className="ns-header-actions">
          <button className="ns-btn" onClick={load}><I.Refresh size={14}/>Refresh</button>
          <button className="ns-btn primary" onClick={resetForm}><I.Plus size={14}/>New report</button>
        </div>
      </div>

      <div className="ns-banner info">
        <strong>Canonical path:</strong>&nbsp; Report definitions live in Mission Control <code>/api/reports</code>. Agent Zero can create definitions through the same API. Protected generation/delivery uses Agent Zero Bridge Session approval.
      </div>
      {error && <div className="ns-banner danger">{error}</div>}
      {toast && <div className={`ns-banner ${toast.kind}`}>{toast.msg}</div>}

      <div className="ns-status-strip">
        <div className="ns-stat"><div className="ns-stat-label">Reports</div><div className="ns-stat-value">{summary.total || reports.length}</div><div className="ns-stat-foot">definitions stored</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Enabled</div><div className="ns-stat-value">{summary.enabled || 0}</div><div className="ns-stat-foot">ready for future runners</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Blocked</div><div className="ns-stat-value">{summary.blocked || 0}</div><div className="ns-stat-foot">schedule/criteria blockers</div></div>
        <div className="ns-stat"><div className="ns-stat-label">Next run</div><div className="ns-stat-value" style={{fontSize: 13}}>{fmtTime(nextReport?.next_run_at)}</div><div className="ns-stat-foot">{nextReport?.name || 'No enabled reports'}</div></div>
      </div>

      <div className="ns-cols">
        <div className="ns-card">
          <div className="ns-card-h">
            <h2>{editingId ? 'Edit report' : 'Create report'}</h2>
            <span className="ns-card-sub">Definition only · no external writes</span>
          </div>
          <form onSubmit={submit}>
            <div className="ns-form">
              <div className="full">
                <label>Report name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Daily executive report" required/>
              </div>
              <div>
                <label>Report type</label>
                <select value={form.report_type} onChange={e => setForm({...form, report_type: e.target.value})}>
                  {REPORT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label>Assigned agent</label>
                <select value={form.assigned_agent} onChange={e => setForm({...form, assigned_agent: e.target.value})}>
                  {REPORT_AGENTS.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                </select>
              </div>
              <div>
                <label>Schedule</label>
                <input value={form.schedule_text} onChange={e => setForm({...form, schedule_text: e.target.value})} placeholder="daily at 9am or cron" required/>
              </div>
              <div>
                <label>Status</label>
                <select value={form.enabled ? 'enabled' : 'disabled'} onChange={e => setForm({...form, enabled: e.target.value === 'enabled'})}>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div className="full">
                <label>Report criteria</label>
                <textarea value={form.criteria_text} onChange={e => setForm({...form, criteria_text: e.target.value})} placeholder="What should this report include?"/>
              </div>
            </div>
            <div className="ns-form-actions">
              <button className="ns-btn primary" type="submit" disabled={busy}><I.Save size={14}/>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Create report'}</button>
              <button className="ns-btn" type="button" onClick={resetForm}>Reset</button>
            </div>
          </form>
        </div>

        <div className="ns-card">
          <div className="ns-card-h">
            <h2>Report details</h2>
            <span className="ns-card-sub">Click a report to review</span>
          </div>
          {!selected ? (
            <div className="ns-empty">Select a report to see details and history.</div>
          ) : (
            <div style={{fontSize: 12, lineHeight: 1.7}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12, marginBottom: 8}}>
                <strong style={{fontSize: 15}}>{selected.name}</strong>
                <ReportStatePill state={selected.status}/>
              </div>
              <div><span className="muted">Assigned:</span> {selected.assigned_agent}</div>
              <div><span className="muted">Type:</span> {selected.report_type}</div>
              <div><span className="muted">Schedule:</span> {selected.schedule_human || selected.schedule_text}</div>
              <div><span className="muted">Last run:</span> {fmtTime(selected.last_run_at)}</div>
              <div><span className="muted">Next run:</span> {fmtTime(selected.next_run_at)}</div>
              <div><span className="muted">Criteria:</span> {selected.criteria?.owner_instructions || 'No owner instructions yet.'}</div>
              <div className="ns-form-actions">
                <button className="ns-btn tiny" onClick={() => editReport(selected)}><I.Edit size={12}/>Edit</button>
                <button className="ns-btn tiny" onClick={() => toggleReport(selected)}>{selected.enabled ? 'Disable' : 'Enable'}</button>
                <button className="ns-btn tiny warn" onClick={() => deleteReport(selected)}><I.Trash size={12}/>Delete</button>
              </div>
              <div className="ns-h2">History</div>
              {history.length === 0 ? <div className="ns-empty">No completed report runs yet. Future generation runners will write here.</div> : (
                <table className="ns-table"><thead><tr><th>Time</th><th>Status</th><th>Summary</th></tr></thead><tbody>{history.map(run => <tr key={run.id}><td>{fmtTime(run.created_at)}</td><td><ReportStatePill state={run.status}/></td><td>{run.summary || '—'}</td></tr>)}</tbody></table>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ns-card">
        <div className="ns-card-h">
          <h2>Scheduled report cards</h2>
          <span className="ns-card-sub">{reports.length} visible</span>
        </div>
        {reports.length === 0 ? (
          <div className="ns-empty">No reports yet. Create the first executive report above.</div>
        ) : (
          <table className="ns-table">
            <thead><tr><th>Name</th><th>Agent</th><th>Schedule</th><th>Last run</th><th>Next run</th><th>Status</th><th>Complete</th><th>Blockers</th><th></th></tr></thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id} onClick={() => loadHistory(report)} style={{cursor:'pointer'}}>
                  <td><strong>{report.name}</strong><div className="muted xsmall">{report.report_type}</div></td>
                  <td>{report.assigned_agent}</td>
                  <td>{report.schedule_human || report.schedule_text}</td>
                  <td>{fmtTime(report.last_run_at)}</td>
                  <td>{fmtTime(report.next_run_at)}</td>
                  <td><ReportStatePill state={report.status}/></td>
                  <td className="num">{report.completion_percentage || 0}%</td>
                  <td>{report.blockers?.length ? report.blockers.join('; ') : '—'}</td>
                  <td className="row-actions" onClick={e => e.stopPropagation()}>
                    <button className="ns-btn tiny" onClick={() => editReport(report)} title="Edit report"><I.Edit size={12}/></button>
                    <button className="ns-btn tiny" onClick={() => toggleReport(report)}>{report.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="ns-btn tiny warn" onClick={() => deleteReport(report)} title="Delete report"><I.Trash size={12}/></button>
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

window.ExecutiveReportsPage = ExecutiveReportsPage;
