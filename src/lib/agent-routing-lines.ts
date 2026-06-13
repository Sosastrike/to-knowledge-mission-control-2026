import { createHash, randomUUID } from 'node:crypto'

import { db_helpers, getDatabase, logAuditEvent } from '@/lib/db'
import { mergeTaskMetadataForAgentWorkTicket } from '@/lib/agent-work-tickets'
import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'
import { evaluateOpenCloudAuthority, isOpenCloudIdentity } from '@/lib/opencloud-authority-policy'

export type AgentSystemType =
  | 'commander'
  | 'nuclear_dispatcher'
  | 'advisory_dispatcher'
  | 'company_workforce_system'
  | 'specialist_agent_system'
  | 'brain_intelligence_system'
  | 'browser_control_surface'
  | 'integration_system'
  | 'tool_layer'
  | 'supporting_runtime_system'
  | 'paperclip_company_agent'
  | 'hermes_mini_agent'
  | 'ron_mini_agent'

export type AgentRoutingLine = {
  agent_id: string
  display_name: string
  system_type: AgentSystemType
  communication_route: string
  gateway_route: string
  conversation_owner: string
  reports_to: string | null
  allowed_tools: string[]
  forbidden_intermediaries: string[]
  opencloud_allowed_role: 'supporting_tool_only' | 'not_allowed'
  direct_line_active: boolean
  normal_chat_bridge_required: boolean
  gateway_tools_visible: boolean
  skills_visible: boolean
  mcp_visible: boolean
  models_visible: boolean
  gateway_runtime_visible: boolean
  hidden_intermediary_required: boolean
  dangerous_actions_require_scope: boolean
  credential_values_exposed: false
  last_verified: string
  visible_task_required: true
  audit_required: true
  rollback_required: true
  execution_policy?: string
  company_scope_required?: boolean
  company_slug?: string
  company_name?: string
  role?: string
  allowed_actions?: string[]
  write_policy?: string
  allowed_as_tool?: boolean
  allowed_as_intermediary?: boolean
  allowed_as_commander?: boolean
  blocker?: string | null
}

type AgentRoutingLineTemplate = Omit<AgentRoutingLine, 'last_verified'>

export type AgentMessageEnvelope = {
  message_id: string
  conversation_id: string
  owner_id_redacted: string
  source_channel: string
  target_agent: string
  target_system: string
  conversation_owner: string
  original_message_hash: string
  normalized_request: string
  direct_line_used: boolean
  route_trace: string[]
  intermediaries: string[]
  delegated_to: string[]
  delegations: string[]
  tools_called: string[]
  opencloud_used: boolean
  opencloud_role: 'supporting_tool_only' | 'not_used' | 'forbidden_hidden_intermediary'
  visible_task_id: string | null
  audit_id: string | null
  rollback_id: string | null
}

export type AgentRoutingBlocker =
  | 'agent_direct_line_missing_visible_ticket_required'
  | 'opencloud_is_supporting_runtime_not_commander'
  | 'opencloud_hidden_intermediary_forbidden'
  | 'hidden_intermediary_forbidden'

export type AgentRoutingSendInput = {
  source_channel?: string
  owner_id_redacted?: string
  target_agent?: string
  target_system?: string
  message?: string
  normalized_request?: string
  conversation_id?: string
  intermediaries?: unknown
  tools_called?: unknown
  delegated_to?: unknown
  opencloud_role?: string | null
  visible_task_id?: string | number | null
}

function line(input: Omit<AgentRoutingLineTemplate,
  | 'visible_task_required'
  | 'audit_required'
  | 'rollback_required'
  | 'forbidden_intermediaries'
  | 'opencloud_allowed_role'
  | 'normal_chat_bridge_required'
  | 'gateway_tools_visible'
  | 'skills_visible'
  | 'mcp_visible'
  | 'models_visible'
  | 'gateway_runtime_visible'
  | 'hidden_intermediary_required'
  | 'dangerous_actions_require_scope'
  | 'credential_values_exposed'
> & {
  forbidden_intermediaries?: string[]
  opencloud_allowed_role?: AgentRoutingLine['opencloud_allowed_role']
  normal_chat_bridge_required?: boolean
  gateway_tools_visible?: boolean
  skills_visible?: boolean
  mcp_visible?: boolean
  models_visible?: boolean
  gateway_runtime_visible?: boolean
  hidden_intermediary_required?: boolean
  dangerous_actions_require_scope?: boolean
}): AgentRoutingLineTemplate {
  const directVisibility = input.direct_line_active
  return {
    ...input,
    forbidden_intermediaries: input.forbidden_intermediaries || ['opencloud', 'openclaw', 'openclaw_plus', 'claudeclaw'],
    opencloud_allowed_role: input.opencloud_allowed_role || 'supporting_tool_only',
    normal_chat_bridge_required: input.normal_chat_bridge_required ?? false,
    gateway_tools_visible: input.gateway_tools_visible ?? directVisibility,
    skills_visible: input.skills_visible ?? directVisibility,
    mcp_visible: input.mcp_visible ?? directVisibility,
    models_visible: input.models_visible ?? directVisibility,
    gateway_runtime_visible: input.gateway_runtime_visible ?? directVisibility,
    hidden_intermediary_required: input.hidden_intermediary_required ?? false,
    dangerous_actions_require_scope: input.dangerous_actions_require_scope ?? true,
    credential_values_exposed: false,
    visible_task_required: true,
    audit_required: true,
    rollback_required: true,
  }
}

