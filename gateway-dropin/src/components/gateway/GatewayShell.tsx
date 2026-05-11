'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Mounts the approved Gateway design files INSIDE Mission Control as iframes
// so the visuals match the design pixel-for-pixel. No re-implementation —
// the design IS the production page. This file is the only adapter between
// Next 15 App Router and the raw designer mock HTML; do NOT edit the mocks
// to fit this shell, and do NOT add visual states beyond the locked grammar.

interface GatewayTab {
  id: string
  label: string
  src: string       // path relative to /design/gateway/
  hint: string
  routeSegment: string // /gateway/<routeSegment> deep link
}

const GATEWAY_TABS: ReadonlyArray<GatewayTab> = [
  { id: 'overview',   label: 'Overview',       src: 'Gateway Overview.html',     hint: 'Nucleus — primary', routeSegment: 'overview' },
  { id: 'agent-hub',  label: 'Agent Hub',      src: 'Agent Hub.html',            hint: '5 agents',          routeSegment: 'agent-hub' },
  { id: 'paperclip',  label: 'Paperclip',      src: 'Paperclip.html',            hint: 'Workforce Control Plane', routeSegment: 'paperclip' },
  { id: 'dispatcher', label: 'Dispatcher',     src: 'Dispatcher.html',           hint: '9-step gate',       routeSegment: 'dispatcher' },
  { id: 'governor',   label: 'Token Governor', src: 'Token Governor.html',       hint: 'budgets',           routeSegment: 'token-governor' },
  { id: 'bridge',     label: 'Bridge Session', src: 'Bridge Session Flow.html',  hint: 'gating',            routeSegment: 'bridge-session' },
  { id: 'health',     label: 'Health',         src: 'Gateway Health.html',       hint: 'live status',       routeSegment: 'health' },
  { id: 'routes',     label: 'Routes',         src: 'Gateway Routes.html',       hint: 'engine routes',     routeSegment: 'routes' },
  { id: 'registry',   label: 'Registry',       src: 'Gateway Registry.html',     hint: 'nodes',             routeSegment: 'registry' },
  { id: 'policies',   label: 'Policies',       src: 'Gateway Policies.html',     hint: 'R/W/X',             routeSegment: 'policies' },
]

const TAB_BY_ID = new Map(GATEWAY_TABS.map((t) => [t.id, t]))
const TAB_BY_SEGMENT = new Map(GATEWAY_TABS.map((t) => [t.routeSegment, t]))

const DEFAULT_TAB_ID = GATEWAY_TABS[0].id

// Read NEXT_PUBLIC_BASE_PATH at module scope so the iframe src is consistent
// across SSR + hydration. Filenames preserve spaces (D5); encodeURI handles
// the URL encoding so a literal "Agent Hub.html" becomes "Agent%20Hub.html".
const BASE_PATH = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || ''

function iframeSrcFor(tab: GatewayTab): string {
  return encodeURI(`${BASE_PATH}/design/gateway/${tab.src}`)
}

