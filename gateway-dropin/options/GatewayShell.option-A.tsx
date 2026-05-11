'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// OPTION A+A — pending Designer Department decision.
//
// This variant reverts the two design-touching changes from commit 7c51e68:
//   1. Tab element returns to <div className="gw-tab" onClick=…>
//      (designer's original shape; loses default keyboard accessibility)
//   2. The three CSS declarations added to compensate for <button> defaults
//      (background: transparent; width: 100%; text-align: left) are removed.
//
// Every other engineering adaptation from the C+C variant stays:
//   - 'use client' for Next 15 App Router
//   - React hook imports (no global React)
//   - basePath-aware iframe src via encodeURI
//   - usePathname / useSearchParams / useRouter for deep-link resolution
//   - iframe sandbox="allow-scripts" (D4 — engineering-allowed)
//   - design-lock manifest registration (D6 — engineering-allowed)
//
// Side-by-side comparison with the C+C variant lives at
// gateway-dropin/options/DESIGNER-REVIEW.md.

interface GatewayTab {
  id: string
  label: string
  src: string
  hint: string
  routeSegment: string
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

const BASE_PATH = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || ''

function iframeSrcFor(tab: GatewayTab): string {
  return encodeURI(`${BASE_PATH}/design/gateway/${tab.src}`)
}

function activeTabFrom(pathname: string | null, searchParams: URLSearchParams | null): GatewayTab {
  const explicit = searchParams?.get('tab')
  if (explicit && TAB_BY_ID.has(explicit)) return TAB_BY_ID.get(explicit)!
  if (pathname) {
    const stripped = pathname.replace(/^\/+/, '').split(/[\/?#]/)
    if (stripped[0] === 'gateway' && stripped[1]) {
      const seg = stripped[1]
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

  useEffect(() => {
    const tab = activeTabFrom(pathname, searchParams)
    if (tab.id !== activeId) setActiveId(tab.id)
  }, [pathname, searchParams, activeId])

  const onTabClick = useCallback(
    (tab: GatewayTab) => {
      setActiveId(tab.id)
      router.push(`/gateway/${tab.routeSegment}`)
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
        .gateway-shell .gw-side .gw-tab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 12.5px; cursor: pointer; color: #cdd4df; border: 1px solid transparent; margin-bottom: 2px; }
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
          <div
            key={t.id}
            className={'gw-tab' + (t.id === activeId ? ' active' : '')}
            onClick={() => onTabClick(t)}
            data-testid={`gateway-tab-${t.id}`}
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

export { GATEWAY_TABS, iframeSrcFor, activeTabFrom }
export type { GatewayTab }
