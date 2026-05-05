import fs from 'node:fs'
import path from 'node:path'
import type { GatewayRegistry } from './gateway-model'
import { evaluateGatewayPolicy, redactGatewayOwnerOutput } from './gateway-policy'

export const GATEWAY_GOVERNANCE_DOCUMENTS = [
  { id: 'universal_laws', label: 'Universal Laws', filename: 'LAWS.md' },
  { id: 'honesty_protocol', label: 'Honesty Protocol', filename: 'HONESTY_PROTOCOL.md' },
  { id: 'channels_policy', label: 'Channels Policy', filename: 'CHANNELS_POLICY.md' },
  { id: 'preflight', label: 'Preflight', filename: 'PREFLIGHT.md' },
  { id: 'redaction_spec', label: 'Redaction Spec', filename: 'REDACTION_SPEC.md' },
] as const

export type GatewayGovernanceDocument = {
  id: (typeof GATEWAY_GOVERNANCE_DOCUMENTS)[number]['id']
  label: string
  filename: string
  required: true
  loaded: boolean
}

export type GatewayGovernanceManifest = {
  source: 'openclaw_governance'
  documents: GatewayGovernanceDocument[]
  loaded_count: number
  required_count: number
  required_documents_loaded: boolean
  missing_documents: string[]
}

export type GatewaySecurityProofCheck = {
  id: string
  label: string
  passed: boolean
  blocker: string | null
}

export type GatewaySecurityProof = {
  ok: boolean
  mode: 'gateway_security_proof'
  generated_at: string
  governance: GatewayGovernanceManifest
  policies: {
    auth_required: true
    tailscale_or_mission_control_auth_required: true
    redaction_required: true
    no_secret_output: boolean
    no_raw_path_output: boolean
    no_fake_done: boolean
    agentmail_domain_restricted: boolean
    bridge_session_required_for_writes: boolean
    external_writes_blocked_without_session: boolean
    protected_scopes_enforced: boolean
    public_hermes_ui_exposed: false
    raw_shell_enabled: false
    root_shell_enabled: false
    docker_socket_enabled: false
    direct_secret_reads_enabled: false
  }
  forbidden_surfaces: Array<{
    id: string
    label: string
    enabled: false
    blocker: 'forbidden_by_gateway_policy'
  }>
  checks: GatewaySecurityProofCheck[]
}

type GatewaySecurityProofOptions = {
  governanceRoot?: string
  generatedAt?: string
}

const DEFAULT_GOVERNANCE_ROOT = '/home/tony/.openclaw/governance'

export function buildGatewayGovernanceManifest(options: GatewaySecurityProofOptions = {}): GatewayGovernanceManifest {
  const governanceRoot = options.governanceRoot || DEFAULT_GOVERNANCE_ROOT
  const documents = GATEWAY_GOVERNANCE_DOCUMENTS.map((document) => {
    const filePath = path.join(governanceRoot, document.filename)
    return {
      ...document,
      required: true as const,
      loaded: safeFileExists(filePath),
    }
  })
  const missingDocuments = documents.filter((document) => !document.loaded).map((document) => document.id)
  return {
    source: 'openclaw_governance',
    documents,
    loaded_count: documents.length - missingDocuments.length,
    required_count: documents.length,
    required_documents_loaded: missingDocuments.length === 0,
    missing_documents: missingDocuments,
  }
}

