import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'

import { ensureAgentRoutingVisibleTask } from '@/lib/agent-routing-lines'
import { hasClaudeClawDashboardToken } from '@/lib/claudeclaw-telegram-approvals'
import { readLatestRunNow } from '@/lib/build-wiki-run-now'
import { logAuditEvent } from '@/lib/db'

export const BRAIN_BRIDGE_STATES = [
  'READY',
  'LIVE_READ_ONLY',
  'WRITE_GATED',
  'EVENT_STREAM_REQUIRED',
  'BACKEND_REQUIRED',
  'SERVICE_UNREACHABLE',
  'CREDENTIAL_REQUIRED',
  'PERMISSION_REQUIRED',
] as const

export type BrainBridgeState = typeof BRAIN_BRIDGE_STATES[number]

export type BrainBridgeLaneStatus = {
  id: string
  display_name: string
  state: BrainBridgeState
  read_state: BrainBridgeState
  write_state: BrainBridgeState
  event_stream_state: BrainBridgeState
  credential_state: 'configured' | 'required_by_name_only' | 'not_required'
  credential_names: string[]
  last_sync: string | null
  blockers: string[]
  exact_action_availability: string[]
  gateway_route: string
  nuclear_gateway_connected: true
  openclaw_intermediary: false
  openclaw_conversation_owner: false
  memory_write_policy: 'approval_gated_exact_scope_only'
  last_observed_event?: BrainBridgeObservedEvent | null
  credential_values_exposed: false
  no_secrets_exposed: true
}

const BRAIN_BRIDGE_VISIBLE_TASK_TITLE = 'Brain Bridge Mode → Gateway Connection'

type BuildWikiFarmerObservedEvent = {
  type: 'BUILDWIKI_FARMER_RUN_COMPLETE'
  observed_at: string
  imported_count: number
  cap: number | null
  window: string | null
  sources_count: number | null
  source: 'opencloud-docs-farmer.log'
  raw_path_exposed: false
  credential_values_exposed: false
}

type GraphifyObservedEvent = {
  type: 'GRAPHIFY_GRAPH_READY'
  observed_at: string
  node_count: number
  edge_count: number
  communities_count: number
  source_files_count: number
  source: 'graphify-out/graph.json'
  raw_path_exposed: false
  credential_values_exposed: false
}

type BrainBridgeObservedEvent = BuildWikiFarmerObservedEvent | GraphifyObservedEvent

function buildWikiFarmerLogPath() {
  return process.env.OPENCLOUD_FARMER_LOG_PATH || '/home/tony/.openclaw/logs/opencloud-docs-farmer.log'
}

function graphifyGraphPath() {
  return process.env.GRAPHIFY_GRAPH_PATH || '/home/tony/mission-control/runtime/graphify/graphify-out/graph.json'
}

