import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { fetchClaudeClawJson, hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import { HERMES_BRAIN_CANONICAL_HIERARCHY } from '@/lib/hermes-brain-sync'
import { sanitizeBridgeProviderPayload } from '@/lib/bridge-provider-sanitizer'
import { getAgentZeroObsidianStatus, type AgentZeroObsidianStatus } from '@/lib/agent-zero-obsidian-adapter'
import { getAgentZeroMemPalaceStatus, type AgentZeroMemPalaceStatus } from '@/lib/agent-zero-mempalace-adapter'
import { readLatestRunNow, readRunNowHistory } from '@/lib/build-wiki-run-now'
import { describeOwnerFacingStatus } from '@/lib/owner-status'

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
  if (['available', 'healthy', 'active', 'ready', 'ok'].includes(normalized)) return 'read_only'
  if (['delayed', 'status_only', 'degraded', 'warning'].includes(normalized)) return 'read_only'
  if (['missing', 'not_connected', 'unavailable', 'failed', 'error'].includes(normalized)) return 'not_connected'
  if (options.writeStatusOnly) return 'read_only'
  return source === 'mempalace' ? 'read_only' : 'needs_owner_setup'
}

function normalizeSource(input: {
  source: string
  state?: string
  summary?: string
  path?: string | null
  count?: number | null
  lastSuccessAt?: number | null
  lastKnownSyncIso?: string | null
  lastAttemptAt?: number | null
  lastError?: string | null
  details?: Record<string, unknown>
  writeStatusOnly?: boolean
}) {
  const present = Boolean(input.state || input.path || input.summary || input.lastSuccessAt || input.lastAttemptAt || input.details)
  const status = classifySource(input.source, input.state, { present, writeStatusOnly: input.writeStatusOnly })
  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: status === 'not_connected' ? 'service_down' : status,
    blockers: [
      present ? null : `${input.source} is not connected to the read-only Brain Sync status layer.`,
      input.lastError,
    ],
    connected: status === 'read_only',
    readEnabled: status === 'read_only',
    writeEnabled: false,
    executionEnabled: false,
    preferReadyWhenReadable: true,
  })
  return {
    source: input.source,
    status,
    raw_state: input.state || (present ? 'available' : 'not_connected'),
    last_known_sync_at: input.lastKnownSyncIso || isoFromSeconds(input.lastSuccessAt),
    last_attempt_at: isoFromSeconds(input.lastAttemptAt),
    missing_connector_warning: present ? null : `${input.source} is not connected to the read-only Brain Sync status layer.`,
    summary: input.summary || (present ? `${input.source} is visible in read-only mode.` : `${input.source} is not connected.`),
    path: input.path ? '<redacted-path>' : null,
    count: input.count ?? null,
    last_error: input.lastError || null,
    details: input.details || {},
    writes_enabled: false,
    owner_status: ownerStatus,
  }
}

function safeObsidianStatus(): AgentZeroObsidianStatus {
  try {
    return getAgentZeroObsidianStatus()
  } catch {
    return {
      ok: false,
      mode: 'agent_zero_obsidian_read_only_adapter',
      status: 'blocked',
      vault_visible: false,
      vault_path_status: 'missing',
      note_count: 0,
      indexed: false,
      last_indexed_at: null,
      available_actions: ['status'],
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: ['obsidian_status_probe_failed'],
    }
  }
}

function safeMemPalaceStatus(): AgentZeroMemPalaceStatus {
  try {
    return getAgentZeroMemPalaceStatus()
  } catch {
    return {
      ok: false,
      mode: 'agent_zero_mempalace_read_only_adapter',
      status: 'blocked',
      mempalace_visible: false,
      graph_db_status: 'missing',
      vector_db_status: 'missing',
      data_dir_status: 'missing',
      config_status: 'missing',
      index_status: 'missing',
      last_seen_at: null,
      counts: {
        entities: null,
        triples: null,
        entity_types: null,
        predicates: null,
        collections: null,
        embeddings: null,
        fulltext_rows: null,
        safe_memory_summaries: null,
      },
      available_actions: ['status'],
      safe_summary_available: false,
      raw_private_dump_enabled: false,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      direct_access: false,
      proxy_access: true,
      blockers: ['mempalace_status_probe_failed'],
    }
  }
}

function safeRunNowStatus() {
  try {
    return readLatestRunNow()
  } catch {
    return { persistence_ready: false, approval: null, run: null }
  }
}

function safeRunNowHistory() {
  try {
    return readRunNowHistory(5)
  } catch {
    return { persistence_ready: false, history: [] }
  }
}