const CORE_LINES: AgentRoutingLineTemplate[] = [
  line({
    agent_id: 'agent-zero-jarvis',
    display_name: 'Agent Zero / Jarvis',
    system_type: 'commander',
    communication_route: '/api/bridge/agent-zero/*',
    gateway_route: '/api/bridge/agent-zero/*',
    conversation_owner: 'agent-zero-jarvis',
    reports_to: 'owner',
    allowed_tools: ['certified_exact_scope_adapters', 'gateway_tools', 'brain_bridge', 'public_read_only_tools'],
    direct_line_active: true,
    execution_policy: 'commander_owner_operator_exact_scope_only',
  }),
  line({
    agent_id: 'hermes',
    display_name: RON_WEASLEY_IDENTITY.full_title,
    system_type: 'nuclear_dispatcher',
    communication_route: '/api/bridge/hermes/*',
    gateway_route: '/api/bridge/hermes/*',
    conversation_owner: 'ron-weasley',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['gateway_tools', 'brain_bridge', 'mini_agent_market', 'jarvis_delegated_exact_scope_adapters'],
    direct_line_active: true,
    execution_policy: 'full_visibility_jarvis_delegation_required_for_writes',
  }),
  line({
    agent_id: 'hermes-webui',
    display_name: 'Ron Weasley WebUI',
    system_type: 'browser_control_surface',
    communication_route: '/api/bridge/hermes-webui/*',
    gateway_route: '/api/bridge/hermes-webui/status',
    conversation_owner: 'ron-weasley',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['hermes_status_read', 'hermes_readiness_read', 'hermes_internal_drafts', 'jarvis_concurrence_request'],
    direct_line_active: true,
    execution_policy: 'browser_surface_only_production_actions_require_jarvis_concurrence',
    blocker: 'hermes_agent_checkout_or_config_required_for_full_agent_features',
  }),
  line({
    agent_id: 'pi',
    display_name: 'Pi',
    system_type: 'specialist_agent_system',
    communication_route: '/api/bridge/pi/*',
    gateway_route: '/api/bridge/pi/*',
    conversation_owner: 'pi',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: [
      'gateway_tools',
      'skills_registry',
      'mcp_tool_layer',
      'provider_model_layer',
      'brain_bridge',
      'paperclip_read_only_inventory',
      'spaceagent_research_readiness',
      'direct_line_recommendations',
      'exact_scope_adapter_requests',
    ],
    direct_line_active: true,
    execution_policy: 'direct_gateway_agent_exact_scope_for_dangerous_actions',
  }),
  line({
    agent_id: 'paperclip',
    display_name: 'Paperclip Workforce System',
    system_type: 'company_workforce_system',
    communication_route: '/api/bridge/paperclip/*',
    gateway_route: '/api/bridge/paperclip/*',
    conversation_owner: 'paperclip',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['paperclip_read_only_inventory', 'paperclip_exact_scope_adapters'],
    direct_line_active: true,
    company_scope_required: true,
    execution_policy: 'direct_gateway_workforce_agent_exact_scope_for_writes',
    blocker: 'paperclip_board_admin_credential_required_for_company_bootstrap',
  }),
  line({
    agent_id: 'spaceagent',
    display_name: 'SpaceAgent',
    system_type: 'specialist_agent_system',
    communication_route: '/api/bridge/space-agent/*',
    gateway_route: '/api/bridge/space-agent/*',
    conversation_owner: 'spaceagent',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: [
      'gateway_tools',
      'skills_registry',
      'mcp_tool_layer',
      'provider_model_layer',
      'playwright_mcp_local_only',
      'read_only_research',
      'firecrawl_readiness',
      'youtube_transcript_readiness',
      'exact_scope_browser_action_requests',
    ],
    direct_line_active: true,
    execution_policy: 'direct_gateway_research_agent_exact_scope_for_browser_actions',
  }),
  line({
    agent_id: 'brain-sync',
    display_name: 'Brain Bridge Mode',
    system_type: 'brain_intelligence_system',
    communication_route: '/api/bridge/brain-sync/*',
    gateway_route: '/api/bridge/brain-sync/gateway-status',
    conversation_owner: 'brain-sync',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['brain.status.read', 'brain.memory.read', 'brain.memory.propose_write'],
    direct_line_active: true,
    execution_policy: 'memory_writes_approval_gated',
  }),
  line({
    agent_id: 'agentmail',
    display_name: 'AgentMail',
    system_type: 'integration_system',
    communication_route: '/api/bridge/agentmail-readiness',
    gateway_route: '/api/bridge/agentmail-readiness',
    conversation_owner: 'agentmail',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['agentmail.readiness.read', 'agentmail.draft_exact_scope'],
    direct_line_active: true,
    execution_policy: 'draft_only_until_certified_send_scope',
  }),
  line({
    agent_id: 'build-wiki-farmer',
    display_name: 'Build-Wiki / Farmer',
    system_type: 'integration_system',
    communication_route: '/api/bridge/brain-sync/build-wiki/*',
    gateway_route: '/api/bridge/brain-sync/build-wiki/status',
    conversation_owner: 'build-wiki-farmer',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['brain.buildwiki.status', 'brain.buildwiki.run_now_approval', 'brain.buildwiki.events'],
    direct_line_active: true,
    execution_policy: 'run_now_bridge_gated_opencloud_docs_farmer_scope_only',
  }),
  line({
    agent_id: 'obsidian',
    display_name: 'Obsidian',
    system_type: 'brain_intelligence_system',
    communication_route: '/api/bridge/brain-sync/obsidian/status',
    gateway_route: '/api/bridge/brain-sync/obsidian/status',
    conversation_owner: 'obsidian',
    reports_to: 'brain-sync',
    allowed_tools: ['brain.obsidian.read', 'brain.obsidian.write_gated'],
    direct_line_active: true,
    execution_policy: 'read_status_live_writes_approval_gated',
  }),
  line({
    agent_id: 'mempalace',
    display_name: 'MemPalace',
    system_type: 'brain_intelligence_system',
    communication_route: '/api/bridge/brain-sync/mempalace/status',
    gateway_route: '/api/bridge/brain-sync/mempalace/status',
    conversation_owner: 'mempalace',
    reports_to: 'brain-sync',
    allowed_tools: ['brain.mempalace.read', 'brain.mempalace.write_gated'],
    direct_line_active: true,
    execution_policy: 'read_status_live_writes_approval_gated',
  }),
  line({
    agent_id: 'graphify',
    display_name: 'Graphify',
    system_type: 'brain_intelligence_system',
    communication_route: '/api/bridge/brain-sync/graphify/status',
    gateway_route: '/api/bridge/brain-sync/graphify/status',
    conversation_owner: 'graphify',
    reports_to: 'brain-sync',
    allowed_tools: ['brain.graphify.read', 'brain.graphify.event_stream'],
    direct_line_active: true,
    execution_policy: 'read_status_live_event_stream_required_for_ready',
  }),
  line({
    agent_id: 'memory-approvals',
    display_name: 'Memory Approvals',
    system_type: 'brain_intelligence_system',
    communication_route: '/api/bridge/brain-sync/memory-approvals/status',
    gateway_route: '/api/bridge/brain-sync/memory-approvals/status',
    conversation_owner: 'memory-approvals',
    reports_to: 'brain-sync',
    allowed_tools: ['brain.memory_approvals.read', 'brain.memory_approvals.write_gated'],
    direct_line_active: true,
    execution_policy: 'approval_status_live_memory_writes_gated',
  }),
  line({
    agent_id: 'n8n',
    display_name: 'n8n',
    system_type: 'integration_system',
    communication_route: '/api/bridge/connector-readiness?connector=n8n',
    gateway_route: '/api/bridge/connector-readiness',
    conversation_owner: 'n8n',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['n8n.workflow.inventory.read'],
    direct_line_active: true,
    execution_policy: 'read_only_until_exact_scope_activation',
  }),
  line({
    agent_id: 'zapier',
    display_name: 'Zapier',
    system_type: 'integration_system',
    communication_route: '/api/bridge/zapier/*',
    gateway_route: '/api/bridge/zapier/status',
    conversation_owner: 'zapier',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['zapier.approved_actions.read', 'zapier.tools.search'],
    direct_line_active: true,
    execution_policy: 'approved_actions_only_broad_execution_blocked',
  }),
  line({
    agent_id: 'google-drive',
    display_name: 'Google Drive',
    system_type: 'integration_system',
    communication_route: '/api/bridge/google-drive-readiness',
    gateway_route: '/api/bridge/google-drive-readiness',
    conversation_owner: 'google-drive',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['drive.approved_folder.list', 'drive.approved_folder.upload_exact_scope'],
    direct_line_active: true,
    execution_policy: 'approved_folder_exact_scope_only',
  }),
  line({
    agent_id: 'onedrive',
    display_name: 'OneDrive',
    system_type: 'integration_system',
    communication_route: '/api/bridge/onedrive-readiness',
    gateway_route: '/api/bridge/onedrive-readiness',
    conversation_owner: 'onedrive',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['onedrive.readiness.read'],
    direct_line_active: true,
    execution_policy: 'readiness_only_until_owner_reopens',
    blocker: 'onedrive_unavailable_not_counted_until_owner_reopens',
  }),
  line({
    agent_id: 'webhooks',
    display_name: 'Webhooks',
    system_type: 'integration_system',
    communication_route: '/api/webhooks',
    gateway_route: '/api/webhooks',
    conversation_owner: 'webhooks',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['webhook.registry.read', 'webhook.local_ping_exact_scope'],
    direct_line_active: true,
    execution_policy: 'local_or_exact_scope_only',
  }),
  line({
    agent_id: 'scheduler',
    display_name: 'Scheduler',
    system_type: 'integration_system',
    communication_route: '/api/scheduler',
    gateway_route: '/api/scheduler',
    conversation_owner: 'scheduler',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['scheduler.status.read', 'scheduler.run_exact_scope'],
    direct_line_active: true,
    execution_policy: 'exact_scope_only_duplicate_loop_guard_required',
  }),
  line({
    agent_id: 'mcp-tool-layer',
    display_name: 'MCP Tool Layer',
    system_type: 'tool_layer',
    communication_route: '/api/bridge/providers',
    gateway_route: '/api/bridge/providers',
    conversation_owner: 'mcp-tool-layer',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['mcp.schema.read', 'mcp.tool_exact_scope'],
    direct_line_active: true,
    execution_policy: 'schema_read_visible_exact_scope_execution_only',
  }),
  line({
    agent_id: 'provider-model-layer',
    display_name: 'Provider / Model Layer',
    system_type: 'tool_layer',
    communication_route: '/api/bridge/providers',
    gateway_route: '/api/bridge/providers',
    conversation_owner: 'provider-model-layer',
    reports_to: 'agent-zero-jarvis',
    allowed_tools: ['provider.status.read', 'model.route.recommend'],
    direct_line_active: true,
    execution_policy: 'read_and_recommend_no_secret_exposure',
  }),
]

