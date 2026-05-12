import type { ComponentStatus } from './cloudcode-backend-support'
import type { AgentStatusConsistencyReport } from './agent-status-consistency'
import type { AgentHubAgent, AgentHubStatusPayload } from './gateway-agent-hub'
import { blockerClassForStatus, ownerSafeStatusText, type OwnerFacingBlockerClass, type OwnerFacingStatus } from './owner-status'

export type MultiAgentProofPacketEntry = {
  agent_id: AgentHubAgent['id']
  name: string
  role: string
  timestamp: string
  runtime_commit: string
  route_or_service_checked: string
  result: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
  audit_pointer: string
  safe_log_pointer: string
  cloudcode_health_ids: string[]
  cloudcode_statuses: Array<{
    id: string
    status: string
    blocker: string | null
  }>
  rollback_command: string
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type MultiAgentProofPacket = {
  ok: boolean
  mode: 'multi_agent_proof_packet'
  generated_at: string
  runtime_commit: string
  packets_total: number
  consistency_ok: boolean
  consistency_issues: number
  proof_packets: MultiAgentProofPacketEntry[]
  audit_pointer: '/api/gateway/agent-hub/status'
  safe_log_pointer: '/api/gateway/agent-hub/proof-packet'
  rollback_command: string
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

type BuildMultiAgentProofPacketInput = {
  agentHubPayload: AgentHubStatusPayload
  cloudcodeHealth: readonly ComponentStatus[]
  consistencyReport: AgentStatusConsistencyReport
  runtimeCommit?: string | null
  rollbackCommand?: string
}

const DEFAULT_ROLLBACK = 'git revert <day-81-multi-agent-proof-packet-commit>'

function safeCommit(value: string | null | undefined): string {
  const commit = ownerSafeStatusText(value)?.trim()
  return commit && /^[A-Za-z0-9._/-]{3,80}$/.test(commit) ? commit : 'unknown'
}

function safeRoute(value: string | null | undefined, fallback: string): string {
  const route = ownerSafeStatusText(value)?.trim()
  return route && route.startsWith('/api/') ? route : fallback
}

function healthRowsForAgent(agent: AgentHubAgent, cloudcodeHealth: readonly ComponentStatus[]): ComponentStatus[] {
  const expected = new Set(agent.cloudcode_health_ids || [])
  return cloudcodeHealth.filter((row) => expected.has(row.id))
}

function firstBlocker(agent: AgentHubAgent, rows: readonly ComponentStatus[]): string | null {
  return ownerSafeStatusText(
    agent.blocked_reason ||
    agent.blockers[0] ||
    rows.find((row) => row.blocker)?.blocker ||
    agent.owner_status.reason,
  )
}

function buildPacketForAgent(
  agent: AgentHubAgent,
  cloudcodeHealth: readonly ComponentStatus[],
  generatedAt: string,
  runtimeCommit: string,
  rollbackCommand: string,
): MultiAgentProofPacketEntry {
  const rows = healthRowsForAgent(agent, cloudcodeHealth)
  const result = agent.owner_status.status
  const blockerClass = blockerClassForStatus(result)
  const blocker = blockerClass === 'NONE' ? null : firstBlocker(agent, rows)
  const healthRoute = safeRoute(agent.routes.health, `/api/gateway/agent-hub/agents/${agent.id}/health`)
  const auditRoute = safeRoute(agent.routes.audit, `/api/gateway/agent-hub/agents/${agent.id}/audit`)

  return {
    agent_id: agent.id,
    name: agent.name,
    role: agent.role,
    timestamp: generatedAt,
    runtime_commit: runtimeCommit,
    route_or_service_checked: healthRoute,
    result,
    blocker_class: blockerClass,
    blocker,
    audit_pointer: auditRoute,
    safe_log_pointer: healthRoute,
    cloudcode_health_ids: rows.map((row) => row.id),
    cloudcode_statuses: rows.map((row) => ({
      id: row.id,
      status: String(row.status),
      blocker: ownerSafeStatusText(row.blocker),
    })),
    rollback_command: rollbackCommand,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export function buildMultiAgentProofPacket(input: BuildMultiAgentProofPacketInput): MultiAgentProofPacket {
  const runtimeCommit = safeCommit(input.runtimeCommit)
  const rollbackCommand = input.rollbackCommand || DEFAULT_ROLLBACK
  const proofPackets = input.agentHubPayload.agents.map((agent) =>
    buildPacketForAgent(
      agent,
      input.cloudcodeHealth,
      input.agentHubPayload.generated_at,
      runtimeCommit,
      rollbackCommand,
    ),
  )

  const unsafePayload = JSON.stringify(proofPackets)
  const unsafeTextDetected = /\/Users\/|\/home\/|Bearer\s+|sk-[A-Za-z0-9_-]{20,}|API_KEY=|AUTH_PASS=|TOKEN=|SECRET=/i.test(unsafePayload)

  return {
    ok: input.consistencyReport.ok && !unsafeTextDetected,
    mode: 'multi_agent_proof_packet',
    generated_at: input.agentHubPayload.generated_at,
    runtime_commit: runtimeCommit,
    packets_total: proofPackets.length,
    consistency_ok: input.consistencyReport.ok,
    consistency_issues: input.consistencyReport.issues.filter((issue) => issue.severity === 'error').length,
    proof_packets: proofPackets,
    audit_pointer: '/api/gateway/agent-hub/status',
    safe_log_pointer: '/api/gateway/agent-hub/proof-packet',
    rollback_command: rollbackCommand,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}
