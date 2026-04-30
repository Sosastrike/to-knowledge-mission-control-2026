import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  ownerApprovalRequired,
  routePath,
} from '@/lib/designer-module-api'
import Database from 'better-sqlite3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SkillSearchRow = {
  name?: string
  source?: string | null
  path?: string | null
  description?: string | null
  registry_slug?: string | null
  security_status?: string | null
  enabled?: number | null
  command_or_api?: string | null
  category?: string | null
  health?: string | null
  required_credentials?: string | null
}

const CLAUDECLAW_DB_PATH =
  process.env.CLAUDECLAW_DB_PATH ||
  '/home/tony/claudeclaw/store/claudeclaw.db'

function searchMissionControlSkills(query: string): SkillSearchRow[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/db') as typeof import('@/lib/db')
    const db = getDatabase()
    const like = `%${query.toLowerCase()}%`
    return db.prepare(`
      SELECT
        name,
        source,
        path,
        description,
        registry_slug,
        security_status,
        1 AS enabled,
        NULL AS command_or_api,
        NULL AS category,
        NULL AS health,
        '[]' AS required_credentials
      FROM skills
      WHERE lower(name) LIKE ?
        OR lower(COALESCE(source, '')) LIKE ?
        OR lower(COALESCE(description, '')) LIKE ?
        OR lower(COALESCE(registry_slug, '')) LIKE ?
      ORDER BY name
      LIMIT 50
    `).all(like, like, like, like) as SkillSearchRow[]
  } catch {
    return []
  }
}

