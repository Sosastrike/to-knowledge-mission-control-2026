import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReadinessState =
  | 'LIVE'
  | 'READ_ONLY'
  | 'BACKEND_REQUIRED'
  | 'CREDENTIAL_REQUIRED'
  | 'OWNER_APPROVAL_REQUIRED'
  | 'DISABLED'

type ConnectorReadiness = {
  id: string
  label: string
  role: string
  state: ReadinessState
  read_only_endpoint: string | null
  execution_endpoint: string | null
  credential_names: string[]
  credentials_present_by_name: Record<string, boolean>
  approval_required_for_execution: boolean
  audit_required_for_execution: boolean
  writes_enabled: boolean
  execution_enabled: boolean
  current_safe_actions: string[]
  blocked_actions: string[]
  blocker: string | null
  next_action: string
}

function hasEnv(name: string): boolean {
  return Boolean((process.env[name] || '').trim())
}

function credentialMap(names: string[]): Record<string, boolean> {
  return Object.fromEntries(names.map((name) => [name, hasEnv(name)]))
}

function missing(names: string[]): string[] {
  return names.filter((name) => !hasEnv(name))
}

function envFileHasName(path: string, name: string): boolean {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .some((line) => line.trim().startsWith(`${name}=`))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const firecrawlMissing = missing(['FIRECRAWL_API_KEY'])
  const missionControlEnvHasFirecrawl =
    envFileHasName(join(process.cwd(), '.env'), 'FIRECRAWL_API_KEY') ||
    envFileHasName(join(process.cwd(), '.env.local'), 'FIRECRAWL_API_KEY')
  const claudeClawEnvHasFirecrawl = envFileHasName('/home/tony/claudeclaw/.env', 'FIRECRAWL_API_KEY')
  const openClawEnvHasFirecrawl = envFileHasName('/home/tony/.openclaw/.env', 'FIRECRAWL_API_KEY')
  const firecrawlSdkPresent = existsSync(join(process.cwd(), 'node_modules/@mendable/firecrawl-js/package.json'))
  const zapierCredentialNames = ['ZAPIER_MCP_URL', 'ZAPIER_MCP_SERVER', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY']
  const zapierHasTransport = hasEnv('ZAPIER_MCP_URL') || hasEnv('ZAPIER_MCP_SERVER')
  const zapierHasToken = hasEnv('ZAPIER_ACCESS_TOKEN') || hasEnv('ZAPIER_API_KEY')
  const n8nMissing = missing(['N8N_BASE_URL', 'N8N_API_KEY'])

  const connectors: ConnectorReadiness[] = [
    {
      id: 'firecrawl',
      label: 'FireCrawl',
      role: 'research/crawl/scrape connector',
      state: firecrawlMissing.length ? 'CREDENTIAL_REQUIRED' : 'BACKEND_REQUIRED',
      read_only_endpoint: '/api/firecrawl/status',
      execution_endpoint: '/api/firecrawl/jobs',
      credential_names: ['FIRECRAWL_API_KEY'],
      credentials_present_by_name: {
        FIRECRAWL_API_KEY: hasEnv('FIRECRAWL_API_KEY'),
        MISSION_CONTROL_ENV_FIRECRAWL_API_KEY: missionControlEnvHasFirecrawl,
        CLAUDECLAW_ENV_FIRECRAWL_API_KEY: claudeClawEnvHasFirecrawl,
        OPENCLAW_ENV_FIRECRAWL_API_KEY: openClawEnvHasFirecrawl,
        MISSION_CONTROL_FIRECRAWL_SDK: firecrawlSdkPresent,
      },
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['status/readiness only'],
      blocked_actions: ['crawl', 'scrape', 'export', 'send to memory'],
      blocker: firecrawlMissing.length
        ? 'Mission Control FIRECRAWL_API_KEY is missing from the service environment'
        : !firecrawlSdkPresent
          ? 'Mission Control FireCrawl SDK package is missing'
          : 'SDK runner/job persistence not enabled',
      next_action: firecrawlMissing.length
        ? 'Use the owner-approved credential sync path; ClaudeClaw/OpenClaw may have FIRECRAWL_API_KEY, but Mission Control does not.'
        : !firecrawlSdkPresent
          ? 'Install @mendable/firecrawl-js only after owner-approved package/change window.'
          : 'Implement job persistence and approval-gated runner without enabling writes by default.',
    },
    {
      id: 'viral_crawl_video',
      label: 'Viral Crawl Video Intelligence',
      role: 'video-to-brain wrapper and Obsidian destination status',
      state: 'READ_ONLY',
      read_only_endpoint: '/api/viral-crawl/video/status',
      execution_endpoint: '/api/viral-crawl/video/request-run',
      credential_names: [],
      credentials_present_by_name: {},
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['wrapper/vendor/Obsidian/skill registry status only'],
      blocked_actions: ['run video wrapper', 'download video', 'write notes to Obsidian from UI', 'queue video jobs'],
      blocker: 'UI execution is disabled until approval persistence, audit chain, and a safe runner are approved.',
      next_action: 'Surface /api/viral-crawl/video/status in the UI as BACKEND_READY_CLI/read-only; do not invoke the wrapper from Mission Control yet.',
    },
    {
      id: 'zapier',
      label: 'Zapier MCP',
      role: 'automation connector and tool inventory',
      state: !zapierHasTransport || !zapierHasToken ? 'CREDENTIAL_REQUIRED' : 'READ_ONLY',
      read_only_endpoint: '/api/zapier/tools',
      execution_endpoint: '/api/zapier/request-write-approval',
      credential_names: zapierCredentialNames,
      credentials_present_by_name: credentialMap(zapierCredentialNames),
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['tool-list only when transport/auth are configured', 'no tool invocation'],
      blocked_actions: ['create', 'update', 'delete', 'send', 'post', 'upload', 'run', 'execute'],
      blocker: !zapierHasTransport || !zapierHasToken
        ? 'missing Zapier MCP transport or token'
        : 'write approval persistence not applied',
      next_action: 'Keep reads/tool inventory separate from writes; enable writes only after owner-approved approval/audit persistence.',
    },
    {
      id: 'n8n',
      label: 'n8n',
      role: 'workflow status/execution connector',
      state: n8nMissing.length ? 'CREDENTIAL_REQUIRED' : 'BACKEND_REQUIRED',
      read_only_endpoint: '/api/n8n/status',
      execution_endpoint: '/api/n8n/workflows/:id/:action',
      credential_names: ['N8N_BASE_URL', 'N8N_API_KEY'],
      credentials_present_by_name: credentialMap(['N8N_BASE_URL', 'N8N_API_KEY']),
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['status/readiness only'],
      blocked_actions: ['workflow activate', 'workflow deactivate', 'workflow execute'],
      blocker: n8nMissing.length ? `missing ${n8nMissing.join(', ')}` : 'REST passthrough and approval persistence not completed',
      next_action: n8nMissing.length
        ? 'Owner configures N8N_BASE_URL and N8N_API_KEY through approved secret path.'
        : 'Implement read-only workflow/execution list before protected workflow actions.',
    },
    {
      id: 'mcp_tools',
      label: 'MCP Tools',
      role: 'MCP server and tool visibility',
      state: 'READ_ONLY',
      read_only_endpoint: '/api/mcp/servers',
      execution_endpoint: '/api/mcp/servers/:id/:action',
      credential_names: [],
      credentials_present_by_name: {},
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['server summary', 'server detail list', 'known status probes'],
      blocked_actions: ['enable', 'disable', 'reauth', 'tool invocation'],
      blocker: 'per-tool read/write classification and execution runner not enabled',
      next_action: 'Keep /api/mcp/status as summary and /api/mcp/servers as detail; add tool classification before any invocation.',
    },
    {
      id: 'skills_registry',
      label: 'Skills Registry',
      role: 'skill discovery and future install flow',
      state: 'READ_ONLY',
      read_only_endpoint: '/api/skills/finder/search',
      execution_endpoint: '/api/skills/finder/request-install',
      credential_names: [],
      credentials_present_by_name: {},
      approval_required_for_execution: true,
      audit_required_for_execution: true,
      writes_enabled: false,
      execution_enabled: false,
      current_safe_actions: ['list/search only'],
      blocked_actions: ['install', 'enable', 'disable', 'arbitrary test execution'],
      blocker: 'install runner and approval persistence not enabled',
      next_action: 'Keep POST /api/skills/registry approval-required and canonicalize installs through /api/skills/finder/request-install.',
    },
  ]

  return NextResponse.json({
    ok: true,
    mode: 'connector_readiness_read_only',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_connector_writes_enabled: true,
    connectors,
    summary: {
      total: connectors.length,
      by_state: connectors.reduce((acc, connector) => {
        acc[connector.state] = (acc[connector.state] || 0) + 1
        return acc
      }, {} as Record<ReadinessState, number>),
      execution_enabled: connectors.filter((connector) => connector.execution_enabled).length,
      writes_enabled: connectors.filter((connector) => connector.writes_enabled).length,
      owner_approval_required_for_execution: connectors.filter((connector) => connector.approval_required_for_execution).length,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
