/* global React */
/* ============================================================
   GatewayShell — Mission Control component for Gateway sprint
   ============================================================
   Mounts the approved Gateway design files INSIDE Mission Control
   as iframes so the visuals match the design pixel-for-pixel.

   No re-implementation. The design IS the production page.
   To wire real data later, replace design/gateway/shared/agent-data.js
   with an API-backed version that assigns to window.AGENTS.

   Sub-tabs (left rail of Gateway surface):
   - Overview        → design/gateway/Gateway Overview.html (Nucleus)
   - Agent Hub       → design/gateway/Agent Hub.html
   - Paperclip       → design/gateway/Paperclip.html (drill-down)
   - Dispatcher      → design/gateway/Dispatcher.html
   - Token Governor  → design/gateway/Token Governor.html
   - Bridge Session  → design/gateway/Bridge Session Flow.html
   - Health          → design/gateway/Gateway Health.html
   - Routes          → design/gateway/Gateway Routes.html
   - Registry        → design/gateway/Gateway Registry.html
   - Policies        → design/gateway/Gateway Policies.html
   ============================================================ */

const GATEWAY_TABS = [
  { id: 'overview',   label: 'Overview',           src: '/design/gateway/Gateway Overview.html',     hint: 'Nucleus — primary' },
  { id: 'agent-hub',  label: 'Agent Hub',          src: '/design/gateway/Agent Hub.html',            hint: '6 agents' },
  { id: 'paperclip',  label: 'Paperclip',          src: '/design/gateway/Paperclip.html',            hint: 'Workforce Control Plane' },
  { id: 'dispatcher', label: 'Dispatcher',         src: '/design/gateway/Dispatcher.html',           hint: '9-step gate' },
  { id: 'governor',   label: 'Token Governor',     src: '/design/gateway/Token Governor.html',       hint: 'budgets' },
  { id: 'bridge',     label: 'Bridge Session',     src: '/design/gateway/Bridge Session Flow.html',  hint: 'gating' },
  { id: 'health',     label: 'Health',             src: '/design/gateway/Gateway Health.html',       hint: 'live status' },
  { id: 'routes',     label: 'Routes',             src: '/design/gateway/Gateway Routes.html',       hint: 'engine routes' },
  { id: 'registry',   label: 'Registry',           src: '/design/gateway/Gateway Registry.html',     hint: 'nodes' },
  { id: 'policies',   label: 'Policies',           src: '/design/gateway/Gateway Policies.html',     hint: 'R/W/X' },
  { id: 'node-detail',label: 'Node spec',          src: '/design/gateway/Gateway Node Detail.html',  hint: 'drilldown' },
  { id: 'mobile',     label: 'Mobile',             src: '/design/gateway/Gateway Mobile Tablet.html', hint: 'responsive' },
];

function resolveGatewayTab() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('tab') || window.location.hash.replace(/^#/, '');
  return GATEWAY_TABS.some(t => t.id === requested) ? requested : 'overview';
}

