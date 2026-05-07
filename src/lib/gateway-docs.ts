import type { GatewayCapability, GatewayNode, GatewayRegistry, GatewayStatus } from './gateway-model'
import type { MiniAgentDefinition } from './gateway-mini-agent-contracts'

export const GATEWAY_DOC_TYPES = [
  'agent',
  'mini_agent',
  'skill',
  'tool',
  'integration',
  'model',
  'mcp_server',
  'brain_system',
  'runtime_engine',
  'buildwiki_farmer',
  'delivery_channel',
  'event',
  'gateway',
] as const

export type GatewayDocType = (typeof GATEWAY_DOC_TYPES)[number]

export type GatewayDoc = {
  id: string
  registry_id: string
  doc_type: GatewayDocType
  title: string
  purpose: string
  owner_or_supervisor: string
  capabilities: string[]
  limitations: string[]
  required_credentials: Record<string, boolean>
  read_enabled: boolean
  write_enabled: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  blocked_reason: string | null
  last_verified_at: string | null
  stale: boolean
  rollback_or_disable_path: string
  documentation_link: string
  secrets_exposed: false
  owner_visible_summary: string
}

export type GatewayDocsIndex = {
  ok: boolean
  mode: 'gateway_docs_index'
  generated_at: string
  docs: GatewayDoc[]
  coverage: {
    nodes_total: number
    capabilities_total: number
    mini_agents_total: number
    docs_total: number
    missing_docs: string[]
    stale_docs: string[]
    secret_findings: Array<{ doc_id: string; concern: string }>
  }
  blocked_reason: string | null
  owner_visible_summary: string
}

export type GatewayDocsValidation = {
  ok: boolean
  missing_docs: string[]
  stale_docs: string[]
  docs_missing_required_fields: string[]
  secret_findings: Array<{ doc_id: string; concern: string }>
}

const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?FILE)\s*[:=]\s*[^,\s}]+)/i
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/i
const DEFAULT_FRESHNESS_HOURS = 168
const LIVE_FRESHNESS_HOURS = 24

export function buildGatewayDocsIndex(
  registry: GatewayRegistry,
  input: { miniAgents?: MiniAgentDefinition[]; generatedAt?: string; freshnessHours?: number } = {},
): GatewayDocsIndex {
  const generatedAt = input.generatedAt || registry.generated_at
  const nodeDocs = registry.nodes.map((node) => docFromNode(node, generatedAt, input.freshnessHours))
  const capabilityDocs = registry.capabilities.map((capability) => docFromCapability(capability, generatedAt, input.freshnessHours))
  const miniAgentDocs = (input.miniAgents || []).map((definition) => docFromMiniAgent(definition, generatedAt, input.freshnessHours))
  const docs = [...nodeDocs, ...capabilityDocs, ...miniAgentDocs]
  const validation = validateGatewayDocsCoverage(registry, docs, { miniAgents: input.miniAgents || [], generatedAt })

  return {
    ok: validation.ok,
    mode: 'gateway_docs_index',
    generated_at: generatedAt,
    docs,
    coverage: {
      nodes_total: registry.nodes.length,
      capabilities_total: registry.capabilities.length,
      mini_agents_total: input.miniAgents?.length || 0,
      docs_total: docs.length,
      missing_docs: validation.missing_docs,
      stale_docs: validation.stale_docs,
      secret_findings: validation.secret_findings,
    },
    blocked_reason: validation.ok ? null : 'gateway_docs_validation_failed',
    owner_visible_summary: validation.ok
      ? 'GatewayDocs covers all registry nodes, capabilities, and provided mini-agent definitions.'
      : 'GatewayDocs has missing, stale, or unsafe entries that must be fixed before release.',
  }
}

export function validateGatewayDocsCoverage(
  registry: GatewayRegistry,
  docs: GatewayDoc[],
  input: { miniAgents?: MiniAgentDefinition[]; generatedAt?: string } = {},
): GatewayDocsValidation {
  const docIds = new Set(docs.map((doc) => doc.registry_id))
  const requiredIds = [
    ...registry.nodes.map((node) => node.id),
    ...registry.capabilities.map((capability) => capability.id),
    ...(input.miniAgents || []).map((definition) => definition.id),
  ]
  const missingDocs = requiredIds.filter((id) => !docIds.has(id))
  const staleDocs = docs.filter((doc) => doc.stale).map((doc) => doc.id)
  const docsMissingFields = docs.filter((doc) => !docHasRequiredFields(doc)).map((doc) => doc.id)
  const secretFindings = docs.flatMap((doc) => secretFindingsForDoc(doc))
  return {
    ok: missingDocs.length === 0 && docsMissingFields.length === 0 && secretFindings.length === 0,
    missing_docs: missingDocs,
    stale_docs: staleDocs,
    docs_missing_required_fields: docsMissingFields,
    secret_findings: secretFindings,
  }
}

