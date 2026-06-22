import { buildExecutionReadinessEntries } from '@/lib/execution-readiness-matrix'
import { RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'

type InventoryState =
  | 'healthy'
  | 'configured'
  | 'full_access_delegated'
  | 'read_only'
  | 'credential_gated'
  | 'not_connected'
  | 'degraded'
  | 'owner_gated'
  | 'bridge_gated'
  | 'service_down'
  | 'blocked'

type InventoryItem = {
  id: string
  label: string
  status: InventoryState
  endpoint?: string
  visible_to_gateway: boolean
  visible_to_paperclip: boolean
  execution_allowed: boolean
  write_allowed: boolean
  bridge_required: boolean
  adapter_present: boolean
  credential_policy: string
  exact_blocker: string | null
}

const providers: InventoryItem[] = [
  { id: 'claude_cli', label: 'Claude CLI', status: 'read_only', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'local_adapter_no_secret_values_exposed', exact_blocker: 'provider_execution_requires_bridge_session' },
  { id: 'openrouter', label: 'OpenRouter', status: 'credential_gated', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'openrouter_credential_required', exact_blocker: 'credential_required' },
  { id: 'ollama', label: 'Ollama', status: 'service_down', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'local_service_required_no_secret_values', exact_blocker: 'service_down' },
  { id: 'openai', label: 'OpenAI API', status: 'credential_gated', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'openai_api_key_required_through_secret_path', exact_blocker: 'credential_required' },
  { id: 'nvidia', label: 'NVIDIA', status: 'credential_gated', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'nvidia_credential_required_through_secret_path', exact_blocker: 'credential_required' },
]

const models: InventoryItem[] = providers.map((provider) => ({
  ...provider,
  id: `${provider.id}_models`,
  label: `${provider.label} models`,
}))

const skills: InventoryItem[] = [
  { id: 'browser-use', label: 'Browser Use', status: 'read_only', endpoint: '/api/skills', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'skill_inventory_read_only', exact_blocker: 'skill_execution_requires_bridge_session' },
  { id: 'watch-video', label: 'Watch Video', status: 'read_only', endpoint: '/api/skills', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'skill_inventory_read_only', exact_blocker: 'skill_execution_requires_bridge_session' },
  { id: 'brain-sync', label: 'Brain Sync', status: 'bridge_gated', endpoint: '/api/skills', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'brain_writes_owner_approval_required', exact_blocker: 'bridge_session_required' },
]

const mcpTools: InventoryItem[] = [
  { id: 'mcp-tools', label: 'MCP Tools', status: 'read_only', endpoint: '/api/mcp/servers', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'mcp_inventory_no_direct_secret_access', exact_blocker: 'mcp_tool_invocation_requires_bridge_session' },
  { id: 'zapier-mcp', label: 'Zapier MCP', status: 'configured', endpoint: '/api/bridge/zapier/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: true, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'zapier_mcp_brokered_no_secret_values', exact_blocker: null },
  { id: 'firecrawl-mcp', label: 'FireCrawl MCP', status: 'credential_gated', endpoint: '/api/mcp/servers', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'firecrawl_credential_required', exact_blocker: 'credential_required' },
]

const integrations: InventoryItem[] = [
  { id: 'zapier', label: 'Zapier', status: 'configured', endpoint: '/api/bridge/zapier/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: true, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'zapier_mcp_brokered_no_secret_values', exact_blocker: null },
  { id: 'n8n', label: 'n8n', status: 'credential_gated', endpoint: '/api/n8n/workflows', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'n8n_base_url_and_api_key_required', exact_blocker: 'credential_required' },
  { id: 'heygen', label: 'HeyGen through Zapier', status: 'bridge_gated', endpoint: '/api/bridge/zapier-heygen-readiness', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'heygen_and_zapier_credentials_required', exact_blocker: 'credential_required' },
  { id: 'telegram', label: 'Telegram', status: 'bridge_gated', endpoint: '/api/bridge/telegram-readiness', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'telegram_secret_path_required', exact_blocker: 'bridge_session_required' },
  { id: 'agentmail', label: 'AgentMail', status: 'read_only', endpoint: '/api/bridge/agentmail-readiness', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'send_requires_bridge_session', exact_blocker: 'bridge_session_required' },
  { id: 'google-drive', label: 'Google Drive', status: 'bridge_gated', endpoint: '/api/bridge/google-drive-readiness', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'oauth_required_for_uploads', exact_blocker: 'bridge_session_required' },
  { id: 'onedrive', label: 'OneDrive', status: 'bridge_gated', endpoint: '/api/bridge/onedrive-readiness', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'oauth_required_for_uploads', exact_blocker: 'bridge_session_required' },
]

const agents: InventoryItem[] = [
  { id: 'agent_zero_jarvis', label: 'Agent Zero (Jarvis)', status: 'healthy', endpoint: '/api/bridge/agent-zero/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: true, write_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', exact_blocker: 'owner_hard_stops_only_remaining' },
  { id: 'pi_gateway_agent', label: 'Pi', status: 'full_access_delegated', endpoint: '/api/bridge/pi/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: true, write_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_names_only_no_secret_values', exact_blocker: 'production_execution_requires_jarvis_concurrence' },
  { id: 'hermes', label: RON_WEASLEY_IDENTITY.full_title, status: 'full_access_delegated', endpoint: '/api/bridge/hermes/full-access/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: true, write_allowed: true, bridge_required: true, adapter_present: true, credential_policy: 'no_direct_secret_access_jarvis_brokered', exact_blocker: 'jarvis_signed_exact_scope_delegation_required' },
  { id: 'paperclip', label: 'Paperclip ECO', status: 'read_only', endpoint: '/api/bridge/paperclip/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'paperclip_login_required_no_password_storage', exact_blocker: 'paperclip_writes_bridge_gated' },
  { id: 'spaceagent', label: 'SpaceAgent', status: 'configured', endpoint: '/api/bridge/spaceagent/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: true, credential_policy: 'gateway_brokered_no_secret_values', exact_blocker: 'production_execution_requires_jarvis_concurrence' },
  { id: 'openclaw_plus', label: 'OpenClaw+', status: 'degraded', endpoint: '/api/openclaw-plus/status', visible_to_gateway: true, visible_to_paperclip: true, execution_allowed: false, write_allowed: false, bridge_required: true, adapter_present: false, credential_policy: 'owner_tunnel_only_no_public_exposure', exact_blocker: 'openclaw_doctor_runtime_not_reachable' },
]

function summarize(items: InventoryItem[]) {
  return {
    total: items.length,
    visible_to_paperclip: items.filter((item) => item.visible_to_paperclip).length,
    execution_allowed: items.filter((item) => item.execution_allowed).length,
    write_allowed: items.filter((item) => item.write_allowed).length,
    bridge_required: items.filter((item) => item.bridge_required).length,
    blocked_or_gated: items.filter((item) => item.exact_blocker).length,
  }
}

export function buildPaperclipGatewayInventory(_companyScope = 'ECO') {
  const executionReadinessEntries = buildExecutionReadinessEntries()
  const zapierVisible = [...integrations, ...mcpTools, ...executionReadinessEntries].some((item) => item.id.toLowerCase().includes('zapier'))
  const n8nVisible = [...integrations, ...executionReadinessEntries].some((item) => item.id.toLowerCase().includes('n8n'))
  const zapier = {
    visible: zapierVisible,
    status: zapierVisible ? 'configured' : 'not_connected',
    execution_allowed: zapierVisible,
    write_allowed: false,
    bridge_required: true,
    adapter_present: zapierVisible,
    reason: zapierVisible
      ? 'Zapier is visible in Gateway and connected/configured. Certified exact-scope Zapier actions are available; broad Zap creation, live social posting, and arbitrary execution require approved scope.'
      : 'Zapier is not registered in the current Gateway inventory.',
    exact_blockers: zapierVisible
      ? []
      : ['not_registered_in_gateway'],
  }
  const n8n = {
    visible: n8nVisible,
    status: n8nVisible ? 'credential_gated' : 'not_connected',
    execution_allowed: false,
    write_allowed: false,
    bridge_required: true,
    adapter_present: false,
    reason: n8nVisible
      ? 'n8n is visible in Gateway but workflows are credential-gated and execution is Bridge-gated.'
      : 'n8n is not registered in the current Gateway inventory.',
    exact_blockers: n8nVisible
      ? ['credential_required', 'bridge_session_required', 'adapter_missing']
      : ['not_registered_in_gateway'],
  }

  return {
    company_scope: 'ECO',
    route: 'bridge.paperclip.gateway-inventory',
    source_endpoints: {
      capability_matrix: '/api/bridge/capability-matrix',
      provider_registry: '/api/bridge/providers',
      mcp_servers: '/api/mcp/servers',
      mcp_readiness: '/api/bridge/mcp-readiness',
      skills: '/api/skills',
      connector_readiness: '/api/bridge/connector-readiness',
      zapier_readiness: '/api/bridge/zapier-heygen-readiness',
      bridge_readiness: '/api/bridge/approval-requests',
    },
    providers,
    models,
    skills,
    mcp_tools: mcpTools,
    integrations,
    agents,
    execution_readiness_matrix: {
      entries: executionReadinessEntries.map((entry) => ({
        ...entry,
        visible_to_paperclip: entry.visible_to_gateway,
      })),
      summary: summarize(executionReadinessEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        status: entry.health,
        endpoint: entry.endpoint,
        visible_to_gateway: entry.visible_to_gateway,
        visible_to_paperclip: entry.visible_to_gateway,
        execution_allowed: entry.execution_allowed,
        write_allowed: entry.write_allowed,
        bridge_required: entry.bridge_required,
        adapter_present: entry.adapter_present,
        credential_policy: entry.credential_policy,
        exact_blocker: entry.exact_blocker,
      }))),
    },
    zapier,
    n8n,
    bridge_policy: {
      read_visible: true,
      writes_bridge_gated: true,
      execution_requires_bridge_session: true,
      protected_action_result: 'WRITES_BRIDGE_GATED',
      approval_request_only_no_execution: true,
    },
    paperclip_agent_context: {
      company_scope: 'ECO',
      target_agents: ['CEO', 'CMO', 'CTO', 'Avatar Specialist', 'Field Service Advisor', 'Social Coordinator', 'Video Producer'],
      gateway_rule: 'Mission Control Gateway is the source of truth for models/tools/providers. If Zapier is visible with guardrails, say it is visible, connected/configured, and exact-scope approved rather than blocked or missing.',
      zapier_answer_template: zapier.reason,
      n8n_answer_template: n8n.reason,
      runtime_context_hook_status: 'ready_for_paperclip_runtime',
    },
    summaries: {
      providers: summarize(providers),
      models: summarize(models),
      skills: summarize(skills),
      mcp_tools: summarize(mcpTools),
      integrations: summarize(integrations),
      agents: summarize(agents),
    },
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    no_zapier_writes: true,
    no_paperclip_writes: true,
    no_tok_routing_change: true,
    next_action: 'Expose this read-only Gateway inventory to Paperclip ECO agent context. Keep Zapier and Paperclip writes Bridge-gated.',
  }
}

export function buildPaperclipGatewayInventorySummary() {
  const inventory = buildPaperclipGatewayInventory()
  return {
    company_scope: inventory.company_scope,
    endpoint: '/api/bridge/paperclip/gateway-inventory',
    providers_visible: inventory.summaries.providers.visible_to_paperclip,
    models_visible: inventory.summaries.models.visible_to_paperclip,
    skills_visible: inventory.summaries.skills.visible_to_paperclip,
    mcp_tools_visible: inventory.summaries.mcp_tools.visible_to_paperclip,
    integrations_visible: inventory.summaries.integrations.visible_to_paperclip,
    zapier: inventory.zapier,
    n8n: inventory.n8n,
    bridge_policy: inventory.bridge_policy,
    paperclip_agent_context: inventory.paperclip_agent_context,
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildPaperclipAgentContext() {
  const inventory = buildPaperclipGatewayInventory()
  const targetAgents = inventory.paperclip_agent_context.target_agents
  const ceoAnswer = [
    'Zapier is visible in Gateway.',
    `Current status is ${inventory.zapier.status}.`,
    'Connection-probe execution is enabled through Jarvis exact-scope Bridge Session.',
    'Paperclip can see the read-only Gateway inventory but cannot execute Zapier writes.',
    'Broad Zap creation, live social posting, and arbitrary Zapier execution require approved scope.',
  ].join(' ')

  return {
    route: 'bridge.paperclip.agent-context',
    company_scope: 'ECO',
    context_injection_status: 'ready_for_paperclip_runtime',
    target_agents: targetAgents,
    mission_control_gateway_inventory_summary: {
      company_scope: inventory.company_scope,
      providers: inventory.providers.map(({ id, label, status, execution_allowed, write_allowed, bridge_required, credential_policy, exact_blocker }) => ({
        id,
        label,
        status,
        execution_allowed,
        write_allowed,
        bridge_required,
        credential_policy,
        exact_blocker,
      })),
      models: inventory.models.map(({ id, label, status, execution_allowed, write_allowed, bridge_required, exact_blocker }) => ({
        id,
        label,
        status,
        execution_allowed,
        write_allowed,
        bridge_required,
        exact_blocker,
      })),
      skills: inventory.skills.map(({ id, label, status, execution_allowed, write_allowed, bridge_required, exact_blocker }) => ({
        id,
        label,
        status,
        execution_allowed,
        write_allowed,
        bridge_required,
        exact_blocker,
      })),
      mcp_tools: inventory.mcp_tools.map(({ id, label, status, execution_allowed, write_allowed, bridge_required, exact_blocker }) => ({
        id,
        label,
        status,
        execution_allowed,
        write_allowed,
        bridge_required,
        exact_blocker,
      })),
      integrations: inventory.integrations.map(({ id, label, status, execution_allowed, write_allowed, bridge_required, exact_blocker }) => ({
        id,
        label,
        status,
        execution_allowed,
        write_allowed,
        bridge_required,
        exact_blocker,
      })),
      zapier: inventory.zapier,
      n8n: inventory.n8n,
      bridge_policy: inventory.bridge_policy,
      visible: {
        providers: inventory.summaries.providers.visible_to_paperclip,
        models: inventory.summaries.models.visible_to_paperclip,
        skills: inventory.summaries.skills.visible_to_paperclip,
        mcp_tools: inventory.summaries.mcp_tools.visible_to_paperclip,
        integrations: inventory.summaries.integrations.visible_to_paperclip,
      },
      executable: {
        providers: inventory.summaries.providers.execution_allowed,
        models: inventory.summaries.models.execution_allowed,
        skills: inventory.summaries.skills.execution_allowed,
        mcp_tools: inventory.summaries.mcp_tools.execution_allowed,
        integrations: inventory.summaries.integrations.execution_allowed,
      },
      credential_gated: ['openrouter', 'openai', 'nvidia', 'n8n', 'firecrawl-mcp'],
      bridge_gated: ['brain-sync', 'heygen', 'telegram', 'google-drive', 'onedrive'],
    },
    context_markdown: [
      'Mission Control Gateway inventory for ECO is visible read-only.',
      'Gateway is the source of truth for providers, models, skills, MCP/NCP tools, integrations, Zapier status, n8n status, and Bridge policy.',
      `Target ECO Paperclip agents receiving this summary: ${targetAgents.join(', ')}.`,
      inventory.zapier.reason,
      inventory.n8n.reason,
      'If Zapier is visible with guardrails, say it is visible, connected/configured, and exact-scope approved. Do not describe Zapier as missing unless the inventory route fails.',
      'Do not execute Zapier, n8n workflows, MCP tools, provider/model calls, Paperclip tasks, comments, or issue mutations from this context.',
      'Protected action result: WRITES_BRIDGE_GATED.',
    ].join('\n'),
    ceo_test_question: 'Do we have Zapier? Check the Gateway on Mission Control.',
    ceo_expected_answer: ceoAnswer,
    zapier_answer_behavior: inventory.zapier.visible ? 'visible_configured_connection_probe_certified_write_gated' : 'not_registered_in_gateway',
    n8n_visibility_behavior: inventory.n8n.visible ? 'visible_credential_gated_bridge_gated' : 'not_registered_in_gateway',
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    paperclip_writes_enabled: false,
    zapier_execution_enabled: false,
    n8n_execution_enabled: false,
    no_paperclip_task_created: true,
    no_paperclip_comment_created: true,
    no_issue_modified: true,
  }
}
