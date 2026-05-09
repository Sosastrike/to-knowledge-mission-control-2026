#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const DEFAULT_ROUTES = [
  '/tkmc',
  '/gateway',
  '/gateway/agent-hub',
  '/gateway/bridge-session',
  '/gateway/agent-hub/paperclip',
]

const BASE_URL = process.env.MC_BASE_URL || 'http://127.0.0.1:3337'
const COOKIE_NAME = safeCookieName(process.env.MC_PROOF_COOKIE_NAME || 'mc-session')
const COOKIE_VALUE = process.env.MC_PROOF_COOKIE_VALUE || ''
const SESSION_KIND = process.env.MC_VISUAL_PROOF_SESSION_KIND || 'provided_session_not_owner_confirmed'
const OUT_PATH = process.env.MC_VISUAL_PROOF_OUT || 'runtime/day-22-authenticated-visual-proof-harness.json'
const SCREENSHOT_DIR = process.env.MC_VISUAL_PROOF_SCREENSHOT_DIR || 'runtime/day-22-authenticated-visual-proof-screenshots'
const ROUTES = parseRoutes(process.env.MC_VISUAL_PROOF_ROUTES)

async function main() {
  const generatedAt = new Date().toISOString()
  const baseOrigin = safeOrigin(BASE_URL)
  const ownerSessionAvailable = Boolean(COOKIE_VALUE.trim())
  const ownerVisualProofClaimed = ownerSessionAvailable && SESSION_KIND === 'owner'
  const proof = {
    schema: 'authenticated_visual_proof_v1',
    generated_at: generatedAt,
    base_origin: baseOrigin,
    routes: ROUTES,
    cookie_name: COOKIE_NAME,
    cookie_value_stored: false,
    session_kind: ownerSessionAvailable ? SESSION_KIND : 'none',
    owner_session_available: ownerSessionAvailable,
    owner_visual_proof_claimed: ownerVisualProofClaimed,
    blocker_class: ownerSessionAvailable ? 'NONE' : 'OWNER_GATED',
    blocker: ownerSessionAvailable ? null : 'owner_authenticated_browser_session_required',
    capture_mode: ownerSessionAvailable ? 'provided-session-capture' : 'owner-session-required',
    screenshots: [],
    authenticated_results: [],
    unauthenticated_probes: [],
    safety: {
      no_secret_values_written: true,
      no_env_changes: true,
      no_public_exposure_added: true,
      raw_path_scan: 'pending',
      secret_shape_scan: 'pending',
    },
  }

  proof.unauthenticated_probes = await probeUnauthenticated(baseOrigin, ROUTES)

  if (ownerSessionAvailable) {
    const capture = await captureAuthenticated(baseOrigin, ROUTES)
    proof.screenshots = capture.screenshots
    proof.authenticated_results = capture.results
    if (capture.blocker) {
      proof.blocker_class = 'BLOCKED'
      proof.blocker = capture.blocker
    }
  }

  const serialized = JSON.stringify(proof, null, 2)
  proof.safety.raw_path_scan = rawPathPattern().test(serialized) ? 'failed' : 'passed'
  proof.safety.secret_shape_scan = secretPattern().test(serialized) ? 'failed' : 'passed'

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({
    ok: true,
    output: OUT_PATH,
    owner_session_available: ownerSessionAvailable,
    owner_visual_proof_claimed: ownerVisualProofClaimed,
    blocker_class: proof.blocker_class,
    blocker: proof.blocker,
    screenshots: proof.screenshots.length,
  })}\n`)
}

async function probeUnauthenticated(baseOrigin, routes) {
  const probes = []
  for (const route of routes) {
    const url = new URL(route, baseOrigin)
    try {
      const response = await fetch(url, { redirect: 'manual' })
      probes.push({
        route,
        status: response.status,
        protected: response.status === 401 || response.status === 403 || isLoginRedirect(response),
        location: sanitizeHeader(response.headers.get('location')),
      })
    } catch (error) {
      probes.push({
        route,
        status: null,
        protected: false,
        error: redactText(error instanceof Error ? error.message : String(error)),
      })
    }
  }
  return probes
}

async function captureAuthenticated(baseOrigin, routes) {
  const screenshots = []
  const results = []
  let browser
  try {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1480, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    })
    await context.addCookies([{
      name: COOKIE_NAME,
      value: COOKIE_VALUE,
      url: baseOrigin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: baseOrigin.startsWith('https://'),
    }])
    const page = await context.newPage()

    for (const route of routes) {
      const target = new URL(route, baseOrigin).toString()
      const screenshotPath = path.join(SCREENSHOT_DIR, safeArtifactName(route))
      const startedAt = Date.now()
      try {
        const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(600)
        const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
        const redactedText = redactText(bodyText).slice(0, 1200)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        screenshots.push(screenshotPath)
        results.push({
          route,
          final_url: redactText(page.url()),
          http_status: response?.status() || null,
          title: redactText(await page.title()),
          elapsed_ms: Date.now() - startedAt,
          screenshot: screenshotPath,
          text_sample: redactedText,
          raw_path_detected: rawPathPattern().test(redactedText),
          secret_shape_detected: secretPattern().test(redactedText),
        })
      } catch (error) {
        results.push({
          route,
          final_url: redactText(page.url()),
          http_status: null,
          elapsed_ms: Date.now() - startedAt,
          screenshot: null,
          error: redactText(error instanceof Error ? error.message : String(error)),
        })
      }
    }
  } catch (error) {
    return {
      screenshots,
      results,
      blocker: `authenticated_visual_capture_failed:${redactText(error instanceof Error ? error.message : String(error))}`,
    }
  } finally {
    await browser?.close().catch(() => undefined)
  }

  return { screenshots, results, blocker: null }
}

function parseRoutes(value) {
  const routes = String(value || '')
    .split(',')
    .map((item) => normalizeRoute(item))
    .filter(Boolean)
  return Array.from(new Set(routes.length > 0 ? routes : DEFAULT_ROUTES))
}

function normalizeRoute(value) {
  const raw = String(value || '').trim()
  if (!raw || rawPathPattern().test(raw)) return null
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      return `${url.pathname}${url.search}${url.hash}` || '/'
    } catch {
      return null
    }
  }
  return `/${raw.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
}

function safeOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return 'http://127.0.0.1:3337'
  }
}

function safeCookieName(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value) ? value : 'mc-session'
}

function safeArtifactName(route) {
  if (rawPathPattern().test(route)) return 'redacted-path.png'
  const stem = String(route || '/')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${stem || 'root'}.png`
}

function isLoginRedirect(response) {
  const location = response.headers.get('location') || ''
  return response.status >= 300 && response.status < 400 && /\/login(?:$|[?#])/.test(location)
}

function sanitizeHeader(value) {
  if (!value) return null
  try {
    const url = new URL(value, BASE_URL)
    return `${url.pathname}${url.search ? '?[query-redacted]' : ''}`
  } catch {
    return redactText(value)
  }
}

function redactText(value) {
  return String(value || '')
    .replace(/(?:\/Users\/|\/home\/|\/var\/folders\/|file:\/\/)[^\s,;)]*auth\.json/gi, '[redacted-auth-file]')
    .replace(/auth\.json/gi, '[redacted-auth-file]')
    .replace(/\/Users\/[^/]+[^\s,;)]+/g, '[redacted-path]')
    .replace(/\/home\/[^/]+[^\s,;)]+/g, '[redacted-path]')
    .replace(/\/var\/folders\/[^\s,;)]+/g, '[redacted-path]')
    .replace(/file:\/\/[^\s,;)]+/gi, '[redacted-path]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9]{12,}/gi, '[redacted-secret]')
    .replace(/(?:^|[?&])(token|session|cookie|auth|key)=[^&\s]+/gi, '$1=[redacted]')
    .replace(/mc-session=[^;\s]+/gi, 'mc-session=[redacted]')
}

function rawPathPattern() {
  return /(?:\/Users\/|\/home\/|\/var\/folders\/|file:\/\/)/i
}

function secretPattern() {
  return /(?:Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]{12,}|mc-session=[^;\s]+)/i
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: redactText(error instanceof Error ? error.message : String(error)) })}\n`)
  process.exit(1)
})
