import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import { isHermesInstalled, isHermesGatewayRunning, scanHermesSessions } from '@/lib/hermes-sessions'
import { getHermesTasks } from '@/lib/hermes-tasks'
import { getHermesMemory } from '@/lib/hermes-memory'
import { classifyHermesStatus, redactSecretsDeep } from '@/lib/hermes-bridge'
import { buildHermesSkillInventory } from '@/lib/hermes-skills'

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


function isHermesSystemdActive(): boolean {
  try {
    const result = spawnSync('systemctl', ['--user', 'is-active', 'hermes-gateway.service'], {
      stdio: 'pipe',
      timeout: 3000,
      env: { ...process.env },
    })
    return result.status === 0 && result.stdout?.toString().trim() === 'active'
  } catch {
    return false
  }
}

function isHermesGatewayProcessRunning(): boolean {
  try {
    const result = spawnSync('pgrep', ['-f', 'hermes_cli.main gateway run'], {
      stdio: 'pipe',
      timeout: 3000,
      env: { ...process.env },
    })
    return result.status === 0 && Boolean(result.stdout?.toString().trim())
  } catch {
    return false
  }
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

function isNonEmptyFile(path: string): boolean {
  try {
    const stat = statSync(path)
    return stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

function getHermesAuthStatus() {
  const homeDir = config.homeDir || process.env.HOME || ''
  const hermesHome = join(homeDir, '.hermes')
  const authJsonConfigured = isNonEmptyFile(join(hermesHome, 'auth.json'))
  const envFileConfigured = isNonEmptyFile(join(hermesHome, '.env'))
  const configFileConfigured = isNonEmptyFile(join(hermesHome, 'config.yaml'))

  return {
    auth_configured: authJsonConfigured || envFileConfigured || configFileConfigured,
    source_types: {
      auth_json: authJsonConfigured,
      env_file: envFileConfigured,
      config_file: configFileConfigured,
    },
    values_exposed: false,
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

  const [providerStatus, binary, ecosystemContext] = await Promise.all([
    readProviderStatus(),
    Promise.resolve(detectHermesBinary()),
    buildAgentZeroEcosystemContext(),
  ])

  const provider = providerStatus.provider
  const installed = isHermesInstalled()
  const sandboxHomes = findSandboxHomes()
  const activeSessions = installed ? scanHermesSessions(25).filter((session) => session.isActive).length : 0
  const cronJobCount = installed ? getHermesTasks().cronJobs.length : 0
  const memoryEntries = installed ? getHermesMemory().agentMemoryEntries : 0
  const gatewaySystemdActive = isHermesSystemdActive()
  const gatewayProcessRunning = isHermesGatewayProcessRunning()
  const gatewayRunning = installed ? (isHermesGatewayRunning() || gatewaySystemdActive || gatewayProcessRunning) : false
  const authStatus = getHermesAuthStatus()
  const providerWarning = provider?.detail?.error || providerStatus.warning || null
  const statusSummary = classifyHermesStatus({
    installed,
    reachable: gatewayRunning,
    version: binary.version || provider?.detail?.version || null,
    authConfigured: authStatus.auth_configured,
    providerWarning,
  })
  const hermesSkillInventory = buildHermesSkillInventory(ecosystemContext)

  return NextResponse.json(redactSecretsDeep({
    ok: true,
    mode: 'hermes_lieutenant_status_read_only',
    generated_at: new Date().toISOString(),
    health: statusSummary.health,
    version: statusSummary.version,
    reachable: statusSummary.reachable,
    auth_configured: statusSummary.auth_configured,
    execution_enabled: statusSummary.execution_enabled,
    blocker: statusSummary.blocker,
    status_endpoint: '/api/bridge/hermes/status',
    test_chat_endpoint: '/api/bridge/hermes/test-chat',
    agent: {
      id: 'hermes',
      name: 'Hermes',
      role: 'lieutenant / skill and workflow specialist',
      allowed_behavior: ['read-only health/status checks', 'workflow analysis', 'skill review', 'recommendations for Agent Zero'],
      disallowed_behavior: ['production bridge execution without Bridge Session', 'public gateway exposure', 'legacy memory writes', 'credential changes'],
      execution_permission: 'lieutenant_read_only_until_bridge_session_approval',
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
      gateway_systemd_active: gatewaySystemdActive,
      gateway_process_running: gatewayProcessRunning,
      production_gateway_enabled: false,
      public_ports_enabled: false,
      legacy_memory_connection_enabled: false,
      credential_changes_enabled: false,
    },
    auth: authStatus,
    provider_registry: {
      state: provider?.state || (installed ? 'sandbox' : 'not_connected'),
      category: provider?.category || 'agent',
      last_checked_at: checkedAtToIso(provider?.last_checked),
      notes: provider?.detail?.notes || 'Hermes is visible as Agent Zero lieutenant in read-only/degraded mode until live chat and Bridge Session execution are proven.',
      limitation: 'Production bridge disabled until separate owner approval; no public ports, legacy memory connection, or credential changes are enabled here.',
      error: providerWarning,
      next_action: provider?.next_action || 'Keep Hermes lieutenant read-only/degraded until health, chat/API, and owner-approved Bridge Session execution are proven.',
    },
    shared_skill_runtime: {
      ...ecosystemContext.skills.shared_runtime,
      visible_to_hermes: true,
      visible_to_agent_zero: true,
      registry_source: 'OpenClaw+ shared skills/runtime layer',
      registry_total: ecosystemContext.skills.total,
      sources: ecosystemContext.skills.sources,
      registry: ecosystemContext.skills.registry,
      hermes_inventory: {
        total: hermesSkillInventory.total,
        blocked_total: hermesSkillInventory.blocked_total,
        missing_dependencies_total: hermesSkillInventory.missing_dependencies_total,
        role_tags: hermesSkillInventory.role_tags,
        role_tag_counts: hermesSkillInventory.role_tag_counts,
        draft_location: hermesSkillInventory.draft_location,
        draft_writes_enabled: hermesSkillInventory.draft_writes_enabled,
        production_skill_writes_enabled: hermesSkillInventory.production_skill_writes_enabled,
        activation_requires: hermesSkillInventory.activation_requires,
        review_workflow: hermesSkillInventory.review_workflow,
      },
      skill_workflow_specialist_status: {
        role: 'lieutenant / skill-workflow specialist',
        can_list_skills: true,
        can_design_skill_proposals_without_writing_files: true,
        can_design_workflow_plans_without_execution: true,
        can_write_drafts: false,
        can_activate_skills: false,
        activation_requires: 'agent_zero_bridge_session',
        agent_zero_reviews_before_activation: true,
      },
      note: 'Hermes and Agent Zero see the same OpenClaw+ skill registry under the active Gateway runtime chain.',
    },
    paperclip_workforce: {
      visible_to_hermes: true,
      visible_to_agent_zero: true,
      role: 'workforce_company_task_orchestration_layer',
      status_endpoint: '/api/bridge/paperclip/status',
      task_registry_endpoint: '/api/bridge/paperclip/tasks',
      proposals_endpoint: '/api/bridge/paperclip/proposals',
      can_design_workflow_task_template: true,
      can_propose_mini_agent_spec: true,
      can_draft_paperclip_routine: true,
      can_create_skill_proposal_document: true,
      can_activate_execution: false,
      agent_zero_review_required: true,
      owner_approval_required_if_protected_action: true,
      issue_or_work_product_storage: 'blocked_until_bridge_session_and_paperclip_write_adapter',
      execution_enabled: false,
      writes_enabled: false,
    },
    safety: {
      production_gateway_changes_enabled: false,
      public_port_changes_enabled: false,
      legacy_memory_connection_changed: false,
      credential_changes_enabled: false,
      execution_permissions_changed: false,
      protected_actions_created: false,
      writes_enabled: false,
    },
  }), { headers: { 'Cache-Control': 'no-store' } })
}
