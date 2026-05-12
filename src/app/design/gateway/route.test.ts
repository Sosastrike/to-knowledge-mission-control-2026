import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GET, HEAD } from './[[...path]]/route'

function request(pathname: string) {
  return new Request(`http://mission-control.test${pathname}`)
}

function context(path: string[]) {
  return {
    params: Promise.resolve({ path }),
  }
}

describe('/design/gateway raw designer asset route', () => {
  it('serves the accepted Agent Hub HTML raw from the mounted designer package', async () => {
    const response = await GET(request('/design/gateway/Agent%20Hub.html'), context(['Agent%20Hub.html']))
    const text = await response.text()
    const mounted = readFileSync(
      join(process.cwd(), 'public/designer-mission-control/design/gateway/Agent Hub.html'),
      'utf8',
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(text).toBe(mounted)
    expect(text).toContain('shared/agent-data.js')
    expect(text).toContain('Open full Workforce Control Plane')
  })

  it('serves the live data file as JavaScript without rewriting it', async () => {
    const response = await GET(request('/design/gateway/shared/agent-data.js'), context(['shared', 'agent-data.js']))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8')
    expect(text).toContain('window.AGENTS')
    expect(text).toContain('/api/gateway/agent-hub/status')
  })

  it('rejects traversal outside the Gateway design folder', async () => {
    const response = await GET(request('/design/gateway/../Mission%20Control.html'), context(['..', 'Mission%20Control.html']))

    expect(response.status).toBe(400)
  })

  it('supports HEAD for direct designer verification probes', async () => {
    const response = await HEAD(request('/design/gateway/Agent%20Hub.html'), context(['Agent%20Hub.html']))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(await response.text()).toBe('')
  })
})
