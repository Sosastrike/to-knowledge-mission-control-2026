// ============================================================
// BuildWikiFarmerSyncPanel — read-only Brain Sync surface for
// the OpenCloud Build-Wiki / farmer sync.
//
// Live source: GET /api/bridge/brain-sync/build-wiki/status
// (Mission Control proxies claudeclaw.db.integration_connections
//  + systemctl --user timer + filesystem counts in the Obsidian
//  vault.) No execution, no secrets, no .env writes.
//
// Every control on this panel is a read-only contract until
// Owner Approval / Credential schemas are wired through Bridge.
// Buttons are disabled and show their lock state directly.
// ============================================================

const BUILD_WIKI_STATUS_URL = '/api/bridge/brain-sync/build-wiki/status';
const RUN_NOW_CREATE_URL    = '/api/bridge/brain-sync/build-wiki/run-now';
const RUN_NOW_READ_URL      = (id) => `/api/bridge/brain-sync/build-wiki/run-now/${encodeURIComponent(id)}`;
const RUN_NOW_DISPATCH_URL  = (id) => `/api/bridge/brain-sync/build-wiki/run-now/${encodeURIComponent(id)}/dispatch`;
const APPROVE_URL           = (id) => `/api/bridge/approval-requests/${encodeURIComponent(id)}/approve`;
const FILES_LIST_URL        = (type, limit) => `/api/bridge/brain-sync/build-wiki/files?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`;
const FILE_READ_URL         = (type, name) => `/api/bridge/brain-sync/build-wiki/files/${encodeURIComponent(type)}/${encodeURIComponent(name)}`;
const LOGS_URL              = (lines) => `/api/bridge/brain-sync/build-wiki/logs?lines=${encodeURIComponent(lines)}`;

const CONTROL_LABELS = {
  pause_sync:             'Pause sync',
  resume_sync:            'Resume sync',
  add_local_source:       'Add local source',
  enable_external_farmer: 'Enable external farmer',
};

// Run Now + the two file browsers + the log viewer are wired (approval-driven
// and read-only respectively). The remaining 4 controls stay locked.
const LOCKED_CONTROL_ORDER = [
  'pause_sync', 'resume_sync',
  'add_local_source', 'enable_external_farmer',
];

function buildWikiPillKind(state) {
  switch (state) {
    case 'OWNER_APPROVAL_REQUIRED':
      return { color: '#ffb547', label: 'OWNER APPROVAL' };
    case 'CREDENTIAL_REQUIRED':
      return { color: '#ff6a9e', label: 'CREDENTIAL' };
    case 'BACKEND_REQUIRED':
      return { color: '#ff7777', label: 'BACKEND' };
    case 'READ_ONLY':
      return { color: '#6bb3ff', label: 'READ ONLY' };
    default:
      return { color: '#888', label: String(state || 'LOCKED').toUpperCase() };
  }
}

function buildWikiSyncKind(state) {
  switch (state) {
    case 'active': return { tone: '#3ddc84', label: 'ACTIVE' };
    case 'paused': return { tone: '#ffb547', label: 'PAUSED' };
    case 'failed': return { tone: '#ff6a9e', label: 'FAILED' };
    default:       return { tone: '#888',    label: 'UNKNOWN' };
  }
}

