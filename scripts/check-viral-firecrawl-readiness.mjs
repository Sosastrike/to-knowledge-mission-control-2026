#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

function readApiKeyFromDb() {
  try {
    return execFileSync('sqlite3', [
      '.data/mission-control.db',
      "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;",
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: apiKey ? { 'x-api-key': apiKey } : {},
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body }
}

const failures = []
const video = await getJson('/api/viral-crawl/video/status')
const firecrawl = await getJson('/api/firecrawl/status')

if (video.status !== 200 || video.body?.ok !== true) {
  failures.push({ endpoint: '/api/viral-crawl/video/status', status: video.status, error: 'video_status_not_ok' })
}
if (video.body?.execution_enabled !== false) {
  failures.push({ endpoint: '/api/viral-crawl/video/status', error: 'video_execution_not_disabled' })
}
for (const field of ['wrapper_present', 'vendor_skill_present', 'obsidian_destination_present', 'skill_registry_present', 'enabled']) {
  if (video.body?.[field] !== true) failures.push({ endpoint: '/api/viral-crawl/video/status', field, error: 'expected_true' })
}

if (firecrawl.status !== 200 || firecrawl.body?.ok !== true) {
  failures.push({ endpoint: '/api/firecrawl/status', status: firecrawl.status, error: 'firecrawl_status_not_ok' })
}
if (firecrawl.body?.firecrawl_backend_truth?.mismatch !== true) {
  failures.push({ endpoint: '/api/firecrawl/status', error: 'expected_mission_control_firecrawl_mismatch_to_be_visible' })
}
if (firecrawl.body?.key_present !== false || firecrawl.body?.sdk_loaded !== false) {
  failures.push({ endpoint: '/api/firecrawl/status', error: 'expected_mission_control_firecrawl_credential_and_sdk_to_remain_missing' })
}

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    base_url: baseUrl,
    failures,
    video: {
      status: video.status,
      ok: video.body?.ok,
      state: video.body?.state,
      execution_enabled: video.body?.execution_enabled,
      notes_count: video.body?.notes_count,
    },
    firecrawl: {
      status: firecrawl.status,
      ok: firecrawl.body?.ok,
      state: firecrawl.body?.status,
      key_present: firecrawl.body?.key_present,
      sdk_loaded: firecrawl.body?.sdk_loaded,
      mismatch: firecrawl.body?.firecrawl_backend_truth?.mismatch,
    },
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  base_url: baseUrl,
  video: {
    state: video.body?.state,
    execution_enabled: video.body?.execution_enabled,
    wrapper_present: video.body?.wrapper_present,
    vendor_skill_present: video.body?.vendor_skill_present,
    obsidian_destination_present: video.body?.obsidian_destination_present,
    skill_registry_present: video.body?.skill_registry_present,
    enabled: video.body?.enabled,
    notes_count: video.body?.notes_count,
  },
  firecrawl: {
    state: firecrawl.body?.status,
    key_present: firecrawl.body?.key_present,
    sdk_loaded: firecrawl.body?.sdk_loaded,
    mismatch: firecrawl.body?.firecrawl_backend_truth?.mismatch,
    approved_fix_required: firecrawl.body?.firecrawl_backend_truth?.approved_fix_required,
  },
}, null, 2))
