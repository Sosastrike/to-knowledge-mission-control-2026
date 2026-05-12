// ============================================================
// Notifications Drawer — real events only.
//
// HONESTY CONTRACT:
//   - Shows only entries from window.Notifications (the bus).
//   - No seeded "3 new alerts". Empty state is honest.
//   - Unread badge on the bell reflects REAL unread count or is hidden.
//   - Navigation actions route via the callback; if an action can't be
//     honored (destination not available), we say so instead of pretending.
// ============================================================

function useNotificationsStore(){
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!window.Notifications) return;
    const unsub = window.Notifications.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);
  const list = window.Notifications ? window.Notifications.snapshot() : [];
  const unread = window.Notifications ? window.Notifications.unreadCount() : 0;
  return { list, unread, tick };
}

function NotifBell({ onOpen }) {
  const { unread } = useNotificationsStore();
  const label = unread > 0 ? `Open notifications, ${unread} unread` : 'Open notifications';
  return (
    <button type="button" className="icon-btn notif-bell" title={unread > 0 ? `${unread} unread notification${unread===1?'':'s'}` : 'Notifications'} aria-label={label} onClick={onOpen}>
      <I.Bell size={15}/>
      {unread > 0 && (
        <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
      )}
    </button>
  );
}

function NotificationsDrawer({ open, onClose, onNavigate }) {
  const { list, unread } = useNotificationsStore();

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const handleItem = (n) => {
    window.Notifications?.markRead(n.id);
    if (n.action?.route) {
      onNavigate && onNavigate(n.action.route);
      onClose();
    }
  };

  return (
    <>
      <div className="nd-overlay" onClick={onClose}/>
      <aside className="nd-drawer" role="dialog" aria-label="Notifications" onClick={e=>e.stopPropagation()}>
        <header className="nd-head">
          <div className="nd-head-left">
            <I.Bell size={15}/>
            <div>
              <div className="nd-title">Notifications</div>
              <div className="nd-sub">
                {unread > 0 ? `${unread} unread` : 'All caught up'} · <b>Real events only</b>
              </div>
            </div>
          </div>
          <div className="nd-head-actions">
            {unread > 0 && (
              <button className="nd-btn-ghost" onClick={()=>window.Notifications?.markAllRead()}>
                Mark all read
              </button>
            )}
            {list.length > 0 && (
              <button className="nd-btn-ghost nd-btn-danger" onClick={()=>window.Notifications?.clearAll()}>
                Clear
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close notifications"><I.X size={14}/></button>
          </div>
        </header>

        <div className="nd-honest">
          <I.Info size={11}/>
          <span>Only real events emitted by this Mission Control show here. No simulated alerts, no pre-seeded messages.</span>
        </div>

        <div className="nd-body">
          {list.length === 0 ? (
            <div className="nd-empty">
              <div className="nd-empty-icon"><I.Bell size={22}/></div>
              <div className="nd-empty-head">No notifications yet</div>
              <div className="nd-empty-body">
                When you connect a provider, draft a meeting, change a permission, or an agent reports an issue,
                it will appear here. Nothing is pre-filled.
              </div>
            </div>
          ) : (
            <ul className="nd-list">
              {list.map(n => (
                <li key={n.id} className={`nd-row nd-${n.kind} ${n.read ? 'read' : 'unread'} ${n.action ? 'clickable' : ''}`}
                    onClick={() => handleItem(n)}>
                  <span className={`nd-dot nd-dot-${n.kind}`}/>
                  <div className="nd-content">
                    <div className="nd-row-head">
                      <span className="nd-row-title">{n.title}</span>
                      <span className="nd-row-src">{n.source}</span>
                    </div>
                    {n.detail && <div className="nd-row-detail">{n.detail}</div>}
                    <div className="nd-row-foot">
                      <span className="nd-time">{ndRelativeTime(n.t)}</span>
                      {n.action?.label && (
                        <span className="nd-action-hint">{n.action.label} →</span>
                      )}
                    </div>
                  </div>
                  {!n.read && <span className="nd-unread-mark"/>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function ndRelativeTime(iso){
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 45_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h ago`;
    const d = new Date(iso);
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  } catch(e){ return ''; }
}

Object.assign(window, { NotifBell, NotificationsDrawer });
