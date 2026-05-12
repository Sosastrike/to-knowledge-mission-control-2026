import { OWNER_FACING_STATUS_STATES, type OwnerFacingStatus } from './owner-status'
import type { ComponentStatus } from './cloudcode-backend-support'
import { agentHubIdToCloudCodeIds } from './gateway-cloudcode-integration'
import type { AgentHubAgent, AgentHubStatusPayload } from './gateway-agent-hub'

export type AgentStatusConsistencyIssue = {
  agent_id: string
  source: 'canonical_registry' | 'agent_hub' | 'cloudcode_agent_health'
  severity: 'error' | 'warning'
  reason: string
  expected: string | null
  actual: string | null
}

export type AgentStatusConsistencyReport = {
  ok: boolean
  mode: 'multi_agent_status_consistency'
  generated_at: string
  checked_agents: number
  canonical_agent_ids: string[]
  agent_hub_agent_ids: string[]
  cloudcode_health_ids: string[]
  issues: AgentStatusConsistencyIssue[]
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

const ACTIVE_STATUSES = new Set<OwnerFacingStatus>(['LIVE', 'READY'])
const GATED_OR_BLOCKED_STATUSES = new Set<OwnerFacingStatus>([
  'OWNER_GATED',
  'CREDENTIAL_GATED',
  'SERVICE_DOWN',
  'BLOCKED',
  'DISABLED',
])
const ACTIVE_CLOUDCODE_STATUSES = new Set(['LIVE', 'READY', 'READ_ONLY'])
const BLOCKER_RE = /(credential|token|api[_-]?key|oauth|not[_-]?installed|not[_-]?reachable|runtime|service|blocked|missing|owner|approval|bridge|unavailable)/i
const PARTIAL_INTERFACE_PROOF_BLOCKER_RE = /(credential|service|runtime|mcp|playwright|firecrawl|youtube|not[_-]?installed|degraded|pending)/i

function issue(input: AgentStatusConsistencyIssue): AgentStatusConsistencyIssue {
  return input
}

function countById(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return counts
}

function ownerStatus(agent: AgentHubAgent): OwnerFacingStatus | null {
  const status = agent.owner_status?.status
  return OWNER_FACING_STATUS_STATES.includes(status as OwnerFacingStatus) ? status as OwnerFacingStatus : null
}

function hasRuntimeBlocker(agent: AgentHubAgent): boolean {
  return Boolean(agent.blocked_reason || agent.blockers.some((blocker) => BLOCKER_RE.test(blocker)))
}

function validateAgentHubRow(agent: AgentHubAgent): AgentStatusConsistencyIssue[] {
  const issues: AgentStatusConsistencyIssue[] = []
  const status = ownerStatus(agent)

  if (!status) {
    issues.push(issue({
      agent_id: agent.id,
      source: 'agent_hub',
      severity: 'error',
      reason: 'owner_status_not_in_canonical_taxonomy',
      expected: OWNER_FACING_STATUS_STATES.join(','),
      actual: String(agent.owner_status?.status || null),
    }))
    return issues
  }

  if (ACTIVE_STATUSES.has(status) && hasRuntimeBlocker(agent)) {
    issues.push(issue({
      agent_id: agent.id,
      source: 'agent_hub',
      severity: 'error',
      reason: 'active_owner_status_has_runtime_blocker',
      expected: 'no blocker when owner status is LIVE or READY',
      actual: agent.blocked_reason || agent.blockers[0] || null,
    }))
  }

  if (agent.status === 'blocked' && ACTIVE_STATUSES.has(status)) {
    issues.push(issue({
      agent_id: agent.id,
      source: 'agent_hub',
      severity: 'error',
      reason: 'blocked_agent_hub_row_has_active_owner_status',
      expected: 'OWNER_GATED, CREDENTIAL_GATED, SERVICE_DOWN, BLOCKED, or DISABLED',
      actual: status,
    }))
  }

  if (
    agent.live_interface_proven &&
    GATED_OR_BLOCKED_STATUSES.has(status) &&
    !agent.blockers.some((blocker) => PARTIAL_INTERFACE_PROOF_BLOCKER_RE.test(blocker))
  ) {
    issues.push(issue({
      agent_id: agent.id,
      source: 'agent_hub',
      severity: 'error',
      reason: 'live_interface_proof_conflicts_with_blocked_owner_status',
      expected: 'LIVE or READY',
      actual: status,
    }))
  }

  if ((agent.write_enabled || agent.execution_enabled) && status !== 'LIVE') {
    issues.push(issue({
      agent_id: agent.id,
      source: 'agent_hub',
      severity: 'error',
      reason: 'write_or_execution_enabled_without_live_status',
      expected: 'LIVE',
      actual: status,
    }))
  }

  return issues
}

function validateCloudCodeRows(agent: AgentHubAgent, rows: ComponentStatus[]): AgentStatusConsistencyIssue[] {
  const issues: AgentStatusConsistencyIssue[] = []
  const expectedIds = agentHubIdToCloudCodeIds(agent.id)
  const rowIds = rows.map((row) => row.id)
  const status = ownerStatus(agent)

  for (const expectedId of expectedIds) {
    if (!rowIds.includes(expectedId)) {
      issues.push(issue({
        agent_id: agent.id,
        source: 'cloudcode_agent_health',
        severity: 'error',
        reason: 'missing_cloudcode_health_row',
        expected: expectedId,
        actual: rowIds.join(',') || null,
      }))
    }
  }

  for (const row of rows) {
    if (row.status === 'LIVE') {
      issues.push(issue({
        agent_id: agent.id,
        source: 'cloudcode_agent_health',
        severity: 'error',
        reason: 'cloudcode_health_claims_live_while_gateway_execution_is_disabled',
        expected: 'READ_ONLY, OWNER_GATED, CREDENTIAL_GATED, SERVICE_DOWN, BLOCKED, DISABLED, or UNKNOWN',
        actual: row.status,
      }))
    }
  }

  if (status && ACTIVE_STATUSES.has(status) && rows.some((row) => row.blocker)) {
    issues.push(issue({
      agent_id: agent.id,
      source: 'cloudcode_agent_health',
      severity: 'error',
      reason: 'active_agent_has_cloudcode_blocker',
      expected: 'no CloudCode health blockers',
      actual: rows.map((row) => row.blocker).filter(Boolean).join(',') || null,
    }))
  }

  if (status && GATED_OR_BLOCKED_STATUSES.has(status) && rows.length > 0) {
    const hasBlockingRow = rows.some((row) => !ACTIVE_CLOUDCODE_STATUSES.has(row.status) || Boolean(row.blocker))
    if (!hasBlockingRow) {
      issues.push(issue({
        agent_id: agent.id,
        source: 'cloudcode_agent_health',
        severity: 'error',
        reason: 'blocked_or_gated_agent_has_only_active_cloudcode_rows',
        expected: 'at least one gated, blocked, service-down, unknown, or blocker row',
        actual: rows.map((row) => row.status).join(',') || null,
      }))
    }
  }

  return issues
}

export function buildAgentStatusConsistencyReport(
  agentHubPayload: AgentHubStatusPayload,
  cloudcodeHealth: readonly ComponentStatus[],
): AgentStatusConsistencyReport {
  const canonicalIds = agentHubPayload.canonical_agent_registry.map((agent) => agent.id)
  const agentIds = agentHubPayload.agents.map((agent) => agent.id)
  const cloudcodeIds = cloudcodeHealth.map((row) => row.id)
  const issues: AgentStatusConsistencyIssue[] = []
  const agentCounts = countById(agentIds)

  for (const canonicalId of canonicalIds) {
    if (!agentCounts.has(canonicalId)) {
      issues.push(issue({
        agent_id: canonicalId,
        source: 'canonical_registry',
        severity: 'error',
        reason: 'canonical_agent_missing_from_agent_hub',
        expected: canonicalId,
        actual: null,
      }))
    }
  }

  for (const [agentId, count] of agentCounts.entries()) {
    if (count > 1) {
      issues.push(issue({
        agent_id: agentId,
        source: 'agent_hub',
        severity: 'error',
        reason: 'duplicate_agent_hub_status_row',
        expected: '1',
        actual: String(count),
      }))
    }
  }

  const healthById = new Map<string, ComponentStatus[]>()
  for (const row of cloudcodeHealth) {
    healthById.set(row.id, [...(healthById.get(row.id) || []), row])
  }

  for (const agent of agentHubPayload.agents) {
    issues.push(...validateAgentHubRow(agent))
    const expectedRows = agentHubIdToCloudCodeIds(agent.id).flatMap((id) => healthById.get(id) || [])
    issues.push(...validateCloudCodeRows(agent, expectedRows))
  }

  return {
    ok: issues.filter((item) => item.severity === 'error').length === 0,
    mode: 'multi_agent_status_consistency',
    generated_at: agentHubPayload.generated_at,
    checked_agents: agentHubPayload.agents.length,
    canonical_agent_ids: canonicalIds,
    agent_hub_agent_ids: agentIds,
    cloudcode_health_ids: cloudcodeIds,
    issues,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}
