import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import { isHermesInstalled, isHermesGatewayRunning, scanHermesSessions } from '@/lib/hermes-sessions'
import { getHermesTasks } from '@/lib/hermes-tasks'
import { getHermesMemory } from '@/lib/hermes-memory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProviderStatus = {
  id?: string
  name?: string
  category?: string
  state?: string
  last_checked?: number
  detail?: {
    endpoint?: string | null
    version?: string | null
    notes?: string
    error?: string | null
  }
  next_action?: string | null
}

function versionFromOutput(output: string): string | null {
  const clean = output.split('\n').map((line) => line.trim()).filter(Boolean)
  const versionLine = clean.find((line) => /^Hermes Agent v/i.test(line))
  return versionLine || clean[0] || null
}

function detectHermesBinary(): { path: string | null; version: string | null; error: string | null } {
  const homeDir = config.homeDir || process.env.HOME || ''
  const dataDir = resolve(config.dataDir || '.data')
  const candidates = [
    process.env.HERMES_BIN,
    join(dataDir, '.local', 'bin', 'hermes'),
    join(dataDir, '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes'),
    join(homeDir, '.local', 'bin', 'hermes'),
    join(homeDir, '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes'),
    'hermes-agent',
    'hermes',
  ].filter((value): value is string => Boolean(value && value.trim()))

  for (const candidate of candidates) {
    try {
      if (candidate.startsWith('/') && !existsSync(candidate)) continue
      const result = spawnSync(candidate, ['--version'], {
        stdio: 'pipe',
        timeout: 5000,
        env: { ...process.env },
      })
      const output = `${result.stdout?.toString() || ''}${result.stderr?.toString() || ''}`.trim()
      const version = versionFromOutput(output)
      if (version) {
        return {
          path: candidate,
          version,
          error: result.error?.message || null,
        }
      }
    } catch {
      continue
    }
  }

  return { path: null, version: null, error: 'hermes_binary_not_found' }
}

function findSandboxHomes(): string[] {
  const sandboxRoot = '/home/tony/sandbox'
  try {
    if (!existsSync(sandboxRoot)) return []
    return readdirSync(sandboxRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('hermes-home-'))
      .map((entry) => join(sandboxRoot, entry.name))
      .sort()
  } catch {
    return []
  }
}

function checkedAtToIso(value: number | undefined): string | null {
  if (!Number.isFinite(value)) return null
  const timestamp = value as number
  return new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp).toISOString()
}

async function readProviderStatus() {
  if (!hasClaudeClawDashboardToken()) {
    return {
      provider: null as ProviderStatus | null,
      warning: 'claudeclaw_dashboard_token_missing',
    }
  }

  const upstream = await fetchClaudeClawJson<{ providers?: ProviderStatus[] }>(
    '/api/bridge/providers',
    {},
    12000,
  ).catch((error) => ({
    ok: false,
    status: 503,
    payload: { error: error instanceof Error ? error.message : 'provider_status_failed' },
  }))

  const providers = Array.isArray((upstream.payload as any)?.providers)
    ? ((upstream.payload as any).providers as ProviderStatus[])
    : []

  return {
    provider: providers.find((provider) => provider.id === 'hermes') || null,
    warning: upstream.ok ? null : ((upstream.payload as any)?.error || `provider status HTTP ${upstream.status}`),
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [providerStatus, binary] = await Promise.all([
    readProviderStatus(),
    Promise.resolve(detectHermesBinary()),
  ])

  const provider = providerStatus.provider
  const installed = isHermesInstalled()
  const sandboxHomes = findSandboxHomes()
  const activeSessions = installed ? scanHermesSessions(25).filter((session) => session.isActive).length : 0
  const cronJobCount = installed ? getHermesTasks().cronJobs.length : 0
  const memoryEntries = installed ? getHermesMemory().agentMemoryEntries : 0
  const gatewayRunning = installed ? isHermesGatewayRunning() : false

  return NextResponse.json({
    ok: true,
    mode: 'hermes_sandbox_specialist_status_read_only',
    generated_at: new Date().toISOString(),
    agent: {
      id: 'hermes',
      name: 'Hermes',
      role: 'sandbox skill/workflow specialist',
      allowed_behavior: ['sandbox testing', 'workflow analysis', 'skill review', 'recommendations'],
      disallowed_behavior: ['production bridge execution', 'public gateway exposure', 'legacy memory writes', 'credential changes'],
      execution_permission: 'sandbox_read_only_until_owner_approval',
      production_bridge_enabled: false,
      owner_approval_required_for_production_bridge: true,
    },
    install: {
      installed,
      binary_path: binary.path || provider?.detail?.endpoint || null,
      version: binary.version || provider?.detail?.version || null,
      version_error: binary.error,
      sandbox_homes: sandboxHomes,
      sandbox_state: sandboxHomes.length > 0 ? 'sandbox_available' : (installed ? 'installed_without_sandbox_home_detected' : 'not_installed'),
    },
    runtime_status: {
      active_sessions: activeSessions,
      cron_jobs: cronJobCount,
      memory_entries_read_only: memoryEntries,
      gateway_pid_running: gatewayRunning,
      production_gateway_enabled: false,
      public_ports_enabled: false,
      tony_memory_connection_enabled: false,
      credential_changes_enabled: false,
    },
    provider_registry: {
      state: provider?.state || (installed ? 'sandbox' : 'not_connected'),
      category: provider?.category || 'agent',
      last_checked_at: checkedAtToIso(provider?.last_checked),
      notes: provider?.detail?.notes || 'Hermes is visible as sandbox specialist only.',
      limitation: 'Production bridge disabled until separate owner approval; no public ports, legacy memory connection, or credential changes are enabled here.',
      error: provider?.detail?.error || providerStatus.warning || null,
      next_action: provider?.next_action || 'Keep Hermes sandbox/read-only until owner approves production bridge wiring.',
    },
    safety: {
      production_gateway_changes_enabled: false,
      public_port_changes_enabled: false,
      tony_memory_connection_changed: false,
      credential_changes_enabled: false,
      execution_permissions_changed: false,
      protected_actions_created: false,
      writes_enabled: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