function GatewayShell() {
  const [active, setActive] = React.useState(resolveGatewayTab);
  const [frameHeight, setFrameHeight] = React.useState('100vh');
  const frameRef = React.useRef(null);
  const resizeObserverRef = React.useRef(null);
  const tab = GATEWAY_TABS.find(t => t.id === active) || GATEWAY_TABS[0];

  const resizeFrame = React.useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;

    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      if (!doc) return;

      const body = doc.body;
      const contentHeight = (element) => {
        if (!element) return 0;
        const elementTop = element.getBoundingClientRect().top;
        const style = frame.contentWindow.getComputedStyle(element);
        const paddingTop = parseFloat(style.paddingTop || '0') || 0;
        const paddingBottom = parseFloat(style.paddingBottom || '0') || 0;
        return Array.from(element.children).reduce((max, child) => {
          const rect = child.getBoundingClientRect();
          return Math.max(max, rect.bottom - elementTop + paddingBottom);
        }, paddingTop + paddingBottom);
      };
      const outerHeight = (selector) => {
        const element = doc.querySelector(selector);
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        const style = frame.contentWindow.getComputedStyle(element);
        const marginTop = parseFloat(style.marginTop || '0') || 0;
        const marginBottom = parseFloat(style.marginBottom || '0') || 0;
        return rect.height + marginTop + marginBottom;
      };
      const canvasHeight = contentHeight(doc.querySelector('.canvas'));
      const sideHeight = contentHeight(doc.querySelector('.side'));
      const measuredHeight =
        outerHeight('.gw-crumbs') +
        outerHeight('.page-head') +
        outerHeight('.tabs') +
        Math.max(canvasHeight, sideHeight) +
        outerHeight('.repo-note');
      const viewportFloor = Math.max(window.innerHeight - 88, 640);

      setFrameHeight(Math.max(measuredHeight + 24, viewportFloor) + 'px');
    } catch (error) {
      setFrameHeight('100vh');
    }
  }, []);

  const observeFrameSize = React.useCallback(() => {
    const frame = frameRef.current;
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    try {
      const doc = frame && (frame.contentDocument || frame.contentWindow.document);
      if (!doc || !window.ResizeObserver) return;

      const observer = new ResizeObserver(resizeFrame);
      if (doc.documentElement) observer.observe(doc.documentElement);
      if (doc.body) observer.observe(doc.body);
      resizeObserverRef.current = observer;
    } catch (error) {
      resizeObserverRef.current = null;
    }
  }, [resizeFrame]);

  const handleFrameLoad = React.useCallback(() => {
    resizeFrame();
    observeFrameSize();
    window.setTimeout(resizeFrame, 160);
  }, [observeFrameSize, resizeFrame]);

  const selectTab = (id) => {
    if (id === active) return;
    setActive(id);
    setFrameHeight('100vh');
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'gateway');
    url.searchParams.set('tab', id);
    window.history.pushState({ page: 'gateway', tab: id }, '', url);
    const main = document.querySelector('.main-solo');
    if (main && typeof main.scrollTo === 'function') {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    const syncFromUrl = () => setActive(resolveGatewayTab());
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  React.useEffect(() => {
    const resizeFromWindow = () => resizeFrame();
    window.addEventListener('resize', resizeFromWindow);
    return () => {
      window.removeEventListener('resize', resizeFromWindow);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [resizeFrame]);

  React.useEffect(() => {
    setFrameHeight('100vh');
    const timeout = window.setTimeout(resizeFrame, 80);
    return () => window.clearTimeout(timeout);
  }, [active, resizeFrame]);

  return (
    <div className="gateway-shell">
      <style>{`
        .gateway-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100%; background: #0a0d12; color: #f1f4f9; font-family: 'Inter', system-ui, sans-serif; }
        .gateway-shell .gw-side { position: sticky; top: 0; align-self: start; max-height: 100vh; background: #0e1218; border-right: 1px solid rgba(255,255,255,0.10); padding: 20px 12px; overflow-y: auto; }
        .gateway-shell .gw-side h3 { margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: #9aa3b2; padding: 0 10px; }
        .gateway-shell .gw-side .sub { font-size: 10.5px; color: #6b7280; padding: 0 10px; margin-bottom: 14px; }
        .gateway-shell .gw-side .gw-tab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 12.5px; cursor: pointer; color: #cdd4df; border: 1px solid transparent; margin-bottom: 2px; }
        .gateway-shell .gw-side .gw-tab:hover { background: #131923; color: #f1f4f9; }
        .gateway-shell .gw-side .gw-tab.active { background: #1a212d; color: #f1f4f9; border-color: rgba(255,255,255,0.10); }
        .gateway-shell .gw-side .gw-tab .hint { font-size: 10px; color: #6b7280; font-weight: 400; }
        .gateway-shell .gw-side .gw-tab.active .hint { color: #9aa3b2; }
        .gateway-shell .gw-frame-wrap { position: relative; min-width: 0; min-height: 100%; background: #0a0d12; }
        .gateway-shell .gw-frame-wrap .gw-frame { width: 100%; min-height: 100vh; border: 0; display: block; background: #0a0d12; overflow: hidden; }
        .gateway-shell .gw-side .gw-foot { margin-top: 18px; padding: 12px 10px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 10.5px; color: #6b7280; line-height: 1.55; }
        .gateway-shell .gw-side .gw-foot strong { color: #cdd4df; font-weight: 600; }
        @media (max-width: 1200px) {
          .gateway-shell { grid-template-columns: 220px 1480px; min-width: 1700px; }
          .gateway-shell .gw-frame-wrap { width: 1480px; }
          .gateway-shell .gw-frame-wrap .gw-frame { width: 1480px; }
        }
      `}</style>

      <aside className="gw-side">
        <h3>Gateway</h3>
        <div className="sub">Mission Control · Gateway</div>
        {GATEWAY_TABS.map(t => (
          <div
            key={t.id}
            className={'gw-tab' + (t.id === active ? ' active' : '')}
            onClick={() => selectTab(t.id)}
          >
            <span>{t.label}</span>
            <span className="hint">{t.hint}</span>
          </div>
        ))}
        <div className="gw-foot">
          <strong>Status grammar</strong><br/>
          green = connected<br/>
          yellow = gated · Bridge required<br/>
          blue = read-only<br/>
          red = blocked<br/>
          gray = not installed
        </div>
      </aside>

      <div className="gw-frame-wrap">
        <iframe
          key={tab.id}
          ref={frameRef}
          className="gw-frame"
          src={tab.src}
          title={'Gateway · ' + tab.label}
          loading="lazy"
          scrolling="no"
          style={{ height: frameHeight }}
          onLoad={handleFrameLoad}
        />
      </div>
    </div>
  );
}

Object.assign(window, { GatewayShell });
