// Visual regression scaffold per Designer Contract operational change #2.
// Compares each rendered Gateway page (via GatewayShell at /gateway?tab=…)
// against the corresponding static mock under /design/gateway/ at 1480px,
// fails the build if pixel diff exceeds 1%.
//
// This file is a SCAFFOLD. To activate it on srv1568353:
//   pnpm add -D @playwright/test pixelmatch pngjs
//   npx playwright install chromium
//   pnpm exec playwright test gateway-dropin/tests/visual-regression.spec.ts
//
// The scaffold is intentionally not added to the default `npm test` invocation
// in gateway-dropin/package.json — it requires a headless browser, an
// running Mission Control v2 origin, and a baseline screenshot directory.
// Wire it into CI after the operator confirms the production origin.

import { test, expect, Page } from '@playwright/test'
// @ts-expect-error — pixelmatch + pngjs are CommonJS; types optional in this scaffold.
import pixelmatch from 'pixelmatch'
// @ts-expect-error
import { PNG } from 'pngjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.GATEWAY_VR_BASE ?? 'http://localhost:3000'
const VIEWPORT = { width: 1480, height: 900 }
const MAX_DIFF_FRACTION = 0.01   // 1% pixel-diff budget — Designer Contract said 99% match required

interface Pair { tab: string; mock: string }

const PAIRS: ReadonlyArray<Pair> = [
  { tab: 'overview',   mock: 'Gateway Overview.html' },
  { tab: 'agent-hub',  mock: 'Agent Hub.html' },
  { tab: 'paperclip',  mock: 'Paperclip.html' },
  { tab: 'dispatcher', mock: 'Dispatcher.html' },
  { tab: 'governor',   mock: 'Token Governor.html' },
  { tab: 'bridge',     mock: 'Bridge Session Flow.html' },
  { tab: 'health',     mock: 'Gateway Health.html' },
  { tab: 'routes',     mock: 'Gateway Routes.html' },
  { tab: 'registry',   mock: 'Gateway Registry.html' },
  { tab: 'policies',   mock: 'Gateway Policies.html' },
]

async function snap(page: Page, url: string): Promise<Buffer> {
  await page.setViewportSize(VIEWPORT)
  await page.goto(url, { waitUntil: 'networkidle' })
  // Crop to the iframe content area (skip the GatewayShell left rail at x<220).
  return await page.screenshot({ clip: { x: 220, y: 0, width: VIEWPORT.width - 220, height: VIEWPORT.height } })
}

async function snapMock(page: Page, mockFile: string): Promise<Buffer> {
  await page.setViewportSize(VIEWPORT)
  await page.goto(`${BASE}/design/gateway/${encodeURI(mockFile)}`, { waitUntil: 'networkidle' })
  return await page.screenshot({ clip: { x: 0, y: 0, width: VIEWPORT.width - 220, height: VIEWPORT.height } })
}

for (const pair of PAIRS) {
  test(`visual-regression: /gateway?tab=${pair.tab} matches ${pair.mock} at 1480px`, async ({ page }) => {
    const liveBuf = await snap(page, `${BASE}/gateway?tab=${pair.tab}`)
    const mockBuf = await snapMock(page, pair.mock)
    const live = PNG.sync.read(liveBuf)
    const mock = PNG.sync.read(mockBuf)
    expect(live.width, `width mismatch for ${pair.tab}`).toBe(mock.width)
    expect(live.height, `height mismatch for ${pair.tab}`).toBe(mock.height)
    const diff = new PNG({ width: live.width, height: live.height })
    const numDiff: number = pixelmatch(live.data, mock.data, diff.data, live.width, live.height, { threshold: 0.10 })
    const totalPixels = live.width * live.height
    const fraction = numDiff / totalPixels
    if (fraction > MAX_DIFF_FRACTION) {
      // On failure, surface the diff buffer for the PR reviewer.
      console.error(`[visual-regression] ${pair.tab}: ${(fraction * 100).toFixed(2)}% pixels differ (max ${MAX_DIFF_FRACTION * 100}%)`)
    }
    expect(fraction, `pixel diff ${(fraction * 100).toFixed(2)}% exceeds ${MAX_DIFF_FRACTION * 100}% for ${pair.tab}`).toBeLessThanOrEqual(MAX_DIFF_FRACTION)
  })
}

// Helper kept for ad-hoc inspection: load any mock by filename.
export async function captureMock(page: Page, filename: string): Promise<Buffer> {
  return snapMock(page, filename)
}

// Re-export the pair list so the same file can also drive a manual side-by-side
// screenshot harness used in the PR description (Designer Contract Rule 4).
export { PAIRS as VISUAL_REGRESSION_PAIRS }
// Suppress unused import warning when running outside Playwright env.
void readFileSync; void join
