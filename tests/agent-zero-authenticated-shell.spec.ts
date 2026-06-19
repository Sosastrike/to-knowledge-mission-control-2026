import { expect, test } from '@playwright/test'
import http from 'node:http'
import type { Page } from '@playwright/test'

const AGENT_ZERO_MOCK_PORT = Number(process.env.AGENT_ZERO_MOCK_PORT || 39883)
const AGENT_ZERO_MOCK_ORIGIN = `http://127.0.0.1:${AGENT_ZERO_MOCK_PORT}`

let mockServer: http.Server | null = null

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function login(page: Page) {
  const user = process.env.AUTH_USER || 'testadmin'
  const pass = process.env.AUTH_PASS || 'testpass1234!'
  await page.goto('/login')
  await expect(page.locator('input[name="username"]')).toBeVisible()
  await page.locator('input[name="username"]').fill(user)
  await page.locator('input[name="password"]').fill(pass)
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await page.waitForURL(/\/designer-mission-control\/Mission%20Control\.html\?page=mission|\/$/, { timeout: 15000 })
}

test.beforeAll(async () => {
  mockServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', AGENT_ZERO_MOCK_ORIGIN)
    if (req.method !== 'POST' || url.pathname !== '/api/api_message') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'not_found' }))
      return
    }

    const body = await readBody(req)
    if (body.includes('FORCE_DEGRADED')) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'mock Agent Zero provider unavailable' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'AGENT_ZERO_OK', context_id: 'ctx_agent_zero_e2e', conversation_id: 'mission_control_agent_zero_owner' }))
  })

  await new Promise<void>((resolve, reject) => {
    mockServer?.once('error', reject)
    mockServer?.listen(AGENT_ZERO_MOCK_PORT, '127.0.0.1', () => resolve())
  })
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => mockServer?.close(() => resolve()))
  mockServer = null
})

test('authenticates into Agent Hub and opens Agent Zero through the TKMC shell', async ({ page }) => {
  const unsafeBrowserRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('100.116.35.95:50080') || /:\/\/localhost(?::|\/)/.test(url)) {
      unsafeBrowserRequests.push(url)
    }
  })

  await login(page)
  await page.goto('/gateway/agent-hub')
  await expect(page).toHaveURL(/\/gateway\/agent-hub$/)
  const iframe = page.locator('[data-testid="gateway-iframe"]')
  await expect(iframe).toBeVisible()
  const frame = page.frameLocator('[data-testid="gateway-iframe"]')
  await expect(frame.getByText('Agent Hub · Control Center')).toBeVisible()

  const agentHubResponse = await page.request.get('/api/gateway/agent-hub/agents')
  expect(agentHubResponse.status()).toBe(200)
  const agentHubPayload = await agentHubResponse.json()
  const agents = Array.isArray(agentHubPayload.agents) ? agentHubPayload.agents : []
  expect(agents.filter((agent: Record<string, unknown>) => agent.id === 'agent-zero' || agent.name === 'Agent Zero')).toHaveLength(1)
  expect(JSON.stringify(agentHubPayload)).not.toMatch(/"id"\s*:\s*"sofia"|"name"\s*:\s*"Sophia"|"name"\s*:\s*"Sofia"/i)

  const agentZeroLinkInfo = await iframe.evaluate((rawFrame) => {
    const doc = (rawFrame as HTMLIFrameElement).contentDocument
    if (!doc) return null
    const links = Array.from(doc.querySelectorAll('a')).map((link) => {
      const card = link.closest('.agent-card')
      return {
        text: link.textContent?.trim() || '',
        href: link.getAttribute('href') || '',
        safeHref: (link as HTMLElement).dataset.ccGatewaySafeHref || '',
        cardText: card?.textContent || '',
      }
    })
    return links.find((link) => link.text === 'Open UI' && /Agent Zero/.test(link.cardText)) || null
  })
  expect(agentZeroLinkInfo).toMatchObject({
    href: '/gateway/agent-hub/agent-zero/chat',
    safeHref: 'agent-zero-authenticated-shell',
  })
  expect(JSON.stringify(agentZeroLinkInfo)).not.toContain('100.116.35.95:50080')

  await frame.locator('a', { hasText: 'Open UI' }).nth(1).click()

  await expect(page).toHaveURL(/\/gateway\/agent-hub\/agent-zero\/chat$/)
  await expect(page.getByTestId('agent-control-agent-zero-chat')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Agent Zero · Chat/i })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('100.116.35.95:50080')
  await expect(page.locator('body')).not.toContainText('Sophia')
  expect(unsafeBrowserRequests).toEqual([])
})

test('returns AGENT_ZERO_OK through the authenticated read-only test channel', async ({ page }) => {
  const unsafeBrowserRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('100.116.35.95:50080')) unsafeBrowserRequests.push(url)
  })

  await login(page)
  await page.goto('/gateway/agent-hub/agent-zero/chat')
  await expect(page).toHaveURL(/\/gateway\/agent-hub\/agent-zero\/chat$/)
  await expect(page.getByTestId('agent-zero-readonly-chat')).toBeVisible()

  await page.getByLabel('Agent Zero read-only test message').fill('Reply exactly: AGENT_ZERO_OK')
  await page.getByTestId('agent-zero-test-send').click()
  await expect(page.getByTestId('agent-zero-test-result')).toContainText('AGENT_ZERO_OK', { timeout: 15000 })
  await expect(page.getByTestId('agent-zero-test-result')).toContainText('Execution')
  await expect(page.getByTestId('agent-zero-test-result')).toContainText('false')
  expect(unsafeBrowserRequests).toEqual([])
})

test('shows a bounded degraded state when Agent Zero provider is unavailable', async ({ page }) => {
  await login(page)
  await page.goto('/gateway/agent-hub/agent-zero/chat')
  await expect(page.getByTestId('agent-zero-readonly-chat')).toBeVisible()

  await page.getByLabel('Agent Zero read-only test message').fill('FORCE_DEGRADED')
  await page.getByTestId('agent-zero-test-send').click()
  await expect(page.getByTestId('agent-zero-test-result')).toContainText('Agent Zero degraded', { timeout: 15000 })
  await expect(page.getByTestId('agent-zero-test-result')).toContainText(/agent_zero_api_http_503|provider unavailable/i)
  await expect(page.getByTestId('agent-zero-test-loading')).toHaveCount(0)
})
