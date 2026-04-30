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
const TIMER_CTRL_CREATE_URL = '/api/bridge/brain-sync/build-wiki/timer-control';
const TIMER_CTRL_DISPATCH_URL = (id) => `/api/bridge/brain-sync/build-wiki/timer-control/${encodeURIComponent(id)}/dispatch`;
const ADD_SRC_CREATE_URL    = '/api/bridge/brain-sync/build-wiki/add-source';
const ADD_SRC_DISPATCH_URL  = (id) => `/api/bridge/brain-sync/build-wiki/add-source/${encodeURIComponent(id)}/dispatch`;
const ADD_SRC_READ_URL      = (id) => `/api/bridge/brain-sync/build-wiki/add-source/${encodeURIComponent(id)}`;

// Display labels for the still-locked Action buttons. Run Now /
// Pause/Resume / file browsers / log viewer have their own components.
const CONTROL_LABELS = {
  add_local_source:       'Add local source',
  enable_external_farmer: 'Enable external farmer',
};

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

// ============================================================
// Section header — visual divider between Status / Actions / Inspect.
// ============================================================
function BWSectionHeader({ index, title, subtitle, tone }) {
  return (
    <div className="hstack" style={{
      gap: 10,
      paddingTop: 4,
      paddingBottom: 4,
      borderBottom: `1px solid ${tone || 'var(--line-2)'}33`,
      alignItems: 'baseline',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 999,
        background: `${tone || '#888'}1A`, color: tone || 'var(--fg-1)',
        border: `1px solid ${tone || 'var(--line-2)'}55`,
        fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
      }}>{index}</span>
      <span style={{
        color: 'var(--fg-0)', fontSize: 14, fontWeight: 600,
        letterSpacing: '0.02em', textTransform: 'uppercase',
      }}>{title}</span>
      {subtitle ? (
        <span className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>· {subtitle}</span>
      ) : null}
    </div>
  );
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

// ============================================================
// Timer control — Pause / Resume sync, approval-driven.
// Same uiStateLabel + BWPill helpers reused from the Run Now panel.
// ============================================================
function BWTimerControl({ timerControl, onAction }) {
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState(null);

  const tc = timerControl || {};
  const offered = tc.offered_action;          // 'pause' | 'resume' | null
  const timerActive = !!tc.timer_active;
  const state = tc.ui_state || 'idle';
  const approvalId = tc.approval && tc.approval.id;
  const approval = tc.approval;
  const run = tc.run;
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

  const requestAction = (actionId) => wrap(async () => {
    const res = await fetch(TIMER_CTRL_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ action: actionId }),
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  });

  const dispatchNow = () => wrap(async () => {
    if (!approvalId) throw new Error('no_approval_id');
    const res = await fetch(TIMER_CTRL_DISPATCH_URL(approvalId), {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  });

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

  // Action button selection — depends on UI state.
  let actionBtn = null;
  if (state === 'idle' || state === 'completed' || state === 'denied' || state === 'expired' || state === 'failed') {
    if (offered === 'pause') {
      actionBtn = (
        <button className="btn sm" disabled={busy} onClick={() => requestAction('pause')} title="Request approval to stop the farmer timer (calendar). Service unaffected.">
          {busy ? 'Submitting…' : 'Request pause'}
        </button>
      );
    } else if (offered === 'resume') {
      actionBtn = (
        <button className="btn sm" disabled={busy} onClick={() => requestAction('resume')} title="Request approval to start the farmer timer (re-arms calendar).">
          {busy ? 'Submitting…' : 'Request resume'}
        </button>
      );
    } else {
      actionBtn = <span className="muted xsmall">timer state unknown</span>;
    }
  } else if (state === 'pending_approval') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={approveSelf} title="Owner / operator approval. Server enforces role + audit.">
        {busy ? 'Approving…' : 'Approve (owner)'}
      </button>
    );
  } else if (state === 'approved') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={dispatchNow} title="Dispatch the approved request → systemctl on the timer unit.">
        {busy ? 'Dispatching…' : 'Dispatch'}
      </button>
    );
  } else if (state === 'dispatching') {
    actionBtn = <button className="btn sm" disabled title="Applying — wait for completion.">Dispatching…</button>;
  }

  const actionLabel = approval && approval.action === 'buildwiki.pause_sync'
    ? 'Pause sync'
    : approval && approval.action === 'buildwiki.resume_sync'
    ? 'Resume sync'
    : 'Pause / Resume sync';

  return (
    <div className="vstack" style={{
      gap: 6, padding: '10px 12px',
      background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line-1)',
    }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <BWPill tone={timerActive ? '#3ddc84' : '#ffb547'}>
          TIMER {timerActive ? 'ACTIVE' : 'INACTIVE'}
        </BWPill>
        <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{actionLabel}</span>
        {approval ? <BWPill tone={k.tone}>{k.label}</BWPill> : null}
        {approval ? <span className="mono xsmall muted">{approval.id}</span> : null}
        <span className="spacer"/>
        {actionBtn}
      </div>

      {approval ? (
        <div className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>
          {approval.action} · requested {approval.created_at}
          {approval.resolved_at ? <> · {approval.approval_state} {approval.resolved_at} by {approval.resolved_by || '—'}</> : null}
          {run && run.started_at ? <> · started {run.started_at}</> : null}
          {run && run.finished_at ? <> · finished {run.finished_at}</> : null}
        </div>
      ) : (
        <div className="muted xsmall">
          Timer is currently <strong>{timerActive ? 'ACTIVE' : 'INACTIVE'}</strong>.
          Request <strong>{offered === 'pause' ? 'Pause' : offered === 'resume' ? 'Resume' : 'an action'}</strong> to change it (approval required).
          Affects <code style={{ fontSize: 11 }}>opencloud-docs-farmer.timer</code> only — the service unit and the manual Run Now path are unaffected.
        </div>
      )}

      {errorMsg ? <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {errorMsg}</div> : null}
    </div>
  );
}

