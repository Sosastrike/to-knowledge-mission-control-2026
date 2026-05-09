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
  credential_names?: string[]
  approval_required?: boolean
  audit_required?: boolean
  execution_enabled: boolean
  fake_success_allowed: boolean
  accepted_for_execution?: boolean
  owner_status?: {
    status: string
    tone: string
    blocker_class: string
  }
}

describe('Mission Control button contracts', () => {
  it('does not mark missing API endpoints as live or read-only actions', async () => {
    const route = await import('@/app/api/bridge/button-contracts/route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/button-contracts'))
    expect(response.status).toBe(200)
    const payload = await response.json() as { buttons: ButtonContract[]; no_fake_success: boolean; protected_execution_enabled: boolean; allowed_owner_statuses: string[] }

    expect(payload.no_fake_success).toBe(true)
    expect(payload.protected_execution_enabled).toBe(false)
    expect(payload.allowed_owner_statuses).toEqual(['LIVE', 'READY', 'OWNER_GATED', 'CREDENTIAL_GATED', 'SERVICE_DOWN', 'BLOCKED', 'DISABLED'])

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

  it('classifies Day 20 live blockers and approval-only actions without fake execution', async () => {
    const route = await import('@/app/api/bridge/button-contracts/route')
    const response = await route.GET(new NextRequest('http://localhost/api/bridge/button-contracts'))
    const payload = await response.json() as { buttons: ButtonContract[] }

    const brainStatus = payload.buttons.find((button) => button.label === 'Brain Sync source status')
    expect(brainStatus).toMatchObject({
      endpoint: '/api/bridge/brain-sync/status',
      state: 'READ_ONLY',
      execution_enabled: true,
      owner_status: {
        status: 'LIVE',
        tone: 'green',
        blocker_class: 'NONE',
      },
    })
    expect(brainStatus?.credential_names).toEqual([])

    const knowledgeReport = payload.buttons.find((button) => button.label === 'Knowledge report')
    expect(knowledgeReport).toMatchObject({
      endpoint: '/api/bridge/brain-sync/knowledge-report',
      state: 'READ_ONLY',
      execution_enabled: true,
      fake_success_allowed: false,
      owner_status: {
        status: 'LIVE',
        tone: 'green',
        blocker_class: 'NONE',
      },
    })

    const farmerLogs = payload.buttons.find((button) => button.label === 'Build-Wiki farmer logs')
    expect(farmerLogs).toMatchObject({
      endpoint: '/api/bridge/brain-sync/build-wiki/logs',
      state: 'BACKEND_REQUIRED',
      execution_enabled: false,
      owner_status: {
        status: 'SERVICE_DOWN',
        tone: 'red',
        blocker_class: 'SERVICE_DOWN',
      },
    })

    const runNow = payload.buttons.find((button) => button.label === 'Build-Wiki request run now')
    expect(runNow).toMatchObject({
      endpoint: '/api/bridge/brain-sync/build-wiki/run-now',
      state: 'OWNER_APPROVAL_REQUIRED',
      approval_required: true,
      audit_required: true,
      execution_enabled: false,
      fake_success_allowed: false,
      owner_status: {
        status: 'OWNER_GATED',
        tone: 'yellow',
        blocker_class: 'OWNER_GATED',
      },
    })

    const obsidianStatus = payload.buttons.find((button) => button.label === 'Obsidian adapter status')
    expect(obsidianStatus).toMatchObject({
      endpoint: '/api/bridge/agent-zero/obsidian',
      state: 'READ_ONLY',
      execution_enabled: true,
      fake_success_allowed: false,
    })

    const obsidianWrites = payload.buttons.find((button) => button.label === 'Obsidian note write actions')
    expect(obsidianWrites).toMatchObject({
      endpoint: '/api/bridge/agent-zero/execute',
      state: 'OWNER_APPROVAL_REQUIRED',
      approval_required: true,
      audit_required: true,
      execution_enabled: false,
      fake_success_allowed: false,
      owner_status: {
        status: 'OWNER_GATED',
        tone: 'yellow',
        blocker_class: 'OWNER_GATED',
      },
    })
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
