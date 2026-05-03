// ============================================================
// src/governance-page.jsx
// Agent Configuration & Governance — the premium admin control center.
//
// Single page that hosts 8 tabs:
//   1. Agent Profile
//   2. Memory Protection
//   3. Master Lock
//   4. Provider Routing
//   5. Tool Assignment
//   6. Bio / Constitution
//   7. Audit & Change History
//   8. Behavior Test
//
// Contract with backend (src/backend/http-client.jsx):
//   window.api.governance.*  — every action goes through here.
//
// Every editable control checks:
//   - is this agent protected?          → show lock icon
//   - is this field in locked_fields?   → show lock icon
//   - is the owner currently unlocked?  → enable edits
// If the operator tries to save something locked without an active
// unlock token, the <UnlockModal/> opens automatically. Tokens are
// ephemeral (15 min), in-memory only, never persisted to disk.
// ============================================================

const GOV_CHANNELS = [
  { key: 'chat_text',    label: 'Normal conversation',     group: 'Conversation' },
  { key: 'voice_stt',    label: 'Voice input (STT)',       group: 'Voice' },
  { key: 'voice_tts',    label: 'Voice output (TTS)',      group: 'Voice' },
  { key: 'text_enhance', label: 'Text enhancement',        group: 'Conversation' },
  { key: 'task_exec',    label: 'Task / job execution',    group: 'Work' },
  { key: 'research',     label: 'Research / browser',      group: 'Work' },
  { key: 'automation',   label: 'Automation',              group: 'Work' },
  { key: 'tool_exec',    label: 'Tool / command execution',group: 'Work' },
  { key: 'marketing',    label: 'Marketing',               group: 'Generative' },
  { key: 'image_gen',    label: 'Image generation',        group: 'Generative' },
  { key: 'video_gen',    label: 'Video generation',        group: 'Generative' },
];

const GOV_TABS = [
  { id: 'profile',   label: 'Agent Profile',   icon: 'User' },
  { id: 'memory',    label: 'Memory Protection', icon: 'Brain' },
  { id: 'lock',      label: 'Master Lock',     icon: 'Key' },
  { id: 'routing',   label: 'Provider Routing',icon: 'Plug' },
  { id: 'tools',     label: 'Tool Assignment', icon: 'Plug' },
  { id: 'bio',       label: 'Bio & Rules',     icon: 'FileLog' },
  { id: 'audit',     label: 'Audit & History', icon: 'FileLog' },
  { id: 'test',      label: 'Behavior Test',   icon: 'Health' },
];

// ─── Hooks ──────────────────────────────────────────────────
function useGovReady() {
  const [ready, setReady] = React.useState(!!(window.API_HTTP_READY && window.api?.governance));
  React.useEffect(() => {
    const on = () => setReady(!!(window.API_HTTP_READY && window.api?.governance));
    window.addEventListener('api:http-ready', on);
    window.addEventListener('api:http-offline', on);
    return () => {
      window.removeEventListener('api:http-ready', on);
      window.removeEventListener('api:http-offline', on);
    };
  }, []);
  return ready;
}

function useUnlock() {
  const [unlocked, setUnlocked] = React.useState(() => !!window.api?.governance?.isUnlocked?.());
  const [expiresAt, setExpiresAt] = React.useState(() => window.api?.governance?.unlockExpiresAt?.());
  React.useEffect(() => {
    const onU = () => { setUnlocked(true);  setExpiresAt(window.api?.governance?.unlockExpiresAt?.()); };
    const onL = () => { setUnlocked(false); setExpiresAt(null); };
    window.addEventListener('governance:unlocked', onU);
    window.addEventListener('governance:locked', onL);
    // Auto-expire tick.
    const t = setInterval(() => {
      const exp = window.api?.governance?.unlockExpiresAt?.();
      if (!exp) return;
      if (new Date(exp).getTime() <= Date.now()) {
        window.api.governance.clearUnlock();
      }
    }, 10_000);
    return () => {
      window.removeEventListener('governance:unlocked', onU);
      window.removeEventListener('governance:locked', onL);
      clearInterval(t);
    };
  }, []);
  return { unlocked, expiresAt };
}

function useAsync(fn, deps) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });
  const reload = React.useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ loading: false, data, error: null });
    } catch (e) {
      setState({ loading: false, data: null, error: e });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => { reload(); }, [reload]);
  return [state, reload];
}

