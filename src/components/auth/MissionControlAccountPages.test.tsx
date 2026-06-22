import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Mission Control direct account pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        replace: vi.fn(),
      },
    })
  })

  it('renders sanitized account details with a real logout action', async () => {
    const modulePath = './MissionControlAccountPages'
    const { MissionControlAccountPage } = await import(/* @vite-ignore */ modulePath)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/auth/session') {
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
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 })
    }))

    render(<MissionControlAccountPage />)

    expect(await screen.findByRole('heading', { name: /account/i })).toBeInTheDocument()
    expect(screen.getByText('Luis')).toBeInTheDocument()
    expect(screen.getByText('human')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /logout confirmation/i })).toHaveAttribute('href', '/logout')
    expect(screen.queryByText('usr_7')).not.toBeInTheDocument()
  })

  it('renders a confirmation logout page that posts to the logout API', async () => {
    const modulePath = './MissionControlAccountPages'
    const { MissionControlLogoutPage } = await import(/* @vite-ignore */ modulePath)
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

    render(<MissionControlLogoutPage />)

    expect(await screen.findByRole('heading', { name: /log out/i })).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm log out/i }))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' })))
    expect(window.location.replace).toHaveBeenCalledWith('/login')
  })
})