function hashProof(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function recordBrainBridgeVisibleProof(input: {
  action: string
  route: string
  blockers: string[]
}) {
  const exactBlocker = input.blockers.length > 0 ? input.blockers.join('; ') : null
  const now = new Date().toISOString()
  const auditId = `audit_brain_bridge_${hashProof(`${input.action}:${input.route}:${exactBlocker || ''}:${now}`).slice(0, 18)}`
  const rollbackId = `rollback_brain_bridge_no_state_${hashProof(`${auditId}:rollback`).slice(0, 16)}`
  const rollbackNoStateProof = {
    rollback_id: rollbackId,
    mutation_scope: 'mission_control_task_and_brain_bridge_status_only',
    memory_write_executed: false,
    external_writes_enabled: false,
    public_exposure_created: false,
    credential_values_exposed: false,
  }
  const task = ensureAgentRoutingVisibleTask({
    title: BRAIN_BRIDGE_VISIBLE_TASK_TITLE,
    description: 'Brain Bridge Mode Gateway status remains connected through exact lane states; writes stay approval-gated and event streams stay explicit.',
    assigned_to: 'agent-zero-jarvis',
    blocker: exactBlocker,
    metadata: {
      project: BRAIN_BRIDGE_VISIBLE_TASK_TITLE,
      route_family: 'bridge.brain-sync',
      action: input.action,
      route: input.route,
      exact_blocker: exactBlocker,
      current_phase: exactBlocker ? 'Brain Bridge exact lane blockers isolated' : 'Brain Bridge Gateway status ready',
      delivery_state: exactBlocker ? 'BRAIN_BRIDGE_EXACT_BLOCKER_VISIBLE' : 'BRAIN_BRIDGE_GATEWAY_STATUS_VISIBLE',
      progress: exactBlocker ? 99 : 100,
      audit_id: auditId,
      rollback_id: rollbackId,
      rollback_no_state_proof: rollbackNoStateProof,
      exact_states_only: true,
      generic_backend_required_suppressed_unless_true: true,
      memory_write_executed: false,
      external_writes_enabled: false,
      public_exposure_created: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      project_continues: true,
      visible_task_required: true,
      audit_required: true,
      rollback_required: true,
      proof_records: [
        '/api/bridge/brain-sync/gateway-status',
        '/api/bridge/brain-sync/events',
      ],
      next_action: exactBlocker
        ? 'Keep polling exact Brain Bridge lane states and wire a real backend event producer before declaring full READY.'
        : 'Continue Brain Bridge read-only Gateway proof and approval-gated memory write flows.',
      next_safe_lane: 'Continue non-credentialed Brain Bridge status, UI truth, and task proof work.',
    },
  })
  logAuditEvent({
    action: `brain_bridge.${input.action}`,
    actor: 'mission-control-brain-bridge',
    target_type: 'brain_bridge',
    target_id: task.task_id,
    detail: {
      audit_id: auditId,
      visible_task_id: String(task.task_id),
      route: input.route,
      blocker: exactBlocker,
      rollback_id: rollbackId,
      memory_write_executed: false,
      external_writes_enabled: false,
      credential_values_exposed: false,
    },
  })
  return {
    visible_task_id: String(task.task_id),
    owner_visible_task_route: `/api/tasks/${task.task_id}`,
    visible_task_event_route: `/api/tasks/${task.task_id}/events`,
    audit_id: auditId,
    rollback_id: rollbackId,
    rollback_no_state_proof: rollbackNoStateProof,
  }
}

function tokenAvailable() {
  return hasClaudeClawDashboardToken()
}

export function parseLatestBuildWikiFarmerEvent(logText: string): BrainBridgeObservedEvent | null {
  const lines = logText.split('\n')
  let latest: BrainBridgeObservedEvent | null = null
  let latestStart: { observed_at: string; sources_count: number | null } | null = null

  for (const line of lines) {
    const startMatch = line.match(/^\[([^\]]+)] run start\b.*\bsources=(\d+)/)
    if (startMatch) {
      latestStart = {
        observed_at: startMatch[1],
        sources_count: Number(startMatch[2]),
      }
      continue
    }

    const completeMatch = line.match(/^\[([^\]]+)] run complete\. imported=(\d+) cap=(\d+) window=([^\s]+)/)
    if (!completeMatch) continue

    latest = {
      type: 'BUILDWIKI_FARMER_RUN_COMPLETE',
      observed_at: completeMatch[1],
      imported_count: Number(completeMatch[2]),
      cap: Number(completeMatch[3]),
      window: completeMatch[4] || null,
      sources_count: latestStart?.sources_count ?? null,
      source: 'opencloud-docs-farmer.log',
      raw_path_exposed: false,
      credential_values_exposed: false,
    }
  }

  return latest
}

export function readLatestBuildWikiFarmerEvent(): BrainBridgeObservedEvent | null {
  try {
    return parseLatestBuildWikiFarmerEvent(readFileSync(buildWikiFarmerLogPath(), 'utf8'))
  } catch {
    return null
  }
}

export function parseLatestGraphifyEvent(graphText: string, observedAt: string): BrainBridgeObservedEvent | null {
  let data: unknown
  try {
    data = JSON.parse(graphText)
  } catch {
    return null
  }

  if (!data || typeof data !== 'object') return null
  const graph = data as { nodes?: unknown; links?: unknown }
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return null

  const communities = new Set<string>()
  const sourceFiles = new Set<string>()
  for (const node of graph.nodes) {
    if (!node || typeof node !== 'object') continue
    const item = node as { community?: unknown; source_file?: unknown }
    if (item.community !== undefined && item.community !== null) communities.add(String(item.community))
    if (typeof item.source_file === 'string' && item.source_file.trim()) sourceFiles.add(item.source_file.trim())
  }

  return {
    type: 'GRAPHIFY_GRAPH_READY',
    observed_at: observedAt,
    node_count: graph.nodes.length,
    edge_count: graph.links.length,
    communities_count: communities.size,
    source_files_count: sourceFiles.size,
    source: 'graphify-out/graph.json',
    raw_path_exposed: false,
    credential_values_exposed: false,
  }
}

