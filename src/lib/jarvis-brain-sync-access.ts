import { getAgentZeroMemPalaceStatus } from '@/lib/agent-zero-mempalace-adapter'
import { getAgentZeroObsidianStatus } from '@/lib/agent-zero-obsidian-adapter'
import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import { listJarvisAdapters } from '@/lib/jarvis-adapter-registry'
import { buildJarvisAccessTruth } from '@/lib/jarvis-access-truth'
import { getDatabase } from '@/lib/db'
import { buildCanonicalAgentRosterSummary } from '@/lib/mission-control-agent-roster'

const BRAIN_WRITE_ADAPTER_IDS = new Set([
  'obsidian_write',
  'jarvis_obsidian_structured_project_note',
  'mempalace_write',
  'jarvis_mempalace_categorized_memory_write',
  'mcp_memory_write_probe',
])

const PERSISTENT_MEMORY_AGENT_IDS = new Set(['agent-zero', 'hermes', 'pi', 'paperclip', 'spaceagent'])

type AgentMemoryContract = {
  agent_id: string
  label: string
  classification: 'mission_control_agent' | 'gateway_full_access_agent' | 'supporting_runtime'
  persistent_memory: boolean
  can_read_brain_context: boolean
  can_read_skills: boolean
  can_read_tools: boolean
  direct_memory_write: boolean
  memory_write_policy: 'direct_exact_scope_bridge_adapter' | 'request_through_jarvis_bridge_adapter' | 'supporting_runtime_read_visible_only'
  write_request_route: string | null
  exact_blocker: string | null
}

function safeSkillInventorySummary() {
  try {
    const db = getDatabase()
    const total = (db.prepare('SELECT COUNT(*) AS count FROM skills').get() as { count?: number } | undefined)?.count || 0
    const rows = db
      .prepare('SELECT source, COUNT(*) AS count FROM skills GROUP BY source ORDER BY source LIMIT 50')
      .all() as Array<{ source?: string; count?: number }>
    return {
      visible: true,
      total,
      sources: rows.map((row) => ({ source: String(row.source || 'unknown'), count: Number(row.count || 0) })),
      endpoint: '/api/skills',
      content_returned: false,
      credential_values_exposed: false,
    }
  } catch {
    return {
      visible: false,
      total: 0,
      sources: [],
      endpoint: '/api/skills',
      content_returned: false,
      credential_values_exposed: false,
      exact_blocker: 'skills_database_unavailable',
    }
  }
}

function adapterExecutable(id: string) {
  return listJarvisAdapters().some((adapter) => adapter.id === id && adapter.execution_enabled === true && adapter.status === 'executable')
}

function brainWriteAdapterIds() {
  return listJarvisAdapters()
    .filter((adapter) => BRAIN_WRITE_ADAPTER_IDS.has(adapter.id) && adapter.execution_enabled === true && adapter.status === 'executable')
    .map((adapter) => adapter.id)
    .sort()
}

function compactBrainEntry(entry: ReturnType<typeof buildExecutionReadinessMatrix>['entries'][number]) {
  return {
    id: entry.id,
    label: entry.label,
    endpoint: entry.endpoint,
    read_allowed: entry.read_allowed,
    write_allowed: entry.write_allowed,
    execution_allowed: entry.execution_allowed,
    bridge_required: entry.bridge_required,
    adapter_present: entry.adapter_present,
    health: entry.health,
    exact_blocker: entry.exact_blocker,
    credential_policy: entry.credential_policy,
  }
}

