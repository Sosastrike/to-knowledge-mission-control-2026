import type { CanonicalStatus, ComponentStatus } from './types'
import { redactString } from './redact'

// Canonical roster for the Agent Hub. Adding new agents here is the only place
// the UI should source the list — Codex never hardcodes agents in the UI.
export const AGENT_ROSTER = [
  { id: 'agent_zero', label: 'Agent Zero', service: 'agent-zero' },
  { id: 'hermes', label: 'Hermes', service: 'hermes' },
  { id: 'pi', label: 'Pi', service: 'pi' },
  { id: 'paperclip', label: 'Paperclip', service: null },
  { id: 'openclaw_plus', label: 'OpenClaw+', service: 'openclaw-plus' },
  { id: 'spaceagent_playwright', label: 'SpaceAgent Playwright', service: 'spaceagent-playwright' },
  { id: 'spaceagent_youtube', label: 'SpaceAgent YouTube', service: 'spaceagent-youtube' },
  { id: 'spaceagent_firecrawl', label: 'SpaceAgent Firecrawl', service: 'spaceagent-firecrawl' },
] as const

export type AgentId = (typeof AGENT_ROSTER)[number]['id']

// Loose probe input — what an upstream service-status endpoint or systemctl
// shim hands us per agent. Every field is optional.
export interface AgentProbeInput {
  id: AgentId | string
  reachable?: boolean
  configured?: boolean
  credential_configured?: boolean
  service_running?: boolean | null
  last_seen?: string | null
  blocker?: string | null
  next_action?: string | null
  proof_available?: boolean
}

interface AgentHealthRow extends ComponentStatus {
  reachable: boolean
  configured: boolean
  credential_configured: boolean
  service_running: boolean | null
  last_seen: string | null
  proof_available: boolean
}

function deriveAgentStatus(probe: AgentProbeInput, hasService: boolean): { status: CanonicalStatus; blocker: string | null; next_action: string | null } {
  // Priority order: SERVICE_DOWN > BLOCKED > CREDENTIAL_GATED > OWNER_GATED > READ_ONLY > READY > LIVE
  if (hasService && probe.service_running === false) {
    return {
      status: 'SERVICE_DOWN',
      blocker: probe.blocker ? redactString(probe.blocker) : 'systemd unit reports inactive',
      next_action: probe.next_action ? redactString(probe.next_action) : 'Owner verifies service unit and brings it up.',
    }
  }
  if (probe.configured === false) {
    return {
      status: 'BLOCKED',
      blocker: probe.blocker ? redactString(probe.blocker) : 'backend adapter not configured',
      next_action: probe.next_action ? redactString(probe.next_action) : 'Codex wires the backend adapter for this agent.',
    }
  }
  if (probe.credential_configured === false) {
    return {
      status: 'CREDENTIAL_GATED',
      blocker: probe.blocker ? redactString(probe.blocker) : 'credential missing by name',
      next_action: probe.next_action ? redactString(probe.next_action) : 'Owner adds the credential via the approved secret path.',
    }
  }
  if (probe.reachable === false) {
    return {
      status: 'OWNER_GATED',
      blocker: probe.blocker ? redactString(probe.blocker) : 'owner login required',
      next_action: probe.next_action ? redactString(probe.next_action) : 'Owner signs in to unlock this agent.',
    }
  }
  if (probe.reachable && probe.configured && probe.credential_configured && (!hasService || probe.service_running)) {
    return { status: 'READY', blocker: null, next_action: null }
  }
  return { status: 'UNKNOWN', blocker: probe.blocker ? redactString(probe.blocker) : null, next_action: probe.next_action ? redactString(probe.next_action) : null }
}

export interface BuildAgentHealthOptions {
  // When false (the default in safe mode) any READY agent is shown as READ_ONLY.
  executionEnabled?: boolean
}

export function buildAgentHealth(
  probes: ReadonlyArray<AgentProbeInput>,
  opts: BuildAgentHealthOptions = {},
): AgentHealthRow[] {
  const byId = new Map<string, AgentProbeInput>()
  for (const p of probes) {
    if (p && typeof p.id === 'string') byId.set(p.id, p)
  }
  return AGENT_ROSTER.map((entry) => {
    const probe = byId.get(entry.id) ?? { id: entry.id }
    const hasService = entry.service !== null
    const { status, blocker, next_action } = deriveAgentStatus(probe, hasService)
    let finalStatus = status
    if (opts.executionEnabled === false && (finalStatus === 'LIVE' || finalStatus === 'READY')) {
      finalStatus = 'READ_ONLY'
    }
    return {
      id: entry.id,
      label: entry.label,
      status: finalStatus,
      blocker,
      next_action,
      reachable: probe.reachable === true,
      configured: probe.configured === true,
      credential_configured: probe.credential_configured === true,
      service_running: hasService ? (probe.service_running ?? null) : null,
      last_seen: probe.last_seen ? redactString(String(probe.last_seen)).slice(0, 80) : null,
      proof_available: probe.proof_available === true,
    }
  })
}