// Decide which tab is "active" given the current URL + query.
// Precedence:
//   1. ?tab=<id>      (legacy URL shape, supported for backwards compat)
//   2. /gateway/<segment>   (rewrite target — set by next.config.js rewrites)
//   3. fallback to DEFAULT_TAB_ID (Overview)
function activeTabFrom(pathname: string | null, searchParams: URLSearchParams | null): GatewayTab {
  const explicit = searchParams?.get('tab')
  if (explicit && TAB_BY_ID.has(explicit)) return TAB_BY_ID.get(explicit)!
  if (pathname) {
    const stripped = pathname.replace(/^\/+/, '').split(/[\/?#]/)
    if (stripped[0] === 'gateway' && stripped[1]) {
      const seg = stripped[1]
      // Check drill-down BEFORE plain segment match — /gateway/agent-hub/paperclip
      // must resolve to paperclip, not agent-hub.
      if (seg === 'agent-hub' && stripped[2] === 'paperclip') return TAB_BY_ID.get('paperclip')!
      if (TAB_BY_SEGMENT.has(seg)) return TAB_BY_SEGMENT.get(seg)!
    }
  }
  return TAB_BY_ID.get(DEFAULT_TAB_ID)!
}

export default function GatewayShell(): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialTab = useMemo(
    () => activeTabFrom(pathname, searchParams),
    [pathname, searchParams],
  )
  const [activeId, setActiveId] = useState<string>(initialTab.id)

  // Keep state in sync with URL when the user hits browser back/forward.
  useEffect(() => {
    const tab = activeTabFrom(pathname, searchParams)
    if (tab.id !== activeId) setActiveId(tab.id)
  }, [pathname, searchParams, activeId])

  const onTabClick = useCallback(
    (tab: GatewayTab) => {
      setActiveId(tab.id)
      const target = `/gateway/${tab.routeSegment}`
      // Use shallow client navigation so the iframe parent doesn't re-mount
      // every tab click. Next handles the rewrite to /gateway?tab=… on the
      // server side; here we just update the URL bar.
      router.push(target)
    },
    [router],
  )

  const active = TAB_BY_ID.get(activeId) ?? GATEWAY_TABS[0]
  const iframeSrc = iframeSrcFor(active)

  return (
    <div className="gateway-shell">
      <style>{`
        .gateway-shell { display: grid; grid-template-columns: 220px 1fr; height: 100%; min-height: 100vh; background: #0a0d12; color: #f1f4f9; font-family: 'Inter', system-ui, sans-serif; }
        .gateway-shell .gw-side { background: #0e1218; border-right: 1px solid rgba(255,255,255,0.10); padding: 20px 12px; overflow-y: auto; }
        .gateway-shell .gw-side h3 { margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: #9aa3b2; padding: 0 10px; }
        .gateway-shell .gw-side .sub { font-size: 10.5px; color: #6b7280; padding: 0 10px; margin-bottom: 14px; }
        .gateway-shell .gw-side .gw-tab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 12.5px; cursor: pointer; color: #cdd4df; border: 1px solid transparent; margin-bottom: 2px; background: transparent; width: 100%; text-align: left; }
        .gateway-shell .gw-side .gw-tab:hover { background: #131923; color: #f1f4f9; }
        .gateway-shell .gw-side .gw-tab.active { background: #1a212d; color: #f1f4f9; border-color: rgba(255,255,255,0.10); }
        .gateway-shell .gw-side .gw-tab .hint { font-size: 10px; color: #6b7280; font-weight: 400; }
        .gateway-shell .gw-side .gw-tab.active .hint { color: #9aa3b2; }
        .gateway-shell .gw-frame-wrap { position: relative; background: #0a0d12; height: 100%; min-height: 100vh; }
        .gateway-shell .gw-frame-wrap .gw-frame { width: 100%; height: 100%; min-height: 100vh; border: 0; display: block; background: #0a0d12; }
        .gateway-shell .gw-side .gw-foot { margin-top: 18px; padding: 12px 10px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 10.5px; color: #6b7280; line-height: 1.55; }
        .gateway-shell .gw-side .gw-foot strong { color: #cdd4df; font-weight: 600; }
      `}</style>

      <aside className="gw-side">
        <h3>Gateway</h3>
        <div className="sub">Mission Control · Gateway</div>
        {GATEWAY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'gw-tab' + (t.id === activeId ? ' active' : '')}
            onClick={() => onTabClick(t)}
            data-testid={`gateway-tab-${t.id}`}
          >
            <span>{t.label}</span>
            <span className="hint">{t.hint}</span>
          </button>
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
          key={active.id}
          className="gw-frame"
          src={iframeSrc}
          title={'Gateway · ' + active.label}
          loading="lazy"
          sandbox="allow-scripts"
          data-testid="gateway-iframe"
        />
      </div>
    </div>
  )
}

// Re-exported for parity tests and the upcoming data-wiring PR.
export { GATEWAY_TABS, iframeSrcFor, activeTabFrom }
export type { GatewayTab }
