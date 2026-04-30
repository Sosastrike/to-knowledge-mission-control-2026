#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const localBaseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const publicLoginUrl = process.env.TKMC_LOGIN_URL || 'https://tkmc.knowledge-vs-ai.com/login'

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 2 * 1024 * 1024,
    }).trim()
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 240) : 'command_failed'
  }
}

async function statusFor(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    return { ok: response.status >= 200 && response.status < 400, status: response.status }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed' }
  }
}

const service = run('systemctl', ['is-active', 'mission-control.service'])
const listener = run('bash', ['-lc', "ss -H -ltnp | awk '/:3337/ {print}'"])
const localLogin = await statusFor(`${localBaseUrl}/login`)
const publicLogin = await statusFor(publicLoginUrl)

const failures = []
if (service !== 'active') failures.push({ check: 'mission-control.service', value: service, error: 'service_not_active' })
if (!listener.includes('127.0.0.1:3337')) failures.push({ check: '127.0.0.1:3337', value: listener, error: 'listener_missing' })
if (!localLogin.ok) failures.push({ check: 'local_login', ...localLogin })
if (!publicLogin.ok || publicLogin.status !== 200) failures.push({ check: 'public_login', ...publicLogin })

const report = {
  ok: failures.length === 0,
  service,
  listener,
  local_login: localLogin,
  public_login: publicLogin,
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