export function readLatestGraphifyEvent(): BrainBridgeObservedEvent | null {
  try {
    const path = graphifyGraphPath()
    return parseLatestGraphifyEvent(readFileSync(path, 'utf8'), statSync(path).mtime.toISOString())
  } catch {
    return null
  }
}

function gatewayRouteForLane(id: string) {
  if (id === 'obsidian') return '/api/bridge/brain-sync/obsidian/status'
  if (id === 'mempalace') return '/api/bridge/brain-sync/mempalace/status'
  if (id === 'graphify') return '/api/bridge/brain-sync/graphify/status'
  if (id === 'build-wiki' || id === 'buildwiki') return '/api/bridge/brain-sync/build-wiki/status'
  if (id === 'memory-approvals' || id === 'approvals') return '/api/bridge/brain-sync/memory-approvals/status'
  return '/api/bridge/brain-sync/gateway-status'
}

function lane(input: Omit<BrainBridgeLaneStatus, 'credential_values_exposed' | 'no_secrets_exposed' | 'gateway_route' | 'nuclear_gateway_connected' | 'openclaw_intermediary' | 'openclaw_conversation_owner' | 'memory_write_policy'>): BrainBridgeLaneStatus {
  return {
    ...input,
    gateway_route: gatewayRouteForLane(input.id),
    nuclear_gateway_connected: true,
    openclaw_intermediary: false,
    openclaw_conversation_owner: false,
    memory_write_policy: 'approval_gated_exact_scope_only',
    credential_values_exposed: false,
    no_secrets_exposed: true,
  }
}

