// ============================================================
// src/governance-page-2.jsx
// Governance tabs 5-8 + <GovernancePage/> shell.
// Depends on globals from governance-page.jsx.
// ============================================================

// ─── Tab 5: Tool Assignment ───────────────────────────────
function TabTools({ agentId, unlocked, onUnlockRequest }) {
  const [cat] = useAsync(() => window.api.governance.toolCatalogue(), []);
  const [state, reload] = useAsync(() => window.api.governance.listTools(agentId), [agentId]);
  if (state.loading || cat.loading) return <div className="muted xsmall">Loading tools…</div>;

  const rows = state.data?.tools || [];
  const byKey = Object.fromEntries(rows.map(r => [r.tool_key, r]));
  const catalogue = cat.data?.tools || [];

  const toggle = async (toolKey, currentEnabled, currentLocked) => {
    if (currentLocked && !unlocked) { onUnlockRequest?.('This tool permission is locked.'); return; }
    try {
      await window.api.governance.updateTool(agentId, toolKey, { enabled: !currentEnabled, locked: !!currentLocked });
      reload();
    } catch (e) {
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };
  const toggleLock = async (toolKey, currentEnabled, currentLocked) => {
    if (!unlocked) { onUnlockRequest?.('Changing a tool lock requires the master password.'); return; }
    try {
      await window.api.governance.updateTool(agentId, toolKey, { enabled: !!currentEnabled, locked: !currentLocked });
      reload();
    } catch (e) {
      if (e.code === 'UNLOCK_REQUIRED') onUnlockRequest?.(e.message);
    }
  };

  const groups = {};
  for (const t of catalogue) (groups[t.group] = groups[t.group] || []).push(t);

  return (
    <div className="vstack" style={{gap: 14}}>
      <div className="gov-warn-banner">
        <I.Alert size={14}/>
        <div>
          <div style={{fontWeight: 500}}>Tool assignment controls what an agent can physically do.</div>
          <div className="muted xsmall">Unchecking a tool revokes capability immediately. Locked tools require the master password to change.</div>
        </div>
      </div>
      {Object.entries(groups).map(([grp, items]) => (
        <div className="card gov-card" key={grp}>
          <div className="card-head">
            <div className="card-title">{grp}</div>
            <span className="muted xsmall">{items.length} tool{items.length > 1 ? 's' : ''}</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <table className="gov-table">
              <thead>
                <tr><th style={{width: 30}}></th><th>Tool</th><th>Description</th><th style={{width: 90}}>State</th><th style={{width: 180}}></th></tr>
              </thead>
              <tbody>
                {items.map(t => {
                  const row = byKey[t.key];
                  const enabled = !!row?.enabled;
                  const locked = !!row?.locked;
                  return (
                    <tr key={t.key}>
                      <td>{locked ? <I.Key size={12} style={{color: 'var(--accent)'}}/> : null}</td>
                      <td><strong>{t.label}</strong><div className="muted xsmall mono">{t.key}</div></td>
                      <td className="muted xsmall">{t.description || '—'}</td>
                      <td>
                        <span className={`gov-pill ${enabled ? 'ok' : 'offline'}`}>
                          {enabled ? 'enabled' : 'disabled'}
                        </span>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <div className="hstack" style={{gap: 4, justifyContent: 'flex-end'}}>
                          <button className="btn sm" onClick={() => toggleLock(t.key, enabled, locked)}>
                            <I.Key size={10}/> {locked ? 'Unlock' : 'Lock'}
                          </button>
                          <button
                            className={`btn sm ${enabled ? 'danger' : 'primary'}`}
                            onClick={() => toggle(t.key, enabled, locked)}
                          >
                            {enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 6: Bio / Constitution ────────────────────────────
function TabBio({ agent, reload, unlocked, onUnlockRequest }) {
  if (!agent) return null;
  const isLocked = (key) => agent.protected || (agent.locked_fields || []).includes(key);
  return (
    <div className="vstack" style={{gap: 14}}>
      <div className="gov-warn-banner">
        <I.Alert size={14}/>
        <div>
          <div style={{fontWeight: 500}}>Bio and rules shape how the agent speaks, makes decisions, and interprets instructions.</div>
          <div className="muted xsmall">Changes take effect on the agent's next task. Prior output is not retroactively altered.</div>
        </div>
      </div>
      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Bio</div>
          {isLocked('bio') ? <span className="gov-pill protected"><I.Key size={10}/> Locked</span> : null}
        </div>
        <div className="card-body">
          <ProfileTextarea
            label="Agent bio"
            value={agent.bio}
            locked={isLocked('bio')}
            unlocked={unlocked}
            onUnlockRequest={onUnlockRequest}
            onSave={v => window.api.governance.updateProfile(agent.agent_id, { bio: v }).then(reload)}
          />
        </div>
      </div>
      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Constitution / Rules</div>
          {isLocked('constitution') ? <span className="gov-pill protected"><I.Key size={10}/> Locked</span> : null}
        </div>
        <div className="card-body">
          <ProfileTextarea
            label="Constitution"
            value={agent.constitution}
            locked={isLocked('constitution')}
            unlocked={unlocked}
            onUnlockRequest={onUnlockRequest}
            onSave={v => window.api.governance.updateProfile(agent.agent_id, { constitution: v }).then(reload)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tab 7: Audit & History ───────────────────────────────
function TabAudit() {
  const [state, reload] = useAsync(() => window.api.governance.audit(200), []);
  if (state.loading) return <div className="muted xsmall">Loading audit events…</div>;
  const events = state.data?.events || [];

  return (
    <div className="card gov-card">
      <div className="card-head">
        <div className="card-title">Audit & change history</div>
        <div className="hstack" style={{gap: 8, marginLeft: 'auto'}}>
          <span className="muted xsmall">{events.length} events</span>
          <button className="btn sm" onClick={reload}>Refresh</button>
        </div>
      </div>
      <div className="card-body" style={{padding: 0}}>
        <table className="gov-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Agent</th>
              <th>Field</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id}>
                <td className="mono xsmall">{new Date(ev.ts).toLocaleString()}</td>
                <td>{ev.actor || '—'}</td>
                <td><code className="gov-chip mono">{ev.action}</code></td>
                <td>{ev.agent_id || '—'}</td>
                <td className="muted xsmall">{ev.field || '—'}</td>
                <td>
                  <span className={`gov-pill ${ev.result === 'ok' ? 'ok' : ev.result === 'denied' ? 'warn' : 'offline'}`}>
                    {ev.result || '—'}
                  </span>
                </td>
                <td className="muted xsmall" style={{maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {ev.detail || '—'}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr><td colSpan={7} className="muted xsmall" style={{padding: 18, textAlign: 'center'}}>No audit events yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 8: Behavior Test ─────────────────────────────────
function TabBehaviorTest({ agentId }) {
  const [state, reload] = useAsync(() => window.api.governance.listTests(agentId, 20), [agentId]);
  const [running, setRunning] = React.useState({});
  const [errors, setErrors] = React.useState({});

  const run = async (channelKey) => {
    setRunning(r => ({ ...r, [channelKey]: true }));
    setErrors(e => ({ ...e, [channelKey]: null }));
    try {
      await window.api.governance.runTest(agentId, channelKey);
      await reload();
    } catch (e) {
      setErrors(er => ({ ...er, [channelKey]: e }));
    } finally {
      setRunning(r => ({ ...r, [channelKey]: false }));
    }
  };

  const byChannel = {};
  for (const t of (state.data?.tests || [])) {
    if (!byChannel[t.channel] || new Date(t.ts) > new Date(byChannel[t.channel].ts)) byChannel[t.channel] = t;
  }

  return (
    <div className="vstack" style={{gap: 14}}>
      <div className="gov-warn-banner">
        <I.Alert size={14}/>
        <div>
          <div style={{fontWeight: 500}}>Behavior tests send a real probe through the configured provider for each channel.</div>
          <div className="muted xsmall">Use after changing routing, tool, or memory settings to confirm nothing broke.</div>
        </div>
      </div>
      <div className="card gov-card">
        <div className="card-head">
          <div className="card-title">Channel probes</div>
          <button className="btn sm" onClick={reload} style={{marginLeft: 'auto'}}>Refresh</button>
        </div>
        <div className="card-body" style={{padding: 0}}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Last run</th>
                <th>Latency</th>
                <th>Result</th>
                <th>Detail</th>
                <th style={{width: 110}}></th>
              </tr>
            </thead>
            <tbody>
              {GOV_CHANNELS.map(ch => {
                const last = byChannel[ch.key];
                const isRunning = !!running[ch.key];
                const err = errors[ch.key];
                return (
                  <tr key={ch.key}>
                    <td><strong>{ch.label}</strong><div className="muted xsmall">{ch.group}</div></td>
                    <td className="mono xsmall">{last ? new Date(last.ts).toLocaleString() : '—'}</td>
                    <td className="mono xsmall">{last?.latency_ms != null ? `${last.latency_ms}ms` : '—'}</td>
                    <td>
                      {last ? (
                        <span className={`gov-pill ${last.ok ? 'ok' : 'warn'}`}>
                          {last.ok ? 'pass' : 'fail'}
                        </span>
                      ) : <span className="muted xsmall">not yet run</span>}
                    </td>
                    <td className="muted xsmall" style={{maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {err ? <span style={{color: 'var(--danger, #ff8088)'}}>{err.message}</span> : (last?.detail || '—')}
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <button className="btn primary sm" onClick={() => run(ch.key)} disabled={isRunning}>
                        {isRunning ? 'Running…' : 'Run probe'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main page shell ──────────────────────────────────────
function GovernancePage() {
  const ready = useGovReady();
  const [tab, setTab] = React.useState(() => localStorage.getItem('gov.tab') || 'profile');
  const [activeId, setActiveId] = React.useState(() => localStorage.getItem('gov.agent') || 'agent-zero');
  const [unlockOpen, setUnlockOpen] = React.useState(false);
  const [unlockReason, setUnlockReason] = React.useState(null);
  const { unlocked, expiresAt } = useUnlock();

  React.useEffect(() => { localStorage.setItem('gov.tab', tab); }, [tab]);
  React.useEffect(() => { localStorage.setItem('gov.agent', activeId); }, [activeId]);

  const [profiles, reloadProfiles] = useAsync(
    () => ready ? window.api.governance.listProfiles() : Promise.resolve({ agents: [] }),
    [ready]
  );
  const [lockStatus, reloadLock] = useAsync(
    () => ready ? window.api.governance.lockStatus() : Promise.resolve({ set: false }),
    [ready]
  );

  if (!ready) return <GovOfflineCard/>;

  const agents = profiles.data?.agents || [];
  const agent = agents.find(a => a.agent_id === activeId) || agents[0];

  const openUnlock = (reason) => { setUnlockReason(reason || null); setUnlockOpen(true); };
  const lockNow = () => window.api.governance.clearUnlock();

  return (
    <div className="gov-page">
      <GovHeader
        agents={agents}
        activeId={agent?.agent_id}
        onPick={setActiveId}
        unlocked={unlocked}
        expiresAt={expiresAt}
        onUnlock={() => openUnlock()}
        onLock={lockNow}
        lockStatus={lockStatus.data}
      />

      <div className="gov-tabs">
        {GOV_TABS.map(t => {
          const IconCmp = I[t.icon] || I.Dot;
          return (
            <button
              key={t.id}
              className={`gov-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <IconCmp size={13}/>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="gov-tab-body">
        {profiles.loading ? (
          <div className="muted xsmall">Loading agent profiles…</div>
        ) : (
          <>
            {tab === 'profile' && <TabAgentProfile agent={agent} reload={reloadProfiles} unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'memory'  && agent && <TabMemory agentId={agent.agent_id} unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'lock'    && <TabMasterLock unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'routing' && agent && <TabRouting agentId={agent.agent_id} unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'tools'   && agent && <TabTools agentId={agent.agent_id} unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'bio'     && <TabBio agent={agent} reload={reloadProfiles} unlocked={unlocked} onUnlockRequest={openUnlock}/>}
            {tab === 'audit'   && <TabAudit/>}
            {tab === 'test'    && agent && <TabBehaviorTest agentId={agent.agent_id}/>}
          </>
        )}
      </div>

      <UnlockModal
        open={unlockOpen}
        reason={unlockReason}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => { reloadLock(); reloadProfiles(); }}
      />
    </div>
  );
}

Object.assign(window, { GovernancePage, TabTools, TabBio, TabAudit, TabBehaviorTest });