const PAPERCLIP_COMPANY_AGENT_LINES = [
  ['paperclip.eco.ceo', 'E copier Solutions CEO', 'eco', 'E copier Solutions', 'CEO'],
  ['paperclip.eco.cmo', 'E copier Solutions CMO', 'eco', 'E copier Solutions', 'CMO'],
  ['paperclip.eco.cto', 'E copier Solutions CTO', 'eco', 'E copier Solutions', 'CTO'],
  ['paperclip.eco.avatar-specialist', 'E copier Solutions Avatar Specialist', 'eco', 'E copier Solutions', 'Avatar Specialist'],
  ['paperclip.eco.field-service-advisor', 'E copier Solutions Field Service Advisor', 'eco', 'E copier Solutions', 'Field Service Advisor'],
  ['paperclip.eco.social-coordinator', 'E copier Solutions Social Coordinator', 'eco', 'E copier Solutions', 'Social Coordinator'],
  ['paperclip.eco.video-producer', 'E copier Solutions Video Producer', 'eco', 'E copier Solutions', 'Video Producer'],
  ['paperclip.pacman-cybersecurity.ceo', 'Pacman Cybersecurity CEO', 'pacman-cybersecurity', 'Pacman Cybersecurity', 'Cybersecurity CEO'],
].map(([agent_id, display_name, company_slug, company_name, role]) => line({
  agent_id,
  display_name,
  system_type: 'paperclip_company_agent',
  communication_route: `/api/bridge/paperclip/agents?company=${company_slug}`,
  gateway_route: '/api/bridge/paperclip/agent-context',
  conversation_owner: agent_id,
  reports_to: 'paperclip',
  allowed_tools: ['paperclip.company_agent.read', 'paperclip.company_agent.exact_scope_write'],
  direct_line_active: true,
  company_scope_required: true,
  company_slug,
  company_name,
  role,
  allowed_actions: ['read_status', 'read_context', 'draft_recommendation', 'request_exact_scope_write'],
  write_policy: 'jarvis_delegated_company_scope_required',
  execution_policy: `company_scope_required:${company_slug}:${role}`,
  blocker: company_slug === 'pacman-cybersecurity' ? 'paperclip_board_admin_credential_required' : null,
}))