async function buildBrainSyncStatusPayload() {
  const upstreamConfigured = hasClaudeClawDashboardToken()
  const obsidianLocal = safeObsidianStatus()
  const mempalaceLocal = safeMemPalaceStatus()
  const runNow = safeRunNowStatus()
  const runNowHistory = safeRunNowHistory()
  const unavailable = (error: string) => ({
    ok: false,
    status: 503,
    payload: { error },
  })

  const [sync, context, writeContract] = upstreamConfigured
    ? await Promise.all([
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
    : [
        unavailable('claudeclaw_dashboard_token_missing'),
        unavailable('claudeclaw_dashboard_token_missing'),
        unavailable('claudeclaw_dashboard_token_missing'),
      ]

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
  const localVisibleSources = [
    obsidianLocal.ok,
    mempalaceLocal.ok,
    runNow.persistence_ready,
  ].filter(Boolean).length
  const buildWikiVisible = buildWikiSources.length > 0 || runNow.persistence_ready || runNowHistory.persistence_ready

  const sources = [
    normalizeSource({
      source: 'agent_zero_brain',
      state: context.ok ? 'available' : localVisibleSources > 0 ? 'status_only' : 'not_connected',
      summary: context.ok
        ? 'Agent Zero brain context is reading the shared brain layer through Mission Control /api/brain/context.'
        : localVisibleSources > 0
          ? 'Agent Zero Brain context upstream is not configured, but Mission Control local read-only Brain adapters are visible.'
          : 'Agent Zero brain context is not reachable through the shared brain endpoint.',
      count: contextSources.reduce((total, row) => total + (typeof row.count === 'number' ? row.count : 0), 0),
      details: {
        endpoint: '/api/brain/context',
        agent_id: 'agent_zero',
        source_count: contextSources.length,
        agent_consumers: (context.payload as any)?.agent_consumers || [],
        upstream_configured: upstreamConfigured,
        local_visible_sources: localVisibleSources,
      },
      writeStatusOnly: !context.ok && localVisibleSources > 0,
    }),
    normalizeSource({
      source: 'brain_sync',
      state: buildWikiSources.length > 0 ? 'available' : localVisibleSources > 0 ? 'status_only' : 'not_connected',
      summary: buildWikiSources.length > 0
        ? 'Brain Sync read layer is available through Build-Wiki, Obsidian, file handoffs, approval history, task history, and MemPalace status.'
        : localVisibleSources > 0
          ? 'Brain Sync upstream source inventory is gated, but local read-only source status is visible.'
          : 'Brain Sync source inventory is not visible yet.',
      count: buildWikiSources.reduce((total, row) => total + (typeof row.count === 'number' ? row.count : 0), 0),
      details: {
        planned_status: 'read_only_available',
        available_status: context.ok ? 'available' : 'not_connected',
        source_status: contextSources,
        upstream_configured: upstreamConfigured,
        local_visible_sources: localVisibleSources,
      },
      writeStatusOnly: !context.ok && localVisibleSources > 0,
    }),
    normalizeSource({
      source: 'mempalace',
      state: mempalaceContext?.state || mempalaceSync?.state || (mempalaceLocal.ok ? 'available' : 'missing'),
      summary: mempalaceContext?.detail || mempalaceSync?.summary || (mempalaceLocal.ok
        ? 'MemPalace local read-only adapter is visible through Mission Control.'
        : 'MemPalace local read-only adapter is not visible.'),
      path: null,
      count: typeof mempalaceSync?.details?.last_entries === 'number'
        ? mempalaceSync.details.last_entries
        : mempalaceLocal.counts.safe_memory_summaries,
      lastSuccessAt: mempalaceSync?.last_success_at,
      lastKnownSyncIso: mempalaceLocal.last_seen_at,
      lastAttemptAt: mempalaceSync?.last_attempt_at,
      lastError: mempalaceSync?.last_error || (mempalaceLocal.blockers.length > 0 ? mempalaceLocal.blockers.join(',') : null),
      details: {
        ...(mempalaceSync?.details || {}),
        adapter_status: mempalaceLocal.status,
        index_status: mempalaceLocal.index_status,
        counts: mempalaceLocal.counts,
        blockers: mempalaceLocal.blockers,
        raw_private_dump_enabled: false,
      },
      writeStatusOnly: true,
    }),
    normalizeSource({
      source: 'obsidian',
      state: obsidianSync?.state || contextBySource.get('obsidian')?.[0]?.state || (obsidianLocal.ok ? 'available' : 'missing'),
      summary: obsidianSync?.summary || (obsidianLocal.ok
        ? 'Obsidian local read-only adapter is visible through Mission Control.'
        : 'Obsidian vault read status is not visible in this runtime.'),
      path: null,
      count: typeof obsidianSync?.details?.md_files === 'number'
        ? obsidianSync.details.md_files as number
        : contextBySource.get('obsidian')?.[0]?.count ?? obsidianLocal.note_count,
      lastSuccessAt: obsidianSync?.last_success_at,
      lastKnownSyncIso: obsidianLocal.last_indexed_at,
      lastAttemptAt: obsidianSync?.last_attempt_at,
      lastError: obsidianSync?.last_error || (obsidianLocal.blockers.length > 0 ? obsidianLocal.blockers.join(',') : null),
      details: {
        ...(obsidianSync?.details || {}),
        adapter_status: obsidianLocal.status,
        vault_path_status: obsidianLocal.vault_path_status,
        indexed: obsidianLocal.indexed,
        blockers: obsidianLocal.blockers,
        direct_filesystem_exposed: false,
      },
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
    normalizeSource({
      source: 'buildwiki',
      state: buildWikiVisible ? 'status_only' : 'not_connected',
      summary: buildWikiVisible
        ? 'Build-Wiki / Farmer approval and run history is visible read-only through Mission Control.'
        : 'Build-Wiki / Farmer status is not visible yet.',
      count: runNowHistory.history.length,
      lastKnownSyncIso: runNow.approval?.created_at || runNow.run?.finished_at || null,
      details: {
        approval_persistence_ready: runNow.persistence_ready,
        history_count: runNowHistory.history.length,
        latest_approval_state: runNow.approval?.approval_state || null,
        latest_run_state: runNow.run?.run_state || null,
        target_service: 'opencloud-docs-farmer.service',
      },
      writeStatusOnly: true,
    }),
  ]

  const summary = sources.reduce((acc, source) => {
    acc.total += 1
    acc[source.status] = (acc[source.status] || 0) + 1
    return acc
  }, { total: 0 } as Record<string, number>)
  const sourceByName = new Map(sources.map((source) => [source.source, source]))
  const brainSystem = (source: string, name: string, role: string) => {
    const item = sourceByName.get(source)
    const visible = Boolean(item && item.status !== 'not_connected')
    return {
      id: source,
      name,
      role,
      visible,
      live_query_available: visible,
      read_enabled: visible,
      write_available: false,
      write_enabled: false,
      blocked: !visible,
      blocked_reason: visible ? null : item?.missing_connector_warning || `${source} is not connected to the read-only Brain Sync status layer.`,
      read_blocked_reason: visible ? null : item?.missing_connector_warning || `${source} read status is blocked.`,
      write_blocked_reason: 'Agent Zero Bridge Session approval is required before protected Brain writes.',
      owner_status: describeOwnerFacingStatus({
        rawStatus: visible ? 'read_only' : 'service_down',
        blockers: visible ? [] : [item?.missing_connector_warning || `${source} is not connected to the read-only Brain Sync status layer.`],
        connected: visible,
        readEnabled: visible,
        writeEnabled: false,
        executionEnabled: false,
        preferReadyWhenReadable: true,
      }),
    }
  }
  const brainSystems = [
    brainSystem('brain_sync', 'Brain Sync', 'brain coordination layer'),
    brainSystem('obsidian', 'Obsidian', 'knowledge system'),
    brainSystem('mempalace', 'MemPalace', 'memory system'),
    brainSystem('graphify', 'Graphify', 'graph system'),
    {
      id: 'buildwiki',
      name: 'Build-Wiki / Farmer',
      role: 'knowledge sync / farmer system',
      visible: buildWikiVisible,
      live_query_available: buildWikiVisible,
      read_enabled: buildWikiVisible,
      write_available: false,
      write_enabled: false,
      blocked: !buildWikiVisible,
      blocked_reason: buildWikiVisible ? null : 'buildwiki_status_not_visible',
      read_blocked_reason: buildWikiVisible ? null : 'buildwiki_status_not_visible',
      write_blocked_reason: 'Build-Wiki Run Now requires an owner-approved Agent Zero Bridge Session.',
      owner_status: describeOwnerFacingStatus({
        rawStatus: buildWikiVisible ? 'read_only' : 'service_down',
        blockers: buildWikiVisible ? [] : ['buildwiki_status_not_visible'],
        connected: buildWikiVisible,
        readEnabled: buildWikiVisible,
        writeEnabled: false,
        executionEnabled: false,
        preferReadyWhenReadable: true,
      }),
    },
  ]
  const brainBlockerTable = brainSystems
    .flatMap((system) => [system.blocked_reason, system.read_blocked_reason, system.write_blocked_reason]
      .filter((blocker): blocker is string => Boolean(blocker))
      .map((blocker) => ({ system: system.id, blocker })))

  const payload = {
    ok: true,
    mode: 'brain_sync_readonly_status',
    generated_at: new Date().toISOString(),
    upstream: {
      claudeclaw_dashboard_token_configured: upstreamConfigured,
      status: upstreamConfigured ? 'READY' : 'CREDENTIAL_GATED',
      blocker: upstreamConfigured ? null : 'claudeclaw_dashboard_token_missing',
      fallback: upstreamConfigured ? null : 'mission_control_local_readonly_adapters',
    },
    canonical_hierarchy: HERMES_BRAIN_CANONICAL_HIERARCHY,
    hermes_context: {
      role: 'secondary / lieutenant / skill-workflow specialist',
      receives_read_only_brain_context: true,
      execution_enabled: false,
      writes_enabled: false,
      source: 'Mission Control Brain Sync read-only status',
    },
    brain_systems: brainSystems,
    brain_blocker_table: brainBlockerTable,
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
      local_readonly_status_available: localVisibleSources > 0,
      upstream_configured: upstreamConfigured,
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
  }

  return sanitizeBridgeProviderPayload(payload)
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const payload = await buildBrainSyncStatusPayload()
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}
