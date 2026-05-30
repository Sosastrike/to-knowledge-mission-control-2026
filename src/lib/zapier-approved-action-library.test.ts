import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AGENT_INTERFACE_LINKS } from '@/components/gateway/GatewayShell'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

function request(url: string) {
  return new NextRequest(url)
}

describe('Zapier approved action library and Gateway copy', () => {
  it('exposes safe exact-scope Zapier actions without broad execution', async () => {
    const { buildZapierApprovedActionLibrary } = await import('@/lib/zapier-approved-action-library')
    const library = buildZapierApprovedActionLibrary()

    expect(library.status).toBe('CONNECTED_CONFIGURED')
    expect(library.card_copy).toMatchObject({
      status: 'Connected / configured',
      detail: 'Certified exact-scope Zapier actions are available.',
      guardrail: 'Broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
    })
    expect(library.actions.map((action) => action.action)).toEqual([
      'zapier.connection_probe',
      'zapier.tool_list',
      'zapier.zap_metadata_read',
      'zapier.approved_internal_trigger',
      'zapier.crm_lead_draft_or_queue',
      'zapier.social_post_draft',
      'zapier.owner_notification',
      'zapier.execution_status_check',
    ])

    for (const action of library.actions) {
      expect(action.adapter_id).toBe('zapier_exact_action_execute')
      expect(action.input_schema).toBeTruthy()
      expect(action.allowed_target).toBeTruthy()
      expect(action.audit_required).toBe(true)
      expect(action.credential_values_exposed).toBe(false)
      expect(action.broad_action_refusal_proof).toBe('broad_zapier_action_returns_hard_refusal')
      expect(action.forbidden_actions).toContain('broad Zapier execution')
    }

    expect(library.broad_execution_enabled).toBe(false)
    expect(library.no_zapier_writes_by_default).toBe(true)
    expect(JSON.stringify(library)).not.toContain('credential_required')
    expect(JSON.stringify(library)).not.toContain('adapter_missing')
  })

  it('serves the approved-action library through an authenticated read-only route', async () => {
    mocks.requireRole.mockReturnValue({ user: { role: 'viewer' } })
    const route = await import('@/app/api/bridge/zapier/approved-actions/route')
    const response = await route.GET(request('http://localhost/api/bridge/zapier/approved-actions'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.route).toBe('bridge.zapier.approved-actions')
    expect(payload.execution_enabled).toBe(true)
    expect(payload.external_writes_enabled).toBe(false)
    expect(payload.credential_values_exposed).toBe(false)
    expect(payload.actions.length).toBe(8)
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(NextRequest), 'viewer')
  })

  it('uses neutral connected copy on the Gateway Zapier card and static graph data', () => {
    const zapier = AGENT_INTERFACE_LINKS.find((row) => row.name === 'Zapier')
    expect(zapier).toMatchObject({
      status: 'Connected / configured',
      detail: 'Certified exact-scope Zapier actions are available.',
      guardrail: 'Broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
    })
    expect(zapier?.blocker).toBe('')

    const rootGraph = readFileSync(join(process.cwd(), 'public/design/gateway/shared/gateway-data.js'), 'utf8')
    const dropinGraph = readFileSync(join(process.cwd(), 'gateway-dropin/public/design/gateway/shared/gateway-data.js'), 'utf8')
    for (const graph of [rootGraph, dropinGraph]) {
      expect(graph).toContain("id: 'int.zapier'")
      expect(graph).toContain("summary: 'Certified exact-scope Zapier actions are available.'")
      expect(graph).toContain("guardrail_reason: 'Broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.'")
      expect(graph).not.toContain('Broad Zapier execution, Zap creation, and social posting remain blocked outside certified exact adapter scope')
      expect(graph).not.toContain('credential_required')
      expect(graph).not.toContain('adapter_missing')
    }
  })

  it('surfaces detailed Zapier connection inventory on the owner UI without secret values', () => {
    const page = readFileSync(join(process.cwd(), 'public/designer-mission-control/src/replicas/ZapierPage.jsx'), 'utf8')

    expect(page).toContain('Connection details')
    expect(page).toContain('Credential names only · values hidden')
    expect(page).toContain('No-secret proof')
    expect(page).toContain('connection_details')
    expect(page).toContain('provider_categories')
    expect(page).not.toContain('Bearer ')
    expect(page).not.toContain('process.env')
  })
})
