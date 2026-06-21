import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GatewayShell from './GatewayShell'

const routerReplace = vi.fn()
const routerPush = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/gateway/agent-hub/agent-zero/chat',
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/agent-platform/AgentJobWorkspace', () => ({
  AgentJobWorkspace: () => <div>Durable job workspace</div>,
}))

describe('GatewayShell authenticated profile controls', () => {
  beforeEach(() => {
    routerReplace.mockReset()
    routerPush.mockReset()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: vi.fn(), href: 'https://tkmc.knowledge-vs-ai.com/gateway/agent-hub/agent-zero/chat' },
    })
  })

  it('shows the verified human session and performs real logout before returning to login', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/session' || url === '/api/auth/me') {
        return new Response(JSON.stringify({
          authenticated: true,
          actor_id: 'usr_7',
          display_name: 'Luis',
          account_type: 'human',
          roles: ['admin'],
          allowed_operations: ['mission-control:logout', 'mission-control:agent-platform:read'],
          csrf_required: true,
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url === '/api/auth/logout') {
        expect(init?.method).toBe('POST')
        return new Response(JSON.stringify({ ok: true, authenticated: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GatewayShell />)

    expect(await screen.findByText('Durable job workspace')).toBeInTheDocument()
    const sessionMenu = await screen.findByTestId('mission-control-session-menu')
    expect(sessionMenu).toHaveTextContent('Luis')
    expect(sessionMenu).toHaveTextContent('admin')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/login'))
  })
})