const HERMES_MINI_AGENT_LINES = [
  ['hermes-mini-agent.researcher', 'Ron Weasley Mini-Agent Researcher', 'safe_research'],
  ['hermes-mini-agent.classifier', 'Ron Weasley Mini-Agent Classifier', 'safe_classification'],
  ['hermes-mini-agent.workflow-drafter', 'Ron Weasley Mini-Agent Workflow Drafter', 'workflow_draft'],
].map(([agent_id, display_name, scope]) => line({
  agent_id,
  display_name,
  system_type: 'hermes_mini_agent',
  communication_route: '/api/bridge/hermes/mini-agent-registry',
  gateway_route: '/api/bridge/hermes/mini-agent-registry',
  conversation_owner: agent_id,
  reports_to: 'hermes',
  allowed_tools: ['safe_internal_work', scope],
  direct_line_active: true,
  execution_policy: 'parent_hermes_final_authority_agent_zero_no_secrets_no_production_writes',
}))

const OPENCLOUD_LINE = line({
  agent_id: 'opencloud',
  display_name: 'OpenCloud / OpenClaw+ Supporting Runtime',
  system_type: 'supporting_runtime_system',
  communication_route: '/api/openclaw-plus/status',
  gateway_route: '/api/openclaw-plus/status',
  conversation_owner: 'none',
  reports_to: 'mission-control-gateway',
  allowed_tools: ['diagnostics_when_invoked', 'supporting_runtime_execution_when_exact_scope_certified'],
  forbidden_intermediaries: ['opencloud', 'openclaw', 'openclaw_plus', 'claudeclaw'],
  opencloud_allowed_role: 'not_allowed',
  direct_line_active: false,
  execution_policy: 'supporting_runtime_tool_provider_only',
  allowed_as_tool: true,
  allowed_as_intermediary: false,
  allowed_as_commander: false,
})

export function listAgentRoutingLines(generatedAt = new Date().toISOString()): AgentRoutingLine[] {
  return [...CORE_LINES, ...PAPERCLIP_COMPANY_AGENT_LINES, ...HERMES_MINI_AGENT_LINES, OPENCLOUD_LINE]
    .map((item) => ({ ...item, last_verified: generatedAt }))
}

function normalizeAgentId(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[@]/g, '').replace(/[_\s]+/g, '-')
}

export function resolveAgentRoutingLine(value: unknown): AgentRoutingLine | null {
  const id = normalizeAgentId(value)
  const aliases: Record<string, string> = {
    jarvis: 'agent-zero-jarvis',
    'agent-zero': 'agent-zero-jarvis',
    agentzero: 'agent-zero-jarvis',
    'agent-0': 'agent-zero-jarvis',
    jarvis88sbot: 'agent-zero-jarvis',
    'jarvis-88sbot': 'agent-zero-jarvis',
    'jarvis-88-bot': 'agent-zero-jarvis',
    brain: 'brain-sync',
    'brain-bridge': 'brain-sync',
    'brain-bridge-mode': 'brain-sync',
    buildwiki: 'build-wiki-farmer',
    'build-wiki': 'build-wiki-farmer',
    farmer: 'build-wiki-farmer',
    'memory-approval': 'memory-approvals',
    'memory-approvals': 'memory-approvals',
    graph: 'graphify',
    'mem-palace': 'mempalace',
    agentmail: 'agentmail',
    'agent-mail': 'agentmail',
    drive: 'google-drive',
    'google-drive': 'google-drive',
    'google-drive-readiness': 'google-drive',
    'one-drive': 'onedrive',
    mcp: 'mcp-tool-layer',
    'mcp-tools': 'mcp-tool-layer',
    providers: 'provider-model-layer',
    models: 'provider-model-layer',
    'model-layer': 'provider-model-layer',
    ron: 'hermes',
    'ron-weasley': 'hermes',
    'ron-weasley-nuclear-dispatcher': 'hermes',
    hermans: 'hermes',
    'pi-dispatcher': 'pi',
    'space-agent': 'spaceagent',
    openclaw: 'opencloud',
    'openclaw+': 'opencloud',
    'openclaw-plus': 'opencloud',
    opencloud: 'opencloud',
  }
  const wanted = aliases[id] || id
  return listAgentRoutingLines().find((item) => item.agent_id === wanted) || null
}

