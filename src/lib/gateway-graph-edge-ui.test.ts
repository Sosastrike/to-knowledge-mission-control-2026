import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Gateway graph edge diagnostics UI', () => {
  it('loads protected edge readiness and exposes a line inspector with a legend', () => {
    const html = readFileSync(join(process.cwd(), 'public/design/gateway/Gateway Overview.html'), 'utf8')

    expect(html).toContain('/api/gateway/graph/edge-readiness')
    expect(html).toContain('edge-tooltip')
    expect(html).toContain('openEdgeInspector')
    expect(html).toContain('Gateway edge legend')
    expect(html).toContain('Node registered, edge standby.')
  })

  it('ships static fallback reasons for the observed gray edges', () => {
    const data = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')

    expect(data).toContain('html_surface_registered_no_runtime_bridge')
    expect(data).toContain('firefox_runtime_not_connected')
    expect(data).toContain('report_preview_ready_delivery_not_enabled')
    expect(data).toContain('webhook_receiver_ready_no_recent_events')
    expect(data).toContain('event_bus_ready_no_recent_events')
  })
})
