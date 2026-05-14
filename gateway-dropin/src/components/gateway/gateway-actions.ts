type GatewayActionContext = {
  label: string
  pageTitle?: string
  nearbyText?: string
}

type GatewayFrameAction =
  | { kind: 'navigate'; href: string; title: string; detail: string }
  | { kind: 'frame'; href: string; title: string; detail: string }
  | { kind: 'openExternal'; href: string; title: string; detail: string }
  | { kind: 'status'; endpoint: string; title: string; detail: string }
  | { kind: 'gated'; title: string; detail: string; href?: string }
  | { kind: 'copy'; title: string; detail: string; value: string }

const BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || ''

function normalized(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function designHref(file: string): string {
  return encodeURI(`${BASE}/design/gateway/${file}`)
}

function shellHref(path: string): string {
  return `${BASE}${path}`
}

function hasAny(text: string, ...needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function connectorEndpoint(text: string): string | null {
  if (text.includes('agentmail')) return '/api/bridge/agentmail-readiness'
  if (text.includes('sendgrid')) return '/api/bridge/agentmail-readiness'
  if (text.includes('firecrawl')) return '/api/firecrawl/status'
  if (text.includes('google drive')) return '/api/bridge/google-drive-readiness'
  if (text.includes('onedrive')) return '/api/bridge/onedrive-readiness'
  if (text.includes('n8n') || text.includes('opencloud')) return '/api/n8n/workflows'
  if (text.includes('twilio') || text.includes('elevenlabs') || text.includes('slack') || text.includes('calendar')) {
    return '/api/bridge/connector-readiness'
  }
  return null
}

function ownerUiLink(text: string): string | null {
  if (hasAny(text, 'paperclip', 'workforce control plane')) return 'http://100.116.35.95:3100/ECO/dashboard'
  if (hasAny(text, 'agent zero', 'agent-zero', ' a0 ')) return 'http://100.116.35.95:50080/'
  if (hasAny(text, 'openclaw+', 'openclaw plus', 'owner tunnel')) return 'http://127.0.0.1:18789/'
  return null
}

function agentControlSlug(text: string): string | null {
  if (hasAny(text, 'paperclip', 'workforce control plane')) return 'paperclip'
  if (hasAny(text, 'agent zero', 'agent-zero', ' a0 ')) return 'agent-zero'
  if (hasAny(text, 'hermes')) return 'hermes'
  if (hasAny(text, 'pi-mono', 'pi ', 'dispatcher candidate', 'route optimizer')) return 'pi'
  if (hasAny(text, 'spaceagent', 'space agent', 'playwright', 'browser research')) return 'spaceagent'
  if (hasAny(text, 'openclaw+', 'openclaw plus', 'openclaw')) return 'openclaw'
  return null
}

function agentControlHref(
  text: string,
  mode: 'config' | 'chat' | 'recommend' | 'research' | 'tools' | 'companies' | 'agents' | 'issues' | 'status' | 'audit' | 'help',
): string | null {
  const slug = agentControlSlug(text)
  if (!slug) return null
  if (mode === 'tools') return slug === 'paperclip' ? shellHref('/gateway/agent-hub/paperclip/tools') : null
  if (['companies', 'agents', 'issues', 'status', 'audit', 'help'].includes(mode)) {
    return slug === 'paperclip' ? shellHref(`/gateway/agent-hub/paperclip/${mode}`) : null
  }
  if (mode === 'chat') {
    if (slug === 'agent-zero' || slug === 'hermes') return shellHref(`/gateway/agent-hub/${slug}/chat`)
    if (slug === 'pi') return shellHref('/gateway/agent-hub/pi/recommend')
    if (slug === 'spaceagent') return shellHref('/gateway/agent-hub/spaceagent/research')
    return shellHref(`/gateway/agent-hub/${slug}/config`)
  }
  return shellHref(`/gateway/agent-hub/${slug}/${mode}`)
}

function protectedActionLabel(label: string): boolean {
  return (
    label.includes('send command') ||
    label.includes('upload') ||
    label.includes('write') ||
    label.includes('execute') ||
    label === 'run now' ||
    label === 'start' ||
    label.includes('start job') ||
    label === 'stop' ||
    label.includes('restart') ||
    label.includes('generate') ||
    label.includes('deploy') ||
    label.includes('activate workflow') ||
    label.includes('deactivate workflow')
  )
}

export function gatewayActionForButton(context: GatewayActionContext): GatewayFrameAction {
  const label = normalized(context.label)
  const page = normalized(context.pageTitle)
  const nearby = normalized(context.nearbyText)
  const text = `${page} ${nearby}`

  if (protectedActionLabel(label)) {
    return {
      kind: 'gated',
      title: 'Protected action gated',
      detail: 'This action is wired, but execution is blocked until Bridge approval, audit persistence, and rollback proof are live.',
      href: shellHref('/gateway/bridge-session'),
    }
  }

  if (label === 'open config' || label === 'config' || label === 'configure agent') {
    const href = agentControlHref(text, 'config')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening agent config',
        detail: 'Opening the readable Mission Control configuration page. No Bridge Session is required for inspection.',
      }
    }
    return {
      kind: 'navigate',
      href: shellHref('/gateway/tools'),
      title: 'Opening Gateway tools',
      detail: 'Opening the readable tools/control page instead of a raw JSON endpoint.',
    }
  }

  if (label === 'open tools' || label === 'tools') {
    const href = agentControlHref(text, 'tools')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening agent tools',
        detail: 'Opening the human-readable agent tools page. The JSON API remains machine-only.',
      }
    }
    return {
      kind: 'navigate',
      href: shellHref('/gateway/tools'),
      title: 'Opening Gateway tools',
      detail: 'Opening the human-readable capability matrix wrapper. The JSON API remains machine-only.',
    }
  }

  if (label === 'companies') {
    const href = agentControlHref(text, 'companies')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening Paperclip companies',
        detail: 'Opening the read-only ECO company inventory. TOK remains a separate legacy blocker.',
      }
    }
  }

  if (label === 'agents' || label === 'agent clip') {
    const href = agentControlHref(text, 'agents')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening Paperclip agents',
        detail: 'Opening the read-only Paperclip workforce roster for ECO.',
      }
    }
  }

  if (label === 'issues' || label === 'tasks') {
    const href = agentControlHref(text, 'issues')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening Paperclip issues',
        detail: 'Opening the read-only Paperclip issue/task queue. Writes stay Bridge-gated.',
      }
    }
  }

  if (label === 'health' || label === 'status') {
    const href = hasAny(text, 'paperclip', 'workforce control plane')
      ? agentControlHref(text, 'status')
      : agentControlHref(text, 'config')
    return {
      kind: 'navigate',
      href: href || shellHref('/gateway/tools'),
      title: 'Opening readable status',
      detail: 'Opening a Mission Control status panel that reads JSON internally without dumping raw JSON in the browser.',
    }
  }

  if (label === 'open chat') {
    const href = agentControlHref(text, 'chat')
    if (href) return {
      kind: 'navigate',
      href,
      title: 'Opening agent chat/test surface',
      detail: 'Opening the safe Mission Control chat, recommendation, or research panel for this agent.',
    }
    return {
      kind: 'navigate',
      href: shellHref('/gateway/tools'),
      title: 'Chat surface unavailable',
      detail: 'No safe chat panel is known for this surface; opening the tools/status page with blockers.',
    }
  }

  if (label === 'view audit' || label === 'audit' || label.includes('audit')) {
    const href = agentControlHref(text, 'audit')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening Paperclip audit',
        detail: 'Opening the readable Paperclip audit page. If no audit source exists yet, the page shows an empty state.',
      }
    }
    return {
      kind: 'navigate',
      href: shellHref('/gateway/health'),
      title: 'Opening Gateway audit',
      detail: 'Routing to the Gateway Health and audit surface.',
    }
  }

  if (label === 'help' || label.includes('help')) {
    const href = agentControlHref(text, 'help')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening Paperclip help',
        detail: 'Opening the readable Paperclip help page with button behavior and current blockers.',
      }
    }
  }

  if (label.includes('bridge') || label.includes('approve') || label.includes('open bridge')) {
    return {
      kind: 'navigate',
      href: shellHref('/gateway/bridge-session'),
      title: 'Opening Bridge Session',
      detail: 'Protected write/execute actions must go through the Bridge gate.',
    }
  }

  if (label === 'open ui') {
    const href = ownerUiLink(text)
    if (href) {
      return {
        kind: 'openExternal',
        href,
        title: 'Opening owner UI',
        detail: 'Opening the real owner-accessible interface in a new tab. Bridge Session is not required for safe navigation.',
      }
    }
    return {
      kind: 'status',
      endpoint: hasAny(text, 'hermes') ? '/api/hermes/status'
        : hasAny(text, 'pi') ? '/api/bridge/dispatcher/status'
          : hasAny(text, 'spaceagent', 'space agent', 'playwright') ? '/api/bridge/space-agent/status'
            : '/api/agent-local-interfaces',
      title: 'Owner UI unavailable',
      detail: 'No safe owner UI link is exposed for this surface. Checking the JSON status/config route instead.',
    }
  }

  if (label === 'open' || label === 'open full nucleus') {
    const isDeliveryConnectorsPage = hasAny(page, 'delivery connectors') || (page.includes('delivery') && page.includes('connectors'))
    const deliveryConnectorEndpoint = isDeliveryConnectorsPage ? connectorEndpoint(text) : null
    if (deliveryConnectorEndpoint) {
      return {
        kind: 'status',
        endpoint: deliveryConnectorEndpoint,
        title: 'Connector status',
        detail: 'Checking the real readiness endpoint before opening this connector.',
      }
    }
    if (hasAny(text, 'hermes')) {
      return {
        kind: 'frame',
        href: designHref('Hermes Lieutenant.html'),
        title: 'Opening Hermes',
        detail: 'Loading the Hermes lieutenant surface in the Gateway pane.',
      }
    }
    if (hasAny(text, 'build-wiki', 'farmer', 'opencloud', 'n8n')) {
      return {
        kind: 'frame',
        href: designHref('OpenCloud Workers.html'),
        title: 'Opening OpenCloud',
        detail: 'Loading the OpenCloud worker/runtime surface in the Gateway pane.',
      }
    }
    if (hasAny(text, 'tony', 'memory')) {
      return {
        kind: 'frame',
        href: designHref('Brain Systems.html'),
        title: 'Opening Brain memory',
        detail: 'Loading the Brain Systems surface with Tony memory read-only provenance.',
      }
    }
    const endpoint = connectorEndpoint(text)
    if (endpoint) {
      return {
        kind: 'status',
        endpoint,
        title: 'Connector status',
        detail: 'Checking the real readiness endpoint before opening this connector.',
      }
    }
  }

  if (label === 'memory') {
    return {
      kind: 'frame',
      href: designHref('Brain Systems.html'),
      title: 'Opening memory',
      detail: 'Loading Brain Systems with provenance and read-only inherited memory.',
    }
  }

  if (label === 'test') {
    const endpoint = connectorEndpoint(text) || '/api/bridge/connector-readiness'
    return {
      kind: 'status',
      endpoint,
      title: 'Running read-only connector test',
      detail: 'Calling the connector readiness contract. This does not send external writes.',
    }
  }

  if (label === 'configure') {
    return {
      kind: 'gated',
      title: 'Configuration is gated',
      detail: 'This connector needs credentials through the approved owner secret path before it can be configured.',
      href: shellHref('/gateway/bridge-session'),
    }
  }

  if (label.includes('open localhost') || label.includes('open in new tab') || label.includes('preview ui')) {
    const href = ownerUiLink(text)
    if (href) {
      return {
        kind: 'openExternal',
        href,
        title: 'Opening owner UI',
        detail: 'Opening the real owner-accessible interface in a new tab. Bridge Session is not required for safe navigation.',
      }
    }
    if (hasAny(text, 'agent zero')) {
      return {
        kind: 'status',
        endpoint: '/api/agent-zero/status',
        title: 'Agent Zero local status',
        detail: 'Checking Agent Zero readiness instead of opening an unproven localhost blindly.',
      }
    }
    if (hasAny(text, 'hermes')) {
      return {
        kind: 'status',
        endpoint: '/api/hermes/status',
        title: 'Hermes local status',
        detail: 'Checking Hermes runtime reachability before opening the localhost surface.',
      }
    }
    if (hasAny(text, 'paperclip')) {
      return {
        kind: 'status',
        endpoint: '/api/paperclip/status',
        title: 'Paperclip local status',
        detail: 'Checking Paperclip service reachability before opening the workforce plane.',
      }
    }
    if (hasAny(text, 'spaceagent', 'playwright', 'browser')) {
      return {
        kind: 'status',
        endpoint: '/api/bridge/space-agent/status',
        title: 'SpaceAgent local status',
        detail: 'Checking SpaceAgent and Playwright MCP readiness before opening browser automation.',
      }
    }
    return {
      kind: 'status',
      endpoint: '/api/bridge/runtime-services',
      title: 'Runtime service status',
      detail: 'Checking runtime service readiness before opening this local surface.',
    }
  }

  if (label.includes('status only')) {
    const href = agentControlHref(text, 'status')
    if (href) {
      return {
        kind: 'navigate',
        href,
        title: 'Opening readable Paperclip status',
        detail: 'Opening the human-readable status page backed by the Paperclip JSON bridge.',
      }
    }
    return {
      kind: 'status',
      endpoint: hasAny(text, 'paperclip') ? '/api/bridge/paperclip/status' : '/api/bridge/runtime-services',
      title: 'Runtime service status',
      detail: 'Checking the JSON service readiness route. No HTML page is parsed as JSON.',
    }
  }

  if (label.includes('recheck handshake')) {
    return {
      kind: 'status',
      endpoint: hasAny(text, 'paperclip') ? '/api/bridge/paperclip/status' : '/api/bridge/runtime-services',
      title: 'Runtime service status',
      detail: 'Checking the JSON service readiness route. No HTML page is parsed as JSON.',
    }
  }

  if (label.includes('pause')) {
    return {
      kind: 'status',
      endpoint: '/api/bridge/runtime-services',
      title: 'Queue pause status',
      detail: 'Pause is not executed from the design surface. Checking service state only.',
    }
  }

  if (label.includes('dry-run route')) {
    return {
      kind: 'status',
      endpoint: '/api/bridge/preflight',
      title: 'Dry-run route',
      detail: 'Running the read-only Gateway preflight route. No execution is dispatched.',
    }
  }

  if (label.includes('refresh') || label.includes('run discovery') || label.includes('show route')) {
    return {
      kind: 'status',
      endpoint: '/api/bridge/runtime-services',
      title: 'Gateway discovery status',
      detail: 'Checking read-only runtime/service metadata. No service control is performed.',
    }
  }

  if (label.includes('brain')) {
    return {
      kind: 'status',
      endpoint: '/api/bridge/brain-readiness',
      title: 'Brain readiness',
      detail: 'Checking the real Brain readiness contract.',
    }
  }

  if (label.includes('marketplace') || label.includes('skill')) {
    return {
      kind: 'navigate',
      href: shellHref('/gateway/tools'),
      title: 'Skills registry',
      detail: 'Opening the human-readable tools and skills page.',
    }
  }

  if (label.includes('migration plan')) {
    return {
      kind: 'frame',
      href: designHref('Gateway Policies.html'),
      title: 'Opening policy plan',
      detail: 'Loading Gateway Policies for the blocked SMB migration path.',
    }
  }

  if (label.includes('copy node')) {
    return {
      kind: 'copy',
      value: normalized(context.nearbyText).split(' ')[0] || 'gateway-node',
      title: 'Copied node ID',
      detail: 'The visible node identifier was copied to the clipboard.',
    }
  }

  return {
    kind: 'gated',
    title: 'Action routed to Gateway',
    detail: `The "${context.label.trim() || 'button'}" control is wired. It is blocked from direct execution until an explicit Gateway contract is attached.`,
    href: shellHref('/gateway/bridge-session'),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function getObject(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  const next = value[key]
  return isRecord(next) ? next : null
}

function summarizeGatewayPayload(payload: unknown, status: number): string {
  if (!isRecord(payload)) return `HTTP ${status}. Response was not JSON.`
  const summary = getObject(payload, 'summary')
  const hermesSummary = getObject(payload, 'hermes_readiness_summary')
  const state = firstString(payload.state, payload.blocker_class, payload.error, summary?.by_state ? 'runtime summary returned' : null)
  const next = firstString(payload.next_action, payload.owner_action_required, hermesSummary?.next_action)
  const flags = [
    payload.execution_enabled === false ? 'execution disabled' : null,
    payload.external_writes_enabled === false ? 'external writes disabled' : null,
    payload.approval_request_created === false ? 'no approval record created' : null,
  ].filter(Boolean).join(' | ')
  return [`HTTP ${status}`, state, next, flags].filter(Boolean).join('. ')
}

function actionHeaders(): HeadersInit {
  const key =
    window.localStorage.getItem('MISSION_CONTROL_API_KEY') ||
    window.localStorage.getItem('missionControlApiKey') ||
    window.localStorage.getItem('tkmc.apiKey')
  return key ? { 'x-api-key': key } : {}
}

function showGatewayNotice(doc: Document, title: string, detail: string, tone: 'info' | 'ok' | 'warn' | 'error' = 'info') {
  let style = doc.getElementById('cc-gateway-action-style')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'cc-gateway-action-style'
    style.textContent = `
      .cc-gateway-action-toast{position:fixed;right:18px;bottom:18px;z-index:99999;width:min(390px,calc(100vw - 36px));padding:13px 14px;border-radius:8px;background:#111827;border:1px solid rgba(148,163,184,.34);box-shadow:0 18px 52px rgba(0,0,0,.42);color:#e5e7eb;font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.45}
      .cc-gateway-action-toast strong{display:block;margin-bottom:4px;font-size:12.5px;color:#f9fafb}
      .cc-gateway-action-toast.info{border-color:rgba(94,234,212,.48)}
      .cc-gateway-action-toast.ok{border-color:rgba(34,197,94,.52)}
      .cc-gateway-action-toast.warn{border-color:rgba(245,181,10,.62)}
      .cc-gateway-action-toast.error{border-color:rgba(239,68,68,.58)}
    `
    doc.head.appendChild(style)
  }

  let toast = doc.getElementById('cc-gateway-action-toast')
  if (!toast) {
    toast = doc.createElement('div')
    toast.id = 'cc-gateway-action-toast'
    doc.body.appendChild(toast)
  }
  toast.className = `cc-gateway-action-toast ${tone}`
  const titleNode = doc.createElement('strong')
  titleNode.textContent = title
  const detailNode = doc.createElement('span')
  detailNode.textContent = detail
  toast.replaceChildren(titleNode, detailNode)
}

