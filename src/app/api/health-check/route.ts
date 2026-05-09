import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getAgentZeroBaseUrl } from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type HealthStatus = 'healthy' | 'configured' | 'degraded' | 'down' | 'missing_credential' | 'unchecked'
type HealthCategory = 'api' | 'service' | 'channel' | 'security' | 'storage'

type HealthCheck = {
  name: string
  category: HealthCategory
  status: HealthStatus
  message: string
  responseTime?: number
  lastChecked: number
  credential_names?: string[]
  execution_enabled?: false
  writes_enabled?: false
}

const ENV_FILES = [
  '/home/tony/mission-control/.env',
  '/home/tony/mission-control/.env.local',
  '/home/tony/claudeclaw/.env',
  '/home/tony/.openclaw/.env',
]

async function checkUrl(url: string, timeoutMs = 2500): Promise<{ ok: boolean; status: number; timeMs: number }> {
  const start = Date.now()
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return { ok: response.ok, status: response.status, timeMs: Date.now() - start }
  } catch {
    return { ok: false, status: 0, timeMs: Date.now() - start }
  }
}

function envNamePresentInFile(file: string, name: string): boolean {
  if (!existsSync(file)) return false
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .some((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return false
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx <= 0) return false
        return trimmed.slice(0, eqIdx).trim() === name && trimmed.slice(eqIdx + 1).trim().length > 0
      })
  } catch {
    return false
  }
}

function hasCredentialName(name: string): boolean {
  if (typeof process.env[name] === 'string' && process.env[name]?.trim()) return true
  return ENV_FILES.some((file) => envNamePresentInFile(file, name))
}

function credentialCheck(now: number, name: string, credentialNames: string[], role: string): HealthCheck {
  const present = credentialNames.some(hasCredentialName)
  return {
    name,
    category: 'api',
    status: present ? 'configured' : 'missing_credential',
    message: present
      ? `${role} credential is present by name. This endpoint does not run provider actions or expose secret values.`
      : `${role} credential is missing by name.`,
    credential_names: credentialNames,
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  }
}

function commandStatus(command: string, args: string[], timeout = 2500) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: {
        ...process.env,
        PATH: `/home/tony/.nvm/versions/node/v24.14.1/bin:${process.env.PATH || ''}`,
      },
      maxBuffer: 256 * 1024,
    })
    return { ok: true, stdout }
  } catch {
    return { ok: false, stdout: '' }
  }
}

