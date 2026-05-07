import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetchClaudeClawJson } from '@/lib/claudeclaw-telegram-approvals'
import { getMcpServerTools } from '@/lib/mcp-server-tool-schemas'
import { getZapierToolBridge, type ZapierToolRecord } from '@/lib/zapier-tool-bridge'
import { getAllModels } from '@/lib/models'
import { getDatabase } from '@/lib/db'
import {
  BUILDWIKI_ACTION_RUN_NOW,
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_KEY,
  BUILDWIKI_TARGET_SERVICE,
  deriveRunNowUiState,
  readLatestRunNow,
} from '@/lib/build-wiki-run-now'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'
import { buildPaperclipStatusPayload } from '@/lib/paperclip-bridge'
import { inferSkillRoleTags } from '@/lib/skill-role-tags'
import { getGitHubToken } from '@/lib/github'
import { getAgentZeroObsidianStatus } from '@/lib/agent-zero-obsidian-adapter'
import { getAgentZeroMemPalaceStatus } from '@/lib/agent-zero-mempalace-adapter'
import { readLatestAgentZeroBridgeSession } from '@/lib/agent-zero-bridge-session'
import {
  type AgentZeroCapabilityState,
  type AgentZeroBrainApiSummary,
  type AgentZeroBrainIndexSummary,
  type AgentZeroBrainPathStatus,
  type AgentZeroBrainSourceRegistryItem,
  type AgentZeroBrainWatchersSummary,
  type AgentZeroBuildWikiFarmerSummary,
  type AgentZeroIntegrationCapability,
  type AgentZeroModelProviderStatus,
  type AgentZeroModelProviderSummary,
  type AgentZeroReadOnlyContext,
  type AgentZeroReadOnlyEndpointSummary,
  type AgentZeroSkillRegistryItem,
  type AgentZeroSkillSourceSummary,
  type AgentZeroToolRegistryItem,
  type EcosystemAccessState,
  buildAgentZeroReadOnlyContext,
} from '@/lib/agent-zero-bridge'

type ProviderStatus = {
  id?: string
  name?: string
  state?: string
  status?: string
  category?: string
  type?: string
}

type BrainSyncPayload = {
  sources?: Array<{
    source?: string
    state?: string
    status?: string
    raw_state?: string
    last_success_at?: number | null
    last_attempt_at?: number | null
    last_error?: string | null
    summary?: string
    details?: Record<string, unknown>
  }>
}

type BrainContextPayload = {
  ok?: boolean
  source_status?: Array<{
    source?: string
    state?: string
    path?: string
    count?: number
    detail?: string
  }>
  source_contracts?: Array<{
    source?: string
    current_status?: string
    read_path?: string
    write_path?: string
    owner_approval_required?: boolean
    writes_enabled_from_shared_context?: boolean
    notes?: string
    risks?: string[]
  }>
  agent_consumers?: unknown[]
  write_contract?: unknown
}

function execFileText(command: string, args: string[], timeout = 2500): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout,
        env: {
          ...process.env,
          XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
        },
      },
      (_error, stdout) => resolve(String(stdout || '')),
    )
  })
}

type SkillRegistryReadResult = {
  items: AgentZeroSkillRegistryItem[]
  sources: AgentZeroSkillSourceSummary[]
}

function readSkillNames(): string[] {
  try {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT name FROM skills ORDER BY name LIMIT 200')
      .all() as Array<{ name?: string }>
    return rows.map((row) => String(row.name || '')).filter(Boolean)
  } catch {
    return []
  }
}

function sanitizeDescription(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260)
}

function parseFrontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'))
  if (!match) return null
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

