import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'
import { evaluateHermesPolicy } from '@/lib/hermes-policy'
import { executeJarvisAdapter, type JarvisExecutionInput, type JarvisExecutionResult } from '@/lib/jarvis-execution-router'
import { buildJarvisSystemCommandRegistry } from '@/lib/jarvis-system-command-registry'
import { recordJarvisAudit } from '@/lib/jarvis-audit'

type AgentLine = {
  agent_id: 'agent_zero' | 'hermes'
  canonical_agent_id: 'agent-zero-jarvis' | 'ron-weasley'
  label: string
  route_root: string
  tool_registry_route: string
  command_registry_route: string
  execute_route: string
  transport_mode: 'nuclear_gateway_direct'
  route_trace: readonly ['owner', 'mission-control', 'nuclear-gateway', 'agent-zero-jarvis' | 'ron-weasley']
  intermediaries_allowed: false
  openclaw_in_path: false
  claudeclaw_in_path: false
  auth_required: true
  audit_required: true
  commander: boolean
  delegated_by: 'agent-zero-jarvis' | null
}

export type HermesDelegationPacket = {
  delegation_id: string
  delegated_by: 'agent-zero-jarvis'
  delegated_to: 'hermes'
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  task_id: string | null
  created_at: string
  expires_at: string
  credential_values_exposed: false
  broad_connector_execution_enabled: false
  public_exposure_change_enabled: false
  destructive_delete_enabled: false
  auth_audit_rollback_disable_enabled: false
  openclaw_in_path: false
  claudeclaw_in_path: false
  delegation_signature: string
}

type CreateDelegationInput = {
  adapter_id?: string
  action?: string
  scope?: Record<string, unknown>
  task_id?: string
  requested_by?: string
  ttl_seconds?: number
}

type HermesDelegatedExecutionInput = JarvisExecutionInput & {
  delegation_id?: string
}

type HermesDelegatedExecutionResult = Omit<JarvisExecutionResult, 'route' | 'mode'> & {
  route: 'bridge.hermes.execute'
  mode:
    | 'hermes_delegated_exact_scope_executed'
    | 'hermes_delegated_exact_scope_blocked'
    | 'hermes_delegation_blocked'
  delegated_by: 'agent-zero-jarvis' | null
  delegated_to: 'hermes'
  jarvis_final_authority: true
  hermes_replaces_jarvis: false
  openclaw_in_path: false
  claudeclaw_in_path: false
}

const delegationStorePath = join(config.dataDir, 'hermes-delegations.json')