export function buildAgentRoutingLinesStatus() {
  const generatedAt = new Date().toISOString()
  const lines = listAgentRoutingLines(generatedAt)
  return {
    route: 'bridge.agent-routing.lines',
    mode: 'universal_direct_agent_lines',
    status: 'UNIVERSAL_DIRECT_AGENT_LINES_POLICY',
    generated_at: generatedAt,
    opencloud_demoted_to_supporting_runtime: true,
    hidden_intermediaries_allowed: false,
    normal_chat_bridge_required: false,
    gateway_tools_visible: true,
    skills_visible: true,
    mcp_visible: true,
    models_visible: true,
    gateway_runtime_visible: true,
    dangerous_actions_require_scope: true,
    credential_values_exposed: false,
    no_secrets_exposed: true,
    project_continues: true,
    lines_count: lines.length,
    lines,
    by_id: Object.fromEntries(lines.map((item) => [item.agent_id, item])),
    edges: lines
      .filter((item) => item.direct_line_active)
      .map((item) => ({
        source: item.reports_to || 'owner',
        target: item.agent_id,
        route: item.gateway_route,
        direct_line: true,
        opencloud_intermediary: false,
      })),
  }
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

export function routeTraceForLine(line: AgentRoutingLine): string[] {
  const base = ['owner', 'mission_control_gateway']

  if (line.system_type === 'paperclip_company_agent') {
    return [
      ...base,
      'paperclip',
      line.company_slug ? `paperclip.company.${line.company_slug}` : 'paperclip.company',
      line.agent_id,
    ]
  }

  if (line.system_type === 'hermes_mini_agent') return [...base, 'hermes', line.agent_id]
  if (line.agent_id === 'hermes-webui') return [...base, 'hermes', 'hermes-webui']
  if (line.reports_to === 'brain-sync') return [...base, 'brain-sync', line.agent_id]

  return [...base, line.agent_id]
}

export function buildAgentMessageEnvelope(input: AgentRoutingSendInput, line: AgentRoutingLine, ids: {
  visible_task_id?: string | null
  audit_id?: string | null
  rollback_id?: string | null
} = {}): AgentMessageEnvelope {
  const normalized = String(input.normalized_request || input.message || '').trim()
  const targetSystem = String(input.target_system || line.agent_id)
  const toolsCalled = asStringArray(input.tools_called)
  const delegatedTo = asStringArray(input.delegated_to)
  const intermediaries = asStringArray(input.intermediaries)
  const opencloudIntermediary = intermediaries.some(isOpenCloudIdentity)
  const opencloudUsed = opencloudIntermediary || toolsCalled.some(isOpenCloudIdentity) || delegatedTo.some(isOpenCloudIdentity)
  return {
    message_id: `msg_${randomUUID()}`,
    conversation_id: String(input.conversation_id || `conv_${hashText(`${line.agent_id}:${normalized}`).slice(0, 16)}`),
    owner_id_redacted: String(input.owner_id_redacted || 'owner_redacted'),
    source_channel: String(input.source_channel || 'mission_control_gateway'),
    target_agent: line.agent_id,
    target_system: targetSystem,
    conversation_owner: line.conversation_owner,
    original_message_hash: hashText(String(input.message || normalized)),
    normalized_request: normalized,
    direct_line_used: line.direct_line_active && intermediaries.length === 0,
    route_trace: routeTraceForLine(line),
    intermediaries,
    delegated_to: delegatedTo,
    delegations: delegatedTo,
    tools_called: toolsCalled,
    opencloud_used: opencloudUsed,
    opencloud_role: opencloudIntermediary ? 'forbidden_hidden_intermediary' : opencloudUsed ? 'supporting_tool_only' : 'not_used',
    visible_task_id: ids.visible_task_id || null,
    audit_id: ids.audit_id || null,
    rollback_id: ids.rollback_id || null,
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function metadataString(metadata: Record<string, unknown>, key: string, fallback: string | null = null): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function metadataNumber(metadata: Record<string, unknown>, key: string, fallback: number): number {
  const value = Number(metadata[key])
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback
}

function metadataStringArray(metadata: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const value = metadata[key]
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

function defaultProjectId(db: ReturnType<typeof getDatabase>, workspaceId: number) {
  const project = db.prepare(`
    SELECT id FROM projects
    WHERE workspace_id = ? AND status = 'active'
    ORDER BY CASE WHEN slug = 'general' THEN 0 ELSE 1 END, id ASC
    LIMIT 1
  `).get(workspaceId) as { id?: number } | undefined
  return project?.id || null
}

export function ensureAgentRoutingVisibleTask(input: {
  title: string
  description: string
  assigned_to: string
  blocker?: string | null
  workspace_id?: number
  metadata?: Record<string, unknown>
}) {
  const db = getDatabase()
  const workspaceId = input.workspace_id || 1
  const now = Math.floor(Date.now() / 1000)
  const existing = db.prepare(`
    SELECT * FROM tasks
    WHERE workspace_id = ? AND title = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(workspaceId, input.title) as { id: number; metadata?: string } | undefined

  const taskId = existing?.id || Number(db.prepare(`
    INSERT INTO tasks (
      title, description, status, priority, project_id, assigned_to, created_by,
      created_at, updated_at, tags, metadata, workspace_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.title,
    input.description,
    input.blocker ? 'awaiting_owner' : 'in_progress',
    'high',
    defaultProjectId(db, workspaceId),
    input.assigned_to,
    'agent-routing',
    now,
    now,
    JSON.stringify(['agent-routing', 'direct-line']),
    JSON.stringify(input.metadata || {}),
    workspaceId,
  ).lastInsertRowid)

  const metadataInput = input.metadata || {}
  const metadata = mergeTaskMetadataForAgentWorkTicket(
    {
      ...parseJsonObject(existing?.metadata),
      ...metadataInput,
    },
    {
      ticket_id: String(taskId),
      task_title: input.title,
      assigned_agent: input.assigned_to,
      agent_runtime: metadataString(metadataInput, 'agent_runtime', 'Mission Control Gateway direct-line router') || 'Mission Control Gateway direct-line router',
      current_status: metadataString(metadataInput, 'current_status', input.blocker ? 'awaiting_owner' : 'in_progress') || (input.blocker ? 'awaiting_owner' : 'in_progress'),
      current_phase: metadataString(metadataInput, 'current_phase', input.blocker ? 'Direct-line blocker isolated' : 'Direct-line route traced'),
      progress_percent: metadataNumber(metadataInput, 'progress', input.blocker ? 75 : 90),
      delivery_state: metadataString(metadataInput, 'delivery_state', input.blocker ? 'VISIBLE_BLOCKER_CREATED' : 'DIRECT_LINE_TRACE_RECORDED') || (input.blocker ? 'VISIBLE_BLOCKER_CREATED' : 'DIRECT_LINE_TRACE_RECORDED'),
      blocker: input.blocker || null,
      current_blocker: input.blocker || null,
      next_action: metadataString(metadataInput, 'next_action', input.blocker ? 'Resolve the exact direct-line blocker through Mission Control Gateway policy.' : 'Continue certified exact-scope route execution.'),
      proof_visible_to_owner: true,
      proof_records: metadataStringArray(metadataInput, 'proof_records', ['/api/bridge/agent-routing/lines', `/api/tasks/${taskId}`]),
      audit_records: [`agent-routing:${hashText(`${taskId}:${input.title}`).slice(0, 16)}`],
      rollback_path: metadataString(metadataInput, 'rollback_path', 'No external mutation occurred; archive this Mission Control task to roll back the visible proof record.'),
      blocked_lane: input.blocker ? metadataString(metadataInput, 'blocked_lane', 'direct_agent_line') : metadataString(metadataInput, 'blocked_lane', null),
      affected_system: metadataString(metadataInput, 'affected_system', 'Mission Control Gateway agent routing'),
      needed_to_unblock: input.blocker ? metadataString(metadataInput, 'needed_to_unblock', 'Use a registered direct line and remove OpenCloud/OpenClaw as hidden intermediary.') : metadataString(metadataInput, 'needed_to_unblock', null),
      blocker_reason: input.blocker || null,
      continued_work: metadataStringArray(metadataInput, 'continued_work', ['All unrelated safe source, route, registry, and test lanes continue.']),
      next_safe_lane: metadataString(metadataInput, 'next_safe_lane', 'Continue direct-line registry and Gateway UI enforcement.'),
      project_continues: true,
      mutation_occurred: false,
    },
    new Date(now * 1000).toISOString(),
  )

  db.prepare(`
    UPDATE tasks
    SET description = ?, status = ?, assigned_to = ?, metadata = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(
    input.description,
    input.blocker ? 'awaiting_owner' : 'in_progress',
    input.assigned_to,
    JSON.stringify(metadata),
    now,
    taskId,
    workspaceId,
  )

  db_helpers.logActivity(
    input.blocker ? 'BLOCKER_FOUND' : 'ROUTE_PROBED',
    'task',
    taskId,
    'agent-routing',
    input.blocker ? `Direct-line blocker: ${input.blocker}` : `Direct line traced: ${input.title}`,
    {
      route_api_touched: '/api/bridge/agent-routing/send',
      blocker: input.blocker || null,
      proof_link_or_id: `/api/tasks/${taskId}`,
      status: input.blocker ? 'awaiting_owner' : 'in_progress',
    },
    workspaceId,
  )

  return { task_id: taskId, metadata }
}

function buildAgentRoutingNoStateProof(input: {
  rollback_id: string
  blocker: AgentRoutingBlocker | 'none'
  requested_target: string | null
}) {
  return {
    rollback_id: input.rollback_id,
    mutation_scope: 'mission_control_task_and_agent_routing_trace_only',
    requested_target: input.requested_target,
    blocker: input.blocker,
    external_writes_enabled: false,
    production_write_allowed: false,
    opencloud_commander_allowed: false,
    hidden_intermediary_allowed: false,
    credential_values_exposed: false,
  }
}

function buildAgentRoutingProof(
  kind: string,
  requestedTarget: string | null,
  blocker: AgentRoutingBlocker | 'none' = 'none',
) {
  const proofSeed = `${kind}:${requestedTarget || 'unknown'}:${Date.now()}:${randomUUID()}`
  const auditId = `audit_${hashText(proofSeed).slice(0, 20)}`
  const rollbackId = `no_state_${hashText(`${auditId}:rollback`).slice(0, 20)}`
  return {
    auditId,
    rollbackId,
    rollbackNoStateProof: buildAgentRoutingNoStateProof({
      rollback_id: rollbackId,
      blocker,
      requested_target: requestedTarget,
    }),
  }
}

function visibleTaskProofRoutes(taskId: number | string) {
  return {
    owner_visible_task_route: `/api/tasks/${taskId}`,
    visible_task_event_route: `/api/tasks/${taskId}/events`,
  }
}

export function routeAgentMessage(input: AgentRoutingSendInput = {}) {
  const requestedTarget = String(input.target_agent || '').trim()
  const line = resolveAgentRoutingLine(requestedTarget)
  const baseTitle = 'OpenCloud Privilege Demotion + Direct Agent Lines'
  const requestedIntermediaries = asStringArray(input.intermediaries)

  if (!requestedTarget || !line) {
    const proof = buildAgentRoutingProof(
      'missing_direct_line',
      requestedTarget || null,
      'agent_direct_line_missing_visible_ticket_required',
    )
    const task = ensureAgentRoutingVisibleTask({
      title: `${baseTitle}: missing direct line`,
      description: `Target "${requestedTarget || 'unknown'}" has no registered direct Mission Control Gateway line.`,
      assigned_to: 'agent-zero-jarvis',
      blocker: 'agent_direct_line_missing_visible_ticket_required',
      metadata: {
        requested_target: requestedTarget || null,
        audit_id: proof.auditId,
        rollback_id: proof.rollbackId,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        proof_records: ['/api/bridge/agent-routing/send', '/api/bridge/agent-routing/lines'],
      },
    })

    logAuditEvent({
      action: 'agent_routing.missing_direct_line_blocked',
      actor: 'agent-zero-jarvis',
      target_type: 'agent_line',
      target_id: Number(task.task_id),
      detail: {
        requested_target: requestedTarget || null,
        blocker: 'agent_direct_line_missing_visible_ticket_required',
        audit_id: proof.auditId,
        rollback_id: proof.rollbackId,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        credential_values_exposed: false,
      },
    })

    return {
      ok: false,
      route: 'bridge.agent-routing.send',
      exact_blocker: 'agent_direct_line_missing_visible_ticket_required',
      visible_task_id: String(task.task_id),
      ...visibleTaskProofRoutes(task.task_id),
      audit_id: proof.auditId,
      rollback_id: proof.rollbackId,
      rollback_no_state_proof: proof.rollbackNoStateProof,
      project_continues: true,
      credential_values_exposed: false,
    }
  }

  if (isOpenCloudIdentity(line.agent_id)) {
    const proof = buildAgentRoutingProof(
      'opencloud_commander_refused',
      requestedTarget,
      'opencloud_is_supporting_runtime_not_commander',
    )
    const task = ensureAgentRoutingVisibleTask({
      title: `${baseTitle}: OpenCloud commander refusal`,
      description: 'OpenCloud/OpenClaw was selected as an agent or commander. It is supporting runtime/tool-only.',
      assigned_to: 'agent-zero-jarvis',
      blocker: 'opencloud_is_supporting_runtime_not_commander',
      metadata: {
        requested_target: requestedTarget,
        line,
        audit_id: proof.auditId,
        rollback_id: proof.rollbackId,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        proof_records: ['/api/bridge/agent-routing/send', '/api/bridge/agent-routing/lines'],
      },
    })

    logAuditEvent({
      action: 'agent_routing.opencloud_commander_refused',
      actor: 'agent-zero-jarvis',
      target_type: 'agent_line',
      target_id: Number(task.task_id),
      detail: {
        requested_target: requestedTarget,
        line,
        blocker: 'opencloud_is_supporting_runtime_not_commander',
        audit_id: proof.auditId,
        rollback_id: proof.rollbackId,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        credential_values_exposed: false,
      },
    })

    return {
      ok: false,
      route: 'bridge.agent-routing.send',
      exact_blocker: 'opencloud_is_supporting_runtime_not_commander',
      visible_task_id: String(task.task_id),
      ...visibleTaskProofRoutes(task.task_id),
      audit_id: proof.auditId,
      rollback_id: proof.rollbackId,
      rollback_no_state_proof: proof.rollbackNoStateProof,
      project_continues: true,
      credential_values_exposed: false,
    }
  }

  if (requestedIntermediaries.length > 0) {
    const blocker: AgentRoutingBlocker = requestedIntermediaries.some(isOpenCloudIdentity)
      ? 'opencloud_hidden_intermediary_forbidden'
      : 'hidden_intermediary_forbidden'
    const proof = buildAgentRoutingProof('hidden_intermediary_refused', line.agent_id, blocker)
    const task = ensureAgentRoutingVisibleTask({
      title: `${baseTitle}: hidden intermediary refusal`,
      description: `Owner request for ${line.display_name} included a hidden intermediary. Owner traffic must use Owner → Mission Control Gateway → Target Agent.`,
      assigned_to: line.agent_id,
      blocker,
      metadata: {
        requested_target: requestedTarget,
        target_agent: line.agent_id,
        intermediaries: requestedIntermediaries,
        direct_line_required: true,
        tools_called_allowed_path: 'tools_called',
        line,
        audit_id: proof.auditId,
        rollback_id: proof.rollbackId,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        proof_records: ['/api/bridge/agent-routing/send', '/api/bridge/agent-routing/lines'],
      },
    })
    const envelope = buildAgentMessageEnvelope(input, line, {
      visible_task_id: String(task.task_id),
      audit_id: proof.auditId,
      rollback_id: proof.rollbackId,
    })

    logAuditEvent({
      action: 'agent_routing.hidden_intermediary_refused',
      actor: line.agent_id,
      target_type: 'agent_line',
      target_id: Number(task.task_id),
      detail: {
        envelope,
        blocker,
        rollback_no_state_proof: proof.rollbackNoStateProof,
        credential_values_exposed: false,
      },
    })

    return {
      ok: false,
      route: 'bridge.agent-routing.send',
      exact_blocker: blocker,
      envelope,
      visible_task_id: envelope.visible_task_id,
      audit_id: envelope.audit_id,
      rollback_id: envelope.rollback_id,
      ...visibleTaskProofRoutes(task.task_id),
      rollback_no_state_proof: proof.rollbackNoStateProof,
      project_continues: true,
      credential_values_exposed: false,
    }
  }

  const task = ensureAgentRoutingVisibleTask({
    title: `${baseTitle}: ${line.display_name}`,
    description: `Owner request routed directly to ${line.display_name} through ${line.gateway_route}.`,
    assigned_to: line.agent_id,
    metadata: { line },
  })
  const auditId = `audit_${hashText(`${line.agent_id}:${task.task_id}:${Date.now()}`).slice(0, 20)}`
  const rollbackId = `no_state_${hashText(`${task.task_id}:${line.agent_id}`).slice(0, 20)}`
  const envelope = buildAgentMessageEnvelope(input, line, {
    visible_task_id: String(task.task_id),
    audit_id: auditId,
    rollback_id: rollbackId,
  })

  const policy = evaluateOpenCloudAuthority({
    target_agent: envelope.target_agent,
    conversation_owner: envelope.conversation_owner,
    invoked_by: envelope.opencloud_used ? envelope.target_agent : null,
    opencloud_role: envelope.opencloud_role,
    visible_task_id: envelope.visible_task_id,
    audit_id: envelope.audit_id,
    rollback_id: envelope.rollback_id,
    direct_line_used: envelope.direct_line_used,
    hidden_intermediary: envelope.intermediaries.some(isOpenCloudIdentity),
  })

  if (!policy.allowed && envelope.opencloud_used) {
    return {
      ok: false,
      route: 'bridge.agent-routing.send',
      exact_blocker: policy.exact_blocker,
      envelope,
      visible_task_id: envelope.visible_task_id,
      project_continues: true,
      credential_values_exposed: false,
    }
  }
  if (envelope.intermediaries.some(isOpenCloudIdentity)) {
    return {
      ok: false,
      route: 'bridge.agent-routing.send',
      exact_blocker: 'opencloud_hidden_intermediary_forbidden',
      envelope,
      visible_task_id: envelope.visible_task_id,
      project_continues: true,
      credential_values_exposed: false,
    }
  }

  logAuditEvent({
    action: 'agent_routing.direct_line_message',
    actor: envelope.target_agent,
    target_type: 'agent_line',
    target_id: Number(task.task_id),
    detail: {
      envelope,
      opencloud_policy: policy,
      credential_values_exposed: false,
    },
  })

  return {
    ok: true,
    route: 'bridge.agent-routing.send',
    mode: 'direct_agent_line_envelope_recorded',
    envelope,
    visible_task_id: envelope.visible_task_id,
    audit_id: envelope.audit_id,
    rollback_id: envelope.rollback_id,
    project_continues: true,
    external_writes_enabled: false,
    credential_values_exposed: false,
  }
}

export function auditOpenCloudReferences(rows: Array<{ file: string; text: string; route?: string | null }>) {
  return rows
    .filter((row) => /opencloud|openclaw|claudeclaw/i.test(row.text))
    .map((row) => {
      const text = row.text.toLowerCase()
      const explicitlyDemoted = /(not|never|must not|cannot|can't|no)\s+.{0,80}(commander|conversation owner|dispatcher|interpreter|telegram identity|agent identity|hidden intermediary|owner)|supporting (runtime|tool)|tool-only|supporting_tool_only|supporting runtime/.test(text)
      const wrong = !explicitlyDemoted && (
        /open(cloud|claw)\W+.{0,80}(commander|owner[-_\s]?operator|conversation owner|hidden dispatcher|telegram identity|agent identity proxy)/.test(text)
        || /(owner|jarvis|hermes|pi|paperclip|spaceagent)\W+.{0,80}(routes? through|via|before)\W+.{0,40}open(cloud|claw)/.test(text)
        || /open(cloud|claw)\W+.{0,80}(answers as|decides routing|routes owner|receives all owner|commands jarvis|commands hermes|commands pi|commands paperclip)/.test(text)
        || /routes_through_open(cloud|claw)|before_open(cloud|claw)/.test(text)
      )
      return {
        wrong_reference: wrong,
        file: row.file,
        route: row.route || null,
        current_behavior: row.text.slice(0, 500),
        required_correction: wrong
          ? 'OpenCloud/OpenClaw must be supporting runtime/tool-only and must not appear as commander, hidden intermediary, or conversation owner.'
          : 'Reference is acceptable only if it describes supporting runtime/tool-provider status.',
      }
    })
}
