import { describe, expect, it } from 'vitest'
import { GET as panelGet } from './[[...panel]]/route'
import { GET as agentsGet } from './agents/route'

describe('Gateway route aliases', () => {
  it('routes root Mission Control entry to the active TKMC home', async () => {
    const response = await panelGet(new Request('http://localhost/'), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/tkmc')
  })

  it('routes overview panel id to the active TKMC home', async () => {
    const response = await panelGet(new Request('http://localhost/overview'), {
      params: Promise.resolve({ panel: ['overview'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/tkmc')
  })

  it('routes the legacy /agent-network route to the production Agent Hub', async () => {
    const response = await panelGet(new Request('http://localhost/agent-network'), {
      params: Promise.resolve({ panel: ['agent-network'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway?tab=agent-hub')
  })

  it('routes the /gateway entry point to the production Agent Hub', async () => {
    const response = await panelGet(new Request('http://localhost/gateway'), {
      params: Promise.resolve({ panel: ['gateway'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway?tab=agent-hub')
  })

  it('routes legacy /gateways to Gateway FULL v3 overview', async () => {
    const response = await panelGet(new Request('http://localhost/gateways'), {
      params: Promise.resolve({ panel: ['gateways'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway')
  })

  it('routes legacy /gateway-config to Gateway FULL v3 policies', async () => {
    const response = await panelGet(new Request('http://localhost/gateway-config'), {
      params: Promise.resolve({ panel: ['gateway-config'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway?tab=policies')
  })

  it('routes Gateway parent panel id to the production Agent Hub', async () => {
    const response = await panelGet(new Request('http://localhost/gateway-parent'), {
      params: Promise.resolve({ panel: ['gateway-parent'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway?tab=agent-hub')
  })

  it('keeps the /agents clean route as a Gateway compatibility alias', async () => {
    const response = await agentsGet()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/gateway?tab=agent-hub')
  })
})
