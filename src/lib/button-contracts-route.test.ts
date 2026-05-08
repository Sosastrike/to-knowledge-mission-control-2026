import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => ({ user: { role: 'admin' } })),
}))

type ButtonContract = {
  label: string
  endpoint: string | null
  method: string
  state: string
  execution_enabled: boolean
  fake_success_allowed: boolean
}

describe('Mission Control button contracts', () => {
  it('does not mark missing API endpoints as live or read-only actions', async () => {
    const route = await import('@/app/api/bridge/button-contracts/route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/button-contracts'))
    expect(response.status).toBe(200)
    const payload = await response.json() as { buttons: ButtonContract[]; no_fake_success: boolean; protected_execution_enabled: boolean }

    expect(payload.no_fake_success).toBe(true)
    expect(payload.protected_execution_enabled).toBe(false)

    const unsafeMissing = payload.buttons.filter((button) => {
      if (!['LIVE', 'READ_ONLY'].includes(button.state)) return false
      if (!button.endpoint?.startsWith('/api/')) return false
      return !apiRouteExists(button.endpoint)
    })

    expect(unsafeMissing).toEqual([])
    expect(payload.buttons.every((button) => button.fake_success_allowed === false)).toBe(true)
  })

  it('keeps mutating or credential-dependent actions non-executable from button contracts', async () => {
    const route = await import('@/app/api/bridge/button-contracts/route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/button-contracts'))
    const payload = await response.json() as { buttons: ButtonContract[] }

    const unsafeExecutable = payload.buttons.filter((button) =>
      ['BACKEND_REQUIRED', 'CREDENTIAL_REQUIRED', 'OWNER_APPROVAL_REQUIRED', 'DISABLED'].includes(button.state)
      && button.execution_enabled,
    )

    expect(unsafeExecutable).toEqual([])
  })
})

function apiRouteExists(endpoint: string): boolean {
  const path = endpoint.split('?')[0].replace(/^\/+/, '')
  const parts = path.split('/').filter(Boolean)
  const candidates = new Set<string>()

  candidates.add(join(process.cwd(), 'src/app', path, 'route.ts'))
  candidates.add(join(process.cwd(), 'src/app', ...parts.map((part) => part.startsWith(':') ? `[${part.slice(1)}]` : part), 'route.ts'))

  for (let index = parts.length; index > 0; index -= 1) {
    const prefix = parts.slice(0, index)
    candidates.add(join(process.cwd(), 'src/app', ...prefix, '[[...path]]', 'route.ts'))
    candidates.add(join(process.cwd(), 'src/app', ...prefix, '[...path]', 'route.ts'))
  }

  return Array.from(candidates).some((candidate) => existsSync(candidate))
}