function docFromNode(node: GatewayNode, generatedAt: string, freshnessHours?: number): GatewayDoc {
  const docType = docTypeFromNode(node)
  const blockedReason = node.blockers[0] || null
  return {
    id: `doc_${node.id}`,
    registry_id: node.id,
    doc_type: docType,
    title: node.label,
    purpose: purposeForNode(node),
    owner_or_supervisor: node.owner || 'ecosystem',
    capabilities: [...node.capabilities],
    limitations: blockedReason ? [blockedReason] : defaultLimitationsForNode(node),
    required_credentials: {},
    read_enabled: node.status !== 'missing' && node.status !== 'legacy_archived',
    write_enabled: node.status === 'write_enabled' || node.status === 'execution_enabled',
    execution_enabled: node.status === 'execution_enabled',
    requires_bridge_session: ['tool', 'mcp_server', 'api', 'delivery_channel', 'runtime_engine', 'buildwiki_farmer'].includes(node.kind),
    blocked_reason: blockedReason,
    last_verified_at: node.health.last_seen || generatedAt || null,
    stale: isStale(node.health.last_seen || generatedAt, generatedAt, node.kind === 'commander' || node.kind === 'lieutenant' ? LIVE_FRESHNESS_HOURS : freshnessHours),
    rollback_or_disable_path: rollbackForNode(node),
    documentation_link: `gateway-docs/nodes/${node.id}`,
    secrets_exposed: false,
    owner_visible_summary: `${node.label} is documented as ${node.kind} with status ${node.status}.`,
  }
}

function docFromCapability(capability: GatewayCapability, generatedAt: string, freshnessHours?: number): GatewayDoc {
  const blockedReason = capability.blockers[0] || null
  return {
    id: `doc_${capability.id}`,
    registry_id: capability.id,
    doc_type: docTypeFromCapability(capability),
    title: capability.label,
    purpose: `Gateway capability ${capability.label}.`,
    owner_or_supervisor: capability.owner || 'ecosystem',
    capabilities: [capability.kind],
    limitations: blockedReason ? [blockedReason] : capability.execution_requirements,
    required_credentials: Object.fromEntries(capability.required_credentials.map((credential) => [credential, false])),
    read_enabled: capability.read_enabled,
    write_enabled: capability.write_enabled,
    execution_enabled: capability.execution_enabled,
    requires_bridge_session: capability.requires_session,
    blocked_reason: blockedReason,
    last_verified_at: capability.last_seen || generatedAt || null,
    stale: isStale(capability.last_seen || generatedAt, generatedAt, freshnessHours),
    rollback_or_disable_path: 'Disable through Gateway registry policy; do not delete runtime data.',
    documentation_link: `gateway-docs/capabilities/${capability.id}`,
    secrets_exposed: false,
    owner_visible_summary: `${capability.label} is ${capability.status}; execution enabled is ${capability.execution_enabled}.`,
  }
}

function docFromMiniAgent(definition: MiniAgentDefinition, generatedAt: string, freshnessHours?: number): GatewayDoc {
  return {
    id: `doc_${definition.id}`,
    registry_id: definition.id,
    doc_type: 'mini_agent',
    title: definition.name,
    purpose: definition.purpose,
    owner_or_supervisor: definition.parent_supervisor,
    capabilities: [...definition.allowed_tools, ...definition.allowed_skills, ...definition.allowed_models],
    limitations: [...definition.forbidden_tools, ...definition.forbidden_skills, definition.kill_condition],
    required_credentials: {},
    read_enabled: definition.read_enabled,
    write_enabled: definition.write_enabled,
    execution_enabled: definition.execution_enabled,
    requires_bridge_session: definition.bridge_session_required_for_execution,
    blocked_reason: definition.blocked_reason,
    last_verified_at: definition.created_at,
    stale: isStale(definition.created_at, generatedAt, freshnessHours),
    rollback_or_disable_path: 'Expire/archive the mini-agent proposal through Gateway lifecycle policy.',
    documentation_link: `gateway-docs/mini-agents/${definition.id}`,
    secrets_exposed: false,
    owner_visible_summary: `${definition.name} is a ${definition.lifecycle} mini-agent under ${definition.parent_supervisor}.`,
  }
}

