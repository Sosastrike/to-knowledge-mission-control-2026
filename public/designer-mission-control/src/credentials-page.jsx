// ============================================================
// src/credentials-page.jsx
// Settings → Credentials
//
// Three service cards: OpenRouter, Twilio, AgentMail.
// - Secrets are never echoed back in full.
// - After save, server returns a masked preview ("••••••••abcd").
// - "Rotate" wipes the field and lets the user enter a new value.
// - "Remove" clears the stored value entirely.
// - "Test" button is rendered but disabled with an honest tooltip
//   until the real backend is reachable — we do not simulate.
//
// Data flow:
//   GET  /api/credentials             → { services, catalogue }
//   PUT  /api/credentials/:service    → upsert fields
//   DELETE /api/credentials/:s/:field → remove one field
// The page calls window.api.credentials.* which may or may not
// be present; if not, the page renders the "backend not wired"
// state and disables Save buttons. No fake writes to localStorage.
// ============================================================

// ─── Service descriptors (rendered order + per-field config) ──
const CRED_SERVICES = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    blurb: 'All LLM traffic (Agent Zero, agents, embeddings). Single API key.',
    link: { href: 'https://openrouter.ai/keys', label: 'openrouter.ai/keys' },
    fields: [
      { id: 'api_key', label: 'API Key', sensitive: true, placeholder: 'sk-or-v1-…', help: 'Starts with sk-or-v1-.' },
    ],
  },
  {
    id: 'twilio',
    label: 'Twilio',
    blurb: 'SMS + voice. From-number must be a Twilio-owned E.164 number.',
    link: { href: 'https://console.twilio.com', label: 'console.twilio.com' },
    fields: [
      { id: 'account_sid',         label: 'Account SID',          sensitive: false, placeholder: 'AC…' },
      { id: 'auth_token',          label: 'Auth Token',           sensitive: true,  placeholder: '32-char token' },
      { id: 'from_number',         label: 'From Number',          sensitive: false, placeholder: '+15551234567', help: 'E.164 format, Twilio-owned.' },
      { id: 'webhook_signing_key', label: 'Webhook Signing Key',  sensitive: true,  placeholder: 'Optional — leave blank to sign with Auth Token', optional: true },
    ],
  },
  {
    id: 'agentmail',
    label: 'AgentMail',
    blurb: 'Email send + inbound webhook. Domain must be verified in AgentMail.',
    link: { href: 'https://agentmail.to', label: 'agentmail.to' },
    fields: [
      { id: 'api_key',         label: 'API Key',        sensitive: true,  placeholder: 'am_live_…' },
      { id: 'domain',          label: 'Sender Domain',  sensitive: false, placeholder: 'mail.tkmc.co', help: 'Used as no-reply@<domain>.' },
      { id: 'webhook_secret',  label: 'Webhook Secret', sensitive: true,  placeholder: 'HMAC-SHA256 secret from AgentMail dashboard' },
    ],
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    blurb: 'Agent Zero voice (TTS). Approved provider — do not swap without Governance approval.',
    link: { href: 'https://elevenlabs.io/app/settings/api-keys', label: 'elevenlabs.io/app/settings/api-keys' },
    fields: [
      { id: 'api_key',           label: 'API Key',          sensitive: true,  placeholder: 'xi-api-key…' },
      { id: 'default_voice_id',  label: 'Default Voice ID', sensitive: false, placeholder: 'e.g. 21m00Tcm4TlvDq8ikWAM', help: 'Voice Agent Zero uses unless overridden per utterance.', optional: true },
    ],
  },
  {
    id: 'whisper',
    label: 'Whisper (OpenAI)',
    blurb: 'Primary speech-to-text. Uses OpenAI\'s /v1/audio/transcriptions.',
    link: { href: 'https://platform.openai.com/api-keys', label: 'platform.openai.com/api-keys' },
    fields: [
      { id: 'api_key', label: 'API Key', sensitive: true, placeholder: 'sk-…', help: 'Same OpenAI key family used across transcription.' },
    ],
  },
  {
    id: 'deepgram',
    label: 'Deepgram',
    blurb: 'Fallback speech-to-text. Used when Whisper is unreachable.',
    link: { href: 'https://console.deepgram.com', label: 'console.deepgram.com' },
    fields: [
      { id: 'api_key', label: 'API Key', sensitive: true, placeholder: 'dg-…' },
    ],
  },
];