function useBuildWikiStatus() {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch(BUILD_WIKI_STATUS_URL, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`);
      }
      const data = await res.json();
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({ loading: false, data: null, error: String(err && err.message || err) });
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return { ...state, refetch: fetchStatus };
}

function BWPill({ tone, children, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 999,
      background: `${tone}1A`, color: tone,
      border: `1px solid ${tone}55`,
      fontSize: 10, letterSpacing: '0.06em', fontWeight: 600,
      textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function BWStat({ label, value, sub }) {
  return (
    <div style={{
      flex: 1, padding: '8px 10px', background: 'var(--bg-2)',
      borderRadius: 8, border: '1px solid var(--line-1)',
      minWidth: 0,
    }}>
      <div className="stat-label" style={{ fontSize: 10 }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, color: 'var(--fg-0)', overflowWrap: 'anywhere' }}>{value}</div>
      {sub ? <div className="muted xsmall">{sub}</div> : null}
    </div>
  );
}

function BWLockedButton({ controlKey, state, title }) {
  const k = buildWikiPillKind(state);
  return (
    <button
      type="button"
      className="btn sm"
      disabled
      title={title || `Locked — ${state}`}
      style={{
        opacity: 0.6,
        cursor: 'not-allowed',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      <span>{CONTROL_LABELS[controlKey] || controlKey}</span>
      <BWPill tone={k.color}>{k.label}</BWPill>
    </button>
  );
}

// ============================================================
// Run Now — approval-driven control (the only wired button).
// ============================================================
function uiStateLabel(s) {
  switch (s) {
    case 'idle':              return { tone: '#6bb3ff', label: 'IDLE' };
    case 'pending_approval':  return { tone: '#ffb547', label: 'APPROVAL PENDING' };
    case 'approved':          return { tone: '#3ec9ff', label: 'APPROVED' };
    case 'dispatching':       return { tone: '#a16bff', label: 'DISPATCHING' };
    case 'completed':         return { tone: '#3ddc84', label: 'COMPLETED' };
    case 'failed':            return { tone: '#ff6a9e', label: 'FAILED' };
    case 'denied':            return { tone: '#ff6a9e', label: 'DENIED' };
    case 'expired':           return { tone: '#888',    label: 'EXPIRED' };
    default:                  return { tone: '#888',    label: String(s || 'UNKNOWN').toUpperCase() };
  }
}

function BWRunNowControl({ runNow, onAction }) {
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState(null);
  const state = (runNow && runNow.ui_state) || 'idle';
  const approvalId = runNow && runNow.approval && runNow.approval.id;
  const k = uiStateLabel(state);

  const wrap = async (fn) => {
    setBusy(true); setErrorMsg(null);
    try {
      await fn();
      if (typeof onAction === 'function') onAction();
    } catch (err) {
      setErrorMsg(String(err && err.message || err).slice(0, 240));
    } finally {
      setBusy(false);
    }
  };

  const requestRun = () => wrap(async () => {
    const res = await fetch(RUN_NOW_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  });

  const dispatchNow = () => wrap(async () => {
    if (!approvalId) throw new Error('no_approval_id');
    const res = await fetch(RUN_NOW_DISPATCH_URL(approvalId), {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = j.systemctl_exit_code !== undefined
        ? ` (exit ${j.systemctl_exit_code})`
        : '';
      throw new Error((j.error || `HTTP ${res.status}`) + detail);
    }
  });

  // Owner self-approval is exposed as a separate button so the operator can
  // also walk through the contract without leaving the panel. The approve
  // route still enforces operator role server-side.
  const approveSelf = () => wrap(async () => {
    if (!approvalId) throw new Error('no_approval_id');
    const res = await fetch(APPROVE_URL(approvalId), {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  });

  // Pick which action button (if any) is exposed for the current state.
  let actionBtn = null;
  if (state === 'idle' || state === 'completed' || state === 'denied' || state === 'expired' || state === 'failed') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={requestRun} title="Create an approval request to run opencloud-docs-farmer.service once.">
        {busy ? 'Submitting…' : (state === 'completed' || state === 'failed' ? 'Request another run' : 'Request run')}
      </button>
    );
  } else if (state === 'pending_approval') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={approveSelf} title="Owner / operator approval. Server still enforces role + audit.">
        {busy ? 'Approving…' : 'Approve (owner)'}
      </button>
    );
  } else if (state === 'approved') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={dispatchNow} title="Dispatch the approved request → systemctl --user start opencloud-docs-farmer.service.">
        {busy ? 'Dispatching…' : 'Dispatch'}
      </button>
    );
  } else if (state === 'dispatching') {
    actionBtn = (
      <button className="btn sm" disabled title="Service is running — wait for completion."> Dispatching… </button>
    );
  }

  const approval = (runNow && runNow.approval) || null;
  const run = (runNow && runNow.run) || null;

  return (
    <div className="vstack" style={{
      gap: 6, padding: '10px 12px',
      background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line-1)',
    }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>Run now</span>
        <BWPill tone={k.tone}>{k.label}</BWPill>
        {approval ? <span className="mono xsmall muted">{approval.id}</span> : null}
        <span className="spacer"/>
        {actionBtn}
      </div>

      {approval ? (
        <div className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>
          requested {approval.created_at}
          {approval.resolved_at ? <> · {approval.approval_state} {approval.resolved_at} by {approval.resolved_by || '—'}</> : null}
          {run && run.started_at ? <> · started {run.started_at}</> : null}
          {run && run.finished_at ? <> · finished {run.finished_at}</> : null}
          {run ? <> · run {run.id}</> : null}
        </div>
      ) : (
        <div className="muted xsmall">
          Click <strong>Request run</strong> to create an owner-approval request for{' '}
          <code style={{ fontSize: 11 }}>{(runNow && runNow.target_service) || 'opencloud-docs-farmer.service'}</code>.
          The service is not started until you separately approve and then dispatch.
        </div>
      )}

      {errorMsg ? (
        <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {errorMsg}</div>
      ) : null}
    </div>
  );
}

// ============================================================
// File browsers — read-only listing + in-place viewer.
// ============================================================
function formatBytes(n) {
  if (typeof n !== 'number' || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelative(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function BWFileViewer({ type, name, onClose }) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FILE_READ_URL(type, name), {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ loading: false, data: null, error: j.error || `HTTP ${res.status}` });
          return;
        }
        setState({ loading: false, data: j.file || null, error: null });
      } catch (err) {
        if (!cancelled) setState({ loading: false, data: null, error: String(err && err.message || err) });
      }
    })();
    return () => { cancelled = true; };
  }, [type, name]);

  const file = state.data;

  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '10px 12px',
      background: 'var(--bg-1)',
      borderRadius: 8,
      border: '1px solid var(--accent-line)',
      marginTop: 4,
    }}>
      <div className="hstack" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <BWPill tone={type === 'raw' ? '#3ddc84' : '#3ec9ff'}>{type.toUpperCase()}</BWPill>
        <span style={{ color: 'var(--fg-0)', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
        {file ? <span className="muted xsmall mono">{formatBytes(file.size_bytes)} · {formatRelative(file.modified_at)}</span> : null}
        <span className="spacer"/>
        <button className="btn sm" onClick={onClose}>Close</button>
      </div>

      {state.loading ? <div className="muted xsmall">Loading…</div> : null}

      {state.error ? (
        <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {state.error}</div>
      ) : null}

      {file && file.secrets_present ? (
        <div className="mono xsmall" style={{
          color: '#ffb3c8', padding: '8px 10px',
          background: 'oklch(0.3 0.1 20 / 0.25)',
          border: '1px solid #ff6a9e55', borderRadius: 6,
        }}>
          ⚠ content_redacted_due_to_secret_pattern_match · matched: {file.secrets_redactions.join(', ')}
        </div>
      ) : null}

      {file && file.content !== null && !file.secrets_present ? (
        <pre style={{
          maxHeight: 360, overflow: 'auto',
          background: 'var(--bg-2)', padding: 10, borderRadius: 6,
          border: '1px solid var(--line-1)',
          fontSize: 11, lineHeight: 1.45,
          color: 'var(--fg-1)',
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          margin: 0,
        }}>{file.content}</pre>
      ) : null}

      {file && file.content_truncated ? (
        <div className="muted xsmall" style={{ marginTop: 6 }}>
          ⚠ content truncated to 200 KB · full size {formatBytes(file.size_bytes)}
        </div>
      ) : null}

      {file ? (
        <div className="muted xsmall mono" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
          {file.relative_path}
          {file.source ? <> · source: {file.source}</> : null}
          {file.imported_at ? <> · imported {file.imported_at}</> : null}
        </div>
      ) : null}
    </div>
  );
}

function BWFileBrowser({ type, label, accentTone }) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState({ loading: false, items: [], error: null, generated_at: null });
  const [viewing, setViewing] = React.useState(null);

  const fetchList = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(FILES_LIST_URL(type, 25), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const block = type === 'raw' ? j.raw : j.wiki;
      setState({
        loading: false,
        items: (block && block.items) || [],
        error: null,
        generated_at: j.generated_at || null,
      });
    } catch (err) {
      setState({ loading: false, items: [], error: String(err && err.message || err), generated_at: null });
    }
  }, [type]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && state.items.length === 0 && !state.loading) fetchList();
      return next;
    });
  };

  return (
    <div className="vstack" style={{
      gap: 6, padding: '10px 12px',
      background: 'var(--bg-2)', borderRadius: 8,
      border: '1px solid var(--line-1)',
    }}>
      <div className="hstack" style={{ gap: 8 }}>
        <BWPill tone={accentTone}>{type === 'raw' ? 'RAW · IMMUTABLE' : 'WIKI'}</BWPill>
        <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{label}</span>
        {state.items.length > 0 ? <span className="mono xsmall muted">{state.items.length} latest</span> : null}
        <span className="spacer"/>
        {open ? (
          <button className="btn sm" onClick={fetchList} disabled={state.loading} title="Refetch list">
            {state.loading ? '…' : <I.Refresh size={11}/>}
          </button>
        ) : null}
        <button className="btn sm" onClick={toggleOpen}>
          {open ? 'Hide' : 'View latest'}
        </button>
      </div>

      {open ? (
        <div className="vstack" style={{ gap: 4 }}>
          {state.loading && state.items.length === 0 ? (
            <div className="muted xsmall">Loading latest {type} files…</div>
          ) : null}
          {state.error ? (
            <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {state.error}</div>
          ) : null}
          {state.items.length === 0 && !state.loading && !state.error ? (
            <div className="muted xsmall">No {type} files found.</div>
          ) : null}

          {state.items.map((f) => {
            const open = viewing && viewing === f.name;
            return (
              <React.Fragment key={f.name}>
                <div
                  className="hstack"
                  style={{
                    padding: '5px 8px', background: 'var(--bg-1)',
                    borderRadius: 6, border: '1px solid var(--line-1)',
                    fontSize: 12, gap: 8, alignItems: 'center', cursor: 'pointer',
                  }}
                  title="Click to view content"
                  onClick={() => setViewing(open ? null : f.name)}
                >
                  <BWPill tone={accentTone}>{type.toUpperCase()}</BWPill>
                  <span className="mono xsmall" style={{ color: 'var(--fg-0)', overflowWrap: 'anywhere', minWidth: 0, flex: 1 }}>
                    {f.title || f.name}
                  </span>
                  <span className="muted xsmall mono">{formatBytes(f.size_bytes)}</span>
                  <span className="muted xsmall mono">{formatRelative(f.modified_at)}</span>
                  <span className="muted xsmall">{open ? '▼' : '▸'}</span>
                </div>
                {open ? (
                  <BWFileViewer type={type} name={f.name} onClose={() => setViewing(null)} />
                ) : null}
              </React.Fragment>
            );
          })}

          {state.generated_at ? (
            <div className="muted xsmall mono" style={{ paddingTop: 4 }}>
              listed at {state.generated_at}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Log viewer — read-only farmer log tail + parsed stats.
// ============================================================
function BWLogViewer({ defaultLines = 200 }) {
  const [open, setOpen] = React.useState(false);
  const [linesCount, setLinesCount] = React.useState(defaultLines);
  const [state, setState] = React.useState({ loading: false, data: null, error: null });

  const fetchTail = React.useCallback(async (n) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(LOGS_URL(n), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setState({ loading: false, data: j, error: null });
    } catch (err) {
      setState({ loading: false, data: null, error: String(err && err.message || err) });
    }
  }, []);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && state.data === null && !state.loading) fetchTail(linesCount);
      return next;
    });
  };

  const changeLines = (n) => {
    setLinesCount(n);
    if (open) fetchTail(n);
  };

  const data = state.data;
  const stats = data && data.stats;
  const lastErrorLine = stats && stats.last_error;

  return (
    <div className="vstack" style={{
      gap: 6, padding: '10px 12px',
      background: 'var(--bg-2)', borderRadius: 8,
      border: '1px solid var(--line-1)',
    }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <BWPill tone="#ffb547">LOG · READ ONLY</BWPill>
        <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>Farmer log</span>
        {data ? <span className="mono xsmall muted">{data.lines_returned} lines · {Math.round(data.size_bytes / 1024)} KB total</span> : null}
        <span className="spacer"/>
        {open ? (
          <>
            {[100, 200, 500].map((n) => (
              <button
                key={n}
                className="btn sm"
                disabled={state.loading || n === linesCount}
                onClick={() => changeLines(n)}
                title={`Tail last ${n} lines`}
                style={n === linesCount ? { opacity: 0.7 } : undefined}
              >
                {n}
              </button>
            ))}
            <button className="btn sm" onClick={() => fetchTail(linesCount)} disabled={state.loading} title="Refetch">
              {state.loading ? '…' : <I.Refresh size={11}/>}
            </button>
          </>
        ) : null}
        <button className="btn sm" onClick={toggleOpen}>
          {open ? 'Hide' : 'View logs'}
        </button>
      </div>

      {open ? (
        <div className="vstack" style={{ gap: 6 }}>
          {state.loading && !data ? (
            <div className="muted xsmall">Loading farmer log tail…</div>
          ) : null}
          {state.error ? (
            <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {state.error}</div>
          ) : null}

          {stats ? (
            <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
              <BWStat label="Last run" value={stats.last_run_complete ? stats.last_run_complete.at : '—'}
                      sub={stats.last_run_complete ? `imported ${stats.last_run_complete.imported} of cap ${stats.last_run_complete.cap}` : '—'} />
              <BWStat label="Imported (in window)" value={String(stats.imported_in_window)}
                      sub={stats.last_imported_at ? `last ${stats.last_imported_at}` : '—'} />
              <BWStat label="Skipped (dup-sha)" value={String(stats.skipped_duplicates_in_window)} sub="already-imported deduplication" />
              <BWStat label="Redacted lines" value={String(stats.redacted_lines)} sub={stats.redacted_lines > 0 ? 'secret patterns matched' : 'clean'} />
            </div>
          ) : null}

          {lastErrorLine && lastErrorLine.line ? (
            <div style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'oklch(0.3 0.1 20 / 0.25)',
              border: '1px solid #ff6a9e55',
              fontSize: 11, color: '#ffb3c8',
              fontFamily: 'var(--mono)', overflowWrap: 'anywhere',
            }}>
              <strong>Last error / warning</strong>{lastErrorLine.at ? ` · ${lastErrorLine.at}` : ''}: {lastErrorLine.line}
            </div>
          ) : null}

          {data && Array.isArray(data.lines) ? (
            <pre style={{
              maxHeight: 380, overflow: 'auto',
              background: 'var(--bg-1)', padding: 10, borderRadius: 6,
              border: '1px solid var(--line-1)',
              fontSize: 10.5, lineHeight: 1.5,
              color: 'var(--fg-1)',
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              margin: 0,
            }}>{data.lines.join('\n')}</pre>
          ) : null}

          {data ? (
            <div className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>
              {data.log_path}
              {data.truncated_from_start ? ' · truncated_from_start (256 KB tail window)' : ''}
              {data.modified_at ? ` · last modified ${data.modified_at}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BuildWikiFarmerSyncPanel() {
  const { loading, data, error, refetch } = useBuildWikiStatus();

  if (loading) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <div className="card-title">
            <span style={{ color: 'var(--accent)' }}>📚</span>
            Build-Wiki · Farmer Sync
            <span className="card-subtitle">opencloud-docs-farmer · Obsidian</span>
          </div>
        </div>
        <div className="card-body">
          <div className="muted xsmall">Loading live status from /api/bridge/brain-sync/build-wiki/status…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <div className="card-title">
            <span style={{ color: 'var(--accent)' }}>📚</span>
            Build-Wiki · Farmer Sync
          </div>
          <div className="hstack">
            <BWPill tone="#ff7777">BACKEND</BWPill>
            <button className="btn sm" onClick={refetch} title="Retry"><I.Refresh size={11}/> Retry</button>
          </div>
        </div>
        <div className="card-body">
          <div className="muted xsmall">
            Live status endpoint not reachable yet — UI is ready, backend route at <code>{BUILD_WIKI_STATUS_URL}</code> requires a Mission Control rebuild + restart to take effect.
          </div>
          {error ? <pre style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>{error}</pre> : null}
        </div>
      </div>
    );
  }

  const sync = data.sync || {};
  const farmer = data.active_farmer || {};
  const dest = data.destination || {};
  const controls = data.controls || {};
  const drafts = Array.isArray(data.draft_external_farmers) ? data.draft_external_farmers : [];
  const activeSources = Array.isArray(data.active_sources) ? data.active_sources : [];
  const availableExpansions = Array.isArray(data.available_source_expansions) ? data.available_source_expansions : [];
  const assignedAgents = Array.isArray(data.assigned_agents) ? data.assigned_agents : [];

  const syncBadge = buildWikiSyncKind(sync.state);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-head">
        <div className="card-title">
          <span style={{ color: 'var(--accent)' }}>📚</span>
          Build-Wiki · Farmer Sync
          <span className="card-subtitle">opencloud-docs-farmer · Obsidian · stage A</span>
        </div>
        <div className="hstack" style={{ gap: 6 }}>
          <BWPill tone={syncBadge.tone} title={`Live state: ${sync.state || 'unknown'}`}>
            {syncBadge.label}
          </BWPill>
          {sync.tool_state ? <BWPill tone="#6bb3ff" title="Registry tool_state">{String(sync.tool_state).replace(/_/g, ' ')}</BWPill> : null}
          {sync.auto_sync_enabled ? <BWPill tone="#3ddc84">AUTO-SYNC</BWPill> : <BWPill tone="#888">AUTO-SYNC OFF</BWPill>}
          <button className="btn sm" onClick={refetch} title="Refetch live status"><I.Refresh size={11}/> Refresh</button>
        </div>
      </div>

      <div className="card-body vstack" style={{ gap: 12 }}>

        {/* 1 — Sync status row */}
        <div className="hstack" style={{ gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <BWStat label="Farmer" value={farmer.name || '—'} sub={farmer.cadence || '—'} />
          <BWStat label="Next run" value={farmer.next_run_at || '—'} sub={farmer.timer_active ? 'timer active' : 'timer inactive'} />
          <BWStat label="Last run" value={farmer.last_run_at || '—'} sub={`result: ${farmer.last_result || 'unknown'}`} />
          <BWStat label="Service state" value={`${farmer.service_active_state || '—'} · ${farmer.service_sub_state || '—'}`} sub={`exit ${farmer.last_exit_status === null || farmer.last_exit_status === undefined ? '—' : farmer.last_exit_status}`} />
        </div>

        {farmer.last_error ? (
          <div style={{
            padding: '8px 10px', borderRadius: 8,
            background: 'oklch(0.3 0.1 20 / 0.25)',
            border: '1px solid #ff6a9e55', color: '#ffb3c8',
            fontSize: 12,
          }}>
            <strong>Last error / warning:</strong> <span style={{ fontFamily: 'var(--mono)' }}>{farmer.last_error}</span>
          </div>
        ) : null}

        {/* 2 — Obsidian destination */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Obsidian destination</div>
          <div className="mono xsmall" style={{ color: 'var(--fg-1)', overflowWrap: 'anywhere' }}>{dest.obsidian_path || '—'}</div>
          <div className="hstack" style={{ gap: 8 }}>
            <BWStat label="Raw files" value={String(dest.raw_count ?? '—')} />
            <BWStat label="Wiki pages" value={String(dest.wiki_count ?? '—')} />
            <BWStat label="Archived versions" value={String(dest.archive_count ?? '—')} />
          </div>
        </div>

        {/* 3 — Active local sources */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="hstack">
            <div className="stat-label">Active local sources</div>
            <span className="spacer"/>
            <span className="mono xsmall muted">{activeSources.length} wired</span>
          </div>
          <div className="vstack" style={{ gap: 4 }}>
            {activeSources.length === 0 ? (
              <div className="muted xsmall">No sources wired.</div>
            ) : activeSources.map((src) => (
              <div key={src} className="hstack" style={{
                padding: '5px 8px', background: 'var(--bg-2)',
                borderRadius: 6, border: '1px solid var(--line-1)',
                fontSize: 12,
              }}>
                <BWPill tone="#3ddc84">LOCAL</BWPill>
                <span className="mono xsmall" style={{ overflowWrap: 'anywhere', color: 'var(--fg-1)' }}>{src}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4 — Available local source expansions */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="hstack">
            <div className="stat-label">Available source expansions</div>
            <span className="spacer"/>
            <span className="mono xsmall muted">{availableExpansions.length} pending</span>
          </div>
          {availableExpansions.length === 0 ? (
            <div className="muted xsmall">All known local sources are already wired into the active farmer.</div>
          ) : (
            <div className="vstack" style={{ gap: 4 }}>
              {availableExpansions.map((src) => (
                <div key={src} className="hstack" style={{
                  padding: '5px 8px', background: 'var(--bg-2)',
                  borderRadius: 6, border: '1px dashed var(--line-2)',
                  fontSize: 12,
                }}>
                  <BWPill tone="#ffb547">PROPOSE</BWPill>
                  <span className="mono xsmall" style={{ overflowWrap: 'anywhere', color: 'var(--fg-2)' }}>{src}</span>
                  <span className="spacer"/>
                  <BWLockedButton controlKey="add_local_source" state={controls.add_local_source || 'OWNER_APPROVAL_REQUIRED'} title="Adding a source requires owner approval through the Brain-Sync rebuild contract."/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5 — External farmer drafts */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="hstack">
            <div className="stat-label">External farmer drafts</div>
            <span className="spacer"/>
            <span className="mono xsmall muted">{drafts.length} disabled</span>
          </div>
          <div className="vstack" style={{ gap: 4 }}>
            {drafts.length === 0 ? (
              <div className="muted xsmall">No external farmer drafts registered.</div>
            ) : drafts.map((d) => (
              <div key={d.name} className="hstack" style={{
                padding: '6px 10px', background: 'var(--bg-2)',
                borderRadius: 6, border: '1px solid var(--line-1)',
                fontSize: 12, alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
              }}>
                <div className="vstack" style={{ gap: 2, minWidth: 200, flex: 1 }}>
                  <div className="hstack" style={{ gap: 6 }}>
                    <BWPill tone="#ffb547">{(d.state || 'DRAFT').replace(/_/g, ' ')}</BWPill>
                    <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{d.name}</span>
                  </div>
                  {d.source ? <div className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>{d.source}</div> : null}
                  {Array.isArray(d.blockers) && d.blockers.length ? (
                    <div className="muted xsmall">blockers: {d.blockers.map((b) => <code key={b} style={{ marginRight: 6, fontSize: 10 }}>{b}</code>)}</div>
                  ) : null}
                </div>
                <BWLockedButton controlKey="enable_external_farmer" state={controls.enable_external_farmer || 'CREDENTIAL_REQUIRED'} title="Each external farmer requires its credentials + owner approval before enable."/>
              </div>
            ))}
          </div>
        </div>

        {/* 6 — Run Now (wired, approval-driven) */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Run now</div>
          <BWRunNowControl runNow={data.run_now} onAction={refetch}/>
        </div>

        {/* 7 — File visibility (read-only) */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">File visibility (read-only)</div>
          <BWFileBrowser type="raw"  label="Latest raw files (immutable)" accentTone="#3ddc84" />
          <BWFileBrowser type="wiki" label="Latest wiki pages"             accentTone="#3ec9ff" />
        </div>

        {/* 8 — Log visibility (read-only) */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Log visibility (read-only)</div>
          <BWLogViewer defaultLines={200} />
        </div>

        {/* 9 — Remaining controls (still locked) */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Other controls (locked)</div>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {LOCKED_CONTROL_ORDER.map((key) => (
              <BWLockedButton
                key={key}
                controlKey={key}
                state={controls[key] || 'OWNER_APPROVAL_REQUIRED'}
                title={`Control "${CONTROL_LABELS[key]}" is currently locked: ${controls[key] || 'OWNER_APPROVAL_REQUIRED'}. No execution is wired from the UI.`}
              />
            ))}
          </div>
        </div>

        {/* Footer — assigned agents + provenance */}
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line-1)', paddingTop: 8 }}>
          <div className="muted xsmall">
            <strong style={{ color: 'var(--fg-1)' }}>Assigned agents:</strong>{' '}
            {assignedAgents.length ? assignedAgents.join(', ') : '—'}
          </div>
          <span className="spacer"/>
          <div className="muted xsmall mono" title={`Source DB: ${data.source_db || 'claudeclaw'} · Generated ${data.generated_at}`}>
            live · {data.canonical_route || BUILD_WIKI_STATUS_URL}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BuildWikiFarmerSyncPanel });