// ============================================================
// Add Local Source — approval-driven script edit.
// ============================================================
function BWAddSourceControl({ addSource, availableExpansions, onAction }) {
  const [pathInput, setPathInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState(null);
  const [stagedDiff, setStagedDiff] = React.useState(null);

  const tc = addSource || {};
  const state = tc.ui_state || 'idle';
  const approval = tc.approval;
  const run = tc.run;
  const approvalId = approval && approval.id;
  const k = uiStateLabel(state);

  const wrap = async (fn) => {
    setBusy(true); setErrorMsg(null);
    try {
      await fn();
      if (typeof onAction === 'function') onAction();
    } catch (err) {
      setErrorMsg(String(err && err.message || err).slice(0, 360));
    } finally {
      setBusy(false);
    }
  };

  const submitPath = (value) => wrap(async () => {
    const proposed = String(value || pathInput || '').trim();
    if (!proposed) throw new Error('path is required');
    const res = await fetch(ADD_SRC_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ path: proposed }),
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = j.reason || j.error || `HTTP ${res.status}`;
      throw new Error(reason);
    }
    if (j.diff_preview) setStagedDiff(j.diff_preview);
    setPathInput('');
  });

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

  const dispatchNow = () => wrap(async () => {
    if (!approvalId) throw new Error('no_approval_id');
    const res = await fetch(ADD_SRC_DISPATCH_URL(approvalId), {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.reason_code || j.error || `HTTP ${res.status}`);
  });

  // For an active approval, fetch the diff/preview from the per-id endpoint
  // when the panel mounts so we can show what was approved.
  React.useEffect(() => {
    if (!approvalId || stagedDiff) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ADD_SRC_READ_URL(approvalId), {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && j.ok && j.diff_preview) setStagedDiff(j.diff_preview);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [approvalId, stagedDiff]);

  let actionBtn = null;
  if (state === 'idle' || state === 'completed' || state === 'denied' || state === 'expired' || state === 'failed') {
    actionBtn = (
      <button
        className="btn sm"
        disabled={busy || !pathInput.trim()}
        onClick={() => submitPath()}
        title="Validate the path and create an approval request. No script writes happen yet."
      >
        {busy ? 'Validating…' : 'Validate & request'}
      </button>
    );
  } else if (state === 'pending_approval') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={approveSelf} title="Owner / operator approval. Server enforces role + audit.">
        {busy ? 'Approving…' : 'Approve (owner)'}
      </button>
    );
  } else if (state === 'approved') {
    actionBtn = (
      <button className="btn sm" disabled={busy} onClick={dispatchNow} title="Dispatch the approved request → atomic write to opencloud-docs-farmer.sh with rollback backup.">
        {busy ? 'Applying…' : 'Apply (write script)'}
      </button>
    );
  } else if (state === 'dispatching') {
    actionBtn = <button className="btn sm" disabled title="Writing script — wait for completion.">Applying…</button>;
  }

  return (
    <div className="vstack" style={{
      gap: 6, padding: '10px 12px',
      background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line-1)',
    }}>
      {!approval ? (
        <>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="/home/tony/some/docs/"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPath(); }}
              style={{
                flex: 1, minWidth: 240,
                padding: '6px 10px',
                background: 'var(--bg-1)', color: 'var(--fg-0)',
                border: '1px solid var(--line-1)', borderRadius: 6,
                fontSize: 12, fontFamily: 'var(--mono)',
              }}
            />
            {actionBtn}
          </div>
          <div className="muted xsmall">
            Local paths only · must be under <code style={{ fontSize: 11 }}>/home/tony/</code> · must be a readable directory · denylisted paths (.env, .ssh, secret-like, db dirs, vault internals, backup dirs) are rejected up front.
          </div>
          {Array.isArray(availableExpansions) && availableExpansions.length > 0 ? (
            <div className="hstack" style={{ gap: 4, flexWrap: 'wrap' }}>
              <span className="muted xsmall">quick-fill:</span>
              {availableExpansions.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="btn sm"
                  style={{ fontSize: 10, padding: '2px 6px', opacity: 0.85 }}
                  onClick={() => setPathInput(p)}
                  title={`Use this candidate path: ${p}`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
          <BWPill tone={k.tone}>{k.label}</BWPill>
          <span className="mono xsmall" style={{ color: 'var(--fg-0)', overflowWrap: 'anywhere', flex: 1, minWidth: 200 }}>
            {approval.target_key || '—'}
          </span>
          <span className="mono xsmall muted">{approval.id}</span>
          <span className="spacer"/>
          {actionBtn}
        </div>
      )}

      {approval ? (
        <div className="muted xsmall mono" style={{ overflowWrap: 'anywhere' }}>
          requested {approval.created_at}
          {approval.resolved_at ? <> · {approval.approval_state} {approval.resolved_at} by {approval.resolved_by || '—'}</> : null}
          {run && run.started_at ? <> · started {run.started_at}</> : null}
          {run && run.finished_at ? <> · finished {run.finished_at}</> : null}
        </div>
      ) : null}

      {stagedDiff ? (
        <pre style={{
          maxHeight: 220, overflow: 'auto',
          background: 'var(--bg-1)', padding: 8, borderRadius: 6,
          border: '1px solid var(--line-1)',
          fontSize: 10.5, lineHeight: 1.45,
          color: 'var(--fg-1)',
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          margin: 0,
        }}>{stagedDiff}</pre>
      ) : null}

      {errorMsg ? <div className="mono xsmall" style={{ color: '#ffb3c8' }}>error: {errorMsg}</div> : null}
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

      <div className="card-body vstack" style={{ gap: 14 }}>

        {/* ============================================================
            1) STATUS — schedule, counts, sources, drafts (read-only).
            ============================================================ */}
        <BWSectionHeader index={1} title="Status" subtitle="schedule · counts · sources · drafts" tone="#6bb3ff"/>

        {/* Schedule + service KPI strip */}
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

        {/* Obsidian destination + counts */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Obsidian destination</div>
          <div className="mono xsmall" style={{ color: 'var(--fg-1)', overflowWrap: 'anywhere' }}>{dest.obsidian_path || '—'}</div>
          <div className="hstack" style={{ gap: 8 }}>
            <BWStat label="Raw count" value={String(dest.raw_count ?? '—')} />
            <BWStat label="Wiki count" value={String(dest.wiki_count ?? '—')} />
            <BWStat label="Archive count" value={String(dest.archive_count ?? '—')} />
          </div>
        </div>

        {/* Active sources */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="hstack">
            <div className="stat-label">Active sources</div>
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
          {availableExpansions.length > 0 ? (
            <>
              <div className="muted xsmall" style={{ marginTop: 4 }}>{availableExpansions.length} known expansion(s) not yet wired:</div>
              <div className="vstack" style={{ gap: 4 }}>
                {availableExpansions.map((src) => (
                  <div key={src} className="hstack" style={{
                    padding: '5px 8px', background: 'var(--bg-2)',
                    borderRadius: 6, border: '1px dashed var(--line-2)',
                    fontSize: 12,
                  }}>
                    <BWPill tone="#ffb547">PROPOSE</BWPill>
                    <span className="mono xsmall" style={{ overflowWrap: 'anywhere', color: 'var(--fg-2)' }}>{src}</span>
                  </div>
                ))}
              </div>
              <div className="muted xsmall">Use the <strong>Add Local Source</strong> action below to propose adding one (owner approval required).</div>
            </>
          ) : null}
        </div>

        {/* Draft farmers */}
        <div className="vstack" style={{ gap: 6 }}>
          <div className="hstack">
            <div className="stat-label">Draft farmers</div>
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
              </div>
            ))}
          </div>
          {drafts.length > 0 ? (
            <div className="muted xsmall">Use the <strong>Enable External Farmer</strong> action below — each draft needs its credentials + owner approval first.</div>
          ) : null}
        </div>

        {/* ============================================================
            2) ACTIONS — wired (approval-driven) + still-locked controls.
            ============================================================ */}
        <BWSectionHeader index={2} title="Actions" subtitle="approval-driven · scope-pinned" tone="#a16bff"/>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Run Now</div>
          <BWRunNowControl runNow={data.run_now} onAction={refetch}/>
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Pause / Resume Sync</div>
          <BWTimerControl timerControl={data.timer_control} onAction={refetch}/>
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Add Local Source</div>
          <BWAddSourceControl
            addSource={data.add_source}
            availableExpansions={availableExpansions}
            onAction={refetch}
          />
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Enable External Farmer</div>
          <div className="hstack" style={{
            padding: '10px 12px', background: 'var(--bg-2)',
            borderRadius: 8, border: '1px solid var(--line-1)',
            gap: 8, flexWrap: 'wrap',
          }}>
            <span className="muted xsmall" style={{ flex: 1, minWidth: 220 }}>
              Promote a draft farmer (SMB / Gmail / Slack / YouTube / Web) out of <code style={{ fontSize: 11 }}>farmers/_drafts/</code>.
              {drafts.length > 0 ? ` ${drafts.length} draft(s) listed above with their blockers.` : ''}
            </span>
            <BWLockedButton
              controlKey="enable_external_farmer"
              state={controls.enable_external_farmer || 'CREDENTIAL_REQUIRED'}
              title="Each external farmer needs its credentials AND owner approval. The button is locked until both are supplied."
            />
          </div>
        </div>

        {/* ============================================================
            3) INSPECT — read-only viewers (raw / wiki / log).
            ============================================================ */}
        <BWSectionHeader index={3} title="Inspect" subtitle="read-only · capped · secret-redacted" tone="#3ddc84"/>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Latest Raw Files</div>
          <BWFileBrowser type="raw" label="Latest raw files (immutable)" accentTone="#3ddc84" />
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Latest Wiki Pages</div>
          <BWFileBrowser type="wiki" label="Latest wiki pages" accentTone="#3ec9ff" />
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <div className="stat-label">Farmer Log</div>
          <BWLogViewer defaultLines={200} />
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