// ─── Small helpers ────────────────────────────────────────────
function useBackendPresent() {
  // window.api.credentials is injected by http-client.jsx once it has
  // successfully probed GET /api/health. Because that probe is async,
  // this page may mount BEFORE the probe resolves — so we subscribe
  // to the ready/offline events and re-render.
  const [present, setPresent] = React.useState(
    !!(window.api && window.api.credentials)
  );
  React.useEffect(() => {
    const onReady   = () => setPresent(!!(window.api && window.api.credentials));
    const onOffline = () => setPresent(false);
    window.addEventListener('api:http-ready', onReady);
    window.addEventListener('api:http-offline', onOffline);
    // One late-check in case the event fired before we mounted
    if (!present && window.API_HTTP_READY) setPresent(true);
    return () => {
      window.removeEventListener('api:http-ready', onReady);
      window.removeEventListener('api:http-offline', onOffline);
    };
  }, [present]);
  return present;
}

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
}

// ─── The page ─────────────────────────────────────────────────
function CredentialsPage(){
  const backendPresent = useBackendPresent();
  const [payload, setPayload] = React.useState(null); // { services: {svc: [fieldRow...]}, catalogue }
  const [err, setErr] = React.useState(null);
  const [savingService, setSavingService] = React.useState(null);
  const [drafts, setDrafts] = React.useState({});         // { 'svc.field': 'new value' }
  const [rotating, setRotating] = React.useState({});     // { 'svc.field': true }
  const [testing, setTesting] = React.useState({});       // { svcId: true } while POST in flight
  const [testResult, setTestResult] = React.useState({}); // { svcId: { ok, detail, latency_ms, tested_at, code? } }

  const load = React.useCallback(async () => {
    if (!backendPresent) return;
    try {
      const res = await window.api.credentials.list();
      setPayload(res);
      setErr(null);
    } catch (e) { setErr(e); }
  }, [backendPresent]);

  React.useEffect(() => { load(); }, [load]);

  const setDraft = (key, val) => setDrafts(d => ({ ...d, [key]: val }));
  const clearDraft = (keys) => setDrafts(d => {
    const next = { ...d };
    keys.forEach(k => delete next[k]);
    return next;
  });
  const toggleRotate = (key, on) => setRotating(r => ({ ...r, [key]: on }));

  const save = async (svc) => {
    // Split touched fields into:
    //   • rotations  — present + currently in rotate mode → real rotate() call
    //                  (verify+revert via the live tester)
    //   • updates    — first-time set or non-rotation edits → plain update()
    const rotations = [];
    const updates = {};
    const touchedKeys = [];
    for (const f of svc.fields) {
      const key = `${svc.id}.${f.id}`;
      const v = drafts[key];
      if (v == null || v === '') continue;
      touchedKeys.push(key);
      const isRotation = rotating[key] && (svc.fields.find(x=>x.id===f.id)
        // present-check uses the live row from `payload`
        ? (payload?.services?.[svc.id] || []).find(r => r.field === f.id)?.present
        : false);
      if (isRotation) rotations.push({ field: f.id, value: v });
      else updates[f.id] = v;
    }
    if (rotations.length === 0 && Object.keys(updates).length === 0) return;

    setSavingService(svc.id);
    try {
      // 1. Updates first (cheap path, no live probe)
      if (Object.keys(updates).length) {
        await window.api.credentials.update(svc.id, updates);
      }
      // 2. Rotations — sequential so a failure on one doesn't poison the next
      const rotResults = [];
      for (const r of rotations) {
        try {
          const out = await window.api.credentials.rotate(svc.id, r.field, r.value, { verify: true });
          rotResults.push({ field: r.field, ...out });
        } catch (e) {
          rotResults.push({ field: r.field, ok: false, reverted: false,
                            test: null, error: e.message || String(e), code: e.code });
        }
      }
      clearDraft(touchedKeys);
      setRotating(r => { const n = { ...r }; touchedKeys.forEach(k => delete n[k]); return n; });
      await load();

      // 3. Surface results — one notif per rotation, one summary for plain updates.
      if (Object.keys(updates).length) {
        window.Notifications?.emit({
          kind:'ok', source:'auth',
          title:`${svc.label} · ${Object.keys(updates).length} field${Object.keys(updates).length>1?'s':''} saved`,
          detail:'Encrypted at rest. Audit written.',
        });
      }
      for (const rr of rotResults) {
        if (rr.error) {
          window.Notifications?.emit({
            kind:'error', source:'auth',
            title:`${svc.label}.${rr.field} · rotation error`,
            detail: rr.error,
          });
        } else if (rr.ok && !rr.reverted) {
          window.Notifications?.emit({
            kind:'ok', source:'auth',
            title:`${svc.label}.${rr.field} · rotated · live test passed`,
            detail:`prev …${rr.prev_last4 || '????'} → new …${rr.new_last4} · ${rr.test?.latency_ms ?? '?'}ms · audit written`,
          });
        } else {
          // Server auto-reverted to the previous value; the system is still working.
          window.Notifications?.emit({
            kind:'warn', source:'auth',
            title:`${svc.label}.${rr.field} · rotation REVERTED`,
            detail:`New key failed live test (${rr.test?.code || rr.test?.detail || 'no detail'}). Previous value restored. System remains operational.`,
          });
        }
      }
    } catch (e) {
      window.Notifications?.emit({
        kind:'error', source:'auth', title:`${svc.label} save failed`,
        detail: e.message || String(e),
      });
    } finally {
      setSavingService(null);
    }
  };

  const remove = async (svc, field) => {    try {
      await window.api.credentials.remove(svc.id, field.id);
      await load();
      window.Notifications?.emit({
        kind:'warn', source:'auth', title:`${svc.label} · ${field.label} removed`,
        detail:'Credential cleared from vault. Audit written.',
      });
    } catch (e) {
      window.Notifications?.emit({
        kind:'error', source:'auth', title:`Remove failed`,
        detail: e.message || String(e),
      });
    }
  };

  const runTest = async (svc) => {
    setTesting(t => ({ ...t, [svc.id]: true }));
    try {
      const res = await window.api.credentials.test(svc.id);
      setTestResult(r => ({ ...r, [svc.id]: res }));
      window.Notifications?.emit({
        kind: res.ok ? 'ok' : 'error',
        source: 'auth',
        title: `${svc.label} · ${res.ok ? 'connection OK' : 'test failed'}`,
        detail: `${res.detail || ''} · ${res.latency_ms}ms · audit written`,
      });
    } catch (e) {
      setTestResult(r => ({ ...r, [svc.id]: { ok:false, detail: e.message || String(e), code: e.code, latency_ms: 0, tested_at: new Date().toISOString() } }));
      window.Notifications?.emit({
        kind:'error', source:'auth',
        title:`${svc.label} · test error`,
        detail: e.message || String(e),
      });
    } finally {
      setTesting(t => ({ ...t, [svc.id]: false }));
    }
  };

  // Header (same state regardless of backend presence)
  const health = window.API_HTTP_HEALTH;
  const apiBase = window.API_BASE;
  const header = (
    <div className="admin-head">
      <div className="admin-title">Credentials</div>
      <div className="admin-sub">
        Stored encrypted (AES-256-GCM) in the server vault. Secrets are never echoed back in full —
        the server returns only the last 4 characters once saved. Rotate replaces the stored value;
        remove clears it.
      </div>
      {backendPresent && health && (
        <div className="hstack" style={{gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center'}}>
          <span className="tag ok">HTTP ADAPTER · LIVE</span>
          <span className="muted" style={{fontSize:11, fontFamily:'ui-monospace, monospace'}}>
            {apiBase}
          </span>
          {health.wiring && Object.entries(health.wiring).map(([k,v]) => (
            <span key={k} className={'tag ' + (v ? 'ok' : '')} style={{fontSize:10}}>
              {k}: {v ? 'on' : 'off'}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (!backendPresent) {
    return (
      <div className="admin-page">
        {header}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Backend unavailable</div>
            <span className="tag warn">BACKEND PENDING</span>
          </div>
          <div className="card-body vstack" style={{gap:10}}>
            <div className="muted">
              The credential store runs on the Node backend. Until that connection is active,
              this page is read-only and no keys can be saved here.
            </div>
            <div className="muted">
              Next step: run the server locally (see <code>server/README.md</code>), then the UI
              adapter swap will wire this page to <code>PUT /api/credentials/:service</code>.
            </div>
            <div className="hstack" style={{gap:8, marginTop:4, flexWrap:'wrap'}}>
              <span className="tag">GET /api/credentials</span>
              <span className="tag">PUT /api/credentials/:service</span>
              <span className="tag">DELETE /api/credentials/:service/:field</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="admin-page">
        {header}
        <div className="card">
          <div className="card-head"><div className="card-title">Couldn't reach credential store</div></div>
          <div className="card-body"><pre className="muted" style={{whiteSpace:'pre-wrap'}}>{err.message || String(err)}</pre></div>
        </div>
      </div>
    );
  }

  if (!payload) {
    return <div className="admin-page">{header}<div className="card"><div className="card-body muted">Loading…</div></div></div>;
  }

  const services = payload.services || {};

  return (
    <div className="admin-page">
      {header}

      <div className="vstack" style={{gap:14}}>
        {CRED_SERVICES.map(svc => {
          const rows = services[svc.id] || [];
          const byField = Object.fromEntries(rows.map(r => [r.field, r]));
          const anyPresent = rows.some(r => r.present && !rows.find(f => f.field === r.field && !f.present));
          const allPresent = svc.fields.filter(f => !f.optional).every(f => byField[f.id]?.present);
          const someMissing = svc.fields.filter(f => !f.optional).some(f => !byField[f.id]?.present);

          const statusChip = allPresent
            ? <span className="tag ok">STORED</span>
            : someMissing
              ? <span className="tag warn">INCOMPLETE</span>
              : <span className="tag">EMPTY</span>;

          const hasDirty = svc.fields.some(f => {
            const v = drafts[`${svc.id}.${f.id}`];
            return v != null && v !== '';
          });

          return (
            <div key={svc.id} className="card">
              <div className="card-head">
                <div className="vstack" style={{gap:4}}>
                  <div className="card-title">{svc.label} {statusChip}</div>
                  <div className="muted" style={{fontSize:12}}>{svc.blurb}</div>
                </div>
                {svc.link && (
                  <a className="muted" href={svc.link.href} target="_blank" rel="noreferrer" style={{fontSize:12}}>
                    {svc.link.label} ↗
                  </a>
                )}
              </div>

              <div className="card-body vstack" style={{gap:12}}>
                {svc.fields.map(f => {
                  const row = byField[f.id] || { present: false };
                  const draftKey = `${svc.id}.${f.id}`;
                  const isRotating = !!rotating[draftKey];
                  const showInput = !row.present || isRotating;
                  const draftVal = drafts[draftKey] ?? '';

                  return (
                    <div key={f.id} className="vstack" style={{gap:4}}>
                      <div className="hstack" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                        <label style={{fontSize:12, fontWeight:600, color:'var(--fg-1)'}}>
                          {f.label}
                          {f.optional ? <span className="muted" style={{fontWeight:400, marginLeft:6}}>optional</span> : null}
                        </label>
                        {row.present && (
                          <span className="muted" style={{fontSize:11}}>
                            updated {fmtWhen(row.updated_at)}{row.updated_by ? ` by ${row.updated_by}` : ''}
                          </span>
                        )}
                      </div>

                      {!showInput && row.present && (
                        <div className="hstack" style={{gap:8, alignItems:'center'}}>
                          <code className="cred-masked">{row.masked}</code>
                          <button className="btn sm" onClick={() => toggleRotate(draftKey, true)}>
                            Rotate
                          </button>
                          <button className="btn sm danger" onClick={() => remove(svc, f)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {showInput && (
                        <div className="hstack" style={{gap:8, alignItems:'center'}}>
                          <input
                            className="input"
                            type={f.sensitive ? 'password' : 'text'}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={f.placeholder || ''}
                            value={draftVal}
                            onChange={(e) => setDraft(draftKey, e.target.value)}
                            style={{flex:1, fontFamily: f.sensitive ? 'ui-monospace, monospace' : 'inherit'}}
                          />
                          {row.present && isRotating && (
                            <button className="btn sm" onClick={() => { toggleRotate(draftKey, false); clearDraft([draftKey]); }}>
                              Cancel
                            </button>
                          )}
                        </div>
                      )}

                      {f.help && <div className="muted" style={{fontSize:11}}>{f.help}</div>}
                    </div>
                  );
                })}

                {testResult[svc.id] && (
                  <div className="hstack" style={{gap:8, alignItems:'center', flexWrap:'wrap'}}>
                    <span className={'tag ' + (testResult[svc.id].ok ? 'ok' : 'warn')}>
                      {testResult[svc.id].ok ? 'LAST TEST · PASS' : 'LAST TEST · FAIL'}
                    </span>
                    <span className="muted" style={{fontSize:11}}>
                      {testResult[svc.id].detail || '—'}
                    </span>
                    <span className="muted" style={{fontSize:11}}>
                      · {testResult[svc.id].latency_ms}ms · {fmtWhen(testResult[svc.id].tested_at)}
                      {testResult[svc.id].code ? ` · ${testResult[svc.id].code}` : ''}
                    </span>
                  </div>
                )}
                <div className="hstack" style={{gap:8, justifyContent:'flex-end', marginTop:4}}>
                  <button
                    className="btn sm"
                    disabled={!!testing[svc.id] || !allPresent}
                    title={!allPresent
                      ? 'Save all required credentials before testing.'
                      : 'Makes a read-only probe to the provider. Writes to audit either way.'}
                    onClick={() => runTest(svc)}
                  >
                    {testing[svc.id] ? 'Testing…' : 'Test connection'}
                  </button>
                  <button
                    className="btn sm primary"
                    disabled={!hasDirty || savingService === svc.id}
                    onClick={() => save(svc)}
                  >
                    {savingService === svc.id ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="card-head">
          <div className="card-title">How this is stored</div>
        </div>
        <div className="card-body vstack" style={{gap:6}}>
          <div className="muted" style={{fontSize:12}}>
            Values are encrypted with AES-256-GCM using <code>CREDENTIALS_MASTER_KEY</code> from the
            server environment. The plaintext is only decrypted inside the Node process when a
            request to the corresponding provider is made. The server never returns raw values
            over HTTP — only last-4 previews.
          </div>
          <div className="muted" style={{fontSize:12}}>
            Every save, rotate, and remove writes to <code>audit_events</code> with
            <code> severity = security</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CredentialsPage });