function readDelegations(): HermesDelegationPacket[] {
  try {
    const parsed = JSON.parse(readFileSync(delegationStorePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDelegations(rows: HermesDelegationPacket[]) {
  mkdirSync(dirname(delegationStorePath), { recursive: true })
  writeFileSync(delegationStorePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function signatureFor(packet: Omit<HermesDelegationPacket, 'delegation_signature'>) {
  return createHash('sha256')
    .update(canonical(packet))
    .digest('hex')
}

function normalizeScope(scope: unknown): Record<string, unknown> {
  return scope && typeof scope === 'object' && !Array.isArray(scope) ? scope as Record<string, unknown> : {}
}

function scopesEqual(left: Record<string, unknown>, right: Record<string, unknown>) {
  return canonical(left) === canonical(right)
}

function blockedHermesExecution(input: {
  adapter_id: string
  action: string
  scope: Record<string, unknown>
  exact_blocker: string
  mode?: HermesDelegatedExecutionResult['mode']
}): HermesDelegatedExecutionResult {
  return {
    ok: false,
    route: 'bridge.hermes.execute',
    mode: input.mode || 'hermes_delegation_blocked',
    adapter_id: input.adapter_id,
    action: input.action,
    scope: input.scope,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    credential_values_exposed: false,
    hard_stop_enforced: true,
    audit_record_written: false,
    audit_hash: null,
    rollback_id: null,
    rollback_command: null,
    exact_blocker: input.exact_blocker,
    delegated_by: null,
    delegated_to: 'hermes',
    jarvis_final_authority: true,
    hermes_replaces_jarvis: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
  }
}

function safePositiveTtl(ttl: unknown) {
  const numeric = typeof ttl === 'number' && Number.isFinite(ttl) ? ttl : 900
  return Math.max(60, Math.min(Math.floor(numeric), 3600))
}

export function buildAgentLinesStatus() {
  const agentZero: AgentLine = {
    agent_id: 'agent_zero',
    canonical_agent_id: 'agent-zero-jarvis',
    label: 'Agent Zero / Jarvis',
    route_root: '/api/bridge/agent-zero',
    tool_registry_route: '/api/bridge/agent-zero/system-command-registry',
    command_registry_route: '/api/bridge/agent-zero/system-command-registry',
    execute_route: '/api/bridge/agent-zero/execute',
    transport_mode: 'nuclear_gateway_direct',
    route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'agent-zero-jarvis'],
    intermediaries_allowed: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    auth_required: true,
    audit_required: true,
    commander: true,
    delegated_by: null,
  }
  const hermes: AgentLine = {
    agent_id: 'hermes',
    canonical_agent_id: 'ron-weasley',
    label: RON_WEASLEY_IDENTITY.full_title,
    route_root: '/api/bridge/hermes',
    tool_registry_route: '/api/bridge/hermes/tool-map',
    command_registry_route: '/api/bridge/hermes/system-command-registry',
    execute_route: '/api/bridge/hermes/execute',
    transport_mode: 'nuclear_gateway_direct',
    route_trace: ['owner', 'mission-control', 'nuclear-gateway', 'ron-weasley'],
    intermediaries_allowed: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    auth_required: true,
    audit_required: true,
    commander: false,
    delegated_by: 'agent-zero-jarvis',
  }

  return {
    route: 'bridge.agent-lines.status',
    mode: 'nuclear_gateway_direct_agent_lines',
    nuclear_gateway_direct: true,
    gateway_node: 'nuclear-gateway',
    gateway_api_direct: true,
    external_transport_scope: 'not_in_first_pass',
    no_intermediary_interpretation: true,
    credential_values_exposed: false,
    lines: {
      agent_zero: agentZero,
      hermes,
    },
    edges: [
      { source: 'agent_zero', target: 'nuclear-gateway', direct_line: true, intermediaries_allowed: false },
      { source: 'hermes', target: 'nuclear-gateway', direct_line: true, delegated_by: 'agent-zero-jarvis', intermediaries_allowed: false },
      { source: 'agent_zero', target: 'hermes', relation: 'delegates_exact_scope', intermediaries_allowed: false },
    ],
  }
}

export function buildHermesSystemCommandRegistry() {
  const jarvis = buildJarvisSystemCommandRegistry()
  const commands = jarvis.commands.map((item) => ({
    ...item,
    hermes_visible: true,
    hermes_authority: item.write || item.execute ? 'jarvis_delegation_required' : 'direct_read_allowed',
    hermes_execution_route: item.write || item.execute ? '/api/bridge/hermes/execute' : null,
    jarvis_delegation_required: item.write || item.execute,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
  }))

  return {
    route: 'bridge.hermes.system-command-registry',
    mode: 'hermes_jarvis_delegated_command_registry',
    source_registry_route: jarvis.route,
    canonical_execution_route: '/api/bridge/hermes/execute',
    jarvis_execution_route: jarvis.canonical_execution_route,
    owner_visible_ticket_route: jarvis.owner_visible_ticket_route,
    jarvis_remains_commander: true,
    hermes_full_visibility: true,
    hermes_gets_same_certified_adapter_surface_as_jarvis: true,
    openclaw_is_supporting_runtime_only: true,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    credential_values_exposed: false,
    no_raw_secret_values: true,
    summary: {
      ...jarvis.summary,
      hermes_visible_commands: commands.length,
      hermes_delegation_required_commands: commands.filter((item) => item.jarvis_delegation_required).length,
    },
    systems: jarvis.systems.map((item) => ({
      ...item,
      hermes_visible: true,
      hermes_write_or_execute_authority: item.write || item.execute ? 'jarvis_delegation_required' : 'direct_read_allowed',
    })),
    commands,
  }
}

export function buildHermesFullAccessStatus() {
  const registry = buildHermesSystemCommandRegistry()
  return {
    route: 'bridge.hermes.full-access.status',
    identity: RON_WEASLEY_IDENTITY.canonical_name,
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    status: 'FULL_ACCESS_DELEGATED',
    mode: 'jarvis_delegated_parity',
    same_visibility_as_jarvis: true,
    same_certified_adapter_surface_as_jarvis: true,
    execution_authority: 'jarvis_signed_exact_scope_delegation',
    direct_line_route: '/api/bridge/agent-lines/status',
    command_registry_route: '/api/bridge/hermes/system-command-registry',
    execute_route: '/api/bridge/hermes/execute',
    delegation_route: '/api/bridge/agent-zero/hermes-delegations',
    jarvis_remains_commander: true,
    hermes_replaces_jarvis: false,
    openclaw_is_intermediary: false,
    claudeclaw_is_intermediary: false,
    credential_values_exposed: false,
    broad_connector_execution_enabled: false,
    public_exposure_change_enabled: false,
    destructive_delete_enabled: false,
    auth_audit_rollback_disable_enabled: false,
    summary: registry.summary,
  }
}

export function createHermesDelegation(input: CreateDelegationInput):
  | { ok: true; route: 'bridge.agent-zero.hermes-delegations'; mode: 'hermes_delegation_created'; packet: HermesDelegationPacket; audit_hash: string; rollback_command: string; credential_values_exposed: false }
  | { ok: false; route: 'bridge.agent-zero.hermes-delegations'; mode: 'hermes_delegation_blocked'; exact_blocker: 'invalid_payload' | 'jarvis_signature_required' | 'owner_hard_stop_required' | 'jarvis_approval_required'; credential_values_exposed: false } {
  const adapterId = typeof input.adapter_id === 'string' ? input.adapter_id.trim() : ''
  const action = typeof input.action === 'string' ? input.action.trim() : ''
  const scope = normalizeScope(input.scope)
  if (!adapterId || !action || !Object.keys(scope).length) {
    return {
      ok: false,
      route: 'bridge.agent-zero.hermes-delegations',
      mode: 'hermes_delegation_blocked',
      exact_blocker: 'invalid_payload',
      credential_values_exposed: false,
    }
  }
  if (input.requested_by !== 'agent-zero-jarvis') {
    return {
      ok: false,
      route: 'bridge.agent-zero.hermes-delegations',
      mode: 'hermes_delegation_blocked',
      exact_blocker: 'jarvis_signature_required',
      credential_values_exposed: false,
    }
  }

  const policy = evaluateHermesPolicy({ adapter_id: adapterId, action, scope })
  if (!policy.allowed) {
    return {
      ok: false,
      route: 'bridge.agent-zero.hermes-delegations',
      mode: 'hermes_delegation_blocked',
      exact_blocker: policy.exact_blocker,
      credential_values_exposed: false,
    }
  }

  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + safePositiveTtl(input.ttl_seconds) * 1000)
  const unsigned: Omit<HermesDelegationPacket, 'delegation_signature'> = {
    delegation_id: `hdel_${randomUUID()}`,
    delegated_by: 'agent-zero-jarvis',
    delegated_to: 'hermes',
    adapter_id: adapterId,
    action,
    scope,
    task_id: typeof input.task_id === 'string' && input.task_id.trim() ? input.task_id.trim().slice(0, 120) : null,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    credential_values_exposed: false,
    broad_connector_execution_enabled: false,
    public_exposure_change_enabled: false,
    destructive_delete_enabled: false,
    auth_audit_rollback_disable_enabled: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
  }
  const packet: HermesDelegationPacket = {
    ...unsigned,
    delegation_signature: signatureFor(unsigned),
  }
  writeDelegations([packet, ...readDelegations()])
  const audit = recordJarvisAudit({
    actor: 'agent-zero-jarvis',
    event: 'hermes_delegation_created',
    target: adapterId,
    classification: 'JARVIS_DELEGATED_EXACT_SCOPE',
    detail: {
      delegation_id: packet.delegation_id,
      delegated_to: 'hermes',
      action,
      scope,
      task_id: packet.task_id,
      expires_at: packet.expires_at,
      credential_values_exposed: false,
      broad_connector_execution_enabled: false,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
    },
  })

  return {
    ok: true,
    route: 'bridge.agent-zero.hermes-delegations',
    mode: 'hermes_delegation_created',
    packet,
    audit_hash: audit.hash,
    rollback_command: `Archive Ron Weasley delegation ${packet.delegation_id}; no external state was changed by delegation creation.`,
    credential_values_exposed: false,
  }
}

function validDelegationFor(input: HermesDelegatedExecutionInput) {
  const delegationId = typeof input.delegation_id === 'string' ? input.delegation_id.trim() : ''
  if (!delegationId) return { ok: false as const, exact_blocker: 'jarvis_delegation_required' as const, packet: null }
  const packet = readDelegations().find((item) => item.delegation_id === delegationId) || null
  if (!packet) return { ok: false as const, exact_blocker: 'jarvis_delegation_required' as const, packet: null }
  if (Date.parse(packet.expires_at) <= Date.now()) {
    return { ok: false as const, exact_blocker: 'hermes_delegation_expired' as const, packet }
  }
  const { delegation_signature: _signature, ...unsigned } = packet
  if (signatureFor(unsigned) !== packet.delegation_signature) {
    return { ok: false as const, exact_blocker: 'hermes_delegation_signature_invalid' as const, packet }
  }
  const adapterId = typeof input.adapter_id === 'string' ? input.adapter_id.trim() : ''
  const action = typeof input.action === 'string' ? input.action.trim() : ''
  const scope = normalizeScope(input.scope)
  if (packet.adapter_id !== adapterId || packet.action !== action || !scopesEqual(packet.scope, scope)) {
    return { ok: false as const, exact_blocker: 'hermes_delegation_scope_mismatch' as const, packet }
  }
  return { ok: true as const, exact_blocker: null, packet }
}

export async function executeHermesDelegatedAdapter(input: HermesDelegatedExecutionInput): Promise<HermesDelegatedExecutionResult> {
  const adapterId = typeof input.adapter_id === 'string' ? input.adapter_id.trim() : 'unknown'
  const action = typeof input.action === 'string' ? input.action.trim() : 'unknown'
  const scope = normalizeScope(input.scope)
  const delegation = validDelegationFor(input)
  if (!delegation.ok) {
    return blockedHermesExecution({
      adapter_id: adapterId,
      action,
      scope,
      exact_blocker: delegation.exact_blocker,
    })
  }

  const result = await executeJarvisAdapter({
    ...input,
    adapter_id: adapterId,
    action,
    scope,
    actor: 'hermes',
    input: {
      ...(input.input || {}),
      hermes_delegation_id: delegation.packet.delegation_id,
      delegated_by: 'agent-zero-jarvis',
    },
  })
  const audit = recordJarvisAudit({
    actor: 'hermes',
    event: result.ok ? 'hermes_delegated_exact_scope_executed' : 'hermes_delegated_exact_scope_blocked',
    target: adapterId,
    classification: 'JARVIS_DELEGATED_EXACT_SCOPE',
    status: result.ok ? 'recorded' : 'blocked',
    detail: {
      delegation_id: delegation.packet.delegation_id,
      delegated_by: 'agent-zero-jarvis',
      action,
      scope,
      jarvis_audit_hash: result.audit_hash,
      jarvis_rollback_id: result.rollback_id,
      exact_blocker: result.exact_blocker,
      credential_values_exposed: false,
      openclaw_in_path: false,
      claudeclaw_in_path: false,
    },
  })

  return {
    ...result,
    route: 'bridge.hermes.execute',
    mode: result.ok ? 'hermes_delegated_exact_scope_executed' : 'hermes_delegated_exact_scope_blocked',
    audit_hash: audit.hash,
    delegated_by: 'agent-zero-jarvis',
    delegated_to: 'hermes',
    jarvis_final_authority: true,
    hermes_replaces_jarvis: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
  }
}
