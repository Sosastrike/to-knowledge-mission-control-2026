// ============================================================
// Search / Command Palette — CLIENT-SIDE ONLY.
//
// HONESTY CONTRACT:
//   - Searches ONLY the local Mission Control data already in this page:
//     AGENTS, TICKETS, MEETINGS, SKILLS, CHANNELS, AUDIT, plus page/settings
//     navigation destinations.
//   - No backend call, no claim of global/knowledge-base search.
//   - Footer clearly labels scope: "Local only — knowledge-base search
//     requires backend wire-up."
//   - Opens with the top search bar click, / key, or ⌘K / Ctrl+K.
// ============================================================

function SearchCommand({ open, onClose, onNavigate }) {
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  // ─── Reset every open ──────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      setQ(''); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ─── Build results from real local data ────────────────────
  const results = React.useMemo(() => {
    if (!open) return [];
    const needle = q.trim().toLowerCase();
    const out = [];

    // Static navigation destinations (always visible when no query)
    const nav = [
      { kind:'page', title:'Mission Control',   sub:'Operational dashboard',        route:{ page:'mission' },    icon:'Mission' },
      { kind:'page', title:'Brain Sync',        sub:'Knowledge graph & sources',    route:{ page:'brain-sync' }, icon:'Brain' },
      { kind:'page', title:'Email & SMTP',      sub:'Sending profiles & routing',   route:{ page:'email-smtp' }, icon:'Mail' },
      { kind:'page', title:'Schedule',          sub:'Calendar & meetings lane',     route:{ overlay:'schedule' }, icon:'Schedule' },
      { kind:'page', title:'Tasks',             sub:'Work & ticket queue',          route:{ overlay:'tasks' }, icon:'FileLog' },
      { kind:'page', title:'Settings',          sub:'Workspace configuration',      route:{ overlay:'settings' }, icon:'Gear' },
    ];

    const matches = (s) => !needle || (s || '').toLowerCase().includes(needle);

    for (const n of nav) if (matches(n.title) || matches(n.sub)) out.push(n);

    // Agents
    for (const a of (window.AGENTS || [])) {
      if (matches(a.name) || matches(a.role) || matches(a.id) || matches(a.model)) {
        out.push({
          kind: 'agent',
          title: a.name,
          sub: `${a.role} · ${a.status}`,
          meta: a.model,
          route: { agentId: a.id },
          icon: 'Agents',
        });
      }
    }

    // Tickets
    for (const t of (window.TICKETS || [])) {
      if (matches(t.id) || matches(t.title) || matches(t.agent) || matches(t.lane)) {
        out.push({
          kind: 'ticket',
          title: t.title,
          sub: `${t.id} · ${t.lane} · ${t.status}`,
          meta: t.priority,
          route: { ticketId: t.id },
          icon: 'FileLog',
        });
      }
    }

    // Meetings
    for (const m of (window.MEETINGS || [])) {
      if (matches(m.id) || matches(m.title) || matches(m.host)) {
        out.push({
          kind: 'meeting',
          title: m.title,
          sub: `${m.id} · ${m.host} · ${m.status}`,
          meta: m.duration,
          route: { meetingId: m.id },
          icon: 'Meeting',
        });
      }
    }

    // Skills
    for (const s of (window.SKILLS || [])) {
      if (matches(s.name) || matches(s.id) || (s.deps || []).some(matches)) {
        out.push({
          kind: 'skill',
          title: s.name,
          sub: `v${s.version} · ${(s.deps||[]).join(', ')}`,
          meta: s.status,
          route: { overlay:'settings', settingsPage:'skills' },
          icon: 'Brain',
        });
      }
    }

    // Channels
    for (const c of (window.CHANNELS || [])) {
      if (matches(c.key) || matches(c.routing) || matches(c.assigned)) {
        out.push({
          kind: 'channel',
          title: c.key,
          sub: `Assigned: ${c.assigned} · ${c.routing}`,
          meta: c.health,
          route: { overlay:'settings', settingsPage:'channels' },
          icon: 'Hash',
        });
      }
    }

    // Recent audit (only when searching — noisy otherwise)
    if (needle) {
      for (const e of (window.AUDIT || []).slice(0, 50)) {
        if (matches(e.action) || matches(e.target) || matches(e.who) || matches(e.meta)) {
          out.push({
            kind: 'audit',
            title: e.action,
            sub: `${e.target} · ${e.who}`,
            meta: e.ts,
            route: { overlay:'settings', settingsPage:'audit' },
            icon: 'FileLog',
          });
        }
      }
    }

    // Cap to a reasonable number, prioritizing nav + exact-id hits
    return out.slice(0, 40);
  }, [q, open]);

  // Group results by kind for visual rhythm
  const grouped = React.useMemo(() => {
    const order = ['page','agent','ticket','meeting','skill','channel','audit'];
    const labels = {
      page:'Navigate', agent:'Agents', ticket:'Tickets', meeting:'Meetings',
      skill:'Skills', channel:'Channels', audit:'Audit log',
    };
    const out = [];
    for (const k of order) {
      const items = results.filter(r => r.kind === k);
      if (items.length > 0) out.push({ kind: k, label: labels[k], items });
    }
    return out;
  }, [results]);

  // Keyboard nav
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(results.length - 1, i + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'Enter')     {
        const r = results[idx];
        if (r) { pick(r); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, results, idx]);

  const pick = (r) => {
    onNavigate && onNavigate(r);
    onClose();
  };

  if (!open) return null;

  // Flat index (for keyboard nav across groups)
  const flat = grouped.flatMap(g => g.items);
  const activeId = flat[idx]?.title + flat[idx]?.sub;

  return (
    <>
      <div className="sc-overlay" onClick={onClose}/>
      <div className="sc-palette" role="dialog" aria-label="Command palette" onClick={e => e.stopPropagation()}>
        <div className="sc-input-row">
          <I.Search size={14}/>
          <input
            ref={inputRef}
            className="sc-input"
            placeholder="Search tickets, agents, meetings, settings…"
            value={q}
            onChange={e => { setQ(e.target.value); setIdx(0); }}
          />
          <span className="sc-esc">esc</span>
        </div>

        <div className="sc-results">
          {flat.length === 0 ? (
            <div className="sc-empty">
              {q.trim()
                ? <>No matches in local data for <b>"{q}"</b>.</>
                : <>Start typing to search agents, tickets, meetings, skills, channels, and settings.</>
              }
            </div>
          ) : grouped.map(group => (
            <div key={group.kind} className="sc-group">
              <div className="sc-group-label">{group.label}</div>
              {group.items.map(r => {
                const IconCmp = I[r.icon] || I.Dot;
                const isActive = (r.title + r.sub) === activeId;
                return (
                  <button
                    key={r.kind + '_' + r.title + '_' + (r.sub||'')}
                    className={`sc-row ${isActive ? 'active' : ''}`}
                    onMouseEnter={() => setIdx(flat.indexOf(r))}
                    onClick={() => pick(r)}>
                    <span className={`sc-icon sc-icon-${r.kind}`}><IconCmp size={13}/></span>
                    <span className="sc-title">{r.title}</span>
                    <span className="sc-sub">{r.sub}</span>
                    {r.meta && <span className="sc-meta">{r.meta}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sc-foot">
          <div className="sc-foot-keys">
            <span><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
            <span><span className="kbd">↵</span> open</span>
            <span><span className="kbd">esc</span> close</span>
          </div>
          <div className="sc-foot-honest">
            <I.Info size={11}/>
            <span>Local only · knowledge-base search requires backend wire-up</span>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SearchCommand });
