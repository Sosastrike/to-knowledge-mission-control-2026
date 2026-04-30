// ============================================================
// src/login-page.jsx — session-auth login surface.
//
// Mounts as a self-contained overlay (z-index above everything).
// Renders only when window.SHOW_LOGIN === true OR the user explicitly
// hits Settings → Account → Sign in. We deliberately do NOT make this
// a hard gate over the entire app — that would break the existing
// localStorage-only mode that the offline UI still depends on. Instead:
//
//   • If window.api.session.isAuthenticated() returns true → render
//     a compact "Signed in as <email>" badge in the top-right.
//   • If not → render a "Sign in" button in the same slot.
//   • Both expose <LoginPage/> as a modal overlay when clicked.
//
// The page calls window.api.session.login(email, password) which
// stores the session token (see src/backend/http-client.jsx) and
// dispatches `auth:logged-in`. We listen for that event to dismiss
// the overlay and refresh `whoami` for the badge.
//
// On `auth:session-expired` (server returned 401 SESSION_INVALID),
// we auto-open the overlay so the user can re-authenticate without
// losing their place.
// ============================================================
(function() {
  function LoginOverlay({ onClose, reason }) {
    const [email, setEmail] = React.useState(localStorage.getItem('tkmc.last_email') || '');
    const [pw, setPw] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const [attemptsRemaining, setAttemptsRemaining] = React.useState(null);

    const submit = async (e) => {
      e?.preventDefault?.();
      if (!email || !pw) { setErr('Email + password required'); return; }
      if (!window.api?.session?.login) {
        setErr('HTTP backend not reachable. Start the server (cd server && npm start) or use legacy bearer.');
        return;
      }
      setLoading(true); setErr(null); setAttemptsRemaining(null);
      try {
        const out = await window.api.session.login(email, pw);
        localStorage.setItem('tkmc.last_email', email);
        // login() already fires 'auth:logged-in' and stores the token.
        onClose && onClose({ ok: true, user: out.user });
      } catch (e) {
        // Honest, server-reported errors only.
        const code = e.code || e.body?.error || 'ERROR';
        const msg = e.body?.message || e.message || 'Login failed';
        if (code === 'INVALID_CREDENTIALS') {
          setErr('Invalid email or password.');
          if (e.body?.attempts_remaining != null) setAttemptsRemaining(e.body.attempts_remaining);
        } else if (code === 'ACCOUNT_LOCKED') {
          setErr(`Account locked until ${new Date(e.body.locked_until).toLocaleTimeString()}. Try again later.`);
        } else if (code === 'PASSWORD_NOT_SET') {
          setErr('No password is set for this account. Ask an admin to provision one.');
        } else if (code === 'ACCOUNT_DISABLED') {
          setErr('Account is disabled.');
        } else if (code === 'AGENT_ACCOUNT_NOT_HUMAN') {
          setErr('That email belongs to an agent. Agents cannot sign in.');
        } else {
          setErr(`${code}: ${msg}`);
        }
      } finally {
        setLoading(false);
      }
    };

    return (
      <div style={loginStyles.scrim} onClick={(e)=>{ if (e.target === e.currentTarget) onClose && onClose({ok:false}); }}>
        <div style={loginStyles.card} role="dialog" aria-modal="true">
          <div style={loginStyles.head}>
            <div style={loginStyles.brandDot} />
            <div>
              <div style={loginStyles.title}>To-Knowledge Mission Control</div>
              <div style={loginStyles.sub}>Sign in to your workspace</div>
            </div>
          </div>

          {reason === 'expired' && (
            <div style={loginStyles.warn}>Your session expired. Sign in again to continue.</div>
          )}

          <form onSubmit={submit}>
            <label style={loginStyles.label}>Email</label>
            <input
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              autoComplete="email" autoFocus required
              style={loginStyles.input}
              placeholder="you@toknowledge.ai"
            />

            <label style={loginStyles.label}>Password</label>
            <input
              type="password" value={pw} onChange={e=>setPw(e.target.value)}
              autoComplete="current-password" required
              style={loginStyles.input}
              placeholder="••••••••"
            />

            {err && (
              <div style={loginStyles.err}>
                {err}
                {attemptsRemaining != null && (
                  <span style={{opacity:0.75, marginLeft:6}}>· {attemptsRemaining} attempts remaining</span>
                )}
              </div>
            )}

            <div style={loginStyles.row}>
              <button
                type="submit" disabled={loading}
                style={{ ...loginStyles.btnPrimary, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button" onClick={()=>onClose && onClose({ok:false})}
                style={loginStyles.btnGhost}
              >Cancel</button>
            </div>
          </form>

          <div style={loginStyles.foot}>
            <div>Sessions expire after {(window.SESSION_TTL_HOURS || 168)/24} days · idle timeout 3 days.</div>
            <div style={{opacity:0.6, marginTop:4}}>Forgot your password? Ask an admin to reset it (no public reset flow yet).</div>
          </div>
        </div>
      </div>
    );
  }

  function SessionBadge() {
    const [user, setUser] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    const [reason, setReason] = React.useState(null);

    const refreshWhoami = React.useCallback(async () => {
      if (!window.api?.session) return;
      if (!window.api.session.isAuthenticated()) { setUser(null); return; }
      try { const me = await window.api.session.whoami(); setUser(me); }
      catch { setUser(null); }
    }, []);

    React.useEffect(() => {
      refreshWhoami();
      const onLogin = () => { setOpen(false); refreshWhoami(); };
      const onLogout = () => { setUser(null); };
      const onExpired = () => { setUser(null); setReason('expired'); setOpen(true); };
      window.addEventListener('auth:logged-in', onLogin);
      window.addEventListener('auth:logged-out', onLogout);
      window.addEventListener('auth:session-expired', onExpired);
      // Also refresh when the HTTP adapter comes online after a delayed server start.
      window.addEventListener('api:http-ready', refreshWhoami);
      return () => {
        window.removeEventListener('auth:logged-in', onLogin);
        window.removeEventListener('auth:logged-out', onLogout);
        window.removeEventListener('auth:session-expired', onExpired);
        window.removeEventListener('api:http-ready', refreshWhoami);
      };
    }, [refreshWhoami]);

    const signOut = async () => {
      try { await window.api.session.logout(); } catch { /* ignore */ }
      setUser(null);
    };

    if (!user) {
      return (
        <>
          <button
            onClick={() => { setReason(null); setOpen(true); }}
            style={loginStyles.signInBtn}
            title="Sign in with your workspace credentials"
          >Sign in</button>
          {open && <LoginOverlay reason={reason} onClose={() => setOpen(false)} />}
        </>
      );
    }

    const role = user.role || 'viewer';
    const roleColor =
      role === 'owner'   ? '#86efac' :
      role === 'admin'   ? '#93c5fd' :
      role === 'manager' ? '#fcd34d' :
                           '#cbd5e1';

    return (
      <>
        <div style={loginStyles.badge} title={`${user.email} · ${role}`}>
          <span style={{ ...loginStyles.dot, background: roleColor }} />
          <span style={{ marginRight: 6 }}>{user.name || user.email.split('@')[0]}</span>
          <span style={{ opacity: 0.6, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{role}</span>
          <button
            onClick={signOut}
            style={loginStyles.signOutBtn}
            title="Sign out and revoke this session"
          >Sign out</button>
        </div>
        {open && <LoginOverlay reason={reason} onClose={() => setOpen(false)} />}
      </>
    );
  }

  const loginStyles = {
    scrim: {
      position: 'fixed', inset: 0, background: 'rgba(8, 12, 24, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000,
    },
    card: {
      width: 380, padding: 24, borderRadius: 14,
      background: 'linear-gradient(180deg, #0e1629 0%, #0a1120 100%)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
      color: '#e6edf6',
      fontFamily: 'inherit',
    },
    head: { display:'flex', gap:12, alignItems:'center', marginBottom:20 },
    brandDot: {
      width:32, height:32, borderRadius:8,
      background:'radial-gradient(circle at 30% 30%, var(--accent, #7dd3fc), var(--accent-2, #2563eb))',
      boxShadow:'0 0 16px rgba(125,211,252,0.4)',
    },
    title: { fontSize:14, fontWeight:600, letterSpacing:0.3 },
    sub:   { fontSize:11, opacity:0.65, marginTop:2 },
    label: { display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:0.6, opacity:0.65, marginBottom:6, marginTop:14 },
    input: {
      width:'100%', boxSizing:'border-box',
      padding:'10px 12px', fontSize:13,
      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(148,163,184,0.18)',
      borderRadius:8, color:'#e6edf6', outline:'none',
      fontFamily:'inherit',
    },
    err: {
      marginTop:14, padding:'8px 12px', borderRadius:6, fontSize:12,
      background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)',
      color:'#fca5a5',
    },
    warn: {
      marginBottom:14, padding:'8px 12px', borderRadius:6, fontSize:12,
      background:'rgba(251,191,36,0.10)', border:'1px solid rgba(251,191,36,0.30)',
      color:'#fcd34d',
    },
    row: { display:'flex', gap:10, marginTop:18 },
    btnPrimary: {
      flex:1, padding:'10px 14px', fontSize:12, fontWeight:600,
      background:'var(--accent, #38bdf8)', color:'#04101f',
      border:'none', borderRadius:8, cursor:'pointer',
      letterSpacing:0.3,
    },
    btnGhost: {
      padding:'10px 14px', fontSize:12,
      background:'transparent', color:'#94a3b8',
      border:'1px solid rgba(148,163,184,0.22)', borderRadius:8, cursor:'pointer',
    },
    foot: { marginTop:18, paddingTop:14, borderTop:'1px solid rgba(148,163,184,0.12)', fontSize:11, opacity:0.65 },
    signInBtn: {
      padding:'5px 10px', fontSize:11, fontWeight:600,
      background:'var(--accent, #38bdf8)', color:'#04101f',
      border:'none', borderRadius:6, cursor:'pointer',
      letterSpacing:0.3,
    },
    badge: {
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'4px 6px 4px 10px', fontSize:11,
      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(148,163,184,0.18)',
      borderRadius:999, color:'#e6edf6',
    },
    dot: { width:7, height:7, borderRadius:'50%', display:'inline-block' },
    signOutBtn: {
      marginLeft:8, padding:'3px 8px', fontSize:10,
      background:'transparent', color:'#94a3b8',
      border:'1px solid rgba(148,163,184,0.22)', borderRadius:999, cursor:'pointer',
    },
  };

  Object.assign(window, { LoginOverlay, SessionBadge });
})();