function searchClaudeClawAgentSkills(query: string): SkillSearchRow[] {
  let db: Database.Database | null = null
  try {
    db = new Database(CLAUDECLAW_DB_PATH, { readonly: true, fileMustExist: true })
    const like = `%${query.toLowerCase()}%`
    return db.prepare(`
      SELECT
        name,
        'claudeclaw-agent-skills' AS source,
        install_path AS path,
        purpose AS description,
        name AS registry_slug,
        health AS security_status,
        enabled,
        command_or_api,
        category,
        health,
        required_credentials
      FROM agent_skills
      WHERE lower(name) LIKE ?
        OR lower(display_name) LIKE ?
        OR lower(COALESCE(category, '')) LIKE ?
        OR lower(COALESCE(purpose, '')) LIKE ?
        OR lower(COALESCE(command_or_api, '')) LIKE ?
      ORDER BY enabled DESC, name
      LIMIT 50
    `).all(like, like, like, like, like) as SkillSearchRow[]
  } catch {
    return []
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}


function parseCredentialNames(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function listClaudeClawAgentSkills(): SkillSearchRow[] {
  let db: Database.Database | null = null
  try {
    db = new Database(CLAUDECLAW_DB_PATH, { readonly: true, fileMustExist: true })
    return db.prepare(`
      SELECT
        name,
        'claudeclaw-agent-skills' AS source,
        install_path AS path,
        purpose AS description,
        name AS registry_slug,
        health AS security_status,
        enabled,
        command_or_api,
        category,
        health,
        required_credentials
      FROM agent_skills
      ORDER BY enabled DESC, category, name
    `).all() as SkillSearchRow[]
  } catch {
    return []
  } finally {
    try { db?.close() } catch { /* noop */ }
  }
}

function searchSkills(query: string): SkillSearchRow[] {
  const byKey = new Map<string, SkillSearchRow>()
  for (const skill of [
    ...searchMissionControlSkills(query),
    ...searchClaudeClawAgentSkills(query),
  ]) {
    const key = `${skill.source || 'unknown'}:${skill.name || ''}`
    if (!byKey.has(key)) byKey.set(key, skill)
  }
  return Array.from(byKey.values()).slice(0, 100)
}

function skillSearchPayload(query: string) {
  const normalizedQuery = query.trim()
  const results = searchSkills(normalizedQuery).map((skill) => ({
    name: skill.name || '',
    source: skill.source || null,
    path: skill.path || null,
    description: skill.description || null,
    registry_slug: skill.registry_slug || null,
    security_status: skill.security_status || 'unknown',
    enabled: skill.enabled === 1,
    command_or_api: skill.command_or_api || null,
    category: skill.category || null,
    health: skill.health || null,
    credential_names: parseCredentialNames(skill.required_credentials),
    state: 'READ_ONLY',
    executable: false,
    install_state: 'OWNER_APPROVAL_REQUIRED',
    test_state: 'BACKEND_REQUIRED',
  }))

  return {
    ok: true,
    state: 'READ_ONLY',
    query: normalizedQuery,
    total: results.length,
    results,
    actions: {
      search: 'READ_ONLY',
      request_install: 'OWNER_APPROVAL_REQUIRED',
      enable_disable: 'OWNER_APPROVAL_REQUIRED',
      test: 'BACKEND_REQUIRED',
    },
    sources: {
      mission_control_skills_table: true,
      claudeclaw_agent_skills_table: true,
      claudeclaw_db_path: CLAUDECLAW_DB_PATH,
    },
    execution_enabled: false,
    writes_enabled: false,
    approval_request_created: false,
    note: 'Search/list only. No skill install, enable/disable, or execution was performed.',
  }
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (path === 'finder/search') {
    const { searchParams } = new URL(request.url)
    const query = String(searchParams.get('q') || searchParams.get('query') || '').trim()
    return NextResponse.json(skillSearchPayload(query))
  }

  if (path === 'tool-skills') {
    const tools = listClaudeClawAgentSkills().map((skill) => ({
      name: skill.name || '',
      source: skill.source || 'claudeclaw-agent-skills',
      path: skill.path || null,
      description: skill.description || null,
      category: skill.category || null,
      health: skill.health || 'unknown',
      enabled: skill.enabled === 1,
      command_or_api: skill.command_or_api || null,
      credential_names: parseCredentialNames(skill.required_credentials),
      state: 'READ_ONLY',
      execution_enabled: false,
      writes_enabled: false,
      install_state: 'OWNER_APPROVAL_REQUIRED',
      test_state: 'BACKEND_REQUIRED',
    }))

    return NextResponse.json({
      ok: true,
      state: 'READ_ONLY',
      source: 'claudeclaw_agent_skills_table',
      claudeclaw_db_path: CLAUDECLAW_DB_PATH,
      total: tools.length,
      enabled_total: tools.filter((tool) => tool.enabled).length,
      execution_enabled: false,
      writes_enabled: false,
      actions: {
        list: 'READ_ONLY',
        search: 'READ_ONLY',
        install: 'OWNER_APPROVAL_REQUIRED',
        enable_disable: 'OWNER_APPROVAL_REQUIRED',
        test: 'BACKEND_REQUIRED',
      },
      tools,
      note: 'Read-only ClaudeClaw agent skill inventory. No skill install, enable/disable, probe, or execution was performed.',
    })
  }
  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: CatchAllParams }) {
  const path = routePath((await params).path)
  const parts = path.split('/').filter(Boolean)

  if (parts[0] === 'finder' && parts[1] === 'search') {
    const auth = authJson(request, 'viewer')
    if (auth) return auth

    const body = await request.json().catch(() => ({}))
    const query = String(body?.query || '').trim()
    if (!query) return NextResponse.json({ ok: false, error: 'query required' }, { status: 400 })
    return NextResponse.json(skillSearchPayload(query))
  }

  const auth = authJson(request, 'operator')
  if (auth) return auth

  if (parts[0] === 'finder' && parts[1] === 'request-install') {
    const body = await request.json().catch(() => ({}))
    const name = String(body?.name || '').trim()
    if (!name) return NextResponse.json({ ok: false, error: 'name required' }, { status: 400 })
    return ownerApprovalRequired({
      name,
      repo: body?.repo || null,
      designed_payload_accepted: true,
      next_action: 'Owner approval plus approved skill install runner required.',
    })
  }

  if (parts[0] && parts[1] === 'test') {
    return backendRequired({
      skill_id: parts[0],
      note: 'Per-skill probe runner is not implemented yet.',
    })
  }

  if (parts[0] && ['enable', 'disable'].includes(parts[1] || '')) {
    return ownerApprovalRequired({
      skill_id: parts[0],
      action: parts[1],
      next_action: 'Owner approval plus agent skill enable/disable persistence required.',
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
