type BrainSourceInput = {
  source?: unknown
  status?: unknown
  raw_state?: unknown
  count?: unknown
  last_known_sync_at?: unknown
  last_attempt_at?: unknown
  last_error?: unknown
  missing_connector_warning?: unknown
  summary?: unknown
  details?: unknown
  owner_status?: unknown
}

type BrainStatusInput = {
  generated_at?: unknown
  upstream?: unknown
  sources?: unknown
  brain_sync?: unknown
}

export type KnowledgeSourceReport = {
  id: string
  label: string
  index_state: 'indexed' | 'not_indexed' | 'blocked' | 'disabled'
  owner_status: string
  record_count: number | null
  last_sync_at: string | null
  blocker: string | null
  summary: string
  safe_link: string
}

export type KnowledgeReport = {
  ok: true
  mode: 'knowledge_report'
  generated_at: string
  summary: {
    total_sources: number
    indexed: number
    not_indexed: number
    blocked: number
    disabled: number
    last_sync_at: string | null
  }
  sources: KnowledgeSourceReport[]
  safety: {
    raw_local_paths_exposed: false
    memory_writes_enabled: boolean
    external_writes_enabled: boolean
    bridge_session_required_for_writes: true
  }
  blockers: string[]
  links: {
    brain: '/gateway/brain'
    bridge_session: '/gateway/bridge-session'
    reports: '/api/bridge/brain-sync/knowledge-report'
  }
  markdown: string
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function safeText(value: unknown, fallback = ''): string {
  return asString(value, fallback)
    .replace(/\/Users\/[^\s,)]+/g, '<redacted-path>')
    .replace(/\/home\/[^\s,)]+/g, '<redacted-path>')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/g, 'Bearer <redacted>')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, '<redacted-token>')
    .slice(0, 360)
}

function ownerStatus(input: BrainSourceInput): string {
  const owner = objectRecord(input.owner_status)
  return asString(owner.status, asString(input.status, 'UNKNOWN')).toUpperCase()
}

function sourceId(input: BrainSourceInput): string {
  return asString(input.source, 'unknown').toLowerCase().replace(/[^a-z0-9_+-]+/g, '_')
}

function labelFromId(id: string): string {
  const labels: Record<string, string> = {
    agent_zero_brain: 'Agent Zero Brain',
    brain_sync: 'Brain Sync',
    buildwiki: 'Build-Wiki / Farmer',
    graphify: 'Graphify',
    mempalace: 'MemPalace',
    obsidian: 'Obsidian',
  }
  return labels[id] || id.split(/[_-]+/g).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

function classifyIndexState(input: BrainSourceInput): KnowledgeSourceReport['index_state'] {
  const status = asString(input.status).toLowerCase()
  const raw = asString(input.raw_state).toLowerCase()
  const owner = ownerStatus(input)
  const details = objectRecord(input.details)
  const count = asNumber(input.count)
  const indexed = details.indexed === true || count !== null && count > 0

  if (owner === 'DISABLED' || status === 'disabled' || raw === 'disabled') return 'disabled'
  if (
    owner === 'BLOCKED' ||
    owner === 'SERVICE_DOWN' ||
    owner === 'CREDENTIAL_GATED' ||
    status === 'not_connected' ||
    status === 'blocked' ||
    status === 'needs_owner_setup'
  ) return 'blocked'
  return indexed ? 'indexed' : 'not_indexed'
}

function sourceReport(input: BrainSourceInput): KnowledgeSourceReport {
  const id = sourceId(input)
  const indexState = classifyIndexState(input)
  const blocker = indexState === 'blocked'
    ? safeText(input.last_error || input.missing_connector_warning || `${id}_not_available`, `${id}_not_available`)
    : null

  return {
    id,
    label: labelFromId(id),
    index_state: indexState,
    owner_status: ownerStatus(input),
    record_count: asNumber(input.count),
    last_sync_at: asString(input.last_known_sync_at) || asString(input.last_attempt_at) || null,
    blocker,
    summary: safeText(input.summary, `${labelFromId(id)} status is visible.`),
    safe_link: '/gateway/brain',
  }
}

function latestIso(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null
}

function markdownFor(report: Omit<KnowledgeReport, 'markdown'>): string {
  const lines = [
    '## Knowledge Report',
    '',
    `Generated: ${report.generated_at}`,
    `Indexed: ${report.summary.indexed}`,
    `Not indexed: ${report.summary.not_indexed}`,
    `Blocked: ${report.summary.blocked}`,
    `Disabled: ${report.summary.disabled}`,
    `Last sync: ${report.summary.last_sync_at || 'none visible'}`,
    '',
    '### Sources',
    ...report.sources.map((source) => `- ${source.label}: ${source.index_state}; records=${source.record_count ?? 'unknown'}; last_sync=${source.last_sync_at || 'none'}; blocker=${source.blocker || 'none'}; link=${source.safe_link}`),
    '',
    'Writes remain Bridge Session gated. This report does not expose local paths, credentials, or raw private records.',
  ]
  return lines.join('\n')
}

export function buildKnowledgeReport(input: BrainStatusInput): KnowledgeReport {
  const generatedAt = asString(input.generated_at) || new Date().toISOString()
  const sources = Array.isArray(input.sources)
    ? (input.sources as BrainSourceInput[]).map(sourceReport)
    : []
  const summary = {
    total_sources: sources.length,
    indexed: sources.filter((source) => source.index_state === 'indexed').length,
    not_indexed: sources.filter((source) => source.index_state === 'not_indexed').length,
    blocked: sources.filter((source) => source.index_state === 'blocked').length,
    disabled: sources.filter((source) => source.index_state === 'disabled').length,
    last_sync_at: latestIso(sources.map((source) => source.last_sync_at)),
  }
  const brainSync = objectRecord(input.brain_sync)
  const blockers = Array.from(new Set(sources.map((source) => source.blocker).filter((value): value is string => Boolean(value)))).sort()
  const base = {
    ok: true as const,
    mode: 'knowledge_report' as const,
    generated_at: generatedAt,
    summary,
    sources,
    safety: {
      raw_local_paths_exposed: false as const,
      memory_writes_enabled: Boolean(brainSync.production_memory_writes_enabled || brainSync.protected_memory_changes_enabled || brainSync.shared_brain_writes_enabled),
      external_writes_enabled: Boolean(brainSync.external_connector_writes_enabled),
      bridge_session_required_for_writes: true as const,
    },
    blockers,
    links: {
      brain: '/gateway/brain' as const,
      bridge_session: '/gateway/bridge-session' as const,
      reports: '/api/bridge/brain-sync/knowledge-report' as const,
    },
  }
  return {
    ...base,
    markdown: markdownFor(base),
  }
}
