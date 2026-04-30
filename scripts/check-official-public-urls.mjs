#!/usr/bin/env node

const targets = [
  {
    id: 'tkmc_login',
    url: process.env.TKMC_LOGIN_URL || 'https://tkmc.knowledge-vs-ai.com/login',
    expected_statuses: [200],
    role: 'official Mission Control / TKMC login',
  },
  {
    id: 'claudeclaw_admin',
    url: process.env.CLAUDECLAW_ADMIN_URL || 'https://mc.knowledge-vs-ai.com/',
    expected_statuses: [200, 401, 302, 307, 308],
    role: 'official ClaudeClaw owner/admin dashboard',
  },
  {
    id: 'openclaw_gateway',
    url: process.env.OPENCLAW_GATEWAY_URL || 'https://gw.knowledge-vs-ai.com/',
    expected_statuses: [200],
    role: 'official OpenClaw Gateway',
  },
]

const results = []
const failures = []

for (const target of targets) {
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const result = {
      id: target.id,
      role: target.role,
      url: target.url,
      status: response.status,
      location: response.headers.get('location') || null,
      ok: target.expected_statuses.includes(response.status),
    }
    results.push(result)
    if (!result.ok) {
      failures.push({
        ...result,
        expected_statuses: target.expected_statuses,
      })
    }
  } catch (error) {
    failures.push({
      id: target.id,
      role: target.role,
      url: target.url,
      status: 0,
      error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
      expected_statuses: target.expected_statuses,
    })
  }
}

const report = {
  ok: failures.length === 0,
  checked_at: new Date().toISOString(),
  policy: {
    no_temporary_8080_urls: true,
    mission_control: 'https://tkmc.knowledge-vs-ai.com/login',
    claudeclaw_admin: 'https://mc.knowledge-vs-ai.com/',
    openclaw_gateway: 'https://gw.knowledge-vs-ai.com/',
  },
  results,
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
