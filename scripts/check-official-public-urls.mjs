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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function probeTarget(target, attempt) {
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    return {
      id: target.id,
      role: target.role,
      url: target.url,
      status: response.status,
      location: response.headers.get('location') || null,
      ok: target.expected_statuses.includes(response.status),
      attempt,
    }
  } catch (error) {
    return {
      id: target.id,
      role: target.role,
      url: target.url,
      status: 0,
      error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
      ok: false,
      attempt,
    }
  }
}

for (const target of targets) {
  const attempts = []
  let accepted = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await probeTarget(target, attempt)
    attempts.push(result)
    if (result.ok) {
      accepted = result
      break
    }
    if (attempt < 3) await wait(750 * attempt)
  }

  const result = {
    ...(accepted || attempts[attempts.length - 1]),
    attempts,
  }
  results.push(result)
  if (!result.ok) {
    failures.push({
      ...result,
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
