import { describe, expect, it } from 'vitest'
import { GET as panelGet } from './[[...panel]]/route'
import { GET as agentsGet } from './agents/route'

describe('Gateway route aliases', () => {
  it('keeps the legacy /agent-network route routed to Gateway', async () => {
    const response = await panelGet(new Request('http://localhost/agent-network'), {
      params: Promise.resolve({ panel: ['agent-network'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/designer-mission-control/Mission%20Control.html?page=gateway')
  })

  it('keeps the new /gateway route routed to Gateway', async () => {
    const response = await panelGet(new Request('http://localhost/gateway'), {
      params: Promise.resolve({ panel: ['gateway'] }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/designer-mission-control/Mission%20Control.html?page=gateway')
  })

  it('keeps the /agents clean route as a Gateway compatibility alias', async () => {
    const response = await agentsGet()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/designer-mission-control/Mission%20Control.html?page=gateway')
  })
})
