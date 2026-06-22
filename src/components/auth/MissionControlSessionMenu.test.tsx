import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissionControlSessionMenu } from './MissionControlSessionMenu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}))

describe('MissionControlSessionMenu', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        replace: vi.fn(),
      },
    })
  })

  it('shows a visible account route and performs real logout', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify({
          authenticated: true,
          actor_id: 'usr_7',
          display_name: 'Luis',
          account_type: 'human',
          roles: ['admin'],
          allowed_operations: ['mission-control:logout'],
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

    render(<MissionControlSessionMenu variant="global" hideWhenSignedOut />)

    expect(await screen.findByText('Luis')).toBeInTheDocument()
    expect(screen.getByText('human')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' })))
    expect(window.location.replace).toHaveBeenCalledWith('/login')
  })
})
