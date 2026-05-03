import { NextRequest, NextResponse } from 'next/server'
import { access, readdir, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { requireRole } from '@/lib/auth'
import { checkSkillSecurity } from '@/lib/skill-registry'

interface SkillSummary {
  id: string
  name: string
  source: string
  path: string
  description?: string
  registry_slug?: string | null
  security_status?: string | null
}

type SkillRoot = { source: string; path: string }

const NAMED_SKILLS = [
  'UI/UX Pro Max',
  'Claude-Mem',
  'LightRAG',
  'n8n',
  'MiroFish',
  'Everything Claude Code',
  'To Knowledge Skills',
  'Zapier',
  'FireCrawl',
]

function resolveSkillRoot(
  envName: string,
  fallback: string,
): string {
  const override = process.env[envName]
  return override && override.trim().length > 0 ? override.trim() : fallback
}

async function pathReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function extractDescription(skillPath: string): Promise<string | undefined> {
  const skillDocPath = join(skillPath, 'SKILL.md')
  if (!(await pathReadable(skillDocPath))) return undefined
  try {
    const content = await readFile(skillDocPath, 'utf8')
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
    const firstParagraph = lines.find((line) => !line.startsWith('#'))
    if (!firstParagraph) return undefined
    return firstParagraph.length > 220 ? `${firstParagraph.slice(0, 217)}...` : firstParagraph
  } catch {
    return undefined
  }
}

async function collectSkillsFromDir(baseDir: string, source: string): Promise<SkillSummary[]> {
  if (!(await pathReadable(baseDir))) return []
  try {
    const entries = await readdir(baseDir, { withFileTypes: true })
    const out: SkillSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = join(baseDir, entry.name)
      const skillDocPath = join(skillPath, 'SKILL.md')
      if (!(await pathReadable(skillDocPath))) continue
      out.push({
        id: `${source}:${entry.name}`,
        name: entry.name,
        source,
        path: skillPath,
        description: await extractDescription(skillPath),
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function getSkillRoots(): SkillRoot[] {
  const home = homedir()
  const cwd = process.cwd()
  const roots: SkillRoot[] = [
    { source: 'user-agents', path: resolveSkillRoot('MC_SKILLS_USER_AGENTS_DIR', join(home, '.agents', 'skills')) },
    { source: 'user-codex', path: resolveSkillRoot('MC_SKILLS_USER_CODEX_DIR', join(home, '.codex', 'skills')) },
    { source: 'project-agents', path: resolveSkillRoot('MC_SKILLS_PROJECT_AGENTS_DIR', join(cwd, '.agents', 'skills')) },
    { source: 'project-codex', path: resolveSkillRoot('MC_SKILLS_PROJECT_CODEX_DIR', join(cwd, '.codex', 'skills')) },
  ]
  // Add OpenClaw gateway skill roots when configured
  const openclawState = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || join(home, '.openclaw')
  const openclawSkills = resolveSkillRoot('MC_SKILLS_OPENCLAW_DIR', join(openclawState, 'skills'))
  roots.push({ source: 'openclaw', path: openclawSkills })

  // Add OpenClaw workspace-local skills (takes precedence when names conflict)
  const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR || process.env.MISSION_CONTROL_WORKSPACE_DIR || join(openclawState, 'workspace')
  const workspaceSkills = resolveSkillRoot('MC_SKILLS_WORKSPACE_DIR', join(workspaceDir, 'skills'))
  roots.push({ source: 'workspace', path: workspaceSkills })

  // Dynamic: scan for workspace-<agent> directories
  try {
    const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs')
    const entries = readdirSync(openclawState) as string[]
    for (const entry of entries) {
      if (!entry.startsWith('workspace-')) continue
      const skillsDir = join(openclawState, entry, 'skills')
      if (existsSync(skillsDir)) {
        const agentName = entry.replace('workspace-', '')
        roots.push({ source: `workspace-${agentName}`, path: skillsDir })
      }
    }
  } catch {
    // openclawBase may not exist
  }

  return roots
}

function normalizeSkillName(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) return null
  return value
}

function normalizeComparableName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildRegistryExtensions(skills: SkillSummary[], roots: SkillRoot[]) {
  const sharedRuntime = {
    runtime_layer: 'OpenClaw+',
    owner_agent: null,
    active_commander: 'agent_zero',
    lieutenant: 'hermes',
    available_to_agents: ['agent_zero', 'hermes'],
    tony_owns_skill_system: false,
    paths_visible: true,
    required_tools_visible: true,
    required_credentials_visible: true,
    execution_requirements_visible: true,
    blocked_reasons_visible: true,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required_for_execution: true,
  }
  const filesystem = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    install_path: skill.path,
    path: skill.path,
    readme: true,
    source: skill.source,
    state: 'installed',
  }))
  const agent = skills
    .filter((skill) => /agent|openclaw|workspace/i.test(skill.source))
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      source: skill.source,
      state: 'installed',
      install_path: skill.path,
    }))
  const installedNames = new Set(skills.map((skill) => normalizeComparableName(skill.name)))
  const named = NAMED_SKILLS.map((label) => {
    const key = normalizeComparableName(label)
    const installed = Array.from(installedNames).some((name) =>
      name.includes(key.slice(0, Math.min(8, key.length))),
    )
    return {
      label,
      installed,
      state: installed ? 'installed' : 'not_installed',
      next_action: installed ? null : `request_install:${label}`,
    }
  })

  return {
    ok: true,
    shared_runtime: sharedRuntime,
    filesystem,
    agent,
    npx: [],
    named,
    roots_scanned: roots.map((root) => root.path),
  }
}

