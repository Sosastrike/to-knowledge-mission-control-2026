import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { panelHref } from './navigation'

describe('Mission Control panel navigation', () => {
  it('uses the active Mission Control home instead of the retired root designer route', () => {
    expect(panelHref('overview')).toBe('/tkmc')
    expect(panelHref('mission')).toBe('/tkmc')
    expect(panelHref('dashboard')).toBe('/tkmc')
  })

  it('uses canonical Gateway FULL v3 routes without relying on compatibility redirects', () => {
    expect(panelHref('gateway')).toBe('/gateway')
    expect(panelHref('gateway-parent')).toBe('/gateway?tab=agent-hub')
    expect(panelHref('gateways')).toBe('/gateway')
    expect(panelHref('gateway-config')).toBe('/gateway?tab=policies')
    expect(panelHref('agents')).toBe('/gateway?tab=agent-hub')
    expect(panelHref('agent-network')).toBe('/gateway?tab=agent-hub')
  })

  it('uses concrete Mission Control settings routes for admin navigation', () => {
    expect(panelHref('settings')).toBe('/settings/tkmc')
    expect(panelHref('security')).toBe('/settings/tkmc/security')
    expect(panelHref('users')).toBe('/settings/tkmc/users')
    expect(panelHref('audit')).toBe('/settings/tkmc/audit')
    expect(panelHref('integrations')).toBe('/settings/tkmc/integrations')
  })

  it('falls back to a direct panel path for panels without a canonical route yet', () => {
    expect(panelHref('tasks')).toBe('/tasks')
  })

  it('resets scroll on route changes so new pages do not inherit trapped positions', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/navigation.ts'), 'utf8')

    expect(source).toContain('router.push(href, { scroll: true })')
    expect(source).not.toContain('router.push(href, { scroll: false })')
  })
})
