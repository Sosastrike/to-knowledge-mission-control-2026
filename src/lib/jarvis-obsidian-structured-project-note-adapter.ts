import { createAgentZeroObsidianNote, type AgentZeroObsidianWriteResult } from '@/lib/agent-zero-obsidian-adapter'

export const JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID = 'obsidian_structured_project_note_write'
export const JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION = 'obsidian.note.structured_project_create'
export const JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_SESSION_SCOPE = 'obsidian_structured_project_note_write'

const STRUCTURED_PROJECT_NOTE_FOLDER = 'Agent Zero/Jarvis Full GO/Structured Project Notes'

export type JarvisObsidianStructuredProjectNoteResult = {
  ok: boolean
  adapter_id: typeof JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID
  action: typeof JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION
  note_created: boolean
  title: string | null
  note_relative_path: string | null
  folder: typeof STRUCTURED_PROJECT_NOTE_FOLDER
  credential_values_exposed: false
  raw_content_returned: false
  direct_filesystem_exposed: false
  tok_touched: false
  paperclip_write_called: false
  provider_execution_called: false
  mcp_tool_invocation_called: false
  delivery_send_or_upload_called: false
  exact_blocker: string | null
}

type AdapterInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type Deps = {
  createNote?: typeof createAgentZeroObsidianNote
  now?: () => Date
}

function blocked(exact_blocker: string): JarvisObsidianStructuredProjectNoteResult {
  return {
    ok: false,
    adapter_id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
    action: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
    note_created: false,
    title: null,
    note_relative_path: null,
    folder: STRUCTURED_PROJECT_NOTE_FOLDER,
    credential_values_exposed: false,
    raw_content_returned: false,
    direct_filesystem_exposed: false,
    tok_touched: false,
    paperclip_write_called: false,
    provider_execution_called: false,
    mcp_tool_invocation_called: false,
    delivery_send_or_upload_called: false,
    exact_blocker,
  }
}

function sanitizeText(value: unknown, fallback = '', max = 4000): string {
  const raw = typeof value === 'string' ? value : fallback
  return String(raw || fallback)
    .replace(/\0/g, '')
    .replace(/\b(?:api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s`]+["']?/gi, (match) => {
      const key = match.split(/[:=]/)[0]?.trim() || 'secret'
      return `${key}=<redacted>`
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gi, 'Bearer <redacted>')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{16,}/g, '<redacted-token>')
    .replace(/\/home\/tony\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .replace(/\bruntime\/(?:executive-reports|reports|task-reports)\/[^\s)\]'"`<>]+/g, '<server-local-path>')
    .trim()
    .slice(0, max)
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return slug || 'jarvis-full-go-note'
}

function safeList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : []
  return list.map((item) => sanitizeText(item, '', 300)).filter(Boolean).slice(0, 12)
}

function renderStructuredContent(input: Record<string, unknown>): string {
  const status = sanitizeText(input.status, 'in_progress', 120)
  const summary = sanitizeText(input.summary, 'Jarvis Full GO project note.', 6000)
  const nextActions = safeList(input.next_actions)
  const blockers = safeList(input.blockers)
  return [
    '## Status',
    '',
    status,
    '',
    '## Summary',
    '',
    summary,
    '',
    '## Next Actions',
    '',
    ...(nextActions.length ? nextActions.map((item) => `- ${item}`) : ['- Continue exact-scope adapter execution with audit and rollback.']),
    '',
    '## Current Blockers',
    '',
    ...(blockers.length ? blockers.map((item) => `- ${item}`) : ['- No blocker recorded for this note.']),
    '',
    '## Safety Contract',
    '',
    '- Created through Jarvis exact-scope Mission Control execution.',
    '- No credentials, cookies, tokens, auth files, or raw local paths are included.',
    '- Rollback is limited to removing this exact note from the canonical vault.',
    '',
  ].join('\n')
}

function exactScopeMatches(scope: Record<string, unknown> | undefined): boolean {
  return Boolean(
    scope
      && scope.system === 'obsidian'
      && scope.operation === 'structured_project_note_create'
      && scope.vault === 'canonical'
      && scope.folder === 'jarvis_full_go',
  )
}

function noteResult(write: AgentZeroObsidianWriteResult): JarvisObsidianStructuredProjectNoteResult {
  const exactBlocker = write.ok ? null : write.blockers[0] || 'obsidian_structured_project_note_failed'
  return {
    ok: write.ok,
    adapter_id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
    action: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
    note_created: write.ok,
    title: write.note?.title || null,
    note_relative_path: write.note?.relative_path || null,
    folder: STRUCTURED_PROJECT_NOTE_FOLDER,
    credential_values_exposed: false,
    raw_content_returned: false,
    direct_filesystem_exposed: false,
    tok_touched: false,
    paperclip_write_called: false,
    provider_execution_called: false,
    mcp_tool_invocation_called: false,
    delivery_send_or_upload_called: false,
    exact_blocker: exactBlocker,
  }
}

export function executeJarvisObsidianStructuredProjectNote(input: AdapterInput, deps: Deps = {}): JarvisObsidianStructuredProjectNoteResult {
  if (input.action !== JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION || !exactScopeMatches(input.scope)) {
    return blocked('exact_scope_required_obsidian_structured_project_note')
  }

  const payload = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
  if ('path' in payload || 'relative_path' in payload || 'folder' in payload) {
    return blocked('obsidian_structured_project_note_path_not_allowed')
  }

  const project = sanitizeText(payload.project, 'Jarvis Full GO', 120)
  if (!project) return blocked('obsidian_structured_project_note_project_required')
  const title = `Jarvis Full GO - ${project}`
  const now = (deps.now || (() => new Date()))()
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const path = `${STRUCTURED_PROJECT_NOTE_FOLDER}/${slugify(project)}-${timestamp}.md`
  const createNote = deps.createNote || createAgentZeroObsidianNote
  const write = createNote({
    title,
    path,
    content: renderStructuredContent(payload),
    tags: ['jarvis', 'full-go', 'structured-project-note'],
  })
  return noteResult(write)
}