function latestFileName(dir: string): string | null {
  try {
    if (!existsSync(dir)) return null
    return readdirSync(dir)
      .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]?.name || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const now = Date.now()
  const checks: HealthCheck[] = []

  checks.push(credentialCheck(now, 'OpenAI API', ['OPENAI_API_KEY'], 'OpenAI'))
  checks.push(credentialCheck(now, 'OpenRouter', ['OPENROUTER_API_KEY'], 'OpenRouter'))
  checks.push(credentialCheck(now, 'NVIDIA', ['NVIDIA_API_KEY', 'NGC_API_KEY', 'NVIDIA_NIM_API_KEY'], 'NVIDIA'))
  checks.push(credentialCheck(now, 'FireCrawl', ['FIRECRAWL_API_KEY'], 'FireCrawl'))

  const zapierTransport = hasCredentialName('ZAPIER_MCP_URL') || hasCredentialName('ZAPIER_MCP_SERVER')
  const zapierToken = hasCredentialName('ZAPIER_ACCESS_TOKEN') || hasCredentialName('ZAPIER_API_KEY')
  checks.push({
    name: 'Zapier MCP',
    category: 'channel',
    status: zapierTransport && zapierToken ? 'configured' : 'missing_credential',
    message: zapierTransport && zapierToken
      ? 'Zapier MCP transport/token are present by name. Tool execution and writes remain locked.'
      : 'Zapier MCP transport/token are missing by name.',
    credential_names: ['ZAPIER_MCP_URL', 'ZAPIER_MCP_SERVER', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY'],
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  checks.push({
    name: 'n8n',
    category: 'channel',
    status: hasCredentialName('N8N_BASE_URL') ? (hasCredentialName('N8N_API_KEY') ? 'configured' : 'missing_credential') : 'unchecked',
    message: 'n8n is status-only here. Workflow activation/execution remains locked behind owner approval.',
    credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'],
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  const ollama = await checkUrl('http://127.0.0.1:11434/api/tags')
  checks.push({
    name: 'Ollama',
    category: 'api',
    status: ollama.ok ? 'healthy' : 'unchecked',
    message: ollama.ok ? `Local Ollama responded (${ollama.status})` : 'Local Ollama did not respond on 127.0.0.1:11434',
    responseTime: ollama.timeMs,
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  const claude = commandStatus('claude', ['--version'])
  checks.push({
    name: 'Claude CLI',
    category: 'api',
    status: claude.ok ? 'healthy' : 'down',
    message: claude.ok ? 'Claude CLI is available through the Node v24 runtime path.' : 'Claude CLI command failed.',
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  const hermes = commandStatus('hermes', ['--version'])
  checks.push({
    name: 'Hermes',
    category: 'service',
    status: hermes.ok ? 'configured' : 'unchecked',
    message: hermes.ok ? 'Hermes CLI is installed. Production execution remains sandbox/approval-gated.' : 'Hermes CLI not found by this process.',
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  for (const [name, url] of [
    ['Mission Control', 'http://127.0.0.1:3337/login'],
    ['ClaudeClaw', 'http://127.0.0.1:3000/'],
    ['OpenClaw Gateway', 'http://127.0.0.1:18789/'],
    ['Agent Zero', `${getAgentZeroBaseUrl()}/api/health`],
  ] as const) {
    const result = await checkUrl(url)
    checks.push({
      name,
      category: 'service',
      status: result.ok || result.status > 0 ? 'healthy' : 'down',
      message: result.ok || result.status > 0 ? `Reachable (${result.status})` : 'Not reachable from Mission Control host.',
      responseTime: result.timeMs,
      lastChecked: now,
    })
  }

  checks.push({
    name: 'Discord Provider',
    category: 'channel',
    status: 'degraded',
    message: 'Discord is intentionally deferred/degraded until owner rotates or validates credentials. Main system health does not depend on Discord.',
    execution_enabled: false,
    writes_enabled: false,
    lastChecked: now,
  })

  try {
    const db = getDatabase()
    const total = db.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }
    const active = db.prepare("SELECT COUNT(*) AS count FROM agents WHERE status = 'active'").get() as { count: number }
    checks.push({
      name: 'Mission Control Agent Registry',
      category: 'service',
      status: total.count > 0 ? (active.count > 0 ? 'healthy' : 'degraded') : 'unchecked',
      message: `${active.count}/${total.count} registry agents active by Mission Control state.`,
      lastChecked: now,
    })
  } catch {
    checks.push({
      name: 'Mission Control Agent Registry',
      category: 'service',
      status: 'unchecked',
      message: 'Agent registry could not be read.',
      lastChecked: now,
    })
  }

  const disk = commandStatus('df', ['-h', '/'])
  checks.push({
    name: 'Server Disk',
    category: 'storage',
    status: disk.ok ? 'healthy' : 'unchecked',
    message: disk.ok ? disk.stdout.split('\n')[1]?.trim() || 'Disk command succeeded.' : 'Could not check disk.',
    lastChecked: now,
  })

  const backupName = latestFileName('/home/tony/.openclaw/backups/gold')
  checks.push({
    name: 'GOLD Backups',
    category: 'storage',
    status: backupName ? 'healthy' : 'degraded',
    message: backupName ? `Latest backup file visible: ${backupName}` : 'No gold backup file found.',
    lastChecked: now,
  })

  const healthy = checks.filter((check) => ['healthy', 'configured'].includes(check.status)).length
  const score = checks.length ? Math.round((healthy / checks.length) * 100) : 0

  return NextResponse.json({
    ok: true,
    mode: 'read_only_health_check',
    timestamp: now,
    score,
    summary: `${healthy}/${checks.length} checks healthy or configured`,
    no_secrets_returned: true,
    no_provider_generation_enabled: true,
    no_connector_execution_enabled: true,
    no_writes_enabled: true,
    checks,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