function buildAgentMemoryContracts(): AgentMemoryContract[] {
  const roster = buildCanonicalAgentRosterSummary()
  const missionAgents = Array.isArray(roster.mission_control_agents) ? roster.mission_control_agents : []
  const agentIdsByLabel = new Map<string, string>([
    ['Agent Zero (Jarvis)', 'agent-zero'],
    ['Pi', 'pi'],
    ['Ron Weasley', 'hermes'],
    ['Paperclip', 'paperclip'],
    ['SpaceAgent', 'spaceagent'],
  ])

  const contracts: AgentMemoryContract[] = missionAgents.map((label) => {
    const id = agentIdsByLabel.get(label) || label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const isJarvis = id === 'agent-zero'
    const isPi = id === 'pi'
    return {
      agent_id: id,
      label,
      classification: isPi ? 'gateway_full_access_agent' : 'mission_control_agent',
      persistent_memory: PERSISTENT_MEMORY_AGENT_IDS.has(id),
      can_read_brain_context: true,
      can_read_skills: true,
      can_read_tools: true,
      direct_memory_write: isJarvis,
      memory_write_policy: isJarvis ? 'direct_exact_scope_bridge_adapter' : 'request_through_jarvis_bridge_adapter',
      write_request_route: isJarvis ? '/api/bridge/agent-zero/execute' : '/api/bridge/agent-zero/execute',
      exact_blocker: isJarvis ? null : 'non_jarvis_agents_request_memory_writes_through_jarvis_bridge_session',
    }
  })

  for (const runtime of Array.isArray(roster.supporting_runtime_systems) ? roster.supporting_runtime_systems : []) {
    contracts.push({
      agent_id: runtime.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: runtime,
      classification: 'supporting_runtime',
      persistent_memory: false,
      can_read_brain_context: true,
      can_read_skills: true,
      can_read_tools: true,
      direct_memory_write: false,
      memory_write_policy: 'supporting_runtime_read_visible_only',
      write_request_route: null,
      exact_blocker: 'supporting_runtime_not_agent_zero',
    })
  }

  return contracts
}

