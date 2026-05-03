import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SourceStatus = {
  source?: string
  state?: string
  path?: string
  count?: number
  detail?: string
}

type SyncSource = {
  source?: string
  state?: string
  last_success_at?: number | null
  last_attempt_at?: number | null
  last_error?: string | null
  summary?: string
  details?: Record<string, unknown>
}

function isoFromSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function classifySource(
  source: string,
  state: string | undefined,
  options: { writeStatusOnly?: boolean; present?: boolean } = {},
) {
  const normalized = String(state || '').toLowerCase()
  if (!options.present) return 'not_connected'
  if (options.writeStatusOnly) return 'read_only'
  if (['available', 'healthy', 'active', 'ready', 'ok'].includes(normalized)) return 'read_only'
  if (['delayed', 'status_only', 'degraded', 'warning'].includes(normalized)) return 'read_only'
  if (['missing', 'not_connected', 'unavailable', 'failed', 'error'].includes(normalized)) return 'not_connected'
  return source === 'mempalace' ? 'read_only' : 'needs_owner_setup'
}

function normalizeSource(input: {
  source: string
  state?: string
  summary?: string
  path?: string | null
  count?: number | null
  lastSuccessAt?: number | null
  lastAttemptAt?: number | null
  lastError?: string | null
  details?: Record<string, unknown>
  writeStatusOnly?: boolean
}) {
  const present = Boolean(input.state || input.path || input.summary || input.lastSuccessAt || input.lastAttemptAt || input.details)
  return {
    source: input.source,
    status: classifySource(input.source, input.state, { present, writeStatusOnly: input.writeStatusOnly }),
    raw_state: input.state || (present ? 'available' : 'not_connected'),
    last_known_sync_at: isoFromSeconds(input.lastSuccessAt),
    last_attempt_at: isoFromSeconds(input.lastAttemptAt),
    missing_connector_warning: present ? null : `${input.source} is not connected to the read-only Brain Sync status layer.`,
    summary: input.summary || (present ? `${input.source} is visible in read-only mode.` : `${input.source} is not connected.`),
    path: input.path || null,
    count: input.count ?? null,
    last_error: input.lastError || null,
    details: input.details || {},
    writes_enabled: false,
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!hasClaudeClawDashboardToken()) {
    return NextResponse.json({
      ok: false,
      mode: 'brain_sync_readonly_status',
      error: 'claudeclaw_dashboard_token_missing',
      sources: [],
      memory_writes_enabled: false,
      protected_memory_changes_enabled: false,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const [sync, context, writeContract] = await Promise.all([
    fetchClaudeClawJson<{ sources?: SyncSource[] }>('/api/memory-sync/status', {}, 12000).catch((error) => ({
      ok: false,
      status: 503,
      payload: { error: error instanceof Error ? error.message : 'memory_sync_status_failed' },
    })),
    fetchClaudeClawJson<{ source_status?: SourceStatus[]; agent_consumers?: unknown[]; write_contract?: unknown }>(
      '/api/brain/context?q=brain%20sync%20status&agent_id=agent_zero&limit=5',
      {},
      12000,
    ).catch((error) => ({
      ok: false,
      status: 503,
      payload: { error: error instanceof Error ? error.message : 'brain_context_failed' },
    })),
    fetchClaudeClawJson<Record<string, unknown>>('/api/brain/write-contract', {}, 12000).catch((error) => ({
      ok: false,
      status: 503,
      payload: { error: error instanceof Error ? error.message : 'write_contract_failed' },
    })),
  ])

  const syncSources = Array.isArray((sync.payload as any)?.sources)
    ? ((sync.payload as any).sources as SyncSource[])
    : []
  const contextSources = Array.isArray((context.payload as any)?.source_status)
    ? ((context.payload as any).source_status as SourceStatus[])
    : []

  const syncBySource = new Map(syncSources.map((source) => [String(source.source || '').toLowerCase(), source]))
  const contextBySource = new Map<string, SourceStatus[]>()
  for (const source of contextSources) {
    const key = String(source.source || '').toLowerCase()
    if (!key) continue
    contextBySource.set(key, [...(contextBySource.get(key) || []), source])
  }

  const buildWikiSources = contextBySource.get('build_wiki') || []
  const obsidianSync = syncBySource.get('obsidian')
  const mempalaceSync = syncBySource.get('mempalace')
  const graphifySync = syncBySource.get('graphify')
  const mempalaceContext = contextBySource.get('mempalace')?.[0]

  const sources = [
    normalizeSource({
      source: 'agent_zero_brain',
      state: context.ok ? 'available' : 'not_connected',
      summary: context.ok
        ? 'Agent Zero brain context is reading the shared brain layer through Mission Control /api/brain/context.'
        : 'Agent Zero brain context is not reachable through the shared brain endpoint.',
      count: contextSources.reduce((total, row) => total + (typeof row.count === 'number' ? row.count : 0), 0),
      details: {
        endpoint: '/api/brain/context',
        agent_id: 'agent_zero',
        source_count: contextSources.length,
        agent_consumers: (context.payload as any)?.agent_consumers || [],
      },
    }),
    normalizeSource({
      source: 'brain_sync',
      state: buildWikiSources.length > 0 ? 'available' : 'not_connected',
      summary: buildWikiSources.length > 0
        ? 'Brain Sync read layer is available through Build-Wiki, Obsidian, file handoffs, approval history, task history, and MemPalace status.'
        : 'Brain Sync source inventory is not visible yet.',
      count: buildWikiSources.reduce((total, row) => total + (typeof row.count === 'number' ? row.count : 0), 0),
      details: {
        planned_status: 'read_only_available',
        available_status: context.ok ? 'available' : 'not_connected',
        source_status: contextSources,
      },
    }),
    normalizeSource({
      source: 'mempalace',
      state: mempalaceContext?.state || mempalaceSync?.state,
      summary: mempalaceContext?.detail || mempalaceSync?.summary || 'MemPalace is not production-connected yet.',
      path: mempalaceContext?.path || String(mempalaceSync?.details?.data_path || ''),
      count: typeof mempalaceSync?.details?.last_entries === 'number' ? mempalaceSync.details.last_entries : null,
      lastSuccessAt: mempalaceSync?.last_success_at,
      lastAttemptAt: mempalaceSync?.last_attempt_at,
      lastError: mempalaceSync?.last_error,
      details: mempalaceSync?.details,
      writeStatusOnly: true,
    }),
    normalizeSource({
      source: 'obsidian',
      state: obsidianSync?.state || contextBySource.get('obsidian')?.[0]?.state,
      summary: obsidianSync?.summary || 'Obsidian vault read status is available through shared brain context.',
      path: String(obsidianSync?.details?.vault_path || contextBySource.get('obsidian')?.[0]?.path || ''),
      count: typeof obsidianSync?.details?.md_files === 'number'
        ? obsidianSync.details.md_files as number
        : contextBySource.get('obsidian')?.[0]?.count ?? null,
      lastSuccessAt: obsidianSync?.last_success_at,
      lastAttemptAt: obsidianSync?.last_attempt_at,
      lastError: obsidianSync?.last_error,
      details: obsidianSync?.details,
    }),
    normalizeSource({
      source: 'graphify',
      state: graphifySync?.state,
      summary: graphifySync?.summary || 'Graphify is not connected to the read-only Brain Sync status layer.',
      path: String(graphifySync?.details?.dir || ''),
      count: typeof graphifySync?.details?.nodes === 'number' ? graphifySync.details.nodes as number : null,
      lastSuccessAt: graphifySync?.last_success_at,
      lastAttemptAt: graphifySync?.last_attempt_at,
      lastError: graphifySync?.last_error,
      details: graphifySync?.details,
    }),
  ]

  const summary = sources.reduce((acc, source) => {
    acc.total += 1
    acc[source.status] = (acc[source.status] || 0) + 1
    return acc
  }, { total: 0 } as Record<string, number>)

  return NextResponse.json({
    ok: true,
    mode: 'brain_sync_readonly_status',
    generated_at: new Date().toISOString(),
    canonical_sources: {
      memory_sync_status: 'ClaudeClaw /api/memory-sync/status',
      shared_brain_context: 'ClaudeClaw /api/brain/context',
      write_contract: 'ClaudeClaw /api/brain/write-contract',
    },
    sources,
    summary,
    brain_sync: {
      planned_status: 'available_read_only',
      available_status: context.ok ? 'available' : 'not_connected',
      production_memory_writes_enabled: false,
      protected_memory_changes_enabled: false,
      shared_brain_writes_enabled: false,
      mempalace_writes_enabled: false,
      external_connector_writes_enabled: false,
      missing_connector_warning: sources
        .filter((source) => source.status === 'not_connected' || source.status === 'needs_owner_setup')
        .map((source) => source.missing_connector_warning || `${source.source} requires owner setup.`),
    },
    write_contract: {
      ...(typeof writeContract.payload === 'object' && writeContract.payload ? writeContract.payload : {}),
      memory_writes_enabled: false,
      protected_memory_changes_enabled: false,
      production_memory_writes_enabled: false,
      shared_brain_writes_enabled: false,
      mempalace_writes_enabled: false,
      external_connector_writes_enabled: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
