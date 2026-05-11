'use client'

// Mounts the approved designer mocks inside Mission Control as iframes.
// Per the Designer Contract (2026-05-11): "GatewayShell.jsx is a 50-line
// iframe holder. Drift is structurally impossible because there's
// nowhere to drift." No status grammar, no legend, no chrome invented
// here. The mocks ARE the production page.
//
// Approved engineering adaptations:
//   - Next 15 App Router 'use client' + hooks (D3)
//   - basePath-aware src + encodeURI for filenames with spaces (D5)
//   - sandbox="allow-scripts allow-same-origin" (DDR-Gateway-005, see
//     middleware.gateway-csp.partial.ts for the security justification —
//     required for the README-authorised data-wiring fetch to send
//     Mission Control session cookies)
//   - DDR-Gateway-001 / -002 accessibility upgrades (<button> + 3 CSS
//     resets, README-stamped)

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Tab { id: string; label: string; src: string; hint: string; seg: string }

const TABS: ReadonlyArray<Tab> = [
  { id: 'overview',   label: 'Overview',       src: 'Gateway Overview.html',     hint: 'Nucleus — primary',       seg: 'overview' },
  { id: 'agent-hub',  label: 'Agent Hub',      src: 'Agent Hub.html',            hint: '5 agents',                seg: 'agent-hub' },
  { id: 'paperclip',  label: 'Paperclip',      src: 'Paperclip.html',            hint: 'Workforce Control Plane', seg: 'paperclip' },
  { id: 'dispatcher', label: 'Dispatcher',     src: 'Dispatcher.html',           hint: '9-step gate',             seg: 'dispatcher' },
  { id: 'governor',   label: 'Token Governor', src: 'Token Governor.html',       hint: 'budgets',                 seg: 'token-governor' },
  { id: 'bridge',     label: 'Bridge Session', src: 'Bridge Session Flow.html',  hint: 'gating',                  seg: 'bridge-session' },
  { id: 'health',     label: 'Health',         src: 'Gateway Health.html',       hint: 'live status',             seg: 'health' },
  { id: 'routes',     label: 'Routes',         src: 'Gateway Routes.html',       hint: 'engine routes',           seg: 'routes' },
  { id: 'registry',   label: 'Registry',       src: 'Gateway Registry.html',     hint: 'nodes',                   seg: 'registry' },
  { id: 'policies',   label: 'Policies',       src: 'Gateway Policies.html',     hint: 'R/W/X',                   seg: 'policies' },
]
const BY_ID = new Map(TABS.map((t) => [t.id, t]))
const BY_SEG = new Map(TABS.map((t) => [t.seg, t]))
const BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || ''

function resolveTab(pathname: string | null, q: URLSearchParams | null): Tab {
  const qid = q?.get('tab')
  if (qid && BY_ID.has(qid)) return BY_ID.get(qid)!
  if (pathname) {
    const parts = pathname.replace(/^\/+/, '').split(/[\/?#]/)
    if (parts[0] === 'gateway' && parts[1]) {
      if (parts[1] === 'agent-hub' && parts[2] === 'paperclip') return BY_ID.get('paperclip')!
      if (BY_SEG.has(parts[1])) return BY_SEG.get(parts[1])!
    }
  }
  return TABS[0]
}

export default function GatewayShell() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [activeId, setActiveId] = useState<string>(() => resolveTab(pathname, sp).id)
  useEffect(() => { const t = resolveTab(pathname, sp); if (t.id !== activeId) setActiveId(t.id) }, [pathname, sp, activeId])
  const active = BY_ID.get(activeId) ?? TABS[0]
  return (
    <div className="gateway-shell">
      <style>{`
        .gateway-shell{display:grid;grid-template-columns:220px 1fr;height:100%;min-height:100vh;background:#0a0d12;color:#f1f4f9;font-family:'Inter',system-ui,sans-serif}
        .gateway-shell .gw-side{background:#0e1218;border-right:1px solid rgba(255,255,255,.10);padding:20px 12px;overflow-y:auto}
        .gateway-shell .gw-side h3{margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:#9aa3b2;padding:0 10px}
        .gateway-shell .gw-side .sub{font-size:10.5px;color:#6b7280;padding:0 10px;margin-bottom:14px}
        .gateway-shell .gw-side .gw-tab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:6px;font-size:12.5px;cursor:pointer;color:#cdd4df;border:1px solid transparent;margin-bottom:2px;background:transparent;width:100%;text-align:left}
        .gateway-shell .gw-side .gw-tab:hover{background:#131923;color:#f1f4f9}
        .gateway-shell .gw-side .gw-tab.active{background:#1a212d;color:#f1f4f9;border-color:rgba(255,255,255,.10)}
        .gateway-shell .gw-side .gw-tab .hint{font-size:10px;color:#6b7280;font-weight:400}
        .gateway-shell .gw-side .gw-tab.active .hint{color:#9aa3b2}
        .gateway-shell .gw-frame-wrap{position:relative;background:#0a0d12;height:100%;min-height:100vh}
        .gateway-shell .gw-frame-wrap .gw-frame{width:100%;height:100%;min-height:100vh;border:0;display:block;background:#0a0d12}
      `}</style>
      <aside className="gw-side">
        <h3>Gateway</h3>
        <div className="sub">Mission Control · Gateway</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'gw-tab' + (t.id === activeId ? ' active' : '')}
            onClick={() => { setActiveId(t.id); router.push(`/gateway/${t.seg}`) }}
            data-testid={`gateway-tab-${t.id}`}
          >
            <span>{t.label}</span>
            <span className="hint">{t.hint}</span>
          </button>
        ))}
      </aside>
      <div className="gw-frame-wrap">
        <iframe
          key={active.id}
          className="gw-frame"
          src={encodeURI(`${BASE}/design/gateway/${active.src}`)}
          title={`Gateway · ${active.label}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          data-testid="gateway-iframe"
        />
      </div>
    </div>
  )
}

export { TABS as GATEWAY_TABS, resolveTab as activeTabFrom }
export function iframeSrcFor(t: Tab): string { return encodeURI(`${BASE}/design/gateway/${t.src}`) }
export type { Tab as GatewayTab }