/**
 * Try to serve skill list from DB (fast path).
 * Falls back to filesystem scan if DB has no data yet.
 */
function getSkillsFromDB(): SkillSummary[] | null {
  try {
    const { getDatabase } = require('@/lib/db')
    const db = getDatabase()
    const rows = db.prepare('SELECT name, source, path, description, registry_slug, security_status FROM skills ORDER BY name').all() as Array<{
      name: string; source: string; path: string; description: string | null; registry_slug: string | null; security_status: string | null
    }>
    if (rows.length === 0) return null // DB empty — fall back to fs scan
    return rows.map(r => ({
      id: `${r.source}:${r.name}`,
      name: r.name,
      source: r.source,
      path: r.path,
      description: r.description || undefined,
      registry_slug: r.registry_slug,
      security_status: r.security_status,
    }))
  } catch {
    return null
  }
}

function skillMutationLocked(action: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      owner_approval_required: true,
      approval_state: 'required',
      execution_enabled: false,
      writes_enabled: false,
      approval_request_created: false,
      canonical_endpoint: '/api/skills/finder/request-install',
      deprecated_endpoint: '/api/skills',
      action,
      next_action: 'Skill writes are locked until owner-approved approval/audit persistence and rollback paths are active.',
      ...extra,
    },
    { status: 423 },
  )
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const roots = getSkillRoots()
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')

  if (mode === 'content') {
    const source = String(searchParams.get('source') || '')
    const name = normalizeSkillName(String(searchParams.get('name') || ''))
    if (!source || !name) {
      return NextResponse.json({ error: 'source and valid name are required' }, { status: 400 })
    }
    const root = roots.find((r) => r.source === source)
    if (!root) return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    const skillPath = join(root.path, name)
    const skillDocPath = join(skillPath, 'SKILL.md')
    if (!(await pathReadable(skillDocPath))) {
      return NextResponse.json({ error: 'SKILL.md not found' }, { status: 404 })
    }
    const content = await readFile(skillDocPath, 'utf8')

    // Run security check inline
    const security = checkSkillSecurity(content)

    return NextResponse.json({
      source,
      name,
      skillPath,
      skillDocPath,
      content,
      security,
    })
  }

  if (mode === 'check') {
    // Security-check a specific skill's content
    const source = String(searchParams.get('source') || '')
    const name = normalizeSkillName(String(searchParams.get('name') || ''))
    if (!source || !name) {
      return NextResponse.json({ error: 'source and valid name are required' }, { status: 400 })
    }
    const root = roots.find((r) => r.source === source)
    if (!root) return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    const skillPath = join(root.path, name)
    const skillDocPath = join(skillPath, 'SKILL.md')
    if (!(await pathReadable(skillDocPath))) {
      return NextResponse.json({ error: 'SKILL.md not found' }, { status: 404 })
    }
    const content = await readFile(skillDocPath, 'utf8')
    const security = checkSkillSecurity(content)

    return NextResponse.json({
      source,
      name,
      security,
      state: 'READ_ONLY',
      writes_enabled: false,
      note: 'Security check is read-only; security_status persistence is locked until approval/audit persistence is active.',
    })
  }

  // Try DB-backed fast path first
  const dbSkills = getSkillsFromDB()
  if (dbSkills) {
    // Group by source for the groups response
    const groupMap = new Map<string, { source: string; path: string; skills: SkillSummary[] }>()
    for (const root of roots) {
      groupMap.set(root.source, { source: root.source, path: root.path, skills: [] })
    }
    for (const skill of dbSkills) {
      // Dynamically add workspace-* groups not already in roots
      if (!groupMap.has(skill.source) && skill.source.startsWith('workspace-')) {
        groupMap.set(skill.source, { source: skill.source, path: '', skills: [] })
      }
      const group = groupMap.get(skill.source)
      if (group) group.skills.push(skill)
    }

    const deduped = new Map<string, SkillSummary>()
    for (const skill of dbSkills) {
      if (!deduped.has(skill.name)) deduped.set(skill.name, skill)
    }

    return NextResponse.json({
      skills: Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)),
      groups: Array.from(groupMap.values()),
      total: deduped.size,
      ...buildRegistryExtensions(Array.from(deduped.values()), roots),
    })
  }

  // Fallback: filesystem scan (first load before sync runs)
  const bySource = await Promise.all(
    roots.map(async (root) => ({
      source: root.source,
      path: root.path,
      skills: await collectSkillsFromDir(root.path, root.source),
    }))
  )

  const all = bySource.flatMap((group) => group.skills)
  const deduped = new Map<string, SkillSummary>()
  for (const skill of all) {
    if (!deduped.has(skill.name)) deduped.set(skill.name, skill)
  }

  return NextResponse.json({
    skills: Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)),
    groups: bySource,
    total: deduped.size,
    ...buildRegistryExtensions(Array.from(deduped.values()), roots),
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const name = normalizeSkillName(String(body?.name || ''))
  return skillMutationLocked('create_skill', {
    source: body?.source || null,
    name,
  })
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const name = normalizeSkillName(String(body?.name || ''))
  return skillMutationLocked('update_skill', {
    source: body?.source || null,
    name,
  })
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const name = normalizeSkillName(String(searchParams.get('name') || ''))
  return skillMutationLocked('delete_skill', {
    source: searchParams.get('source') || null,
    name,
  })
}

export const dynamic = 'force-dynamic'