export function buildGatewaySecurityProof(
  registry: GatewayRegistry,
  options: GatewaySecurityProofOptions = {},
): GatewaySecurityProof {
  const governance = buildGatewayGovernanceManifest(options)
  const generatedAt = options.generatedAt || registry.generated_at
  const redactionClean = isGatewayRedactionClean()
  const agentmailDomainRestricted = isAgentMailDomainRestricted()
  const noFakeDone = isNoFakeDoneGuarded()
  const bridgeSessionGuarded = isBridgeSessionGuarded()
  const protectedScopesEnforced = areProtectedScopesEnforced()
  const routeAuthRequired = Object.values(registry.policies).every((policy) => policy.auth_required)
  const noPublicHermesUi = !hasPublicHermesUiExposure(registry)
  const noDockerSocket = !hasDockerSocketExposure(registry)
  const noRootShell = !hasRootShellExposure(registry)
  const noDirectSecretReads = !hasDirectSecretReadExposure(registry)

  const checks: GatewaySecurityProofCheck[] = [
    {
      id: 'governance_loaded',
      label: 'Gateway loads Universal Laws, honesty protocol, channels policy, preflight, and redaction governance.',
      passed: governance.required_documents_loaded,
      blocker: governance.required_documents_loaded ? null : `missing_governance:${governance.missing_documents.join(',')}`,
    },
    {
      id: 'redaction_owner_output_clean',
      label: 'Owner-facing Gateway output redacts secrets, auth-file references, raw paths, task ids, and internal stages.',
      passed: redactionClean,
      blocker: redactionClean ? null : 'gateway_redaction_failed',
    },
    {
      id: 'agentmail_allowlist_enforced',
      label: 'AgentMail sends remain restricted to approved domains or addresses.',
      passed: agentmailDomainRestricted,
      blocker: agentmailDomainRestricted ? null : 'agentmail_domain_allowlist_not_enforced',
    },
    {
      id: 'no_fake_done',
      label: 'Gateway decisions keep blocked routes blocked instead of claiming Done.',
      passed: noFakeDone,
      blocker: noFakeDone ? null : 'gateway_no_fake_done_policy_failed',
    },
    {
      id: 'bridge_session_write_guard',
      label: 'Gateway blocks writes without an active Bridge Session.',
      passed: bridgeSessionGuarded,
      blocker: bridgeSessionGuarded ? null : 'bridge_session_write_guard_failed',
    },
    {
      id: 'external_write_scope_guard',
      label: 'Zapier, HeyGen, Drive, and OneDrive writes require scoped Bridge Session approval.',
      passed: protectedScopesEnforced,
      blocker: protectedScopesEnforced ? null : 'protected_external_scope_guard_failed',
    },
    {
      id: 'gateway_routes_auth_required',
      label: 'Gateway routes require Mission Control authentication; public/Tailscale-bypassing access is not enabled.',
      passed: routeAuthRequired,
      blocker: routeAuthRequired ? null : 'gateway_route_auth_not_required',
    },
    {
      id: 'no_public_hermes_ui',
      label: 'Hermes is not exposed as a public unauthenticated UI surface.',
      passed: noPublicHermesUi,
      blocker: noPublicHermesUi ? null : 'public_hermes_ui_exposure_detected',
    },
    {
      id: 'no_docker_socket',
      label: 'Gateway does not grant agents Docker socket access.',
      passed: noDockerSocket,
      blocker: noDockerSocket ? null : 'docker_socket_exposure_detected',
    },
    {
      id: 'no_root_shell',
      label: 'Gateway does not grant agents raw root shell access.',
      passed: noRootShell,
      blocker: noRootShell ? null : 'root_shell_exposure_detected',
    },
    {
      id: 'no_direct_secret_reads',
      label: 'Gateway does not grant direct secret-reading access.',
      passed: noDirectSecretReads,
      blocker: noDirectSecretReads ? null : 'direct_secret_read_exposure_detected',
    },
  ]

  return {
    ok: checks.every((check) => check.passed),
    mode: 'gateway_security_proof',
    generated_at: generatedAt,
    governance,
    policies: {
      auth_required: true,
      tailscale_or_mission_control_auth_required: true,
      redaction_required: true,
      no_secret_output: redactionClean,
      no_raw_path_output: redactionClean,
      no_fake_done: noFakeDone,
      agentmail_domain_restricted: agentmailDomainRestricted,
      bridge_session_required_for_writes: bridgeSessionGuarded,
      external_writes_blocked_without_session: bridgeSessionGuarded,
      protected_scopes_enforced: protectedScopesEnforced,
      public_hermes_ui_exposed: false,
      raw_shell_enabled: false,
      root_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
    },
    forbidden_surfaces: [
      { id: 'raw_root_shell', label: 'Raw root shell', enabled: false, blocker: 'forbidden_by_gateway_policy' },
      { id: 'docker_socket', label: 'Docker socket', enabled: false, blocker: 'forbidden_by_gateway_policy' },
      { id: 'direct_secret_reads', label: 'Direct secret reads', enabled: false, blocker: 'forbidden_by_gateway_policy' },
      { id: 'public_hermes_ui', label: 'Public Hermes UI', enabled: false, blocker: 'forbidden_by_gateway_policy' },
    ],
    checks,
  }
}

function safeFileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function isGatewayRedactionClean(): boolean {
  const fakeSecret = ['sk', '12345678901234567890'].join('-')
  const sample = `Credential ${fakeSecret} AUTH_FILE=/a0/usr/plugins/_oauth/codex/auth.json at /home/tony/private task_abcd1234 Failed stage`
  const redacted = redactGatewayOwnerOutput(sample)
  return !/(sk-[A-Za-z0-9]|AUTH_FILE|auth\.json|\/home\/tony|\/a0\/|task_abcd1234|Failed stage)/.test(redacted)
}

