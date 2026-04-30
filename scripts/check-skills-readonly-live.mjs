#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

if (!apiKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_api_key_for_local_check' }, null, 2))
  process.exit(1)
}

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

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers: {
      'x-api-key': apiKey,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(7000),
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body }
}

const list = await request('/api/skills')
const toolSkills = await request('/api/skills/tool-skills')
const search = await request('/api/skills/finder/search', {
  method: 'POST',
  body: JSON.stringify({ query: 'video' }),
})
const requestInstall = await request('/api/skills/finder/request-install', {
  method: 'POST',
  body: JSON.stringify({ name: 'watch_video', source: 'readonly-safety-probe' }),
})

const failures = []
if (list.status !== 200) failures.push({ path: '/api/skills', status: list.status, error: 'skills_list_failed' })
if (!Array.isArray(list.body?.skills)) failures.push({ path: '/api/skills', error: 'skills_array_missing' })

if (toolSkills.status !== 200) failures.push({ path: '/api/skills/tool-skills', status: toolSkills.status, error: 'tool_skills_failed' })
if (toolSkills.body?.state !== 'READ_ONLY') failures.push({ path: '/api/skills/tool-skills', state: toolSkills.body?.state, error: 'tool_skills_not_read_only' })
if (toolSkills.body?.execution_enabled === true) failures.push({ path: '/api/skills/tool-skills', error: 'tool_skills_execution_enabled' })

if (search.status !== 200) failures.push({ path: '/api/skills/finder/search', status: search.status, error: 'skill_search_failed' })
if (search.body?.state !== 'READ_ONLY') failures.push({ path: '/api/skills/finder/search', state: search.body?.state, error: 'skill_search_not_read_only' })
if (search.body?.execution_enabled === true) failures.push({ path: '/api/skills/finder/search', error: 'skill_search_execution_enabled' })

if (requestInstall.status !== 423) failures.push({ path: '/api/skills/finder/request-install', status: requestInstall.status, error: 'request_install_not_locked' })
if (requestInstall.body?.owner_approval_required !== true) failures.push({ path: '/api/skills/finder/request-install', error: 'request_install_missing_owner_approval' })
if (requestInstall.body?.execution_enabled === true) failures.push({ path: '/api/skills/finder/request-install', error: 'request_install_execution_enabled' })
if (requestInstall.body?.approval_request_created === true) failures.push({ path: '/api/skills/finder/request-install', error: 'request_install_created_fake_approval' })

const report = {
  ok: failures.length === 0,
  base_url: baseUrl,
  summary: {
    skills_count: Array.isArray(list.body?.skills) ? list.body.skills.length : 0,
    tool_skills_state: toolSkills.body?.state || null,
    search_state: search.body?.state || null,
    request_install_status: requestInstall.status,
    execution_enabled: false,
    approval_request_created: false,
  },
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