export function buildJarvisBrainSyncAccess() {
  const accessTruth = buildJarvisAccessTruth()
  const matrix = buildExecutionReadinessMatrix()
  const obsidian = getAgentZeroObsidianStatus()
  const mempalace = getAgentZeroMemPalaceStatus()
  const skills = safeSkillInventorySummary()
  const executableBrainAdapters = brainWriteAdapterIds()
  const brainEntries = matrix.entries
    .filter((entry) => entry.category === 'brain' || /brain|obsidian|mempalace|memory/i.test(`${entry.id} ${entry.label}`))
    .map(compactBrainEntry)

  const canWriteMemory = adapterExecutable('obsidian_write') && adapterExecutable('mempalace_write')
  const contracts = buildAgentMemoryContracts()

  return {
    route: 'bridge.agent-zero.brain-sync-access',
    generated_at: new Date().toISOString(),
    mode: 'canonical_jarvis_brain_tools_memory_sync_packet',
    source_routes: {
      brain_context: '/api/bridge/brain-context',
      brain_sync_status: '/api/bridge/brain-sync/status',
      brain_bridge_gateway_status: '/api/bridge/brain-sync/gateway-status',
      brain_bridge_memory_write_request: '/api/bridge/brain-sync/memory/write-request',
      brain_bridge_memory_write_approve: '/api/bridge/brain-sync/memory/write-approve',
      brain_bridge_memory_write_execute: '/api/bridge/brain-sync/memory/write-execute',
      obsidian: '/api/bridge/agent-zero/obsidian',
      mempalace: '/api/bridge/agent-zero/mempalace',
      skills: '/api/skills',
      tools_and_capabilities: '/api/bridge/capability-matrix',
      execute: '/api/bridge/agent-zero/execute',
      agent_roster: '/api/bridge/agent-zero/agent-roster',
    },
    agent_zero_jarvis: {
      agent_id: 'agent-zero',
      label: 'Agent Zero (Jarvis)',
      brain_runtime: 'separate_agent_zero_runtime',
      can_read_memory: true,
      can_read_skills: true,
      can_read_tools: true,
      can_sync_context: true,
      can_write_memory: canWriteMemory,
      memory_write_mode: canWriteMemory ? 'exact_scope_bridge_adapter' : 'blocked_until_brain_write_adapters_ready',
      bridge_session_active: accessTruth.bridge_session_active,
      exact_scope_execution_enabled: accessTruth.exact_scope_execution_enabled,
      unrestricted_external_execution: false,
      certified_brain_write_adapters: executableBrainAdapters,
      write_request_route: '/api/bridge/agent-zero/execute',
      exact_blocker: canWriteMemory ? null : 'brain_write_adapter_not_ready',
    },
    memory_systems: {
      obsidian: {
        visible: obsidian.ok,
        status: obsidian.status,
        read_enabled: obsidian.ok,
        write_enabled: adapterExecutable('obsidian_write'),
        structured_write_enabled: adapterExecutable('jarvis_obsidian_structured_project_note'),
        note_count: obsidian.note_count,
        direct_filesystem_exposed: false,
        blockers: obsidian.blockers,
      },
      mempalace: {
        visible: mempalace.ok,
        status: mempalace.status,
        read_enabled: mempalace.ok,
        write_enabled: adapterExecutable('mempalace_write'),
        categorized_write_enabled: adapterExecutable('jarvis_mempalace_categorized_memory_write'),
        safe_summary_available: mempalace.safe_summary_available,
        raw_private_dump_enabled: false,
        counts: mempalace.counts,
        blockers: mempalace.blockers,
      },
    },
    skills_inventory: skills,
    tools_inventory: {
      visible: true,
      endpoint: '/api/bridge/capability-matrix',
      total: matrix.summary.total,
      read_allowed: matrix.summary.read_allowed,
      write_allowed: matrix.summary.write_allowed,
      execution_allowed: matrix.summary.execution_allowed,
      bridge_required: matrix.summary.bridge_required,
      brain_related_entries: brainEntries,
      credential_values_exposed: false,
    },
    agent_memory_contracts: contracts,
    synchronization_policy: {
      source_of_truth: 'Mission Control brain-sync access packet plus exact-scope Jarvis execution adapters',
      persistent_memory_agents: contracts.filter((agent) => agent.persistent_memory).map((agent) => agent.agent_id),
      temporary_profile_note: 'Developer, Researcher, Hacker, Agent Zero profile, and Default profile are local Agent Zero delegation profiles, not Mission Control agents.',
      non_jarvis_write_flow: 'Agents read shared brain context directly where exposed, then request memory writes through Jarvis exact-scope Bridge adapters with audit and rollback.',
      no_raw_memory_dump: true,
      no_secret_values: true,
    },
    openclaw_boundary: {
      classification: 'supporting_gateway_runtime_not_agent_zero',
      statement: 'OpenClaw/OpenClaw+ can host shared Gateway skills/runtime surfaces, but Agent Zero/Jarvis remains the separate commander and brain identity.',
    },
    current_truth: accessTruth.correct_self_report,
    credential_values_exposed: false,
    no_secret_values_returned: true,
  }
}

export function buildJarvisBrainSyncAccessSummary() {
  const packet = buildJarvisBrainSyncAccess()
  return {
    endpoint: '/api/bridge/agent-zero/brain-sync-access',
    can_read_memory: packet.agent_zero_jarvis.can_read_memory,
    can_read_skills: packet.agent_zero_jarvis.can_read_skills,
    can_read_tools: packet.agent_zero_jarvis.can_read_tools,
    can_write_memory: packet.agent_zero_jarvis.can_write_memory,
    memory_write_mode: packet.agent_zero_jarvis.memory_write_mode,
    certified_brain_write_adapters: packet.agent_zero_jarvis.certified_brain_write_adapters,
    persistent_memory_agents: packet.synchronization_policy.persistent_memory_agents,
    openclaw_boundary: packet.openclaw_boundary.classification,
    credential_values_exposed: false,
  }
}