function docTypeFromNode(node: GatewayNode): GatewayDocType {
  switch (node.kind) {
    case 'commander':
    case 'lieutenant':
    case 'specialist_agent':
      return 'agent'
    case 'mini_agent':
      return node.visibility === 'archived' ? 'agent' : 'mini_agent'
    case 'skill':
      return 'skill'
    case 'tool':
      return 'tool'
    case 'model':
      return 'model'
    case 'mcp_server':
      return 'mcp_server'
    case 'api':
      return 'integration'
    case 'brain_system':
      return 'brain_system'
    case 'runtime_engine':
      return 'runtime_engine'
    case 'buildwiki_farmer':
      return 'buildwiki_farmer'
    case 'delivery_channel':
      return 'delivery_channel'
    case 'event':
      return 'event'
    case 'gateway':
    case 'owner':
    case 'data_source':
    default:
      return 'gateway'
  }
}

function docTypeFromCapability(capability: GatewayCapability): GatewayDocType {
  switch (capability.kind) {
    case 'agent':
      return 'agent'
    case 'skill':
      return 'skill'
    case 'tool':
      return 'tool'
    case 'model':
      return 'model'
    case 'mcp_server':
      return 'mcp_server'
    case 'api':
      return 'integration'
    case 'brain':
      return 'brain_system'
    case 'integration':
    default:
      return 'integration'
  }
}

function purposeForNode(node: GatewayNode): string {
  if (node.id === 'agent_zero') return 'Commander and default owner-command route.'
  if (node.id === 'hermes') return 'Lieutenant for skill and workflow design.'
  if (node.id === 'pi') return 'Dispatcher candidate in shadow mode.'
  if (node.id === 'space_agent') return 'Browser, web, YouTube, video, crawl, scrape, search, extraction, and Firecrawl research specialist that returns Research Packets through Gateway.'
  if (node.id === 'openclaw_plus') return 'Runtime / skills / adapters / reports / governance / agent execution layer.'
  return `${node.label} Gateway node.`
}

function defaultLimitationsForNode(node: GatewayNode): string[] {
  const limitations = ['No secrets exposed', 'No raw local paths', 'No fake Done']
  if (node.kind !== 'owner' && node.kind !== 'gateway') limitations.push('Actions route through Gateway policy')
  if (node.kind === 'runtime_engine') limitations.push('No Gateway bypass; side effects require Bridge Session')
  if (node.id === 'space_agent') limitations.push('Research-only by default; no external writes, no commander authority, and no Gateway bypass')
  return limitations
}

function rollbackForNode(node: GatewayNode): string {
  if (node.id === 'openclaw_plus' || node.kind === 'buildwiki_farmer') return 'Retain service/data; disable only future Gateway route changes if needed.'
  if (node.id === 'agent_zero') return 'Revert Gateway routing commit; do not create a second Agent Zero.'
  if (node.id === 'space_agent') return 'Disable Space Agent Gateway research routes; retain the external Space Agent checkout and do not delete existing agents.'
  return 'Revert the related Gateway registry/docs change.'
}

function docHasRequiredFields(doc: GatewayDoc): boolean {
  return Boolean(
    doc.id &&
    doc.registry_id &&
    doc.title &&
    doc.purpose &&
    doc.owner_or_supervisor &&
    doc.rollback_or_disable_path &&
    doc.documentation_link &&
    typeof doc.read_enabled === 'boolean' &&
    typeof doc.write_enabled === 'boolean' &&
    typeof doc.execution_enabled === 'boolean' &&
    typeof doc.requires_bridge_session === 'boolean' &&
    Object.prototype.hasOwnProperty.call(doc, 'blocked_reason') &&
    Object.prototype.hasOwnProperty.call(doc, 'last_verified_at')
  )
}

function secretFindingsForDoc(doc: GatewayDoc): Array<{ doc_id: string; concern: string }> {
  const serialized = JSON.stringify(doc)
  const findings: Array<{ doc_id: string; concern: string }> = []
  if (SECRETISH_PATTERN.test(serialized)) findings.push({ doc_id: doc.id, concern: 'secret_like_value' })
  if (RAW_PATH_PATTERN.test(doc.owner_visible_summary) || RAW_PATH_PATTERN.test(doc.documentation_link)) findings.push({ doc_id: doc.id, concern: 'owner_visible_raw_path' })
  return findings
}

function isStale(lastVerifiedAt: string | null, generatedAt: string, freshnessHours = DEFAULT_FRESHNESS_HOURS): boolean {
  if (!lastVerifiedAt) return true
  const last = new Date(lastVerifiedAt).getTime()
  const now = new Date(generatedAt).getTime()
  if (!Number.isFinite(last) || !Number.isFinite(now)) return true
  return now - last > freshnessHours * 60 * 60 * 1000
}