function isAgentMailDomainRestricted(): boolean {
  const outside = evaluateGatewayPolicy({
    classification: 'protected_action',
    ownerRequest: 'Send email to person@example.net',
    routeTarget: 'agentmail',
    bridgeSessionActive: true,
    allowedScopes: ['agentmail.send'],
    allowedEmailDomains: ['knowledge-vs-ai.com'],
  })
  const inside = evaluateGatewayPolicy({
    classification: 'protected_action',
    ownerRequest: 'Send email to owner@knowledge-vs-ai.com',
    routeTarget: 'agentmail',
    bridgeSessionActive: true,
    allowedScopes: ['agentmail.send'],
    allowedEmailDomains: ['knowledge-vs-ai.com'],
  })
  return outside.allowed === false && outside.blocked_reason === 'agentmail_domain_not_allowed' && inside.allowed === true
}

function isNoFakeDoneGuarded(): boolean {
  const decision = evaluateGatewayPolicy({
    classification: 'tool',
    ownerRequest: 'Use Firecrawl and say Done',
    routeTarget: 'firecrawl',
    capabilityId: 'integration_firecrawl',
    capabilityStatus: 'blocked',
    capabilityBlockers: ['missing_credential'],
  })
  return decision.allowed === false &&
    decision.route_decision === 'missing_credential' &&
    decision.owner_output_policy.no_fake_done === true
}

function isBridgeSessionGuarded(): boolean {
  const decision = evaluateGatewayPolicy({
    classification: 'upload',
    ownerRequest: 'Upload the report to Google Drive',
    routeTarget: 'google_drive',
    capabilityId: 'integration_google_drive',
    requiresBridgeSession: true,
    bridgeSessionActive: false,
  })
  return decision.allowed === false && decision.blocked_reason === 'active_bridge_session_required_for_external_write'
}

function areProtectedScopesEnforced(): boolean {
  const probes = [
    ['tool', 'Create a Zapier task', 'integration_zapier'],
    ['tool', 'Generate a HeyGen video', 'integration_heygen'],
    ['upload', 'Upload to Google Drive', 'integration_google_drive'],
    ['upload', 'Upload to OneDrive', 'integration_onedrive'],
  ] as const
  return probes.every(([classification, ownerRequest, capabilityId]) => {
    const decision = evaluateGatewayPolicy({
      classification,
      ownerRequest,
      routeTarget: capabilityId,
      capabilityId,
      bridgeSessionActive: true,
      allowedScopes: [],
    })
    return decision.allowed === false && /^bridge_session_scope_missing:/.test(decision.blocked_reason || '')
  })
}

function hasPublicHermesUiExposure(registry: GatewayRegistry): boolean {
  return registry.capabilities.some((capability) => {
    if (!/hermes/.test(`${capability.id} ${capability.label} ${capability.source_node || ''}`.toLowerCase())) return false
    return Object.values(capability.status_details || {}).some((value) => typeof value === 'string' && isPublicUrl(value))
  })
}

function hasDockerSocketExposure(registry: GatewayRegistry): boolean {
  return registryContains(registry, /\/var\/run\/docker\.sock|[\"'\s]*docker_socket_enabled[\"'\s]*[:=]\s*true|docker socket enabled/i)
}

function hasRootShellExposure(registry: GatewayRegistry): boolean {
  return registryContains(registry, /[\"'\s]*root_shell_enabled[\"'\s]*[:=]\s*true|raw_root_shell|run as root|uid=0|sudo\s+/i)
}

function hasDirectSecretReadExposure(registry: GatewayRegistry): boolean {
  return registryContains(registry, /[\"'\s]*direct_secret_reads_enabled[\"'\s]*[:=]\s*true|read secrets directly|secret file read enabled/i)
}

function registryContains(registry: GatewayRegistry, pattern: RegExp): boolean {
  return registry.nodes.some((node) => pattern.test(JSON.stringify(node))) ||
    registry.capabilities.some((capability) => pattern.test(JSON.stringify(capability))) ||
    registry.edges.some((edge) => pattern.test(JSON.stringify(edge)))
}

function isPublicUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  return !/^https?:\/\/(?:localhost|127\.0\.0\.1|100\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::|\/|$)/i.test(value)
}