// ─── Setup-pending banner (when governance API is not reachable) ────────────
function GovOfflineCard() {
  return (
    <div className="gov-offline-card">
      <I.Alert size={28}/>
      <h2>Governance API setup pending</h2>
      <p>
        Agent Configuration &amp; Governance is a protected live-only surface.
        It must use the approved Mission Control API and owner-approved
        governance gates before it can accept changes.
      </p>
      <p className="gov-offline-hint">
        Read-only status can be shown here. Protected governance writes stay
        locked until the production API, audit chain, and rollback path are wired.
      </p>
    </div>
  );
}

// ─── Unlock Modal ──────────────────────────────────────────
function UnlockModal({ open, reason, onClose, onUnlocked }) {
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [lockStatus, setLockStatus] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setPassword(''); setErr(null);
    window.api.governance.lockStatus().then(setLockStatus).catch(() => setLockStatus(null));
  }, [open]);

  if (!open) return null;
  const isSet = !!(lockStatus && lockStatus.set);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (!isSet) {
        await window.api.governance.lockSet(password);
        // After setting, immediately verify to get a token.
        await window.api.governance.lockVerify(password);
      } else {
        await window.api.governance.lockVerify(password);
      }
      setBusy(false);
      onUnlocked?.();
      onClose?.();
    } catch (e) {
      setBusy(false);
      setErr(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={busy ? null : onClose}>
      <div className="modal gov-unlock-modal" onClick={e => e.stopPropagation()}>
        <div className="gov-unlock-head">
          <div className="gov-unlock-icon"><I.Key size={22}/></div>
          <div>
            <h3>{isSet ? 'Master password required' : 'Set master password'}</h3>
            <p className="muted xsmall">
              {isSet
                ? 'This action changes a protected setting. Enter the master password to unlock the session for 15 minutes.'
                : 'No master password is configured yet. Set one now — it will gate all future edits to Agent Zero voice, memory, routing, bio, and tool permissions.'}
            </p>
          </div>
        </div>

        {reason ? (
          <div className="gov-unlock-reason">
            <I.Alert size={12}/> {reason}
          </div>
        ) : null}

        <label className="gov-unlock-label">
          <span>Master password</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            autoFocus
            placeholder={isSet ? 'Enter password' : 'Choose a password (≥ 8 chars)'}
          />
        </label>

        {err ? (
          <div className="gov-unlock-err">
            <I.Alert size={12}/>
            <div>
              <div style={{fontWeight: 500}}>{err.code || 'Error'}</div>
              <div className="muted xsmall">
                {err.message}
                {typeof err.failed_attempts === 'number'
                  ? ` · ${err.failed_attempts} failed attempt${err.failed_attempts > 1 ? 's' : ''}`
                  : ''}
              </div>
            </div>
          </div>
        ) : null}

        <div className="gov-unlock-foot">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || password.length < 1 || (!isSet && password.length < 8)}
          >
            {busy ? 'Verifying…' : (isSet ? 'Unlock' : 'Set password')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Header (agent picker + lock status) ───────────────────
function GovHeader({ agents, activeId, onPick, unlocked, expiresAt, onUnlock, onLock, lockStatus }) {
  const active = agents.find(a => a.agent_id === activeId);
  const expSec = expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const expLabel = expSec > 60 ? `${Math.floor(expSec/60)}m ${expSec%60}s left` : `${expSec}s left`;
  return (
    <div className="gov-header">
      <div className="gov-agent-picker">
        <span className="gov-picker-label">Governing</span>
        <select
          className="input gov-agent-select"
          value={activeId || ''}
          onChange={e => onPick(e.target.value)}
        >
          {agents.map(a => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.display_name} · {a.role_title}{a.protected ? ' · PROTECTED' : ''}
            </option>
          ))}
        </select>
        {active?.protected ? <span className="gov-pill protected"><I.Key size={10}/> Protected</span> : null}
        <span className={`gov-pill ${active?.runtime_status === 'live' ? 'ok' : active?.runtime_status === 'degraded' ? 'warn' : 'offline'}`}>
          <span className="dot"/> {active?.runtime_status || 'unknown'}
        </span>
      </div>

      <div className="gov-lock-panel">
        {!lockStatus?.set ? (
          <>
            <span className="gov-pill warn"><I.Alert size={10}/> Master password not set</span>
            <button className="btn primary sm" onClick={onUnlock}>Set master password</button>
          </>
        ) : unlocked ? (
          <>
            <span className="gov-pill ok"><I.Key size={10}/> Unlocked · {expLabel}</span>
            <button className="btn sm" onClick={onLock}>Lock now</button>
          </>
        ) : (
          <>
            <span className="gov-pill locked"><I.Key size={10}/> Locked</span>
            <button className="btn sm" onClick={onUnlock}>Unlock</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Agent Profile ───────────────────────────────────
function TabAgentProfile({ agent, reload, unlocked, onUnlockRequest }) {
  if (!agent) return <div className="gov-empty">No agent selected.</div>;
  const isLocked = (key) => agent.protected || (agent.locked_fields || []).includes(key);

  return (
    <div className="gov-grid-2">
      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Identity</div>
          {agent.protected ? <span className="gov-pill protected"><I.Key size={10}/> Owner-only</span> : null}
        </div>
        <div className="card-body vstack" style={{gap: 12}}>
          <ProfileField label="Agent name" value={agent.display_name} locked={isLocked('display_name')}/>
          <ProfileField label="Role" value={agent.role_title} locked={isLocked('role_title')}/>
          <ProfileField label="Status" value={
            <span className={`gov-pill ${agent.protected ? 'protected' : 'ok'}`}>
              {agent.protected ? 'PROTECTED / LOCKED' : 'EDITABLE'}
            </span>
          }/>
          <ProfileField label="Runtime" value={
            <span className={`gov-pill ${agent.runtime_status === 'live' ? 'ok' : 'offline'}`}>
              <span className="dot"/> {agent.runtime_status || 'unknown'}
            </span>
          }/>
          <ProfileField label="Last updated" value={agent.updated_at ? new Date(agent.updated_at).toLocaleString() : '—'}/>
          <ProfileField label="Updated by" value={agent.updated_by || 'system.seed'}/>
        </div>
      </div>

      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Behavior</div>
        </div>
        <div className="card-body vstack" style={{gap: 14}}>
          <ProfileTextarea
            label="Voice behavior"
            value={agent.voice_behavior}
            locked={isLocked('voice_behavior')}
            unlocked={unlocked}
            onUnlockRequest={onUnlockRequest}
            onSave={v => window.api.governance.updateProfile(agent.agent_id, { voice_behavior: v }).then(reload)}
          />
          <ProfileTextarea
            label="Memory behavior"
            value={agent.memory_behavior}
            locked={isLocked('memory_behavior')}
            unlocked={unlocked}
            onUnlockRequest={onUnlockRequest}
            onSave={v => window.api.governance.updateProfile(agent.agent_id, { memory_behavior: v }).then(reload)}
          />
          <ProfileTextarea
            label="Task-routing behavior"
            value={agent.routing_behavior}
            locked={isLocked('routing_behavior')}
            unlocked={unlocked}
            onUnlockRequest={onUnlockRequest}
            onSave={v => window.api.governance.updateProfile(agent.agent_id, { routing_behavior: v }).then(reload)}
          />
        </div>
      </div>

      <div className="card gov-card gov-span-2">
        <div className="card-head">
          <div className="card-title">Owner-only controls</div>
          <span className="muted xsmall">What actions require owner / master password</span>
        </div>
        <div className="card-body">
          <div className="gov-owner-grid">
            {Object.entries(agent.owner_controls || {}).map(([k, v]) => (
              <div key={k} className="gov-owner-cell">
                <div className="gov-owner-k">{k.replace(/_/g, ' ')}</div>
                <div className="gov-owner-v">{v}</div>
              </div>
            ))}
            {Object.keys(agent.owner_controls || {}).length === 0 ? (
              <div className="muted xsmall">No owner controls declared for this agent.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card gov-card gov-span-2">
        <div className="card-head">
          <div className="card-title">Locked fields</div>
          <span className="muted xsmall">Edits to these require the master password</span>
        </div>
        <div className="card-body">
          <div className="gov-locked-fields">
            {(agent.locked_fields || []).map(f => (
              <span key={f} className="gov-chip locked"><I.Key size={10}/> {f}</span>
            ))}
            {(agent.locked_fields || []).length === 0 ? (
              <span className="muted xsmall">No fields are locked for this agent.</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, locked }) {
  return (
    <div className="gov-field-row">
      <div className="gov-field-label">
        {locked ? <I.Key size={11}/> : null}
        <span>{label}</span>
      </div>
      <div className="gov-field-value">{value || '—'}</div>
    </div>
  );
}

function ProfileTextarea({ label, value, locked, unlocked, onUnlockRequest, onSave }) {
  const [draft, setDraft] = React.useState(value || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { setDraft(value || ''); }, [value]);
  const dirty = draft !== (value || '');
  const canSave = dirty && (!locked || unlocked);

  const save = async () => {
    if (locked && !unlocked) { onUnlockRequest?.('This field is locked. Unlock to save.'); return; }
    setBusy(true); setErr(null);
    try { await onSave(draft); setBusy(false); }
    catch (e) {
      setBusy(false); setErr(e);
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  return (
    <div className="gov-textarea-block">
      <div className="gov-field-label">
        {locked ? <I.Key size={11}/> : null}
        <span>{label}</span>
        {locked ? <span className="gov-chip locked-mini">LOCKED</span> : null}
      </div>
      <textarea
        className="input gov-textarea"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        disabled={locked && !unlocked}
        placeholder={locked && !unlocked ? 'Unlock to edit' : '—'}
      />
      {dirty ? (
        <div className="gov-textarea-actions">
          <button className="btn sm" onClick={() => setDraft(value || '')} disabled={busy}>Revert</button>
          <button className="btn primary sm" onClick={save} disabled={!canSave || busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : null}
      {err ? <div className="gov-inline-err"><I.Alert size={11}/> {err.message}</div> : null}
    </div>
  );
}

// ─── Tab 2: Memory Protection ──────────────────────────────
function TabMemory({ agentId, unlocked, onUnlockRequest }) {
  const [mem, reloadMem] = useAsync(() => window.api.governance.getMemory(agentId).catch(e => e.status === 404 ? null : Promise.reject(e)), [agentId]);
  const [snaps, reloadSnaps] = useAsync(() => window.api.governance.listSnapshots(agentId), [agentId]);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (mem.data) setDraft(mem.data.body || '');
  }, [mem.data]);

  const isProtected = !!mem.data?.protected;
  const canEdit = !isProtected || unlocked;

  const save = async () => {
    if (!canEdit) { onUnlockRequest?.('This memory is protected.'); return; }
    let parsed;
    try { parsed = JSON.parse(draft); }
    catch (e) { setErr(new Error('Memory body must be valid JSON')); return; }
    setBusy(true); setErr(null);
    try {
      await window.api.governance.putMemory(agentId, parsed, isProtected);
      await reloadMem(); await reloadSnaps();
      setEditing(false); setBusy(false);
    } catch (e) {
      setBusy(false); setErr(e);
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  const snapshot = async () => {
    try {
      await window.api.governance.snapshotMemory(agentId, prompt('Label (optional)') || null);
      await reloadSnaps();
    } catch (e) { setErr(e); }
  };

  const restore = async (snapId) => {
    if (!confirm(`Restore memory from snapshot ${snapId}? Current memory will be auto-snapshotted first.`)) return;
    try {
      await window.api.governance.restoreMemory(agentId, snapId);
      await reloadMem(); await reloadSnaps();
    } catch (e) {
      setErr(e);
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  return (
    <div className="gov-grid-2">
      <div className="card gov-card gov-span-2">
        <div className="card-head">
          <div className="card-title">
            {isProtected
              ? <><I.Key size={14}/> Protected memory</>
              : 'Memory'}
          </div>
          <span className={`gov-pill ${isProtected ? 'protected' : mem.data ? 'ok' : 'warn'}`}>
            {isProtected ? 'PROTECTED / LOCKED' : mem.data ? 'ACTIVE' : 'EMPTY'}
          </span>
        </div>
        <div className="card-body vstack">
          {isProtected ? (
            <div className="gov-warn-banner">
              <I.Alert size={14}/>
              <div>
                <div style={{fontWeight: 500}}>Changing protected memory can affect agent behavior, identity, voice, and user recognition.</div>
                <div className="muted xsmall">Every edit auto-snapshots the previous state. Use Restore to roll back.</div>
              </div>
            </div>
          ) : null}

          <div className="gov-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Last update</span>
              <span className="kpi-value" style={{fontSize: 14}}>
                {mem.data?.updated_at ? new Date(mem.data.updated_at).toLocaleString() : '—'}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Changed by</span>
              <span className="kpi-value" style={{fontSize: 14}}>{mem.data?.updated_by || '—'}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Body size</span>
              <span className="kpi-value" style={{fontSize: 14}}>
                {mem.data?.body ? `${mem.data.body.length} chars` : '—'}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Snapshots</span>
              <span className="kpi-value" style={{fontSize: 14}}>{snaps.data?.snapshots?.length || 0}</span>
            </div>
          </div>

          <div className="hstack" style={{gap: 8, marginTop: 4}}>
            <button className="btn sm" onClick={() => setEditing(v => !v)} disabled={!mem.data}>
              {editing ? 'Close editor' : 'View / Edit JSON'}
              {isProtected && !unlocked ? <I.Key size={10} style={{marginLeft: 4}}/> : null}
            </button>
            <button className="btn sm" onClick={snapshot} disabled={!mem.data}>
              <I.Plus size={10}/> Take snapshot
            </button>
          </div>

          {editing && mem.data ? (
            <>
              <textarea
                className="input gov-textarea gov-memory-body"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={16}
                disabled={!canEdit}
              />
              {err ? <div className="gov-inline-err"><I.Alert size={11}/> {err.message}</div> : null}
              <div className="hstack" style={{gap: 8}}>
                <button className="btn sm" onClick={() => setDraft(mem.data.body)} disabled={busy}>Revert</button>
                <button className="btn primary sm" onClick={save} disabled={busy || draft === mem.data.body}>
                  {busy ? 'Saving…' : 'Save memory'}
                </button>
                {!canEdit ? <span className="muted xsmall">Unlock to edit</span> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="card gov-card gov-span-2">
        <div className="card-head">
          <div className="card-title">Change history</div>
          <span className="muted xsmall">Every save auto-snapshots the previous state</span>
        </div>
        <div className="card-body">
          {snaps.loading ? <div className="muted xsmall">Loading…</div> : null}
          {snaps.data && snaps.data.snapshots?.length === 0 ? (
            <div className="muted xsmall">No snapshots yet.</div>
          ) : null}
          {snaps.data && snaps.data.snapshots?.length > 0 ? (
            <table className="gov-table">
              <thead>
                <tr><th>Timestamp</th><th>Label</th><th>Size</th><th>Created by</th><th>Kind</th><th>Hash</th><th></th></tr>
              </thead>
              <tbody>
                {snaps.data.snapshots.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.ts).toLocaleString()}</td>
                    <td>{s.label || '—'}</td>
                    <td className="mono">{s.size_bytes}B</td>
                    <td>{s.created_by || '—'}</td>
                    <td>
                      <span className={`gov-chip ${s.restore_point ? 'auto' : 'manual'}`}>
                        {s.restore_point ? 'auto' : 'manual'}
                      </span>
                    </td>
                    <td className="mono" style={{fontSize: 10}}>{s.hash.slice(0, 12)}…</td>
                    <td style={{textAlign: 'right'}}>
                      <button className="btn sm" onClick={() => restore(s.id)}>Restore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Master Lock ─────────────────────────────────────
function TabMasterLock({ unlocked, onUnlockRequest }) {
  const [status, reload] = useAsync(() => window.api.governance.lockStatus(), []);
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [oldPw, setOldPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [ok, setOk] = React.useState(null);

  const doRotate = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      await window.api.governance.lockRotate(oldPw, newPw);
      setOk('Master password rotated. All existing unlock tokens have been revoked.');
      setOldPw(''); setNewPw(''); setRotateOpen(false);
      setBusy(false); reload();
    } catch (e) { setBusy(false); setErr(e); }
  };

  const s = status.data || {};
  return (
    <div className="gov-grid-2">
      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title"><I.Key size={14}/> Lock status</div>
          <span className={`gov-pill ${s.set ? (unlocked ? 'ok' : 'locked') : 'warn'}`}>
            {!s.set ? 'Not configured' : unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <div className="card-body vstack">
          <div className="gov-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Configured</span>
              <span className="kpi-value" style={{fontSize: 14}}>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Last rotation</span>
              <span className="kpi-value" style={{fontSize: 14}}>{s.rotated_at ? new Date(s.rotated_at).toLocaleString() : '—'}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Rotated by</span>
              <span className="kpi-value" style={{fontSize: 14}}>{s.rotated_by || '—'}</span>
            </div>
            <div className="kpi-card" style={{borderColor: s.failed_attempts ? 'rgba(255,120,40,0.4)' : undefined}}>
              <span className="kpi-label">Failed attempts</span>
              <span className="kpi-value" style={{fontSize: 14}}>{s.failed_attempts || 0}</span>
            </div>
          </div>
          {s.locked_out ? (
            <div className="gov-inline-err">
              <I.Alert size={12}/> Temporarily locked out until {new Date(s.locked_until).toLocaleString()} due to repeated failed attempts.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Actions</div>
        </div>
        <div className="card-body vstack">
          {!s.set ? (
            <button className="btn primary" onClick={() => onUnlockRequest?.('Set the master password to gate protected settings.')}>
              Set master password
            </button>
          ) : null}
          {s.set && !unlocked ? (
            <button className="btn primary" onClick={() => onUnlockRequest?.('Unlock the session to edit protected settings.')}>
              Unlock session
            </button>
          ) : null}
          {s.set && unlocked ? (
            <button className="btn" onClick={() => window.api.governance.clearUnlock()}>
              Lock session now
            </button>
          ) : null}
          {s.set ? (
            <button className="btn" onClick={() => setRotateOpen(v => !v)}>
              {rotateOpen ? 'Close rotation form' : 'Rotate master password'}
            </button>
          ) : null}

          {rotateOpen ? (
            <div className="gov-rotate-form vstack">
              <label className="gov-field-label"><span>Current password</span></label>
              <input type="password" className="input" value={oldPw} onChange={e => setOldPw(e.target.value)} autoFocus/>
              <label className="gov-field-label"><span>New password (≥ 8 chars)</span></label>
              <input type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)}/>
              {err ? <div className="gov-inline-err"><I.Alert size={11}/> {err.message}</div> : null}
              {ok ? <div className="gov-inline-ok"><I.Check size={11}/> {ok}</div> : null}
              <div className="hstack" style={{gap: 8}}>
                <button className="btn sm" onClick={() => { setRotateOpen(false); setOldPw(''); setNewPw(''); setErr(null); }} disabled={busy}>
                  Cancel
                </button>
                <button className="btn primary sm" onClick={doRotate} disabled={busy || newPw.length < 8 || !oldPw}>
                  {busy ? 'Rotating…' : 'Rotate'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card gov-card gov-span-2">
        <div className="card-head">
          <div className="card-title">What the master password protects</div>
        </div>
        <div className="card-body">
          <div className="gov-protect-grid">
            <ProtectRow icon="Brain"  label="Agent Zero memory"                  note="Identity, recognition rules, voice pipeline."/>
            <ProtectRow icon="Radio"  label="Voice providers"                 note="STT (Whisper) and TTS (ElevenLabs)."/>
            <ProtectRow icon="Radio"  label="Normal chat provider"            note="Approved chat path — not OpenRouter."/>
            <ProtectRow icon="Agents" label="Task / job provider"             note="OpenRouter model choice."/>
            <ProtectRow icon="User"   label="Agent bio / constitution"        note="Identity instructions, rules."/>
            <ProtectRow icon="Plug"   label="Tool permissions"                note="Which tools are enabled per agent."/>
            <ProtectRow icon="FileLog" label="Routing rules"                  note="Per-channel provider choice."/>
            <ProtectRow icon="Alert"  label="Fallback behavior"               note="Backup providers when primary fails."/>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtectRow({ icon, label, note }) {
  const IconCmp = I[icon] || I.Key;
  return (
    <div className="gov-protect-row">
      <div className="gov-protect-icon"><IconCmp size={14}/></div>
      <div>
        <div className="gov-protect-label">{label}</div>
        <div className="muted xsmall">{note}</div>
      </div>
    </div>
  );
}

// ─── Tab 4: Provider Routing ───────────────────────────────
function TabRouting({ agentId, unlocked, onUnlockRequest }) {
  const [state, reload] = useAsync(() => window.api.governance.listRouting(agentId), [agentId]);
  if (state.loading) return <div className="muted xsmall">Loading routing rules…</div>;
  const rules = state.data?.rules || [];
  const byKey = Object.fromEntries(rules.map(r => [r.channel, r]));

  const groups = {};
  for (const ch of GOV_CHANNELS) {
    (groups[ch.group] = groups[ch.group] || []).push({ ch, rule: byKey[ch.key] || null });
  }

  return (
    <div className="vstack" style={{gap: 14}}>
      <div className="gov-warn-banner">
        <I.Alert size={14}/>
        <div>
          <div style={{fontWeight: 500}}>Keep task traffic and conversational traffic separate.</div>
          <div className="muted xsmall">OpenRouter is reserved for task / job execution. Do not move normal conversation or voice onto it unless explicitly instructed by the owner.</div>
        </div>
      </div>
      {Object.entries(groups).map(([group, rows]) => (
        <div className="card gov-card" key={group}>
          <div className="card-head">
            <div className="card-title">{group}</div>
            <span className="muted xsmall">{rows.length} channel{rows.length > 1 ? 's' : ''}</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th style={{width: 36}}></th>
                  <th>Channel</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Fallback</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ch, rule }) => (
                  <RoutingRow
                    key={ch.key}
                    agentId={agentId}
                    channel={ch}
                    rule={rule}
                    unlocked={unlocked}
                    onUnlockRequest={onUnlockRequest}
                    reload={reload}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoutingRow({ agentId, channel, rule, unlocked, onUnlockRequest, reload }) {
  const locked = !!rule?.locked;
  const [editing, setEditing] = React.useState(false);
  const [provider, setProvider] = React.useState(rule?.provider || '');
  const [model, setModel] = React.useState(rule?.model || '');
  const [fallback, setFallback] = React.useState(rule?.fallback || '');
  const [notes, setNotes] = React.useState(rule?.notes || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const openEdit = () => {
    if (locked && !unlocked) { onUnlockRequest?.('This routing rule is locked.'); return; }
    setProvider(rule?.provider || ''); setModel(rule?.model || '');
    setFallback(rule?.fallback || ''); setNotes(rule?.notes || '');
    setEditing(true);
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await window.api.governance.updateRouting(agentId, channel.key, {
        provider, model, fallback, notes, locked: rule?.locked ?? false,
      });
      await reload();
      setEditing(false); setBusy(false);
    } catch (e) {
      setBusy(false); setErr(e);
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  const toggleLock = async () => {
    if (!unlocked) { onUnlockRequest?.('Changing the lock status requires the master password.'); return; }
    try {
      await window.api.governance.updateRouting(agentId, channel.key, {
        provider: rule?.provider, model: rule?.model,
        fallback: rule?.fallback, notes: rule?.notes,
        locked: !locked,
      });
      reload();
    } catch (e) {
      setErr(e);
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  if (editing) {
    return (
      <tr className="gov-row-editing">
        <td>{locked ? <I.Key size={12}/> : null}</td>
        <td>{channel.label}</td>
        <td><input className="input sm" value={provider} onChange={e => setProvider(e.target.value)} placeholder="Provider"/></td>
        <td><input className="input sm" value={model} onChange={e => setModel(e.target.value)} placeholder="Model slug"/></td>
        <td><input className="input sm" value={fallback} onChange={e => setFallback(e.target.value)} placeholder="Fallback"/></td>
        <td><input className="input sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes"/></td>
        <td style={{textAlign: 'right'}}>
          <div className="hstack" style={{gap: 4, justifyContent: 'flex-end'}}>
            <button className="btn sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
          </div>
          {err ? <div className="gov-inline-err" style={{marginTop: 4}}><I.Alert size={11}/> {err.message}</div> : null}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{locked ? <I.Key size={12} style={{color: 'var(--accent)'}}/> : null}</td>
      <td><strong>{channel.label}</strong></td>
      <td>{rule?.provider || <span className="muted xsmall">Not assigned</span>}</td>
      <td className="mono xsmall">{rule?.model || '—'}</td>
      <td className="mono xsmall">{rule?.fallback || '—'}</td>
      <td className="muted xsmall">{rule?.notes || '—'}</td>
      <td style={{textAlign: 'right'}}>
        <div className="hstack" style={{gap: 4, justifyContent: 'flex-end'}}>
          <button className="btn sm" onClick={toggleLock} title={unlocked ? (locked ? 'Unlock rule' : 'Lock rule') : 'Master password required'}>
            <I.Key size={10}/> {locked ? 'Unlock' : 'Lock'}
          </button>
          <button className="btn sm" onClick={openEdit}>Edit</button>
        </div>
      </td>
    </tr>
  );
}

Object.assign(window, { GovernancePage: null, GOV_TABS, GOV_CHANNELS, UnlockModal, GovHeader, GovOfflineCard, TabAgentProfile, TabMemory, TabMasterLock, TabRouting, useGovReady, useUnlock, useAsync });