function buttonContext(doc: Document, button: HTMLButtonElement): GatewayActionContext {
  const container = button.closest(
    '.conn,.delegate-row,.detail-head,.detail,.agent-card,.section,.system-row,.tool-row,.scope-row,.ba-tool,.localhost-embed,.node-card,.hero,.az-hero,.h-hero,.pc-hero',
  )
  return {
    label: button.textContent || '',
    pageTitle: doc.title,
    nearbyText: container?.textContent || button.parentElement?.textContent || '',
  }
}

async function executeGatewayAction(action: GatewayFrameAction, iframe: HTMLIFrameElement, doc: Document): Promise<void> {
  if (action.kind === 'navigate') {
    showGatewayNotice(doc, action.title, action.detail, 'info')
    window.location.href = action.href
    return
  }

  if (action.kind === 'frame') {
    showGatewayNotice(doc, action.title, action.detail, 'info')
    iframe.contentWindow?.location.assign(action.href)
    return
  }

  if (action.kind === 'openExternal') {
    showGatewayNotice(doc, action.title, action.detail, 'ok')
    const opened = window.open(action.href, '_blank', 'noopener,noreferrer')
    if (!opened) window.location.href = action.href
    return
  }

  if (action.kind === 'gated') {
    const suffix = action.href ? ` Open Bridge Session from ${action.href}.` : ''
    showGatewayNotice(doc, action.title, `${action.detail}${suffix}`, 'warn')
    return
  }

  if (action.kind === 'copy') {
    await navigator.clipboard?.writeText(action.value).catch(() => undefined)
    showGatewayNotice(doc, action.title, action.detail, 'ok')
    return
  }

  showGatewayNotice(doc, action.title, `${action.detail} Checking ${action.endpoint}...`, 'info')
  try {
    const response = await fetch(action.endpoint, {
      credentials: 'include',
      headers: actionHeaders(),
    })
    const payload = await response.json().catch(() => null)
    const detail = summarizeGatewayPayload(payload, response.status)
    const isReady = response.ok && (!isRecord(payload) || payload.ok !== false)
    showGatewayNotice(doc, action.title, detail, isReady ? 'ok' : response.status === 401 || response.status === 403 ? 'warn' : 'error')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    showGatewayNotice(doc, action.title, `Could not reach ${action.endpoint}: ${message}`, 'error')
  }
}

export function attachGatewayActionHandler(iframe: HTMLIFrameElement): void {
  try {
    const doc = iframe.contentDocument
    if (!doc) return
    const root = doc.documentElement as HTMLElement
    if (root.dataset.ccGatewayActionsWired === '1') return
    root.dataset.ccGatewayActionsWired = '1'
    doc.querySelectorAll('button').forEach((button) => {
      const wiredButton = button as HTMLButtonElement
      if (wiredButton.matches('.tab')) return
      if (wiredButton.dataset.ccGatewayActionButtonWired === '1') return
      wiredButton.dataset.ccGatewayActionButtonWired = '1'
      wiredButton.addEventListener(
        'click',
        (event) => {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          const action = gatewayActionForButton(buttonContext(doc, wiredButton))
          void executeGatewayAction(action, iframe, doc)
        },
        true,
      )
    })
  } catch (_err) {
    /* cross-origin - ignore, matching the shell back-button handler */
  }
}

export type { GatewayActionContext, GatewayFrameAction }