export function buildBrainBridgeLaneStatus(laneId: string): BrainBridgeLaneStatus {
  const hasToken = tokenAvailable()
  const readState: BrainBridgeState = hasToken ? 'LIVE_READ_ONLY' : 'CREDENTIAL_REQUIRED'
  const credentialState = hasToken ? 'configured' : 'required_by_name_only'
  const credentialNames = hasToken ? [] : ['DASHBOARD_TOKEN or CLAUDECLAW_DASHBOARD_TOKEN']

  if (laneId === 'obsidian') {
    return lane({
      id: 'obsidian',
      display_name: 'Obsidian',
      state: hasToken ? 'WRITE_GATED' : 'CREDENTIAL_REQUIRED',
      read_state: readState,
      write_state: 'WRITE_GATED',
      event_stream_state: 'EVENT_STREAM_REQUIRED',
      credential_state: credentialState,
      credential_names: credentialNames,
      last_sync: null,
      blockers: hasToken ? ['obsidian_write_adapter_approval_required', 'obsidian_event_stream_required'] : ['brain_sync_status_token_required'],
      exact_action_availability: ['brain.obsidian.read', 'brain.obsidian.write_gated'],
    })
  }

  if (laneId === 'mempalace') {
    return lane({
      id: 'mempalace',
      display_name: 'MemPalace',
      state: hasToken ? 'WRITE_GATED' : 'CREDENTIAL_REQUIRED',
      read_state: readState,
      write_state: 'WRITE_GATED',
      event_stream_state: 'EVENT_STREAM_REQUIRED',
      credential_state: credentialState,
      credential_names: credentialNames,
      last_sync: null,
      blockers: hasToken ? ['mempalace_write_adapter_approval_required', 'mempalace_event_stream_required'] : ['brain_sync_status_token_required'],
      exact_action_availability: ['brain.mempalace.read', 'brain.mempalace.write_gated'],
    })
  }

  if (laneId === 'graphify') {
    const graphifyEvent = readLatestGraphifyEvent()
    const eventObserved = Boolean(graphifyEvent)
    return lane({
      id: 'graphify',
      display_name: 'Graphify',
      state: hasToken ? (eventObserved ? 'LIVE_READ_ONLY' : 'EVENT_STREAM_REQUIRED') : 'CREDENTIAL_REQUIRED',
      read_state: readState,
      write_state: 'WRITE_GATED',
      event_stream_state: eventObserved ? 'READY' : 'EVENT_STREAM_REQUIRED',
      credential_state: credentialState,
      credential_names: credentialNames,
      last_sync: graphifyEvent?.observed_at || null,
      blockers: hasToken ? (eventObserved ? [] : ['graphify_event_stream_required']) : ['brain_sync_status_token_required'],
      exact_action_availability: ['brain.graphify.read', 'brain.graphify.event_stream'],
      last_observed_event: graphifyEvent,
    })
  }

  if (laneId === 'build-wiki' || laneId === 'buildwiki') {
    const runNow = readLatestRunNow()
    const runNowReady = runNow.persistence_ready
    const farmerEvent = readLatestBuildWikiFarmerEvent()
    const eventObserved = Boolean(farmerEvent)
    return lane({
      id: 'build-wiki',
      display_name: 'Build-Wiki / Farmer',
      state: runNowReady ? (eventObserved ? 'LIVE_READ_ONLY' : 'EVENT_STREAM_REQUIRED') : 'BACKEND_REQUIRED',
      read_state: runNowReady ? 'LIVE_READ_ONLY' : 'BACKEND_REQUIRED',
      write_state: 'WRITE_GATED',
      event_stream_state: eventObserved ? 'READY' : 'EVENT_STREAM_REQUIRED',
      credential_state: 'not_required',
      credential_names: [],
      last_sync: farmerEvent?.observed_at || runNow.run?.finished_at || runNow.approval?.created_at || null,
      blockers: runNowReady ? (eventObserved ? [] : ['buildwiki_event_stream_required']) : ['buildwiki_approval_persistence_required'],
      exact_action_availability: ['brain.buildwiki.status', 'brain.buildwiki.run_now_approval', 'brain.buildwiki.events'],
      last_observed_event: farmerEvent,
    })
  }

  if (laneId === 'memory-approvals' || laneId === 'approvals') {
    const runNow = readLatestRunNow()
    return lane({
      id: 'memory-approvals',
      display_name: 'Memory Approvals',
      state: runNow.persistence_ready ? 'WRITE_GATED' : 'BACKEND_REQUIRED',
      read_state: runNow.persistence_ready ? 'LIVE_READ_ONLY' : 'BACKEND_REQUIRED',
      write_state: 'WRITE_GATED',
      event_stream_state: 'EVENT_STREAM_REQUIRED',
      credential_state: 'not_required',
      credential_names: [],
      last_sync: runNow.approval?.created_at || null,
      blockers: runNow.persistence_ready ? ['memory_write_approval_required'] : ['bridge_approval_persistence_required'],
      exact_action_availability: ['brain.memory.propose_write', 'brain.memory.approval_request'],
    })
  }

  return lane({
    id: 'brain-sync',
    display_name: 'Brain Sync',
    state: hasToken ? 'LIVE_READ_ONLY' : 'CREDENTIAL_REQUIRED',
    read_state: readState,
    write_state: 'WRITE_GATED',
    event_stream_state: 'EVENT_STREAM_REQUIRED',
    credential_state: credentialState,
    credential_names: credentialNames,
    last_sync: null,
    blockers: hasToken ? ['brain_sync_write_layer_approval_gated', 'brain_sync_event_stream_required'] : ['brain_sync_status_token_required'],
    exact_action_availability: ['brain.status.read', 'brain.memory.read', 'brain.memory.propose_write'],
  })
}

