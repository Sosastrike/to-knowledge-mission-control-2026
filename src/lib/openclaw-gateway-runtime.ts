import { userInfo } from 'node:os'

import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'
import type { CanonicalAgentHubState } from './canonical-agent-registry'
import { runOpenClaw } from './command'
import { config } from './config'
import type { GatewayStatus } from './gateway-model'
import { describeOwnerFacingStatus, type OwnerFacingStatusDescriptor } from './owner-status'
import {
  buildOpenClawDoctorMissingPayload,
  parseOpenClawDoctorOutput,
  withOpenClawDoctorClosure,
  type OpenClawDoctorClosureSummary,
} from './openclaw-doctor'

export type OpenClawGatewayRuntimeStatus = {
  ok: true
  mode: 'openclaw_plus_gateway_runtime_status'
  generated_at: string
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocker: string | null
  route_or_service_checked: '/api/openclaw/doctor'
  gateway_node_route: '/api/gateway/nodes/openclaw-plus'
  agent_hub_state: CanonicalAgentHubState
  gateway_health: GatewayStatus
  connected: boolean
  configured: boolean
  read_enabled: boolean
  live_interface_proven: boolean
  called_true_proven: boolean
  owner_status: OwnerFacingStatusDescriptor
  proof_packet: OpenClawDoctorClosureSummary['proof_packet']
  owner_approval_required_for_execution: true
  bridge_session_required_for_execution: true
  execution_enabled: false
  writes_enabled: false
  destructive_repair_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

type CommandDetail = {
  detail: string
  code: number | null
}

type OpenClawDoctorRunner = (args: string[], options: { timeoutMs: number }) => Promise<{
  stdout: string
  stderr: string
  code: number | null
}>

function runtimeServiceUser(): string | null {
  try {
    return userInfo().username || null
  } catch {
    return process.env.USER || null
  }
}

function getCommandDetail(error: unknown): CommandDetail {
  const err = error as {
    stdout?: string
    stderr?: string
    message?: string
    code?: number | null
  }

  return {
    detail: [err?.stdout, err?.stderr, err?.message].filter(Boolean).join('\n').trim(),
    code: typeof err?.code === 'number' ? err.code : null,
  }
}

function isMissingOpenClaw(detail: string): boolean {
  return /enoent|not installed|not reachable|command not found/i.test(detail)
}

function agentHubStateFor(status: MissionControlCanonicalStatus): CanonicalAgentHubState {
  if (status === 'LIVE' || status === 'READY') return 'read_only'
  if (status === 'OWNER_GATED' || status === 'CREDENTIAL_GATED') return 'gated'
  return 'blocked'
}

function gatewayHealthFor(status: MissionControlCanonicalStatus): GatewayStatus {
  if (status === 'LIVE' || status === 'READY') return 'read_only'
  if (status === 'DISABLED') return 'legacy_archived'
  return 'blocked'
}

export function isOpenClawGatewayNodeId(value: string): boolean {
  return /^(openclaw|openclaw\+|openclaw-plus|openclaw_plus|openclawplus)$/i.test(value.trim())
}

export function buildOpenClawGatewayRuntimeStatus(
  closure: OpenClawDoctorClosureSummary,
  input: {
    generatedAt?: string
  } = {},
): OpenClawGatewayRuntimeStatus {
  const generatedAt = input.generatedAt || closure.proof_packet.timestamp || new Date().toISOString()
  const live = closure.canonical_status === 'LIVE'
  const ready = closure.canonical_status === 'READY'
  const readEnabled = live || ready
  const ownerStatus = describeOwnerFacingStatus({
    rawStatus: closure.canonical_status,
    blockers: closure.blocker ? [closure.blocker] : [],
    summary: closure.blocker || 'OpenClaw+ doctor runtime status is visible to Gateway.',
    connected: live,
    configured: live,
    readEnabled,
    writeEnabled: false,
    executionEnabled: false,
    requiresBridgeSession: true,
  })

  return {
    ok: true,
    mode: 'openclaw_plus_gateway_runtime_status',
    generated_at: generatedAt,
    canonical_status: closure.canonical_status,
    blocker_class: closure.blocker_class,
    blocker: closure.blocker,
    route_or_service_checked: '/api/openclaw/doctor',
    gateway_node_route: '/api/gateway/nodes/openclaw-plus',
    agent_hub_state: agentHubStateFor(closure.canonical_status),
    gateway_health: gatewayHealthFor(closure.canonical_status),
    connected: live,
    configured: live,
    read_enabled: readEnabled,
    live_interface_proven: live,
    called_true_proven: live,
    owner_status: ownerStatus,
    proof_packet: closure.proof_packet,
    owner_approval_required_for_execution: true,
    bridge_session_required_for_execution: true,
    execution_enabled: false,
    writes_enabled: false,
    destructive_repair_enabled: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
  }
}

export async function getOpenClawGatewayRuntimeStatus(input: {
  timeoutMs?: number
  runDoctor?: OpenClawDoctorRunner
  generatedAt?: string
  serviceUser?: string | null
} = {}): Promise<OpenClawGatewayRuntimeStatus> {
  const timeoutMs = input.timeoutMs ?? 5000
  const runDoctor = input.runDoctor || runOpenClaw
  const serviceUser = input.serviceUser ?? runtimeServiceUser()
  const timestamp = input.generatedAt || new Date().toISOString()

  try {
    const result = await runDoctor(['doctor'], { timeoutMs })
    const doctorStatus = parseOpenClawDoctorOutput(`${result.stdout}\n${result.stderr}`, result.code ?? 0, {
      stateDir: config.openclawStateDir,
    })
    return buildOpenClawGatewayRuntimeStatus(withOpenClawDoctorClosure(doctorStatus, {
      timestamp,
      serviceUser,
      rollbackCommand: 'git revert <day-79-openclaw-gateway-integration-commit>',
    }), { generatedAt: timestamp })
  } catch (error) {
    const { detail, code } = getCommandDetail(error)
    if (isMissingOpenClaw(detail)) {
      return buildOpenClawGatewayRuntimeStatus(buildOpenClawDoctorMissingPayload({
        timestamp,
        serviceUser,
        rollbackCommand: 'git revert <day-79-openclaw-gateway-integration-commit>',
      }), { generatedAt: timestamp })
    }

    const doctorStatus = parseOpenClawDoctorOutput(detail, code ?? 1, {
      stateDir: config.openclawStateDir,
    })
    return buildOpenClawGatewayRuntimeStatus(withOpenClawDoctorClosure(doctorStatus, {
      timestamp,
      serviceUser,
      rollbackCommand: 'git revert <day-79-openclaw-gateway-integration-commit>',
    }), { generatedAt: timestamp })
  }
}
