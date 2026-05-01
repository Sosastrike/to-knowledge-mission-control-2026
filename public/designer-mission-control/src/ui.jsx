// Reusable UI primitives

const Tag = ({ kind, children }) => (
  <span className={`tag ${kind || ''}`}>{children}</span>
);

const StatusDot = ({ s }) => {
  const cls = s === 'live' || s === 'ok' || s === 'active' || s === 'healthy' || s === 'valid' || s === 'complete' ? 'ok'
    : s === 'warn' || s === 'degraded' || s === 'review' || s === 'idle' || s === 'assigned' ? 'warn'
    : s === 'offline' || s === 'err' || s === 'broken' ? 'err'
    : 'muted';
  return <span className={`dot ${cls}`} />;
};

const Progress = ({ value, kind }) => (
  <div className="progress" style={{width:'100%'}}>
    <div className={`fill ${kind||''}`} style={{width: `${Math.min(100, value)}%`}} />
  </div>
);

const ChanChip = ({ code, size = 22 }) => {
  const m = window.CHANNEL_META[code] || { name: code, color: '#888', glyph: code };
  return (
    <span className="chan-chip" title={m.name}
          style={{width:size, height:size, color: m.color === '#ffffff' ? '#fff' : m.color, fontSize: size<=22?10:12, fontWeight:600}}>
      {m.glyph}
    </span>
  );
};

const ChanStack = ({ codes }) => (
  <span className="chan-stack">{codes.map(c => <ChanChip key={c} code={c} />)}</span>
);

const Avatar = ({ name, size = 22 }) => {
  const initials = name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  // Deterministic hue from name
  let hue = 0; for (const c of name) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{
      width:size, height:size, fontSize: size*0.45,
      background: `linear-gradient(135deg, oklch(0.7 0.14 ${hue}), oklch(0.55 0.18 ${(hue+60)%360}))`
    }}>{initials}</span>
  );
};

const Switch = ({ on, onToggle }) => (
  <span className={`switch ${on?'on':''}`} onClick={e=>{e.stopPropagation(); onToggle && onToggle(!on);}} />
);

const Sparkline = ({ data, w=120, h=28, stroke='var(--accent)' }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const r = max - min || 1;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h - ((v-min)/r)*h}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  const gid = 'g' + Math.random().toString(36).slice(2,7);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={stroke} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

// Simple interactive button group
const ButtonGroup = ({ value, onChange, options }) => (
  <div className="filter-row">
    {options.map(o => (
      <div key={o.value} className={`filter-pill ${value===o.value?'on':''}`} onClick={()=>onChange(o.value)}>
        {o.label}{o.count !== undefined && <span className="count">{o.count}</span>}
      </div>
    ))}
  </div>
);

// Mock-data badge — shown next to any status that is not backed by a real API
const MockBadge = ({ size, label, title }) => (
  <span className={`mock-badge${size==='sm'?' sm':''}`} title={title || 'Demo data — not wired to a real backend'}>
    {label || 'mock'}
  </span>
);

// Not-wired pill — stronger signal for disabled/unavailable actions
const NotWiredBadge = ({ label, title }) => (
  <span className="mock-badge" style={{background:'rgba(255,80,80,0.08)', borderColor:'rgba(255,80,80,0.28)', color:'oklch(0.78 0.15 20)'}}
        title={title || 'API not wired yet'}>
    {label || 'api not wired'}
  </span>
);

// Live-readiness banner — sticky under topbar, dismissible
function DemoBanner() {
  const [dismissed, setDismissed] = React.useState(() => sessionStorage.getItem('cc.liveReadOnlyBannerV3Dismissed') === '1');
  if (dismissed) return null;
  return (
    <div className="demo-banner">
      <I.Info size={13} style={{color:'oklch(0.82 0.14 85)', flexShrink:0}}/>
      <div className="demo-banner-main">
        <span>
          <b style={{color:'var(--fg-0)'}}>Live read-only mode.</b> Status data is live. Execution approvals go through <b>Tony in Telegram</b> with Approve/Deny buttons. Mission Control shows status and history only; broad protected writes stay locked as <code>OWNER_APPROVAL_REQUIRED</code> or HTTP 423.
        </span>
        <div className="approval-system-status" role="status" aria-label="Approval system status">
          <div>
            <strong>Approval system status</strong>
            <span className="mock-badge">Read-only mirror</span>
          </div>
          <p>No approvals are approved from this screen. Active pending requests appear only when Tony sends a real Telegram Approve/Deny request.</p>
          <small>Completed, denied, expired, and failed approvals move to history instead of staying in the active queue.</small>
        </div>
      </div>
      <button className="close-x" onClick={()=>{ sessionStorage.setItem('cc.liveReadOnlyBannerV3Dismissed','1'); setDismissed(true); }} aria-label="Dismiss">✕</button>
    </div>
  );
}

Object.assign(window, { Tag, StatusDot, Progress, ChanChip, ChanStack, Avatar, Switch, Sparkline, ButtonGroup, MockBadge, NotWiredBadge, DemoBanner });