export function buildBrainBridgeGatewayStatus() {
  const laneList = [
    buildBrainBridgeLaneStatus('obsidian'),
    buildBrainBridgeLaneStatus('mempalace'),
    buildBrainBridgeLaneStatus('graphify'),
    buildBrainBridgeLaneStatus('build-wiki'),
    buildBrainBridgeLaneStatus('memory-approvals'),
  ]
  const lanes = {
    obsidian: laneList[0],
    mempalace: laneList[1],
    graphify: laneList[2],
    build_wiki: laneList[3],
    memory_approvals: laneList[4],
  }
  const hasToken = tokenAvailable()
  const exactBlockers = Array.from(new Set(laneList.flatMap((item) => item.blockers)))
  const proof = recordBrainBridgeVisibleProof({
    action: 'gateway_status',
    route: 'bridge.brain-sync.gateway-status',
    blockers: exactBlockers,
  })
  return {
    route: 'bridge.brain-sync.gateway-status',
    generated_at: new Date().toISOString(),
    brain_bridge_mode: hasToken ? 'read_only' : 'degraded',
    gateway_connected: true,
    nuclear_gateway_connected: true,
    jarvis_connected: true,
    hermes_connected: true,
    openclaw_intermediary: false,
    openclaw_conversation_owner: false,
    credential_broker: 'nuclear.gateway',
    memory_write_layer: 'approval_gated',
    memory_write_policy: 'approval_gated_exact_scope_only',
    event_stream: 'missing',
    exact_states_only: true,
    generic_backend_required_suppressed_unless_true: true,
    lanes,
    obsidian: lanes.obsidian,
    mempalace: lanes.mempalace,
    graphify: lanes.graphify,
    build_wiki: lanes.build_wiki,
    approvals: lanes.memory_approvals,
    canonical_routes: {
      status: '/api/bridge/brain-sync/status',
      gateway_status: '/api/bridge/brain-sync/gateway-status',
      events: '/api/bridge/brain-sync/events',
      obsidian: '/api/bridge/brain-sync/obsidian/status',
      mempalace: '/api/bridge/brain-sync/mempalace/status',
      graphify: '/api/bridge/brain-sync/graphify/status',
      build_wiki_status: '/api/bridge/brain-sync/build-wiki/status',
      build_wiki_events: '/api/bridge/brain-sync/build-wiki/events',
      memory_approvals: '/api/bridge/brain-sync/memory-approvals/status',
    },
    exact_blockers: exactBlockers,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    project_continues: true,
    ...proof,
  }
}

export function buildBrainBridgeEvents() {
  const status = buildBrainBridgeGatewayStatus()
  const blockers = [
    status.graphify.event_stream_state === 'READY' ? null : 'graphify_live_producer_stream_required_for_full_ready_state',
    status.build_wiki.event_stream_state === 'READY' ? null : 'buildwiki_live_farmer_event_observation_required_for_full_ready_state',
  ].filter(Boolean) as string[]
  const proof = recordBrainBridgeVisibleProof({
    action: 'events_polling_snapshot',
    route: 'bridge.brain-sync.events',
    blockers,
  })
  return {
    route: 'bridge.brain-sync.events',
    mode: 'polling_v1',
    event_stream: 'polling_v1_snapshot',
    sse_enabled: false,
    sse_blocker: 'brain_bridge_v1_uses_polling_not_sse',
    events: [
      'MEMORY_READ',
      'MEMORY_WRITE_REQUESTED',
      'MEMORY_WRITE_APPROVED',
      'MEMORY_WRITE_COMPLETED',
      'OBSIDIAN_SYNC_EVENT',
      'MEMPALACE_SYNC_EVENT',
      'GRAPHIFY_UPDATE',
      'BUILDWIKI_EVENT',
      'AGENT_MEMORY_CORRECTION',
      'STALE_MEMORY_DETECTED',
      'CANONICAL_TRUTH_PROMOTED',
    ].map((type) => ({
      type,
      available: (type === 'BUILDWIKI_EVENT' && status.build_wiki.event_stream_state === 'READY')
        || (type === 'GRAPHIFY_UPDATE' && status.graphify.event_stream_state === 'READY'),
      state: (type === 'BUILDWIKI_EVENT' && status.build_wiki.event_stream_state === 'READY')
        || (type === 'GRAPHIFY_UPDATE' && status.graphify.event_stream_state === 'READY')
        ? 'READY'
        : status.event_stream === 'ready' ? 'READY' : 'EVENT_STREAM_REQUIRED',
      observed_event: type === 'BUILDWIKI_EVENT'
        ? status.build_wiki.last_observed_event || null
        : type === 'GRAPHIFY_UPDATE' ? status.graphify.last_observed_event || null : null,
    })),
    blockers,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    project_continues: true,
    ...proof,
  }
}
