// Parity tests for GatewayShell. The point is to prove three contracts the
// owner-facing UI must always honour:
//   1. Every GATEWAY_TABS entry points at a real file under public/design/gateway/.
//   2. iframeSrcFor returns a basePath-aware, URL-encoded path (D5).
//   3. activeTabFrom resolves both deep-link segments and ?tab= query.
// These tests do NOT spin up Next or React — they exercise the pure helpers
// exported from the shell so they run in plain vitest without a JSDOM dep.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  GATEWAY_TABS,
  activeTabFrom,
  iframeSrcFor,
  type GatewayTab,
} from '../../src/components/gateway/GatewayShell'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const MOCKS_ROOT = join(HERE, '..', 'public', 'design', 'gateway')

function searchParamsOf(qs: string): URLSearchParams {
  return new URLSearchParams(qs)
}

describe('GATEWAY_TABS — contract with the static mocks', () => {
  it('declares exactly ten owner-facing sub-tabs (D7)', () => {
    expect(GATEWAY_TABS.length).toBe(10)
  })

  it('every tab points at a file that exists on disk', () => {
    for (const tab of GATEWAY_TABS) {
      const abs = join(MOCKS_ROOT, tab.src)
      expect(existsSync(abs), `missing mock for tab ${tab.id} → ${tab.src}`).toBe(true)
    }
  })

  it('tab ids and segs are unique', () => {
    const ids = new Set(GATEWAY_TABS.map((t) => t.id))
    const segs = new Set(GATEWAY_TABS.map((t) => t.seg))
    expect(ids.size).toBe(GATEWAY_TABS.length)
    expect(segs.size).toBe(GATEWAY_TABS.length)
  })

  it('Overview is the canonical first tab', () => {
    expect(GATEWAY_TABS[0].id).toBe('overview')
  })
})

describe('iframeSrcFor — URL encoding (D5) + basePath', () => {
  const overview: GatewayTab = GATEWAY_TABS.find((t) => t.id === 'overview')!
  const agentHub: GatewayTab = GATEWAY_TABS.find((t) => t.id === 'agent-hub')!

  it('keeps designer filenames with spaces intact at the storage layer', () => {
    expect(agentHub.src).toBe('Agent Hub.html')
  })

  it('encodes spaces in the URL it hands to the iframe', () => {
    expect(iframeSrcFor(agentHub)).toBe('/design/gateway/Agent%20Hub.html')
    expect(iframeSrcFor(overview)).toBe('/design/gateway/Gateway%20Overview.html')
  })

  it('never emits a leading double slash', () => {
    for (const t of GATEWAY_TABS) {
      const src = iframeSrcFor(t)
      expect(src.startsWith('//')).toBe(false)
      expect(src.startsWith('/design/gateway/')).toBe(true)
    }
  })

  it('never leaks an absolute filesystem path', () => {
    for (const t of GATEWAY_TABS) {
      const src = iframeSrcFor(t)
      expect(src).not.toMatch(/^\/Users\//)
      expect(src).not.toMatch(/^\/home\//)
      expect(src).not.toMatch(/^\/Volumes\//)
    }
  })
})

describe('activeTabFrom — URL → tab resolution', () => {
  it('falls back to Overview when nothing matches', () => {
    expect(activeTabFrom('/', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', searchParamsOf('')).id).toBe('overview')
  })

  it('resolves ?tab=<id> query form', () => {
    expect(activeTabFrom('/gateway', searchParamsOf('tab=agent-hub')).id).toBe('agent-hub')
    expect(activeTabFrom('/gateway', searchParamsOf('tab=governor')).id).toBe('governor')
  })

  it('resolves /gateway/<seg> path form', () => {
    expect(activeTabFrom('/gateway/dispatcher', null).id).toBe('dispatcher')
    expect(activeTabFrom('/gateway/token-governor', null).id).toBe('governor')
    expect(activeTabFrom('/gateway/bridge-session', null).id).toBe('bridge')
  })

  it('resolves /gateway/agent-hub/paperclip drill-down', () => {
    expect(activeTabFrom('/gateway/agent-hub/paperclip', null).id).toBe('paperclip')
  })

  it('?tab= wins over path when both are present (legacy precedence)', () => {
    expect(
      activeTabFrom('/gateway/dispatcher', searchParamsOf('tab=agent-hub')).id,
    ).toBe('agent-hub')
  })

  it('ignores unknown tab ids and segments', () => {
    expect(activeTabFrom('/gateway/does-not-exist', null).id).toBe('overview')
    expect(activeTabFrom('/gateway', searchParamsOf('tab=garbage')).id).toBe('overview')
  })
})