function parseFrontmatterList(frontmatter: string, key: string): string[] {
  const inline = parseFrontmatterValue(frontmatter, key)
  if (inline) {
    if (inline.startsWith('[') && inline.endsWith(']')) {
      return inline
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
    return [inline].filter(Boolean)
  }

  const block = frontmatter.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, 'mi'))
  if (!block) return []
  return block[1]
    .split('\n')
    .map((line) => line.replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

type SkillFileMetadata = {
  name: string | null
  description: string
  dependencies: string[]
  requiredTools: string[]
  requiredCredentials: string[]
  executionRequirements: string[]
}

function normalizeCredentialName(value: string): string | null {
  const cleaned = value.trim().replace(/^env:/i, '').replace(/^credential:/i, '')
  if (!cleaned || !/^[A-Z0-9_][A-Z0-9_.-]{1,80}$/i.test(cleaned)) return null
  return cleaned.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

function normalizeToolRequirement(value: string): string | null {
  const cleaned = value.trim().replace(/^tool:/i, '')
  if (!cleaned || cleaned.length > 120) return null
  return cleaned
}

function readSkillMarkdownMetadata(skillDoc: string): SkillFileMetadata {
  const content = readFileSync(skillDoc, 'utf8').slice(0, 20000)
  const frontmatter = content.startsWith('---\n') ? content.match(/^---\n([\s\S]*?)\n---/)?.[1] || '' : ''
  const name = frontmatter ? parseFrontmatterValue(frontmatter, 'name') : null
  const description = frontmatter
    ? parseFrontmatterValue(frontmatter, 'description')
    : null
  const tools = frontmatter
    ? parseFrontmatterList(frontmatter, 'tools').map(normalizeToolRequirement).filter((tool): tool is string => Boolean(tool))
    : []
  const requiredCredentials = frontmatter
    ? [
        ...parseFrontmatterList(frontmatter, 'credentials'),
        ...parseFrontmatterList(frontmatter, 'required_credentials'),
        ...parseFrontmatterList(frontmatter, 'credential_names'),
        ...parseFrontmatterList(frontmatter, 'env'),
      ].map(normalizeCredentialName).filter((credential): credential is string => Boolean(credential))
    : []
  const dependencies = frontmatter
    ? [
        ...parseFrontmatterList(frontmatter, 'dependencies'),
        ...tools.map((tool) => `tool:${tool}`),
        ...requiredCredentials.map((credential) => `credential:${credential}`),
      ]
    : []
  const executionRequirements = frontmatter
    ? parseFrontmatterList(frontmatter, 'execution_requirements')
    : []

  if (description) {
    return {
      name,
      description: sanitizeDescription(description),
      dependencies,
      requiredTools: tools,
      requiredCredentials,
      executionRequirements,
    }
  }

  const firstBodyLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('---') && !line.startsWith('#') && !line.includes(':'))
  return {
    name,
    description: sanitizeDescription(firstBodyLine || 'Skill metadata visible; no description declared.'),
    dependencies,
    requiredTools: tools,
    requiredCredentials,
    executionRequirements,
  }
}

function readSkillJsonMetadata(skillJson: string): SkillFileMetadata {
  const json = JSON.parse(readFileSync(skillJson, 'utf8')) as {
    name?: string
    description?: string
    tools?: string[]
    dependencies?: string[]
    credentials?: string[]
    required_credentials?: string[]
    credential_names?: string[]
    execution_requirements?: string[]
  }
  const requiredTools = (Array.isArray(json.tools) ? json.tools : [])
    .map(normalizeToolRequirement)
    .filter((tool): tool is string => Boolean(tool))
  const requiredCredentials = [
    ...(Array.isArray(json.credentials) ? json.credentials : []),
    ...(Array.isArray(json.required_credentials) ? json.required_credentials : []),
    ...(Array.isArray(json.credential_names) ? json.credential_names : []),
  ].map(normalizeCredentialName).filter((credential): credential is string => Boolean(credential))
  return {
    name: json.name || null,
    description: sanitizeDescription(json.description || 'Skill metadata visible; no description declared.'),
    dependencies: [
      ...(Array.isArray(json.dependencies) ? json.dependencies : []),
      ...requiredTools.map((tool) => `tool:${tool}`),
      ...requiredCredentials.map((credential) => `credential:${credential}`),
    ],
    requiredTools,
    requiredCredentials,
    executionRequirements: Array.isArray(json.execution_requirements) ? json.execution_requirements : [],
  }
}

function skillDependencyMetadata(skillPath: string, baseDependencies: string[]): {
  dependencies: string[]
  required_tools: string[]
  required_credentials: string[]
  execution_requirements: string[]
  missing_dependencies: string[]
  blocked_dependencies: string[]
  blocked_reasons: string[]
} {
  const dependencies = new Set(baseDependencies.filter(Boolean))
  const requiredTools = new Set<string>()
  const requiredCredentials = new Set<string>()
  const executionRequirements = new Set<string>()
  const missing = new Set<string>()
  const blocked = new Set<string>()
  const blockedReasons = new Set<string>()

  const requirementsPath = join(skillPath, 'requirements.txt')
  const packagePath = join(skillPath, 'package.json')
  const scriptsPath = join(skillPath, 'scripts')

  if (existsSync(requirementsPath)) {
    dependencies.add('python:requirements.txt')
    executionRequirements.add('python_dependencies_required')
  }
  if (existsSync(packagePath)) {
    dependencies.add('node:package.json')
    executionRequirements.add('node_dependencies_required')
  }
  if (existsSync(scriptsPath)) {
    dependencies.add('scripts')
    executionRequirements.add('scripts_require_bridge_session')
  }

  for (const dependency of Array.from(dependencies)) {
    if (dependency.startsWith('tool:')) {
      const tool = normalizeToolRequirement(dependency)
      if (tool) requiredTools.add(tool)
      executionRequirements.add('tools_require_bridge_session')
      blocked.add(`${dependency}:execution_disabled_in_read_only_context`)
      blockedReasons.add(`${dependency}:bridge_session_required`)
    }
    if (dependency.startsWith('credential:') || dependency.startsWith('env:')) {
      const credential = normalizeCredentialName(dependency)
      if (credential) {
        requiredCredentials.add(credential)
        executionRequirements.add('credentials_required')
        if (!process.env[credential]?.trim()) {
          missing.add(`credential:${credential}`)
          blockedReasons.add(`credential:${credential}:missing`)
        }
      }
    }
    if (dependency.startsWith('execution:')) {
      const requirement = dependency.replace(/^execution:/i, '').trim()
      if (requirement) executionRequirements.add(requirement)
    }
    if (dependency === 'scripts') {
      blocked.add('scripts:execution_disabled_in_read_only_context')
      blockedReasons.add('scripts_require_bridge_session')
    }
  }

  return {
    dependencies: Array.from(dependencies).sort(),
    required_tools: Array.from(requiredTools).sort(),
    required_credentials: Array.from(requiredCredentials).sort(),
    execution_requirements: Array.from(executionRequirements).sort(),
    missing_dependencies: Array.from(missing).sort(),
    blocked_dependencies: Array.from(blocked).sort(),
    blocked_reasons: Array.from(blockedReasons).sort(),
  }
}

function scanSkillRoot(input: {
  source: AgentZeroSkillRegistryItem['source']
  label: string
  root: string
  includeBlockedDirectories?: boolean
}): SkillRegistryReadResult {
  const items: AgentZeroSkillRegistryItem[] = []
  if (!existsSync(input.root)) {
    return {
      items,
      sources: [{
        source: input.source,
        label: input.label,
        root_path: input.root,
        status: 'blocked',
        total: 0,
        runtime_layer: 'OpenClaw+',
        shared_runtime: true,
        owner_agent: null,
        available_to_agents: ['agent_zero', 'hermes'],
        tony_owns_skill_system: false,
        safe_mode: 'blocked',
        blocked_reason: 'skill_root_missing_or_unreadable',
      }],
    }
  }

  let entries: string[] = []
  try {
    entries = readdirSync(input.root).sort()
  } catch {
    return {
      items,
      sources: [{
        source: input.source,
        label: input.label,
        root_path: input.root,
        status: 'blocked',
        total: 0,
        runtime_layer: 'OpenClaw+',
        shared_runtime: true,
        owner_agent: null,
        available_to_agents: ['agent_zero', 'hermes'],
        tony_owns_skill_system: false,
        safe_mode: 'blocked',
        blocked_reason: 'skill_root_unreadable',
      }],
    }
  }

  for (const entry of entries) {
    const skillPath = join(input.root, entry)
    try {
      if (!statSync(skillPath).isDirectory()) continue
    } catch {
      continue
    }

    const skillDoc = join(skillPath, 'SKILL.md')
    const skillJson = join(skillPath, 'skill.json')
    let name = entry
    let description = 'Skill directory is visible, but metadata is missing.'
    let dependencies: string[] = []
    let status: EcosystemAccessState = 'visible'
    let safeMode: AgentZeroSkillRegistryItem['safe_mode'] = 'metadata_only'
    const missingDependencies: string[] = []
    let blockedReason: string | null = null

    try {
      if (existsSync(skillDoc)) {
        const metadata = readSkillMarkdownMetadata(skillDoc)
        name = metadata.name || entry
        description = metadata.description
        dependencies = metadata.dependencies
        dependencies.push(...metadata.requiredTools.map((tool) => `tool:${tool}`))
        dependencies.push(...metadata.requiredCredentials.map((credential) => `credential:${credential}`))
        dependencies.push(...metadata.executionRequirements.map((requirement) => `execution:${requirement}`))
      } else if (existsSync(skillJson)) {
        const metadata = readSkillJsonMetadata(skillJson)
        name = metadata.name || entry
        description = metadata.description
        dependencies = metadata.dependencies
        dependencies.push(...metadata.requiredTools.map((tool) => `tool:${tool}`))
        dependencies.push(...metadata.requiredCredentials.map((credential) => `credential:${credential}`))
        dependencies.push(...metadata.executionRequirements.map((requirement) => `execution:${requirement}`))
      } else if (input.includeBlockedDirectories) {
        status = 'blocked'
        safeMode = 'blocked'
        missingDependencies.push('SKILL.md_or_skill.json')
        blockedReason = 'skill_metadata_missing'
      } else {
        continue
      }
    } catch {
      status = 'blocked'
      safeMode = 'blocked'
      missingDependencies.push('readable_skill_metadata')
      blockedReason = 'skill_metadata_unreadable'
    }

    const dependencyMetadata = skillDependencyMetadata(skillPath, dependencies)
    const blockedReasons = Array.from(new Set([
      ...(blockedReason ? [blockedReason] : []),
      ...dependencyMetadata.blocked_reasons,
    ])).sort()
    items.push({
      name,
      source: input.source,
      source_label: input.label,
      path: skillPath,
      skill_doc_path: existsSync(skillDoc) ? skillDoc : (existsSync(skillJson) ? skillJson : null),
      description,
      dependencies: dependencyMetadata.dependencies,
      required_tools: dependencyMetadata.required_tools,
      required_credentials: dependencyMetadata.required_credentials,
      execution_requirements: Array.from(new Set([
        ...dependencyMetadata.execution_requirements,
        'bridge_session_required_for_execution',
      ])).sort(),
      missing_dependencies: Array.from(new Set([...missingDependencies, ...dependencyMetadata.missing_dependencies])).sort(),
      blocked_dependencies: dependencyMetadata.blocked_dependencies,
      blocked_reasons: blockedReasons,
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to: ['agent_zero', 'hermes'],
      available_to_agents: ['agent_zero', 'hermes'],
      role_tags: inferSkillRoleTags({ name, source: input.source, description, path: skillPath, dependencies: dependencyMetadata.dependencies, requiredTools: dependencyMetadata.required_tools, requiredCredentials: dependencyMetadata.required_credentials }),
      tony_owns_skill_system: false,
      safe_mode: safeMode,
      status,
      execution_enabled: false,
      writes_enabled: false,
      direct_access: false,
      proxy_access: true,
      blocked_reason: blockedReason || blockedReasons[0] || null,
    })
  }

  return {
    items,
    sources: [{
      source: input.source,
      label: input.label,
      root_path: input.root,
      status: items.length > 0 ? 'visible' : 'blocked',
      total: items.length,
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      tony_owns_skill_system: false,
      safe_mode: items.length > 0 ? 'metadata_only' : 'blocked',
      blocked_reason: items.length > 0 ? null : 'no_skills_discovered',
    }],
  }
}

function readDatabaseSkills(): AgentZeroSkillRegistryItem[] {
  try {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT name, source, path, description, security_status FROM skills ORDER BY source, name LIMIT 200')
      .all() as Array<{ name?: string; source?: string; path?: string | null; description?: string | null; security_status?: string | null }>
    return rows
      .map((row) => ({
        name: String(row.name || '').trim(),
        source: 'database' as const,
        source_label: `db:${String(row.source || 'skills')}`,
        path: row.path || null,
        skill_doc_path: row.path ? join(row.path, 'SKILL.md') : null,
        description: sanitizeDescription(row.description || 'Mission Control database skill record.'),
        dependencies: [],
        required_tools: [],
        required_credentials: [],
        execution_requirements: ['bridge_session_required_for_execution'],
        missing_dependencies: [],
        blocked_dependencies: [],
        blocked_reasons: [],
        runtime_layer: 'OpenClaw+' as const,
        shared_runtime: true as const,
        owner_agent: null,
        available_to: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
        available_to_agents: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
        role_tags: inferSkillRoleTags({ name: row.name, source: row.source, description: row.description, path: row.path || null }),
        tony_owns_skill_system: false as const,
        safe_mode: 'metadata_only' as const,
        status: accessFromVisibility(row.security_status || 'visible'),
        execution_enabled: false as const,
        writes_enabled: false as const,
        direct_access: false as const,
        proxy_access: true as const,
        blocked_reason: accessFromVisibility(row.security_status || 'visible') === 'blocked' ? 'database_skill_security_status_blocked' : null,
      }))
      .filter((skill) => skill.name)
  } catch {
    return []
  }
}

function readSkillRegistry(): SkillRegistryReadResult {
  const roots = [
    {
      source: 'agent_zero' as const,
      label: 'Agent Zero deployed skills',
      root: '/home/tony/agent-zero-deploy/data/skills',
    },
    {
      source: 'agent_zero' as const,
      label: 'Agent Zero deployed user skills',
      root: '/home/tony/agent-zero-deploy/data/usr/skills',
    },
    {
      source: 'openclaw_plus' as const,
      label: 'OpenClaw+ shared skills',
      root: '/home/tony/.openclaw/skills',
    },
    {
      source: 'openclaw_plus' as const,
      label: 'OpenClaw+ workspace skills',
      root: '/home/tony/.openclaw/workspace/skills',
    },
    {
      source: 'openclaw_plus' as const,
      label: 'OpenClaw+ runtime skills',
      root: '/home/tony/claudeclaw/skills',
    },
    {
      source: 'openclaw_plus' as const,
      label: 'OpenClaw+ vendor skills',
      root: '/home/tony/claudeclaw/vendor/skills',
    },
    {
      source: 'openclaw_plus' as const,
      label: 'OpenClaw+ project Claude skills',
      root: '/home/tony/claudeclaw/.claude/skills',
    },
    {
      source: 'hermes' as const,
      label: 'Hermes shared skills',
      root: '/home/tony/.hermes/skills',
    },
    {
      source: 'hermes' as const,
      label: 'Hermes agent skills',
      root: '/home/tony/.hermes/hermes-agent/skills',
    },
    {
      source: 'hermes' as const,
      label: 'Hermes sandbox skills',
      root: '/home/tony/sandbox/hermes-home-20260428/skills',
    },
    {
      source: 'mission_control_repo' as const,
      label: 'Mission Control repo skills',
      root: join(process.cwd(), 'skills'),
    },
    ...(process.env.AGENT_ZERO_INCLUDE_HOME_CLAUDE_SKILLS === 'false'
      ? []
      : [{
          source: 'home_claude' as const,
          label: 'Safe home Claude skills',
          root: '/home/tony/.claude/skills',
          includeBlockedDirectories: true,
        }]),
  ]

  const items: AgentZeroSkillRegistryItem[] = []
  const sourceMap = new Map<string, AgentZeroSkillSourceSummary>()
  for (const root of roots) {
    const result = scanSkillRoot(root)
    items.push(...result.items)
    for (const source of result.sources) {
      const key = `${source.source}:${source.label}`
      sourceMap.set(key, source)
    }
  }

  const dbSkills = readDatabaseSkills()
  items.push(...dbSkills)
  if (dbSkills.length > 0) {
    sourceMap.set('database:Mission Control skills database', {
      source: 'database',
      label: 'Mission Control skills database',
      root_path: null,
      status: 'visible',
      total: dbSkills.length,
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      tony_owns_skill_system: false,
      safe_mode: 'metadata_only',
      blocked_reason: null,
    })
  }

  const seen = new Set<string>()
  const deduped = items
    .filter((skill) => {
      const key = `${skill.source}:${skill.source_label}:${skill.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => `${a.source}:${a.name}`.localeCompare(`${b.source}:${b.name}`))


  return {
    items: deduped,
    sources: Array.from(sourceMap.values()).sort((a, b) => `${a.source}:${a.label}`.localeCompare(`${b.source}:${b.label}`)),
  }
}

function parseSystemctlShow(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf('=')
    if (index <= 0) continue
    out[line.slice(0, index)] = line.slice(index + 1)
  }
  return out
}

function systemdTimestamp(value: string | undefined): string | null {
  if (!value || value === '0' || value === 'n/a') return null
  return value
}

function systemdActiveBoolean(value: string | undefined): boolean | null {
  if (!value) return null
  return value === 'active'
}

function readSmbMountState(): { mounted: boolean; mount_status: EcosystemAccessState; blocker: string } {
  try {
    const mounts = readFileSync('/proc/mounts', 'utf8')
    const mounted = mounts
      .split('\n')
      .some((line) => /\s(cifs|smb3|smbfs)\s/i.test(line))
    return {
      mounted,
      mount_status: mounted ? 'visible' : 'blocked',
      blocker: mounted ? 'smb_mount_visible_read_only' : 'smb_mount_not_verified',
    }
  } catch {
    return { mounted: false, mount_status: 'unknown', blocker: 'smb_mount_status_unavailable' }
  }
}

function lastRunAccessState(result: string, exitStatus: number | null, startedAt: string | null): EcosystemAccessState {
  if (!startedAt) return 'unknown'
  if (result === 'success' && (exitStatus === null || exitStatus === 0)) return 'connected'
  if (result && result !== 'success' && result !== 'unknown') return 'blocked'
  return 'visible'
}

async function readBuildWikiFarmerStatus(input: {
  latestRunNow: ReturnType<typeof readLatestRunNow>
  runState: ReturnType<typeof deriveRunNowUiState>
}): Promise<AgentZeroBuildWikiFarmerSummary> {
  const [timerText, serviceText] = await Promise.all([
    execFileText('systemctl', [
      '--user',
      'show',
      'opencloud-docs-farmer.timer',
      '--no-pager',
      '-p',
      'ActiveState',
      '-p',
      'UnitFileState',
      '-p',
      'NextElapseUSecRealtime',
      '-p',
      'LastTriggerUSec',
    ], 2500),
    execFileText('systemctl', [
      '--user',
      'show',
      'opencloud-docs-farmer.service',
      '--no-pager',
      '-p',
      'ActiveState',
      '-p',
      'SubState',
      '-p',
      'Result',
      '-p',
      'ExecMainStatus',
      '-p',
      'ExecMainStartTimestamp',
      '-p',
      'ExecMainExitTimestamp',
    ], 2500),
  ])
  const timer = parseSystemctlShow(timerText)
  const service = parseSystemctlShow(serviceText)
  const timerActive = systemdActiveBoolean(timer.ActiveState)
  const serviceActive = systemdActiveBoolean(service.ActiveState)
  const exitStatus = service.ExecMainStatus !== undefined && service.ExecMainStatus !== ''
    ? Number(service.ExecMainStatus)
    : null
  const normalizedExitStatus = Number.isFinite(exitStatus) ? exitStatus : null
  const lastStartedAt = systemdTimestamp(service.ExecMainStartTimestamp)
  const lastExitedAt = systemdTimestamp(service.ExecMainExitTimestamp)
  const lastResult = service.Result || 'unknown'
  const smb = readSmbMountState()
  const approval = input.latestRunNow.approval
  const run = input.latestRunNow.run
  const runNowBlockedReason = approval?.approval_state === 'pending'
    ? 'owner_approval_pending'
    : input.runState.ui_state === 'approved'
      ? 'bridge_session_dispatch_required'
      : 'buildwiki_run_now_requires_bridge_session_and_owner_approval'

  return {
    status: timer.ActiveState || service.ActiveState ? 'visible' : 'unknown',
    direct_opencloud_access_visible: false,
    build_wiki_status_visible: true,
    read_only: true,
    read_available: true,
    write_available: input.latestRunNow.persistence_ready,
    blocked: false,
    blocked_reason: null,
    read_blocked_reason: null,
    write_blocked_reason: input.latestRunNow.persistence_ready ? null : 'buildwiki_run_now_persistence_unavailable',
    routes: {
      status: { method: 'GET', path: '/api/bridge/brain-sync/build-wiki/status', read_only: true, execution_enabled: false, requires_bridge_session: false },
      files: { method: 'GET', path: '/api/bridge/brain-sync/build-wiki/files', read_only: true, execution_enabled: false, requires_bridge_session: false },
      logs: { method: 'GET', path: '/api/bridge/brain-sync/build-wiki/logs', read_only: true, execution_enabled: false, requires_bridge_session: false },
      run_now_create: { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/run-now', read_only: false, execution_enabled: false, requires_bridge_session: true },
      run_now_read: { method: 'GET', path: '/api/bridge/brain-sync/build-wiki/run-now/{id}', read_only: true, execution_enabled: false, requires_bridge_session: false },
      run_now_dispatch: { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/run-now/{id}/dispatch', read_only: false, execution_enabled: false, requires_bridge_session: true },
    },
    farmer_service: BUILDWIKI_TARGET_SERVICE,
    farmer_timer: 'opencloud-docs-farmer.timer',
    timer_active: timerActive,
    timer: {
      unit: 'opencloud-docs-farmer.timer',
      active: timerActive,
      active_state: timer.ActiveState || 'unknown',
      unit_file_state: timer.UnitFileState || null,
      next_run_at: systemdTimestamp(timer.NextElapseUSecRealtime),
      last_trigger_at: systemdTimestamp(timer.LastTriggerUSec),
    },
    service: {
      unit: BUILDWIKI_TARGET_SERVICE,
      active: serviceActive,
      active_state: service.ActiveState || 'unknown',
      sub_state: service.SubState || 'unknown',
      last_result: lastResult,
      last_exit_status: normalizedExitStatus,
      last_started_at: lastStartedAt,
      last_exited_at: lastExitedAt,
    },
    last_run: {
      status: lastRunAccessState(lastResult, normalizedExitStatus, lastStartedAt),
      result: lastResult,
      exit_status: normalizedExitStatus,
      started_at: lastStartedAt,
      completed_at: lastExitedAt,
      source: 'systemd_user_service',
    },
    run_now: {
      action: BUILDWIKI_ACTION_RUN_NOW,
      connector: BUILDWIKI_CONNECTOR,
      target_service: BUILDWIKI_TARGET_SERVICE,
      ui_state: input.runState.ui_state,
      approval_state: approval?.approval_state || null,
      run_state: run?.run_state || null,
      approval_id: approval?.id || null,
      persistence_ready: input.latestRunNow.persistence_ready,
      owner_approval_required: true,
      bridge_session_required: true,
      execution_enabled: false,
      dispatch_scope: BUILDWIKI_TARGET_KEY,
      blocked_reason: runNowBlockedReason,
    },
    fork_state: {
      fork1: {
        state: 'visible',
        label: 'local_buildwiki_farmer',
        status_visible: true,
        execution_enabled: false,
        approval_required: true,
        scope: BUILDWIKI_TARGET_SERVICE,
      },
      fork2: {
        state: smb.mounted ? 'visible' : 'blocked',
        label: 'smb_external_farmer',
        smb_mounted: smb.mounted,
        execution_enabled: false,
        approval_required: true,
        blocker: smb.mounted ? 'smb_mount_visible_but_fork2_execution_still_requires_owner_approval' : smb.blocker,
      },
    },
    smb: {
      required_for_fork2: true,
      mounted: smb.mounted,
      mount_status: smb.mount_status,
      blocker: smb.mounted ? 'smb_mount_visible_but_fork2_not_enabled' : smb.blocker,
    },
    farmer_execution_enabled: false,
    note: 'Agent Zero can see Build-Wiki/Farmer status only. Run Now requires a Bridge Session and owner approval, dispatch stays scoped to opencloud-docs-farmer.service, and SMB/Fork 2 remains blocked unless an SMB mount is verified and separately approved.',
  }
}

async function readBuildWikiTimerActive(): Promise<boolean | null> {
  const text = (await execFileText('systemctl', ['--user', 'is-active', 'opencloud-docs-farmer.timer'], 2000)).trim()
  if (!text) return null
  return text === 'active'
}

function hasOneDriveTool(toolNames: string[]): boolean {
  return toolNames.some((tool) => tool.includes('onedrive') || tool.includes('one_drive'))
}

function hasSource(brainSources: BrainSyncPayload['sources'], sourceName: string): boolean {
  return Boolean(brainSources?.some((source) => String(source.source).toLowerCase() === sourceName))
}

function providerId(provider: ProviderStatus): string {
  return String(provider.id || provider.name || '').trim()
}

function normalizeToolName(tool: ZapierToolRecord): string {
  return String(tool.tool_name || '').toLowerCase()
}

function accessFromVisibility(value: string | null | undefined): EcosystemAccessState {
  const text = String(value || '').toLowerCase()
  if (/(active|healthy|ready|connected|reachable|ok|success|schema_visible)/.test(text)) return 'connected'
  if (/(configured|available)/.test(text)) return 'configured'
  if (/(visible|read_only|degraded|partial|cached)/.test(text)) return 'visible'
  if (/(missing|blocked|not_visible|not_connected|unavailable|failed|error|denied|locked)/.test(text)) return 'blocked'
  return 'unknown'
}

function isoFromEpochSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function hasCredential(names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()))
}

function credentialPresentFromSources(names: string[], sourcePresent = false): boolean {
  return sourcePresent || hasCredential(names)
}

function capabilityState(input: {
  connected?: boolean
  configured?: boolean
  credentialPresent?: boolean
  missingCredential?: boolean
}): AgentZeroCapabilityState {
  if (input.connected) return 'connected'
  if (input.configured || input.credentialPresent) return 'configured'
  if (input.missingCredential) return 'blocked'
  return 'blocked'
}

function capability(input: {
  id: string
  name: string
  category: AgentZeroIntegrationCapability['category']
  connected?: boolean
  configured?: boolean
  credentialPresent?: boolean
  missingCredential?: boolean
  credentialNames?: string[]
  readOnly?: boolean
  writeEnabled?: boolean
  requiresBridgeSession?: boolean
  toolCount?: number | null
  source?: string
  blockedReason?: string | null
  notes?: string
}): AgentZeroIntegrationCapability {
  const credentialPresent = Boolean(input.credentialPresent)
  const missingCredential = Boolean(input.missingCredential)
  const status = capabilityState({
    connected: input.connected,
    configured: input.configured,
    credentialPresent,
    missingCredential,
  })
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    status,
    credential_present: credentialPresent,
    missing_credential: missingCredential,
    credential_names: input.credentialNames || [],
    credential_values_exposed: false,
    read_only: input.readOnly !== false,
    write_enabled: Boolean(input.writeEnabled),
    requires_bridge_session: Boolean(input.requiresBridgeSession),
    execution_enabled: false,
    direct_access: false,
    proxy_access: true,
    tool_count: typeof input.toolCount === 'number' ? input.toolCount : null,
    source: input.source || 'mission_control_context',
    blocked_reason: input.blockedReason || (missingCredential ? 'missing_credential' : null),
    notes: input.notes || '',
  }
}

function toolRegistryItem(input: {
  id: string
  name?: string
  status: EcosystemAccessState
  source: string
  category?: string
  mcpServerName?: string | null
  schemaAvailable?: boolean
  readOnly?: boolean
  writeEnabled?: boolean
  requiresBridgeSession?: boolean
  missingCredential?: boolean
  blockedReason?: string | null
}): AgentZeroToolRegistryItem {
  return {
    id: input.id,
    name: input.name || input.id,
    status: input.status,
    source: input.source,
    category: input.category || 'unknown',
    mcp_server_name: input.mcpServerName || null,
    schema_available: Boolean(input.schemaAvailable),
    read_only: input.readOnly !== false,
    write_enabled: Boolean(input.writeEnabled),
    requires_bridge_session: Boolean(input.requiresBridgeSession),
    missing_credential: Boolean(input.missingCredential),
    direct_access: false,
    proxy_access: true,
    execution_enabled: false,
    writes_enabled: false,
    blocked_reason: input.blockedReason || null,
  }
}

function brainApi(input: {
  endpoint: string
  method?: AgentZeroBrainApiSummary['method']
  status: EcosystemAccessState
  purpose: string
  readOnly?: boolean
  requiresOwnerApproval?: boolean
  requiresBridgeSession?: boolean
  blockedReason?: string | null
}): AgentZeroBrainApiSummary {
  return {
    endpoint: input.endpoint,
    method: input.method || 'GET',
    status: input.status,
    purpose: input.purpose,
    read_only: input.readOnly !== false,
    write_enabled: false,
    requires_owner_approval: Boolean(input.requiresOwnerApproval),
    requires_bridge_session: Boolean(input.requiresBridgeSession),
    execution_enabled: false,
    direct_access: false,
    proxy_access: true,
    blocked_reason: input.blockedReason || null,
  }
}

function pathStatusFromDetails(details: Record<string, unknown> | undefined, keys: string[]): AgentZeroBrainPathStatus {
  if (!details) return 'unknown'
  return keys.some((key) => typeof details[key] === 'string' && String(details[key]).trim())
    ? 'present'
    : 'unknown'
}

function numberFromDetails(details: Record<string, unknown> | undefined, key: string): number | null {
  const value = details?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function brainSourceRegistryItem(input: {
  id: AgentZeroBrainSourceRegistryItem['id']
  name: string
  sync?: NonNullable<BrainSyncPayload['sources']>[number]
  context?: NonNullable<BrainContextPayload['source_status']>[number]
  contract?: NonNullable<BrainContextPayload['source_contracts']>[number]
  status?: EcosystemAccessState
  rawState?: string
  statusVisible?: boolean
  readAdapter?: AgentZeroBrainSourceRegistryItem['read_adapter']
  writeAdapter?: AgentZeroBrainSourceRegistryItem['write_adapter']
  readContentEnabled?: boolean
  pathStatus?: AgentZeroBrainPathStatus
  indexStatus?: EcosystemAccessState
  availableReadApis?: string[]
  availableWriteApis?: string[]
  blockers?: string[]
  summary?: string
  notes?: string
}): AgentZeroBrainSourceRegistryItem {
  const rawState = input.rawState || input.sync?.state || input.sync?.raw_state || input.sync?.status || input.context?.state || input.contract?.current_status || 'unknown'
  const status = input.status || accessFromVisibility(rawState)
  const readStatus = input.readAdapter || (
    input.contract?.current_status === 'read_ready'
      ? 'available'
      : input.contract?.current_status === 'status_only'
        ? 'status_only'
        : status === 'blocked'
          ? 'blocked'
          : 'status_only'
  )
  const writeStatus = input.writeAdapter || (
    input.contract?.writes_enabled_from_shared_context
      ? 'available'
      : 'blocked'
  )
  const blockers = new Set(input.blockers || [])
  if (readStatus === 'status_only' && input.id !== 'brain_sync') blockers.add(`${input.id}_content_read_adapter_not_connected`)
  if (writeStatus !== 'available') blockers.add(`${input.id}_write_adapter_disabled`)
  if (status === 'blocked') blockers.add(`${input.id}_status_blocked`)
  const readAvailable = status !== 'blocked' && status !== 'not_connected' && (readStatus === 'available' || readStatus === 'status_only')
  const writeAvailable = writeStatus === 'available'
  const blockedReason = status === 'blocked'
    ? `${input.id}_status_blocked`
    : !readAvailable && !writeAvailable
      ? `${input.id}_adapter_not_available`
      : null

  return {
    id: input.id,
    name: input.name,
    status,
    raw_state: rawState,
    status_visible: Boolean(input.statusVisible ?? status !== 'blocked'),
    read_available: readAvailable,
    write_available: writeAvailable,
    blocked: Boolean(blockedReason),
    blocked_reason: blockedReason,
    read_blocked_reason: readAvailable ? null : `${input.id}_read_adapter_blocked`,
    write_blocked_reason: writeAvailable ? null : `${input.id}_write_adapter_disabled`,
    read_adapter: readStatus,
    write_adapter: writeStatus,
    read_content_enabled: Boolean(input.readContentEnabled && readStatus === 'available'),
    write_content_enabled: false,
    memory_writes_enabled: false,
    direct_access: false,
    proxy_access: true,
    path_status: input.pathStatus || 'unknown',
    index_status: input.indexStatus || 'unknown',
    last_sync_at: isoFromEpochSeconds(input.sync?.last_success_at),
    last_attempt_at: isoFromEpochSeconds(input.sync?.last_attempt_at),
    last_error: input.sync?.last_error || null,
    available_read_apis: Array.from(new Set(input.availableReadApis || [])).sort(),
    available_write_apis: Array.from(new Set(input.availableWriteApis || [])).sort(),
    blockers: Array.from(blockers).sort(),
    summary: input.summary || input.context?.detail || input.sync?.summary || `${input.name} status is ${status}.`,
    notes: input.notes || input.contract?.notes || '',
  }
}

function normalizedProviderText(provider: ProviderStatus): string {
  return [
    provider.id,
    provider.name,
    provider.category,
    provider.type,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
}

function providerStateFor(providers: ProviderStatus[], ids: string[]): string | null {
  const needles = ids.map((id) => id.toLowerCase())
  const provider = providers.find((item) => {
    const text = normalizedProviderText(item)
    return needles.some((needle) => text.includes(needle))
  })
  return provider ? String(provider.state || provider.status || 'visible') : null
}

function modelProviderStatus(input: {
  credentialPresent: boolean
  providerState: string | null
  localConfigured?: boolean
}): AgentZeroModelProviderStatus {
  const access = accessFromVisibility(input.providerState)
  if (access === 'connected') return 'connected'
  if (input.credentialPresent || input.localConfigured || access === 'configured' || access === 'visible') return 'configured'
  return 'blocked'
}

function buildModelProviderRegistry(input: {
  providers: ProviderStatus[]
  models: Array<{ provider: string; name: string }>
}): AgentZeroModelProviderSummary[] {
  const modelsByProvider = new Map<string, string[]>()
  for (const model of input.models) {
    const key = model.provider.toLowerCase()
    modelsByProvider.set(key, [...(modelsByProvider.get(key) || []), model.name])
  }

  const build = (provider: {
    id: string
    name: string
    modelProvider?: string
    providerIds?: string[]
    credentialNames: string[]
    bestUseCase: string
    executionMode: string
    localConfigured?: boolean
    includeBlocked?: boolean
  }): AgentZeroModelProviderSummary | null => {
    const providerState = providerStateFor(input.providers, provider.providerIds || [provider.id, provider.name])
    const credentialPresent = hasCredential(provider.credentialNames)
    const status = modelProviderStatus({
      credentialPresent,
      providerState,
      localConfigured: provider.localConfigured,
    })
    const modelProvider = provider.modelProvider || provider.id
    const models = modelsByProvider.get(modelProvider.toLowerCase()) || []
    if (!provider.includeBlocked && status === 'blocked') return null

    return {
      id: provider.id,
      name: provider.name,
      status,
      credential_present: credentialPresent,
      credential_names: provider.credentialNames,
      credential_values_exposed: false,
      model_count: models.length,
      models,
      best_use_case: provider.bestUseCase,
      execution_mode: provider.executionMode,
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocked_reason: status === 'blocked'
        ? `${provider.id}_not_configured_or_not_visible_in_provider_registry`
        : null,
    }
  }

  const allModelNames = Array.from(new Set(input.models.map((model) => model.name))).slice(0, 40)
  const openRouterState = providerStateFor(input.providers, ['openrouter', 'open router'])
  const openRouterCredential = hasCredential(['OPENROUTER_API_KEY'])
  const openRouterStatus = modelProviderStatus({
    credentialPresent: openRouterCredential,
    providerState: openRouterState,
  })

  const requiredProviders: AgentZeroModelProviderSummary[] = [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      status: openRouterStatus,
      credential_present: openRouterCredential,
      credential_names: ['OPENROUTER_API_KEY'],
      credential_values_exposed: false,
      model_count: allModelNames.length,
      models: allModelNames,
      best_use_case: 'Router/fallback access to hosted models when configured through Mission Control.',
      execution_mode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      execution_enabled: false,
      bridge_session_required: true,
      direct_access: false,
      proxy_access: true,
      blocked_reason: openRouterStatus === 'blocked' ? 'openrouter_not_configured_or_not_visible_in_provider_registry' : null,
    },
    build({
      id: 'anthropic',
      name: 'Anthropic / Claude',
      modelProvider: 'anthropic',
      providerIds: ['anthropic', 'claude'],
      credentialNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      bestUseCase: 'High-quality reasoning, coding, analysis, and agent planning.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'openai',
      name: 'OpenAI',
      modelProvider: 'openai',
      providerIds: ['openai'],
      credentialNames: ['OPENAI_API_KEY'],
      bestUseCase: 'General assistant work, coding support, fast/cheap GPT-class routing, and report drafting.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'google',
      name: 'Gemini / Google',
      modelProvider: 'google',
      providerIds: ['google', 'gemini'],
      credentialNames: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
      bestUseCase: 'Gemini long-context, multimodal, and Google-family reasoning tasks when configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'groq',
      name: 'Groq',
      modelProvider: 'groq',
      providerIds: ['groq'],
      credentialNames: ['GROQ_API_KEY'],
      bestUseCase: 'Very low-latency hosted inference for lightweight or speed-sensitive work.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
      includeBlocked: true,
    })!,
    build({
      id: 'ollama',
      name: 'Ollama / Local',
      modelProvider: 'ollama',
      providerIds: ['ollama', 'local'],
      credentialNames: [],
      bestUseCase: 'Local/private fallback tasks where latency and model quality are acceptable.',
      executionMode: 'local_status_visible_read_only; execution_requires_owner_approved_bridge_session_and_local_adapter',
      localConfigured: Boolean(process.env.OLLAMA_HOST?.trim()) || Boolean(providerStateFor(input.providers, ['ollama', 'local'])),
      includeBlocked: true,
    })!,
  ]

  const optionalProviders = [
    build({
      id: 'moonshot',
      name: 'Moonshot / Kimi',
      modelProvider: 'moonshot',
      providerIds: ['moonshot', 'kimi'],
      credentialNames: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
      bestUseCase: 'Alternative hosted model routing when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
    build({
      id: 'venice',
      name: 'Venice AI',
      modelProvider: 'venice',
      providerIds: ['venice'],
      credentialNames: ['VENICE_API_KEY'],
      bestUseCase: 'Alternative hosted open-model routing when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
    build({
      id: 'minimax',
      name: 'MiniMax',
      modelProvider: 'minimax',
      providerIds: ['minimax'],
      credentialNames: ['MINIMAX_API_KEY'],
      bestUseCase: 'Cost-sensitive hosted coding and general tasks when explicitly configured.',
      executionMode: 'mission_control_proxy_read_only_now; execution_requires_owner_approved_bridge_session',
    }),
  ].filter((provider): provider is AgentZeroModelProviderSummary => Boolean(provider))

  return [...requiredProviders, ...optionalProviders]
}

function endpointSummary(input: {
  endpoint: string
  mcp_server_name?: string | null
  status: EcosystemAccessState
  reachable: boolean
  tool_count?: number | null
  schema_available?: boolean
  blocked_reason?: string | null
  note: string
}): AgentZeroReadOnlyEndpointSummary {
  return {
    endpoint: input.endpoint,
    method: 'GET',
    mcp_server_name: input.mcp_server_name ?? null,
    status: input.status,
    reachable: input.reachable,
    tool_count: typeof input.tool_count === 'number' ? input.tool_count : null,
    schema_available: Boolean(input.schema_available),
    execution_enabled: false,
    bridge_session_required: true,
    blocked_reason: input.blocked_reason || null,
    note: input.note,
  }
}

export async function buildAgentZeroEcosystemContext(): Promise<AgentZeroReadOnlyContext> {
  const [providersResult, zapierResult, mcpZapierResult, brainResult, brainContextResult, brainWriteContractResult, obsidianAdapterStatus, mempalaceAdapterStatus, timerActive, paperclipStatus, githubToken] = await Promise.all([
    fetchClaudeClawJson<{ providers?: ProviderStatus[] }>('/api/bridge/providers', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { providers: [] as ProviderStatus[] },
    })),
    getZapierToolBridge(null).catch(() => ({
      connected: false,
      mcp_reachable: false,
      tools_total: 0,
      tools: [] as ZapierToolRecord[],
      heygen_found: false,
      required_fields: null as string[] | null,
    })),
    getMcpServerTools('zapier').catch(() => ({
      ok: false,
      status: 'unavailable',
      server: 'zapier',
      mcp_reachable: false,
      tools_total: 0,
      tools: [],
      execution_enabled: false,
      writes_enabled: false,
      no_tool_invocation: true,
      blocker: 'zapier_mcp_schema_unavailable',
    })),
    fetchClaudeClawJson<BrainSyncPayload>('/api/memory-sync/status', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: { sources: [] as BrainSyncPayload['sources'] },
    })),
    fetchClaudeClawJson<BrainContextPayload>(
      '/api/brain/context?q=brain%20status&agent_id=agent_zero&limit=5',
      {},
      12000,
    ).catch(() => ({
      ok: false,
      status: 503,
      payload: { source_status: [], source_contracts: [] } as BrainContextPayload,
    })),
    fetchClaudeClawJson<Record<string, unknown>>('/api/brain/write-contract', {}, 12000).catch(() => ({
      ok: false,
      status: 503,
      payload: {},
    })),
    Promise.resolve(getAgentZeroObsidianStatus()).catch(() => ({
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter' as const,
      status: 'blocked' as const,
      vault_visible: false,
      vault_path_status: 'missing' as const,
      note_count: 0,
      indexed: false,
      last_indexed_at: null,
      available_actions: ['status' as const],
      read_only: true as const,
      write_enabled: false as const,
      execution_enabled: false as const,
      direct_filesystem_exposed: false as const,
      direct_access: false as const,
      proxy_access: true as const,
      blockers: ['obsidian_adapter_status_failed'],
    })),
    Promise.resolve(getAgentZeroMemPalaceStatus()).catch(() => ({
      ok: false,
      mode: 'agent_zero_mempalace_read_only_adapter' as const,
      status: 'blocked' as const,
      mempalace_visible: false,
      graph_db_status: 'missing' as const,
      vector_db_status: 'missing' as const,
      data_dir_status: 'missing' as const,
      config_status: 'missing' as const,
      index_status: 'missing' as const,
      last_seen_at: null,
      counts: {
        entities: null,
        triples: null,
        entity_types: null,
        predicates: null,
        collections: null,
        embeddings: null,
        fulltext_rows: null,
      },
      available_actions: ['status' as const],
      safe_summary_available: false,
      raw_private_dump_enabled: false as const,
      read_only: true as const,
      write_enabled: false as const,
      execution_enabled: false as const,
      direct_filesystem_exposed: false as const,
      direct_access: false as const,
      proxy_access: true as const,
      blockers: ['mempalace_adapter_status_failed'],
    })),
    readBuildWikiTimerActive(),
    buildPaperclipStatusPayload({ generatedAt: new Date().toISOString() }).catch(() => null),
    getGitHubToken().catch(() => null),
  ])

  const providers = Array.isArray((providersResult.payload as any)?.providers)
    ? ((providersResult.payload as any).providers as ProviderStatus[])
    : []
  const allModels = getAllModels()
  const providerIds = providers.map(providerId).filter(Boolean)
  const zapierTools = Array.isArray((zapierResult as any).tools)
    ? ((zapierResult as any).tools as ZapierToolRecord[])
    : []
  const toolSet = new Set(zapierTools.map((tool) => normalizeToolName(tool)))
  const brainSources = Array.isArray((brainResult.payload as BrainSyncPayload)?.sources)
    ? ((brainResult.payload as BrainSyncPayload).sources || [])
    : []
  const brainContextSources = Array.isArray((brainContextResult.payload as BrainContextPayload)?.source_status)
    ? ((brainContextResult.payload as BrainContextPayload).source_status || [])
    : []
  const brainSourceContracts = Array.isArray((brainContextResult.payload as BrainContextPayload)?.source_contracts)
    ? ((brainContextResult.payload as BrainContextPayload).source_contracts || [])
    : []
  const brainSyncBySource = new Map(brainSources.map((source) => [String(source.source || '').toLowerCase(), source]))
  const brainContextBySource = new Map(brainContextSources.map((source) => [String(source.source || '').toLowerCase(), source]))
  const brainContractBySource = new Map(brainSourceContracts.map((contract) => [String(contract.source || '').toLowerCase(), contract]))
  const latestRunNow = readLatestRunNow()
  const runState = deriveRunNowUiState(latestRunNow.approval, latestRunNow.run)
  const buildWikiFarmerStatus = await readBuildWikiFarmerStatus({ latestRunNow, runState })
  const skillNames = readSkillNames()
  const oneDriveVisible = hasOneDriveTool(Array.from(toolSet))
  const googleDriveVisible = Array.from(toolSet).some((tool) => tool.includes('google_drive') || tool.includes('google_drive_upload_file'))
  const heygenRequiredFields = Array.isArray((zapierResult as any).required_fields)
    ? ((zapierResult as any).required_fields as string[])
    : []
  const skillRegistry = readSkillRegistry()
  const schemaRequiredFields = Array.from(new Set([
    ...((mcpZapierResult as any).tools || []).flatMap((tool: any) => Array.isArray(tool.required_fields) ? tool.required_fields : []),
    ...heygenRequiredFields,
  ])).slice(0, 75)
  const writeToolsTotal = ((mcpZapierResult as any).tools || []).filter((tool: any) => tool.write_classification !== 'read').length
  const readToolsTotal = ((mcpZapierResult as any).tools || []).filter((tool: any) => tool.write_classification === 'read').length
  const mcpToolCount = Number((mcpZapierResult as any).tools_total || (zapierResult as any).tools_total || zapierTools.length || 0)
  const mcpSchemaAvailable = Boolean(
    ((mcpZapierResult as any).ok && ((mcpZapierResult as any).tools || []).some((tool: any) => tool.schema_available))
      || heygenRequiredFields.length > 0,
  )
  const mcpReachable = Boolean((mcpZapierResult as any).mcp_reachable || (zapierResult as any).mcp_reachable)
  const zapierReachable = Boolean((zapierResult as any).connected || (zapierResult as any).mcp_reachable)
  const zapierBlocker = String((mcpZapierResult as any).blocker || (zapierResult as any).blocker || '').trim() || null
  const mcpTools = Array.isArray((mcpZapierResult as any).tools) ? ((mcpZapierResult as any).tools as any[]) : []
  const firecrawlStatus = getFirecrawlStatus(process.cwd())
  const githubCredentialPresent = Boolean(githubToken)
  const zapierCredentialNames = ['ZAPIER_MCP_URL', 'ZAPIER_MCP_SERVER', 'ZAPIER_ACCESS_TOKEN', 'ZAPIER_API_KEY']
  const zapierCredentialPresent = credentialPresentFromSources(zapierCredentialNames, zapierReachable)
  const googleDriveCredentialNames = ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
  const oneDriveCredentialNames = ['ONEDRIVE_CLIENT_ID', 'ONEDRIVE_CLIENT_SECRET', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']
  const telegramCredentialNames = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TOKEN', 'BOT_TOKEN']
  const slackCredentialNames = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_WEBHOOK_URL']
  const whatsappCredentialNames = ['WHATSAPP_API_KEY', 'WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_TOKEN']
  const emailCredentialNames = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SENDGRID_API_KEY', 'MAILGUN_API_KEY', 'AGENTMAIL_API_KEY']
  const smsCredentialNames = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
  const hasToolLike = (terms: string[]) => Array.from(toolSet).some((tool) => terms.some((term) => tool.includes(term)))
  const providerVisible = (terms: string[]) => Boolean(providerStateFor(providers, terms))
  const telegramVisible = providerVisible(['telegram']) || hasCredential(telegramCredentialNames)
  const slackVisible = hasToolLike(['slack']) || hasCredential(slackCredentialNames) || providerVisible(['slack'])
  const whatsappVisible = hasToolLike(['whatsapp', 'whats_app']) || hasCredential(whatsappCredentialNames) || providerVisible(['whatsapp'])
  const emailVisible = hasToolLike(['gmail', 'email', 'mailgun', 'sendgrid']) || hasCredential(emailCredentialNames) || providerVisible(['email', 'gmail'])
  const smsVisible = hasToolLike(['twilio', 'sms']) || hasCredential(smsCredentialNames) || providerVisible(['twilio', 'sms'])
  const integrationRegistry: AgentZeroIntegrationCapability[] = [
    capability({
      id: 'google_drive',
      name: 'Google Drive',
      category: 'storage',
      connected: googleDriveVisible,
      configured: hasCredential(googleDriveCredentialNames),
      credentialPresent: hasCredential(googleDriveCredentialNames),
      missingCredential: !googleDriveVisible && !hasCredential(googleDriveCredentialNames),
      credentialNames: googleDriveCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => normalizeToolName(tool).includes('google_drive')).length || null,
      source: googleDriveVisible ? 'zapier_mcp_schema' : 'mission_control_env',
      blockedReason: googleDriveVisible ? null : 'google_drive_not_visible_or_configured',
      notes: 'Visible only through safe schema/registry metadata here. Upload/write actions require a separate approved Bridge Session.',
    }),
    capability({
      id: 'onedrive',
      name: 'OneDrive',
      category: 'storage',
      connected: oneDriveVisible,
      configured: hasCredential(oneDriveCredentialNames),
      credentialPresent: hasCredential(oneDriveCredentialNames),
      missingCredential: !oneDriveVisible && !hasCredential(oneDriveCredentialNames),
      credentialNames: oneDriveCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => /one_?drive|onedrive/.test(normalizeToolName(tool))).length || null,
      source: oneDriveVisible ? 'zapier_mcp_schema' : 'mission_control_env',
      blockedReason: oneDriveVisible ? null : 'onedrive_not_visible_or_configured',
      notes: 'A local report path does not satisfy OneDrive delivery. Upload/write actions require a separate approved Bridge Session.',
    }),
    capability({
      id: 'zapier',
      name: 'Zapier',
      category: 'automation',
      connected: Boolean((zapierResult as any).connected || (mcpZapierResult as any).ok),
      configured: zapierCredentialPresent || zapierReachable,
      credentialPresent: zapierCredentialPresent,
      missingCredential: !zapierCredentialPresent && !zapierReachable,
      credentialNames: zapierCredentialNames,
      requiresBridgeSession: true,
      toolCount: Number((zapierResult as any).tools_total || zapierTools.length || 0),
      source: String((zapierResult as any).source || 'zapier_mcp'),
      blockedReason: (zapierResult as any).connected || zapierReachable ? null : (zapierBlocker || 'zapier_not_configured'),
      notes: 'Tool/schema discovery is read-only. Zapier writes remain disabled until an exact-scope Bridge Session exists.',
    }),
    capability({
      id: 'heygen',
      name: 'HeyGen',
      category: 'media',
      connected: Boolean((zapierResult as any).heygen_found && heygenRequiredFields.length > 0),
      configured: Boolean((zapierResult as any).heygen_found),
      credentialPresent: zapierCredentialPresent,
      missingCredential: !zapierCredentialPresent && !(zapierResult as any).heygen_found,
      credentialNames: zapierCredentialNames,
      requiresBridgeSession: true,
      toolCount: Number((zapierResult as any).heygen_tools?.length || 0),
      source: 'zapier_mcp_schema',
      blockedReason: (zapierResult as any).heygen_found ? null : 'heygen_tool_schema_not_visible',
      notes: 'HeyGen generation is not enabled. Schema visibility does not grant generation access.',
    }),
    capability({
      id: 'telegram',
      name: 'Telegram',
      category: 'messaging',
      connected: telegramVisible,
      configured: telegramVisible,
      credentialPresent: hasCredential(telegramCredentialNames) || telegramVisible,
      missingCredential: !telegramVisible,
      credentialNames: telegramCredentialNames,
      requiresBridgeSession: true,
      source: providerVisible(['telegram']) ? 'claudeclaw_provider_registry' : 'mission_control_env',
      blockedReason: telegramVisible ? null : 'telegram_not_visible_or_configured',
      notes: 'Telegram owner workflow is visible as ecosystem status only. Agent Zero test-chat cannot send messages.',
    }),
    capability({
      id: 'build_wiki',
      name: 'Build-Wiki',
      category: 'buildwiki',
      connected: true,
      configured: true,
      credentialPresent: true,
      missingCredential: false,
      credentialNames: [],
      requiresBridgeSession: true,
      source: 'mission_control_build_wiki',
      blockedReason: null,
      notes: 'Build-Wiki status is visible read-only. Run Now remains approval-gated and scoped to the local farmer service.',
    }),
    capability({
      id: 'opencloud_farmer',
      name: 'Build-Wiki/Farmer',
      category: 'buildwiki',
      connected: timerActive === true,
      configured: typeof timerActive === 'boolean',
      credentialPresent: true,
      missingCredential: false,
      credentialNames: [],
      requiresBridgeSession: true,
      source: 'systemd_user_timer_status',
      blockedReason: typeof timerActive === 'boolean' ? null : 'opencloud_docs_farmer_timer_status_unknown',
      notes: 'Agent Zero can see farmer/timer status only. Farmer execution requires owner approval and scoped dispatcher.',
    }),
    capability({
      id: 'paperclip',
      name: 'Paperclip Workforce Control Plane',
      category: 'automation',
      connected: paperclipStatus?.health === 'connected',
      configured: Boolean(paperclipStatus?.configured),
      credentialPresent: Boolean(paperclipStatus?.configured),
      missingCredential: false,
      credentialNames: [],
      requiresBridgeSession: true,
      toolCount: paperclipStatus?.workforce_summary.active_agents ?? null,
      source: 'mission_control_paperclip_bridge',
      blockedReason: paperclipStatus?.blocker || (paperclipStatus?.reachable ? 'paperclip_write_adapter_not_configured' : 'paperclip_service_not_configured'),
      notes: 'Paperclip status is visible to Agent Zero through Gateway. Agent Zero may request workforce tasks, Hermes/SpaceAgent/Pi/mini-agent assignments, and co-worker proposals only through the protected Paperclip Gateway route; Paperclip issue creation and status mutation require Bridge Session and a configured write adapter.',
    }),
    capability({
      id: 'github',
      name: 'GitHub',
      category: 'developer',
      connected: githubCredentialPresent,
      configured: githubCredentialPresent,
      credentialPresent: githubCredentialPresent,
      missingCredential: !githubCredentialPresent,
      credentialNames: ['GITHUB_TOKEN'],
      requiresBridgeSession: true,
      source: 'mission_control_github_client',
      blockedReason: githubCredentialPresent ? null : 'github_token_not_configured',
      notes: 'GitHub sync/client support is present. Writes and pushes require explicit owner approval outside Agent Zero test-chat.',
    }),
    capability({
      id: 'firecrawl',
      name: 'Firecrawl',
      category: 'crawler',
      connected: firecrawlStatus.state === 'LIVE',
      configured: Boolean(firecrawlStatus.key_present || firecrawlStatus.sdk_loaded),
      credentialPresent: Boolean(firecrawlStatus.key_present),
      missingCredential: !firecrawlStatus.key_present,
      credentialNames: ['FIRECRAWL_API_KEY'],
      requiresBridgeSession: true,
      source: 'mission_control_firecrawl_status',
      blockedReason: firecrawlStatus.state === 'LIVE' ? null : firecrawlStatus.state.toLowerCase(),
      notes: firecrawlStatus.next_action,
    }),
    capability({
      id: 'slack',
      name: 'Slack',
      category: 'messaging',
      connected: slackVisible,
      configured: slackVisible,
      credentialPresent: hasCredential(slackCredentialNames) || slackVisible,
      missingCredential: !slackVisible,
      credentialNames: slackCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => normalizeToolName(tool).includes('slack')).length || null,
      source: slackVisible ? 'zapier_or_provider_registry' : 'mission_control_env',
      blockedReason: slackVisible ? null : 'slack_not_visible_or_configured',
      notes: 'Included only as visible/configured/blocked metadata; no Slack sends are enabled from Agent Zero test-chat.',
    }),
    capability({
      id: 'whatsapp',
      name: 'WhatsApp',
      category: 'messaging',
      connected: whatsappVisible,
      configured: whatsappVisible,
      credentialPresent: hasCredential(whatsappCredentialNames) || whatsappVisible,
      missingCredential: !whatsappVisible,
      credentialNames: whatsappCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => /whatsapp|whats_app/.test(normalizeToolName(tool))).length || null,
      source: whatsappVisible ? 'zapier_or_provider_registry' : 'mission_control_env',
      blockedReason: whatsappVisible ? null : 'whatsapp_not_visible_or_configured',
      notes: 'No WhatsApp messages are enabled from Agent Zero test-chat.',
    }),
    capability({
      id: 'email',
      name: 'Email providers',
      category: 'communication',
      connected: emailVisible,
      configured: emailVisible,
      credentialPresent: hasCredential(emailCredentialNames) || emailVisible,
      missingCredential: !emailVisible,
      credentialNames: emailCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => /gmail|email|mailgun|sendgrid/.test(normalizeToolName(tool))).length || null,
      source: emailVisible ? 'zapier_or_provider_registry' : 'mission_control_env',
      blockedReason: emailVisible ? null : 'email_provider_not_visible_or_configured',
      notes: 'Email send/write actions require exact-scope approval and a Bridge Session.',
    }),
    capability({
      id: 'sms',
      name: 'SMS providers',
      category: 'communication',
      connected: smsVisible,
      configured: smsVisible,
      credentialPresent: hasCredential(smsCredentialNames) || smsVisible,
      missingCredential: !smsVisible,
      credentialNames: smsCredentialNames,
      requiresBridgeSession: true,
      toolCount: zapierTools.filter((tool) => /twilio|sms/.test(normalizeToolName(tool))).length || null,
      source: smsVisible ? 'zapier_or_provider_registry' : 'mission_control_env',
      blockedReason: smsVisible ? null : 'sms_provider_not_visible_or_configured',
      notes: 'SMS send/write actions require exact-scope approval and a Bridge Session.',
    }),
    capability({
      id: 'mcp_tools',
      name: 'MCP tools',
      category: 'mcp',
      connected: Boolean((mcpZapierResult as any).ok),
      configured: mcpReachable || mcpToolCount > 0,
      credentialPresent: Boolean((mcpZapierResult as any).auth_attached || zapierCredentialPresent),
      missingCredential: !mcpReachable && mcpToolCount === 0,
      credentialNames: zapierCredentialNames,
      requiresBridgeSession: true,
      toolCount: mcpToolCount,
      source: 'mcp_schema_passthrough',
      blockedReason: (mcpZapierResult as any).ok ? null : (zapierBlocker || 'mcp_tool_schema_unavailable'),
      notes: 'All discovered MCP tools are exposed as read-only metadata. Tool invocation is disabled from Agent Zero test-chat.',
    }),
  ]
  const obsidianSync = brainSyncBySource.get('obsidian')
  const mempalaceSync = brainSyncBySource.get('mempalace')
  const graphifySync = brainSyncBySource.get('graphify')
  const obsidianDetails = obsidianSync?.details
  const mempalaceDetails = mempalaceSync?.details
  const graphifyDetails = graphifySync?.details
  const obsidianMdFiles = numberFromDetails(obsidianDetails, 'md_files')
  const mempalaceEntries = numberFromDetails(mempalaceDetails, 'last_entries')
  const graphifyNodes = numberFromDetails(graphifyDetails, 'nodes')
  const graphifyEdges = numberFromDetails(graphifyDetails, 'edges')
  const brainContextReachable = Boolean((brainContextResult as any).ok && (brainContextResult.payload as BrainContextPayload)?.ok !== false)
  const brainWriteContractReachable = Boolean((brainWriteContractResult as any).ok)
  const obsidianAdapterConnected = obsidianAdapterStatus.status === 'connected'
  const mempalaceAdapterConnected = mempalaceAdapterStatus.status === 'connected'
  const brainLastSyncAt = [
    obsidianSync?.last_success_at,
    mempalaceSync?.last_success_at,
    graphifySync?.last_success_at,
  ]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
    .at(-1) || null
  const brainReadApis: AgentZeroBrainApiSummary[] = [
    brainApi({
      endpoint: '/api/bridge/brain-sync/status',
      status: brainSources.length > 0 ? 'connected' : 'blocked',
      purpose: 'Read-only Brain Sync status for Obsidian, MemPalace, Graphify, brain watchers, and shared brain source state.',
      blockedReason: brainSources.length > 0 ? null : 'brain_sync_status_unavailable',
    }),
    brainApi({
      endpoint: '/api/bridge/brain-context',
      status: brainContextReachable ? 'connected' : 'blocked',
      purpose: 'Read-only shared brain context proxy. It may return content snippets only through Mission Control/ClaudeClaw context rules.',
      blockedReason: brainContextReachable ? null : 'shared_brain_context_proxy_unavailable',
    }),
    brainApi({
      endpoint: '/api/memory/health',
      status: 'configured',
      purpose: 'Mission Control memory directory health diagnostics. Read-only for Agent Zero.',
    }),
    brainApi({
      endpoint: '/api/memory/search',
      status: 'configured',
      purpose: 'Mission Control FTS memory search GET endpoint. Query-only; rebuild POST is not enabled for Agent Zero.',
    }),
    brainApi({
      endpoint: '/api/memory/context',
      status: 'configured',
      purpose: 'Mission Control memory context read endpoint when memory directory/index are available.',
    }),
    brainApi({
      endpoint: '/api/memory/graph',
      status: 'configured',
      purpose: 'Mission Control memory graph read endpoint. This is not proof of direct Graphify control.',
    }),
    brainApi({
      endpoint: '/api/memory/links',
      status: 'configured',
      purpose: 'Mission Control memory link graph read endpoint.',
    }),
    brainApi({
      endpoint: '/api/bridge/brain-sync/build-wiki/status',
      status: 'connected',
      purpose: 'Build-Wiki/Farmer read-only status inside the shared brain surface.',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/obsidian?action=status',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero Obsidian adapter vault status. This exposes status only, not raw filesystem access.',
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/obsidian?action=search&q=...',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero Obsidian adapter note search. Results return safe snippets and relative note identifiers only.',
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/obsidian?action=read&path=...|title=...',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero Obsidian adapter safe-note read. Returns bounded redacted previews through Mission Control only.',
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/obsidian?action=summarize&path=...|title=...',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero Obsidian adapter note summary. No LLM/tool execution is required.',
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/mempalace?action=status',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero MemPalace adapter index/status summary. It exposes counts and health only, not raw memory content.',
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/mempalace?action=query&q=...',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero MemPalace safe query summary. Returns aggregate counts and categories only; raw memory records stay hidden.',
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    brainApi({
      endpoint: '/api/bridge/agent-zero/mempalace?action=summary&q=...',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      purpose: 'Agent Zero MemPalace safe memory summary. No embeddings, raw records, or private memory dumps are returned.',
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
  ]
  const brainWriteApis: AgentZeroBrainApiSummary[] = [
    brainApi({
      endpoint: '/api/memory/search',
      method: 'POST',
      status: 'blocked',
      purpose: 'FTS index rebuild exists as an operator mutation path, but Agent Zero read-only chat cannot use it.',
      readOnly: false,
      requiresOwnerApproval: true,
      requiresBridgeSession: true,
      blockedReason: 'agent_zero_read_only_context_write_disabled',
    }),
    brainApi({
      endpoint: '/api/bridge/brain-sync/rebuild',
      method: 'POST',
      status: 'blocked',
      purpose: 'Brain/Graph rebuild action requires owner approval and is not enabled for Agent Zero test-chat.',
      readOnly: false,
      requiresOwnerApproval: true,
      requiresBridgeSession: true,
      blockedReason: 'owner_approved_bridge_session_required',
    }),
    brainApi({
      endpoint: '/api/bridge/brain-sync/build-wiki/run-now',
      method: 'POST',
      status: 'blocked',
      purpose: 'Build-Wiki farmer run request path. This is not a memory write and remains separately approval-gated.',
      readOnly: false,
      requiresOwnerApproval: true,
      requiresBridgeSession: true,
      blockedReason: 'buildwiki_run_now_requires_explicit_owner_approval',
    }),
    brainApi({
      endpoint: '/api/bridge/brain-sync/build-wiki/add-source',
      method: 'POST',
      status: 'blocked',
      purpose: 'Build-Wiki source addition is a protected mutation path; not enabled for Agent Zero read-only chat.',
      readOnly: false,
      requiresOwnerApproval: true,
      requiresBridgeSession: true,
      blockedReason: 'protected_source_add_requires_owner_approval',
    }),
  ]
  const brainRegistry: AgentZeroBrainSourceRegistryItem[] = [
    brainSourceRegistryItem({
      id: 'brain_sync',
      name: 'Brain Sync',
      status: brainSources.length > 0 || brainContextReachable ? 'connected' : 'blocked',
      rawState: brainSources.length > 0 ? 'status_visible' : 'not_connected',
      statusVisible: brainSources.length > 0 || brainContextReachable,
      readAdapter: brainContextReachable ? 'available' : 'status_only',
      writeAdapter: 'blocked',
      readContentEnabled: brainContextReachable,
      pathStatus: 'not_applicable',
      indexStatus: graphifyNodes !== null || obsidianMdFiles !== null || mempalaceEntries !== null ? 'visible' : 'unknown',
      availableReadApis: brainReadApis.map((api) => api.endpoint),
      availableWriteApis: brainWriteApis.map((api) => api.endpoint),
      blockers: [
        'memory_writes_disabled',
        ...(brainContextReachable ? [] : ['shared_brain_context_proxy_unavailable']),
        ...(brainWriteContractReachable ? [] : ['brain_write_contract_unavailable']),
      ],
      summary: brainSources.length > 0
        ? 'Brain Sync status is visible read-only through Mission Control/ClaudeClaw.'
        : 'Brain Sync status is not visible through the current bridge.',
      notes: 'Brain Sync status visibility does not enable memory writes.',
    }),
    brainSourceRegistryItem({
      id: 'obsidian',
      name: 'Obsidian',
      sync: obsidianSync,
      context: brainContextBySource.get('obsidian'),
      contract: brainContractBySource.get('obsidian'),
      status: obsidianAdapterConnected ? 'connected' : undefined,
      rawState: obsidianAdapterConnected ? 'adapter_read_ready' : undefined,
      statusVisible: obsidianAdapterConnected || undefined,
      readAdapter: obsidianAdapterConnected
        ? 'available'
        : brainContractBySource.get('obsidian')?.current_status === 'read_ready' ? 'available' : 'status_only',
      writeAdapter: obsidianAdapterConnected ? 'available' : 'blocked',
      readContentEnabled: obsidianAdapterConnected || (brainContractBySource.get('obsidian')?.current_status === 'read_ready' && brainContextReachable),
      pathStatus: obsidianAdapterStatus.vault_path_status === 'present' ? 'present' : pathStatusFromDetails(obsidianDetails, ['vault_path']),
      indexStatus: obsidianAdapterStatus.indexed || obsidianMdFiles !== null ? 'visible' : 'unknown',
      availableReadApis: [
        '/api/bridge/brain-sync/status',
        '/api/bridge/brain-context',
        '/api/memory/search',
        '/api/bridge/agent-zero/obsidian?action=status',
        '/api/bridge/agent-zero/obsidian?action=search&q=...',
        '/api/bridge/agent-zero/obsidian?action=read&path=...|title=...',
        '/api/bridge/agent-zero/obsidian?action=summarize&path=...|title=...',
      ],
      availableWriteApis: obsidianAdapterConnected
        ? [
            '/api/bridge/agent-zero/execute action=obsidian.note.create',
            '/api/bridge/agent-zero/execute action=obsidian.note.update',
            '/api/bridge/agent-zero/execute action=obsidian.note.append_report_summary',
            '/api/bridge/agent-zero/execute action=obsidian.note.tag',
            '/api/bridge/agent-zero/execute action=obsidian.note.link_task_report',
          ]
        : [],
      blockers: [
        ...(obsidianAdapterConnected ? [] : ['obsidian_write_adapter_blocked']),
        ...(obsidianAdapterConnected || brainContractBySource.get('obsidian')?.current_status === 'read_ready' ? [] : ['obsidian_content_read_adapter_not_proven']),
        ...obsidianAdapterStatus.blockers,
      ],
      summary: obsidianAdapterConnected
        ? `Obsidian adapter is connected with ${obsidianAdapterStatus.note_count} safe markdown notes visible. Writes require an active Agent Zero Bridge Session and the execution gateway.`
        : obsidianSync?.summary || brainContextBySource.get('obsidian')?.detail || 'Obsidian status is not visible.',
      notes: 'Filesystem/vault presence is not direct Agent Zero filesystem access. Agent Zero can write only through the Mission Control Obsidian adapter after Bridge Session approval; every write is audited by the execution gateway.',
    }),
    brainSourceRegistryItem({
      id: 'mempalace',
      name: 'MemPalace',
      sync: mempalaceSync,
      context: brainContextBySource.get('mempalace'),
      contract: brainContractBySource.get('mempalace'),
      status: mempalaceAdapterConnected ? 'connected' : undefined,
      rawState: mempalaceAdapterConnected ? 'adapter_safe_summary_ready' : undefined,
      statusVisible: mempalaceAdapterConnected || undefined,
      readAdapter: mempalaceAdapterConnected ? 'available' : 'status_only',
      writeAdapter: mempalaceAdapterConnected ? 'available' : 'blocked',
      readContentEnabled: mempalaceAdapterConnected,
      pathStatus: mempalaceAdapterStatus.mempalace_visible ? 'present' : pathStatusFromDetails(mempalaceDetails, ['data_path']),
      indexStatus: mempalaceAdapterStatus.index_status === 'visible'
        ? 'visible'
        : mempalaceEntries !== null ? 'visible' : (numberFromDetails(mempalaceDetails, 'chroma_bytes') ? 'visible' : 'unknown'),
      availableReadApis: [
        '/api/bridge/brain-sync/status',
        '/api/bridge/brain-context',
        '/api/bridge/agent-zero/mempalace?action=status',
        '/api/bridge/agent-zero/mempalace?action=query&q=...',
        '/api/bridge/agent-zero/mempalace?action=summary&q=...',
      ],
      availableWriteApis: mempalaceAdapterConnected
        ? [
            '/api/bridge/agent-zero/execute action=mempalace.memory.remember_task_result',
            '/api/bridge/agent-zero/execute action=mempalace.memory.remember_owner_preference',
            '/api/bridge/agent-zero/execute action=mempalace.memory.update_safe_summary',
            '/api/bridge/agent-zero/execute action=mempalace.memory.link_report_task',
          ]
        : [],
      blockers: [
        ...(mempalaceAdapterConnected ? [] : ['mempalace_content_read_adapter_not_connected', 'mempalace_write_adapter_blocked']),
        ...mempalaceAdapterStatus.blockers,
      ],
      summary: mempalaceAdapterConnected
        ? `MemPalace adapter is connected. It sees ${mempalaceAdapterStatus.counts.entities ?? 0} graph entities, ${mempalaceAdapterStatus.counts.triples ?? 0} graph relationships, ${mempalaceAdapterStatus.counts.embeddings ?? 0} vector index rows, and ${mempalaceAdapterStatus.counts.safe_memory_summaries ?? 0} Agent Zero safe memory summaries. Writes require an active Agent Zero Bridge Session and store owner-visible summaries only.`
        : mempalaceSync?.summary || brainContextBySource.get('mempalace')?.detail || 'MemPalace is not production-connected yet.',
      notes: 'Agent Zero can read MemPalace status and safe aggregate memory summaries through Mission Control. Agent Zero can save task results, owner preferences, safe summary versions, and task/report links only through the Bridge Session execution gateway. Raw private memory dumps, embeddings, direct filesystem/database access, and unaudited overwrites stay disabled.',
    }),
    brainSourceRegistryItem({
      id: 'graphify',
      name: 'Graphify',
      sync: graphifySync,
      context: brainContextBySource.get('graphify'),
      contract: brainContractBySource.get('graphify'),
      readAdapter: graphifySync ? 'status_only' : 'blocked',
      writeAdapter: 'blocked',
      readContentEnabled: false,
      pathStatus: pathStatusFromDetails(graphifyDetails, ['dir']),
      indexStatus: graphifyNodes !== null ? 'visible' : 'unknown',
      availableReadApis: ['/api/bridge/brain-sync/status', '/api/memory/graph'],
      availableWriteApis: [],
      blockers: [
        'graphify_direct_read_adapter_not_connected_to_agent_zero',
        'graphify_rebuild_disabled_without_owner_approval',
      ],
      summary: graphifySync?.summary || 'Graphify status is not visible.',
      notes: 'Graphify artifact status can be visible without giving Agent Zero direct Graphify file or rebuild access.',
    }),
    brainSourceRegistryItem({
      id: 'brain_watchers',
      name: 'Brain watchers',
      status: brainSources.length > 0 ? 'visible' : 'blocked',
      rawState: brainSources.length > 0 ? 'sync_snapshots_visible' : 'not_connected',
      statusVisible: brainSources.length > 0,
      readAdapter: 'status_only',
      writeAdapter: 'blocked',
      readContentEnabled: false,
      pathStatus: 'not_applicable',
      indexStatus: 'not_connected',
      availableReadApis: ['/api/bridge/brain-sync/status'],
      availableWriteApis: [],
      blockers: ['watcher_status_inferred_from_sync_snapshots_no_direct_control_adapter'],
      summary: brainSources.length > 0
        ? 'Brain watcher status is inferred from Obsidian, MemPalace, and Graphify sync snapshots.'
        : 'Brain watcher status is not visible through Mission Control.',
      notes: 'Agent Zero cannot start, stop, or control brain watchers.',
    }),
  ]
  const brainWatchers: AgentZeroBrainWatchersSummary = {
    status: brainSources.length > 0 ? 'visible' : 'blocked',
    status_visible: brainSources.length > 0,
    direct_control_enabled: false,
    execution_enabled: false,
    direct_access: false,
    proxy_access: true,
    last_seen_at: isoFromEpochSeconds(brainLastSyncAt),
    sources: brainSources.map((source) => String(source.source || '')).filter(Boolean),
    blockers: ['watcher_status_inferred_from_sync_snapshots_no_direct_control_adapter'],
    summary: brainSources.length > 0
      ? 'Brain watchers are visible only as read-only sync/status snapshots.'
      : 'Brain watchers are not visible through the current bridge.',
  }
  const brainIndexStatus: AgentZeroBrainIndexSummary = {
    status: graphifyNodes !== null || obsidianMdFiles !== null || mempalaceEntries !== null ? 'visible' : 'unknown',
    indexed_records: [graphifyNodes, obsidianMdFiles, mempalaceEntries]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .reduce((total, value) => total + value, 0) || null,
    indexed_sources: [
      ...(obsidianMdFiles !== null ? ['obsidian'] : []),
      ...(mempalaceEntries !== null ? ['mempalace'] : []),
      ...(graphifyNodes !== null ? ['graphify'] : []),
    ],
    last_indexed_at: isoFromEpochSeconds(brainLastSyncAt),
    search_read_api_available: true,
    rebuild_write_api_enabled: false,
    blockers: [
      ...(graphifyEdges === null ? ['graphify_edge_index_not_visible'] : []),
      'index_rebuild_write_disabled_for_agent_zero',
    ],
  }
  const endpointSummaries = [
    endpointSummary({
      endpoint: '/api/bridge/preflight',
      status: 'connected',
      reachable: true,
      note: 'Bridge preflight is visible read-only for routing decisions; it does not execute tools.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/providers',
      status: providers.length > 0 ? 'visible' : 'blocked',
      reachable: providers.length > 0,
      blocked_reason: providers.length > 0 ? null : 'provider_registry_empty_or_unreachable',
      note: 'Bridge provider registry is visible through Mission Control.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/providers/:id',
      status: providers.length > 0 ? 'visible' : 'blocked',
      reachable: providers.length > 0,
      blocked_reason: providers.length > 0 ? null : 'provider_detail_requires_provider_registry',
      note: 'Provider detail route is available for individual read-only provider records.',
    }),
    endpointSummary({
      endpoint: '/api/mcp/list',
      status: mcpReachable || mcpToolCount > 0 ? 'visible' : 'blocked',
      reachable: mcpReachable || mcpToolCount > 0,
      tool_count: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      blocked_reason: mcpReachable || mcpToolCount > 0 ? null : zapierBlocker,
      note: 'MCP server list is visible read-only; execution is disabled.',
    }),
    endpointSummary({
      endpoint: '/api/mcp/servers/zapier/tools',
      mcp_server_name: 'zapier',
      status: (mcpZapierResult as any).ok ? 'connected' : (zapierReachable ? 'visible' : 'blocked'),
      reachable: Boolean((mcpZapierResult as any).ok || zapierReachable),
      tool_count: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      blocked_reason: (mcpZapierResult as any).ok ? null : zapierBlocker,
      note: 'Zapier MCP tools/schema summary is read-only. No MCP tool invocation is enabled.',
    }),
    endpointSummary({
      endpoint: '/api/zapier/tools',
      mcp_server_name: 'zapier',
      status: (zapierResult as any).connected ? 'visible' : 'blocked',
      reachable: Boolean((zapierResult as any).connected),
      tool_count: Number((zapierResult as any).tools_total || zapierTools.length || 0),
      schema_available: heygenRequiredFields.length > 0 || mcpSchemaAvailable,
      blocked_reason: (zapierResult as any).connected ? null : String((zapierResult as any).blocker || zapierBlocker || 'zapier_tool_inventory_unavailable'),
      note: 'Canonical Zapier tool inventory is visible read-only when configured; writes remain disabled.',
    }),
    endpointSummary({
      endpoint: '/api/bridge/zapier/tools/search',
      mcp_server_name: 'zapier',
      status: (zapierResult as any).heygen_found ? 'visible' : ((zapierResult as any).connected ? 'configured' : 'blocked'),
      reachable: Boolean((zapierResult as any).connected),
      tool_count: Number((zapierResult as any).heygen_tools?.length || 0),
      schema_available: heygenRequiredFields.length > 0,
      blocked_reason: (zapierResult as any).connected ? null : String((zapierResult as any).blocker || zapierBlocker || 'zapier_search_unavailable'),
      note: 'Zapier tool search is visible read-only; use q=heygen for schema discovery. No execution is enabled.',
    }),
  ]
  const integrationItems = integrationRegistry.map((item) => ({
    id: item.id,
    status: item.status,
    visibility: item.status === 'blocked'
      ? 'blocked' as const
      : item.status === 'connected'
        ? 'visible' as const
        : 'configured' as const,
    direct_access: false,
    proxy_access: true,
    execution_enabled: false,
    writes_enabled: false,
    missing_credential: item.missing_credential,
    read_only: item.read_only,
    write_enabled: item.write_enabled,
    requires_bridge_session: item.requires_bridge_session,
  }))
  const zapierToolRecordsByName = new Map(zapierTools.map((tool) => [tool.tool_name, tool]))
  const mcpToolRegistry = mcpTools.map((tool) => {
    const name = String(tool.tool_name || tool.raw_tool_name || '').trim()
    const zapierTool = zapierToolRecordsByName.get(name)
    const writeClassification = String(tool.write_classification || zapierTool?.write_classification || 'unknown')
    const isReadOnly = writeClassification === 'read'
    return toolRegistryItem({
      id: name,
      name,
      status: accessFromVisibility(tool.schema_available ? 'schema_visible' : (mcpZapierResult as any).status),
      source: 'mcp_schema_passthrough',
      category: zapierTool?.category || 'mcp',
      mcpServerName: String((mcpZapierResult as any).server || 'zapier'),
      schemaAvailable: Boolean(tool.schema_available),
      readOnly: isReadOnly,
      writeEnabled: false,
      requiresBridgeSession: true,
      missingCredential: !mcpReachable && !zapierCredentialPresent,
      blockedReason: 'tool_invocation_disabled_in_agent_zero_read_only_context',
    })
  }).filter((tool) => tool.id)
  const fallbackZapierToolRegistry = zapierTools
    .filter((tool) => !mcpToolRegistry.some((item) => item.id === tool.tool_name))
    .map((tool) => toolRegistryItem({
      id: tool.tool_name,
      name: tool.tool_name,
      status: accessFromVisibility(tool.required_fields ? 'schema_visible' : tool.source),
      source: `zapier_${tool.source}`,
      category: tool.category,
      mcpServerName: 'zapier',
      schemaAvailable: Boolean(tool.required_fields),
      readOnly: tool.write_classification === 'read',
      writeEnabled: false,
      requiresBridgeSession: true,
      missingCredential: !zapierCredentialPresent,
      blockedReason: tool.blocker || 'tool_invocation_disabled_in_agent_zero_read_only_context',
    }))
  const bridgeSessionRead = readLatestAgentZeroBridgeSession({ sync: true })

  const toolRegistry = [
    toolRegistryItem({
      id: 'mission_control.status',
      name: 'Mission Control status',
      status: 'connected',
      source: 'mission_control',
      category: 'status',
      readOnly: true,
      requiresBridgeSession: false,
    }),
    toolRegistryItem({
      id: 'bridge.providers.list',
      name: 'Bridge provider list',
      status: providers.length > 0 ? 'visible' : 'blocked',
      source: 'mission_control_bridge',
      category: 'bridge',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: providers.length > 0 ? null : 'provider_registry_empty_or_unreachable',
    }),
    toolRegistryItem({
      id: 'mcp.zapier.tools.schema',
      name: 'Zapier MCP tool/schema listing',
      status: accessFromVisibility((mcpZapierResult as any).ok ? 'connected' : (mcpZapierResult as any).blocker),
      source: 'mcp_schema_passthrough',
      category: 'mcp',
      mcpServerName: 'zapier',
      schemaAvailable: mcpSchemaAvailable,
      readOnly: true,
      requiresBridgeSession: false,
      missingCredential: !zapierCredentialPresent && !mcpReachable,
      blockedReason: (mcpZapierResult as any).ok ? null : (zapierBlocker || 'mcp_schema_unavailable'),
    }),
    toolRegistryItem({
      id: 'build_wiki.farmer.status',
      name: 'Build-Wiki farmer status',
      status: 'visible',
      source: 'mission_control_build_wiki',
      category: 'buildwiki',
      readOnly: true,
      requiresBridgeSession: false,
    }),
    toolRegistryItem({
      id: 'brain.sync.status',
      name: 'Brain Sync status',
      status: brainSources.length > 0 ? 'visible' : 'blocked',
      source: 'claudeclaw_brain_sync',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: brainSources.length > 0 ? null : 'brain_sync_status_unavailable',
    }),
    toolRegistryItem({
      id: 'obsidian.adapter.status',
      name: 'Obsidian adapter vault status',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_obsidian_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'obsidian.adapter.search',
      name: 'Obsidian adapter safe note search',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_obsidian_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'obsidian.adapter.read',
      name: 'Obsidian adapter safe note read',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_obsidian_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'obsidian.adapter.summarize',
      name: 'Obsidian adapter note summary',
      status: obsidianAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_obsidian_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: obsidianAdapterConnected ? null : obsidianAdapterStatus.blockers.join(';') || 'obsidian_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.adapter.status',
      name: 'MemPalace adapter status',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_mempalace_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.adapter.query',
      name: 'MemPalace adapter safe memory query',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_mempalace_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.adapter.summary',
      name: 'MemPalace adapter safe memory summary',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_mempalace_adapter',
      category: 'brain',
      readOnly: true,
      requiresBridgeSession: false,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.memory.remember_task_result',
      name: 'MemPalace remember task result',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_execution_gateway',
      category: 'brain',
      readOnly: false,
      writeEnabled: mempalaceAdapterConnected,
      requiresBridgeSession: true,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.memory.remember_owner_preference',
      name: 'MemPalace remember owner preference',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_execution_gateway',
      category: 'brain',
      readOnly: false,
      writeEnabled: mempalaceAdapterConnected,
      requiresBridgeSession: true,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.memory.update_safe_summary',
      name: 'MemPalace update safe memory summary',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_execution_gateway',
      category: 'brain',
      readOnly: false,
      writeEnabled: mempalaceAdapterConnected,
      requiresBridgeSession: true,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    toolRegistryItem({
      id: 'mempalace.memory.link_report_task',
      name: 'MemPalace link memory to task/report',
      status: mempalaceAdapterConnected ? 'connected' : 'blocked',
      source: 'mission_control_agent_zero_execution_gateway',
      category: 'brain',
      readOnly: false,
      writeEnabled: mempalaceAdapterConnected,
      requiresBridgeSession: true,
      blockedReason: mempalaceAdapterConnected ? null : mempalaceAdapterStatus.blockers.join(';') || 'mempalace_adapter_blocked',
    }),
    ...mcpToolRegistry,
    ...fallbackZapierToolRegistry,
  ]

  const ecosystemAgents = providers
    .filter((provider) => ['agent_zero', 'tony_legacy', 'hermes', 'openclaw_gateway'].includes(String(provider.id || '').toLowerCase()))
    .map((provider) => ({
      id: String(provider.id || provider.name || ''),
      status: String(provider.state || 'unknown'),
      role: String(provider.category || provider.type || 'agent'),
      execution_enabled: false,
      direct_access: false,
      proxy_access: true,
    }))
  if (!ecosystemAgents.some((agent) => agent.id === 'hermes')) {
    ecosystemAgents.push({
      id: 'hermes',
      status: 'degraded',
      role: 'lieutenant / skill and workflow specialist',
      execution_enabled: false,
      direct_access: false,
      proxy_access: true,
    })
  }

  return buildAgentZeroReadOnlyContext({
    providerIds,
    providerRegistry: providers.map((provider) => ({
      id: providerId(provider),
      name: String(provider.name || provider.id || ''),
      state: String(provider.state || 'unknown'),
      category: String(provider.category || provider.type || 'provider'),
      execution_enabled: false,
      direct_access: false,
      proxy_access: true,
    })),
    agents: ecosystemAgents,
    modelCatalog: allModels.map((model) => ({ alias: model.alias, provider: model.provider, name: model.name })),
    modelProviderRegistry: buildModelProviderRegistry({
      providers,
      models: allModels.map((model) => ({ provider: model.provider, name: model.name })),
    }),
    skillNames,
    skillRegistry: skillRegistry.items,
    skillSources: skillRegistry.sources,
    integrationItems,
    integrationRegistry,
    toolRegistry,
    mcpServers: [{
      name: 'zapier',
      status: (mcpZapierResult as any).ok
        ? 'connected'
        : ((zapierResult as any).mcp_reachable || (zapierResult as any).connected ? 'visible_cached_or_bridge_inventory' : 'blocked'),
      transport: 'http',
      tool_count: mcpToolCount || null,
      reachable: Boolean((mcpZapierResult as any).ok || zapierReachable),
      schema_available: mcpSchemaAvailable,
      blocked_reason: (mcpZapierResult as any).ok ? null : zapierBlocker,
      tools_endpoint: '/api/mcp/servers/zapier/tools',
    }],
    mcpEndpointSummaries: endpointSummaries,
    mcpToolSchemaSummary: {
      tools_total: mcpToolCount,
      schema_available: mcpSchemaAvailable,
      required_fields: schemaRequiredFields,
      write_tools_total: writeToolsTotal,
      read_tools_total: readToolsTotal,
    },
    mcpVisible: Boolean((zapierResult as any).mcp_reachable || (zapierResult as any).connected || (mcpZapierResult as any).mcp_reachable),
    zapierVisible: Boolean((zapierResult as any).connected || (zapierResult as any).tools_total),
    zapierToolsTotal: Number((zapierResult as any).tools_total || zapierTools.length || 0),
    googleDriveVisible,
    oneDriveVisible,
    heygenVisible: Boolean((zapierResult as any).heygen_found),
    heygenSchemaVisible: heygenRequiredFields.length > 0,
    brainSources,
    brainRegistry,
    brainReadApis,
    brainWriteApis,
    brainWatchers,
    brainIndexStatus,
    timerActive,
    latestBuildWikiRunState: runState.ui_state,
    buildWikiFarmerStatus,
    bridgeSessionAvailable: latestRunNow.persistence_ready || bridgeSessionRead.persistence_ready,
    bridgeSession: bridgeSessionRead.session,
  })
}
