// ============================================================
// Notification Bus — ONE source of truth for notifications.
//
// HONESTY CONTRACT:
//   - Only REAL events the app itself emits end up here.
//   - Nothing pre-seeded, nothing faked, no "simulated" incoming alerts.
//   - Count badge reflects actual unread entries or is hidden entirely.
//   - Persists to localStorage so refreshes don't silently lose state.
//
// Anyone in the app can call window.Notifications.emit({...})
// and the Bell will pick it up.
// ============================================================

(function(){
  const KEY = 'tkmc.notifications.v1';
  const MAX = 200;
  const bus = new EventTarget();

  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function save(list){
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch(e){}
  }

  let _list = load();

  function snapshot(){ return _list.slice(); }
  function unreadCount(){ return _list.filter(n => !n.read).length; }

  function emit(entry){
    if (!entry || !entry.title) return;
    const n = {
      id: 'n_' + Math.random().toString(36).slice(2, 10),
      t: new Date().toISOString(),
      read: false,
      kind: entry.kind || 'info',         // info | ok | warn | err
      source: entry.source || 'system',   // meetings | auth | email | agents | brain | system
      title: entry.title,
      detail: entry.detail || '',
      // Optional action: { label, pageRoute } — router destination within shell
      action: entry.action || null,
    };
    _list = [n, ..._list].slice(0, MAX);
    save(_list);
    bus.dispatchEvent(new CustomEvent('change', { detail: { reason: 'emit', entry: n } }));
    return n;
  }

  function markRead(id){
    let changed = false;
    _list = _list.map(n => {
      if (n.id === id && !n.read) { changed = true; return { ...n, read: true }; }
      return n;
    });
    if (changed) {
      save(_list);
      bus.dispatchEvent(new CustomEvent('change', { detail: { reason: 'read' } }));
    }
  }

  function markAllRead(){
    if (_list.every(n => n.read)) return;
    _list = _list.map(n => ({ ...n, read: true }));
    save(_list);
    bus.dispatchEvent(new CustomEvent('change', { detail: { reason: 'read-all' } }));
  }

  function clearAll(){
    _list = [];
    save(_list);
    bus.dispatchEvent(new CustomEvent('change', { detail: { reason: 'clear' } }));
  }

  function subscribe(fn){
    const handler = () => fn();
    bus.addEventListener('change', handler);
    return () => bus.removeEventListener('change', handler);
  }

  window.Notifications = { emit, markRead, markAllRead, clearAll, snapshot, unreadCount, subscribe };
})();
